//! SEQ-04 entity deletion/conversion, relationship updates, and recoverable storage.

use log::{info, warn};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// [REQ-04-RULE-028][REQ-04-RULE-029] Confirmed deletion request carrying the
/// client's stale-checked affected FACTs, replacement EXPERIENCE, child parent
/// reassignments, and per-LINK delete/retain decisions.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRequest {
    entity_type: String,
    entity_id: Uuid,
    fact_ids: Vec<Uuid>,
    replacement_experience_id: Option<Uuid>,
    child_parents: Vec<ChildParent>,
    link_decisions: Vec<LinkDecision>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChildParent {
    child_id: Uuid,
    parent_id: Uuid,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkDecision {
    link_id: Uuid,
    delete: bool,
}

/// [REQ-04-RULE-029] Deletion outcome exposing the recoverable archive path
/// under `.hasm/deleted/<operation-id>/` and an optional non-fatal warning.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResult {
    archive_path: String,
    warning: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct ArchiveEntry {
    entity_type: String,
    entity_id: Uuid,
    metadata: HashMap<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
struct ArchiveManifest {
    entries: Vec<ArchiveEntry>,
    #[serde(default)]
    conversion: Option<ConversionState>,
}

#[derive(Serialize, Deserialize)]
struct ConversionState {
    target_type: String,
    target_id: Uuid,
    keep_original: bool,
}

/// [REQ-04-RULE-030] Reviewed FACT/EXPERIENCE conversion with optional source
/// retention, target memberships/owner/date, and source Markdown freshness.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertRequest {
    entity_type: String,
    entity_id: Uuid,
    keep_original: bool,
    experience_ids: Vec<Uuid>,
    person_id: Option<Uuid>,
    occurred_at: Option<String>,
    loaded_mtime_ms: u64,
}

/// [REQ-04-RULE-030] Conversion destination and recoverable archive information.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertResult {
    entity_type: String,
    entity_id: Uuid,
    archive_path: Option<String>,
    warning: Option<String>,
}

/// [REQ-04-RULE-030] Converts FACT/EXPERIENCE on a worker with atomic database
/// changes and recoverable folder staging; dependent EXPERIENCES require copying.
#[tauri::command]
pub async fn convert_entity(path: String, request: ConvertRequest) -> Result<ConvertResult, String> {
    let result = tauri::async_runtime::spawn_blocking(move || convert_entity_inner(&path, request))
        .await.map_err(|error| format!("Conversion worker failed: {error}"))?;
    match &result {
        Ok(_) => info!("[SEQ-MD-04][CONVERT] entity conversion committed"),
        Err(error) => warn!("[SEQ-MD-04][CONVERT] entity conversion failed: {error}"),
    }
    result
}

fn convert_entity_inner(path: &str, request: ConvertRequest) -> Result<ConvertResult, String> {
    let root = PathBuf::from(path);
    plain_directory(&root)?;
    require_owned_lock(&root)?;
    let target_type = match request.entity_type.as_str() {
        "FACT" => "EXPERIENCE",
        "EXPERIENCE" => "FACT",
        _ => return Err("Only FACT and EXPERIENCE can be converted.".into()),
    };
    let (source_table, source_key) = entity_table(&request.entity_type)?;
    let (target_table, target_key) = entity_table(target_type)?;
    plain_directory(&root.join(target_type))?;
    let mut connection = crate::hasm::service::open_connection(&root)?;
    let transaction = connection.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    require_owned_lock(&root)?;
    let entry = archive_entry(&transaction, &request.entity_type, request.entity_id)?;
    let source_dir = root.join(&request.entity_type).join(request.entity_id.to_string());
    plain_directory(&source_dir)?;
    plain_directory(&source_dir.join("assets"))?;
    let description_key = format!("{source_table}_description_path");
    let stored_path = metadata_text(&entry, &description_key)?;
    let markdown_path = if stored_path.is_empty() { source_dir.join("main.md") } else { root.join(stored_path) };
    let canonical = fs::canonicalize(&markdown_path).map_err(|error| format!("Cannot read source Markdown: {error}"))?;
    if !canonical.starts_with(fs::canonicalize(&source_dir).map_err(|error| error.to_string())?) {
        return Err("Source Markdown must be inside its entity folder before conversion.".into());
    }
    let metadata = fs::metadata(&markdown_path).map_err(|error| error.to_string())?;
    let mtime = metadata.modified().map_err(|error| error.to_string())?
        .duration_since(std::time::UNIX_EPOCH).map_err(|error| error.to_string())?.as_millis();
    if mtime != u128::from(request.loaded_mtime_ms) {
        return Err("Markdown changed; refresh the ticket before converting.".into());
    }
    let name = metadata_text(&entry, &format!("{source_table}_name"))?;
    if name.trim().is_empty() { return Err("Entity name must not be empty.".into()); }
    let external_links: Vec<String> = metadata_array(&entry, "link")?;
    crate::hasm::definitions::validate_external_links(&external_links)?;
    let link_ids: Vec<Uuid> = metadata_array(&entry, "link_ids")?;
    let links = read_references(&transaction, "link", "link_id", "related_ids")?;
    if link_ids.iter().any(|id| !links.contains_key(id)) {
        return Err("A referenced LINK is missing; repair the workspace before converting.".into());
    }
    let source_relationships = if request.entity_type == "FACT" { "experience_ids" } else { "parent_experience_ids" };
    let _: Vec<Uuid> = metadata_array(&entry, source_relationships)?;
    let memberships = unique_set(request.experience_ids.clone())
        .map_err(|error| format!("Invalid conversion EXPERIENCE choices: {error}"))?;
    for id in &memberships {
        if !row_exists(&transaction, "experience", "experience_id", *id)? {
            return Err("Choose existing EXPERIENCE relationships.".into());
        }
        if !request.keep_original && *id == request.entity_id {
            return Err("A converted entity cannot belong to its archived EXPERIENCE.".into());
        }
    }
    let source_people: Vec<Uuid> = if request.entity_type == "FACT" {
        metadata_array(&entry, "person_ids")?
    } else {
        let owner = Uuid::parse_str(metadata_text(&entry, "person_id")?).map_err(|error| error.to_string())?;
        if owner.is_nil() { Vec::new() } else { vec![owner] }
    };
    let people = if target_type == "EXPERIENCE" {
        request.person_id.filter(|id| !id.is_nil()).into_iter().collect::<Vec<_>>()
    } else { source_people };
    for id in &people {
        if !row_exists(&transaction, "person", "person_id", *id)? {
            return Err("Choose an existing PERSON owner.".into());
        }
    }
    if !request.keep_original && request.entity_type == "EXPERIENCE" {
        let facts = read_references(&transaction, "fact", "fact_id", "experience_ids")?;
        let parents = read_references(&transaction, "experience", "experience_id", "parent_experience_ids")?;
        let owner = Uuid::parse_str(metadata_text(&entry, "person_id")?).map_err(|error| error.to_string())?;
        if !owner.is_nil() || facts.values().any(|ids| ids.contains(&request.entity_id))
            || parents.values().any(|ids| ids.contains(&request.entity_id)) {
            return Err("This EXPERIENCE has dependent FACTs, children, or PERSON ownership. Keep the original to create a FACT.".into());
        }
    }
    let occurred_at = request.occurred_at.as_deref().unwrap_or("");
    if target_type == "FACT" && !occurred_at.is_empty() {
        crate::hasm::entity_creation_commands::validate_birth_date(occurred_at)
            .map_err(|error| format!("Invalid FACT occurrence date: {error}"))?;
    }
    let target_id = if request.keep_original { Uuid::new_v4() } else { request.entity_id };
    for (table, key) in [("person", "person_id"), ("experience", "experience_id"), ("fact", "fact_id"), ("link", "link_id")] {
        if (request.keep_original || table != source_table) && row_exists(&transaction, table, key, target_id)? {
            return Err("Conversion target UUID already exists.".into());
        }
    }
    let destination = root.join(target_type).join(target_id.to_string());
    if destination.exists() { return Err("Conversion target folder already exists.".into()); }
    let markdown = fs::read_to_string(&markdown_path).map_err(|error| format!("Cannot read source Markdown: {error}"))?;
    let converted_markdown = conversion_markdown(&markdown, target_type, target_id, name)?;
    let conversion = ConversionState { target_type: target_type.into(), target_id, keep_original: request.keep_original };
    let archive = prepare_archive(&root, std::slice::from_ref(&entry), Some(conversion))?;
    let operation = (|| -> Result<(), String> {
        let staged = archive.join("target");
        copy_entity_directory(&source_dir, &staged)?;
        fs::write(staged.join("main.md"), converted_markdown).map_err(|error| error.to_string())?;
        let relative_path = format!("{target_type}/{target_id}/main.md");
        let relationships = serde_json::to_string(&request.experience_ids).map_err(|error| error.to_string())?;
        let serialized_links = serde_json::to_string(&link_ids).map_err(|error| error.to_string())?;
        let urls = serde_json::to_string(&external_links).map_err(|error| error.to_string())?;
        if target_type == "EXPERIENCE" {
            transaction.execute(
                "INSERT INTO experience (experience_id, person_id, experience_name, experience_description_path, parent_experience_ids, link_ids, link) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![target_id.to_string(), people.first().copied().unwrap_or_else(Uuid::nil).to_string(), name, relative_path, relationships, serialized_links, urls],
            ).map_err(|error| error.to_string())?;
        } else {
            transaction.execute(
                "INSERT INTO fact (fact_id, fact_name, occurred_at, fact_description_path, experience_ids, person_ids, link_ids, link) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![target_id.to_string(), name, occurred_at, relative_path, relationships, serde_json::to_string(&people).map_err(|error| error.to_string())?, serialized_links, urls],
            ).map_err(|error| error.to_string())?;
        }
        if request.keep_original {
            for (id, endpoints) in &links {
                if endpoints.contains(&request.entity_id) || link_ids.contains(id) {
                    let mut next = endpoints.clone();
                    if !next.contains(&target_id) { next.push(target_id); }
                    write_references(&transaction, "link", "link_id", "related_ids", *id, &next)?;
                }
            }
        } else {
            transaction.execute(&format!("DELETE FROM {source_table} WHERE {source_key} = ?1"), [request.entity_id.to_string()])
                .map_err(|error| error.to_string())?;
            move_to_archive(&root, &archive, std::slice::from_ref(&entry))?;
        }
        require_owned_lock(&root)?;
        fs::rename(staged, &destination).map_err(|error| format!("Cannot install converted folder: {error}"))?;
        Ok(())
    })();
    if let Err(error) = operation {
        transaction.rollback().map_err(|rollback| format!("{error}; database rollback failed: {rollback}"))?;
        recover_pending_archives(&root, &connection)
            .map_err(|recovery| format!("{error}; conversion recovery required: {recovery}"))?;
        return Err(error);
    }
    let mut warning = None;
    if let Err(error) = transaction.commit() {
        recover_pending_archives(&root, &connection)
            .map_err(|recovery| format!("Conversion commit failed: {error}; recovery required: {recovery}"))?;
        if !row_exists(&connection, target_table, target_key, target_id)? {
            return Err(format!("Conversion rolled back after commit failure: {error}"));
        }
        warning = Some(format!("Conversion committed after a database error; verify the workspace: {error}"));
    } else if let Err(error) = fs::rename(archive.join("pending.json"), archive.join("complete.json")) {
        warning = Some(format!("Conversion succeeded, but archive finalization needs recovery: {error}"));
    }
    if let Some(message) = &warning { warn!("[SEQ-MD-04][CONVERT] {message}"); }
    Ok(ConvertResult {
        entity_type: target_type.into(), entity_id: target_id,
        archive_path: (!request.keep_original).then(|| archive.to_string_lossy().to_string()), warning,
    })
}

fn metadata_text<'a>(entry: &'a ArchiveEntry, key: &str) -> Result<&'a str, String> {
    entry.metadata.get(key).and_then(serde_json::Value::as_str)
        .ok_or_else(|| format!("Invalid source metadata: {key}"))
}

fn metadata_array<T: serde::de::DeserializeOwned>(entry: &ArchiveEntry, key: &str) -> Result<T, String> {
    serde_json::from_str(metadata_text(entry, key)?).map_err(|error| format!("Invalid source {key}: {error}"))
}

fn copy_entity_directory(source: &Path, destination: &Path) -> Result<(), String> {
    plain_directory(source)?;
    fs::create_dir(destination).map_err(|error| format!("Cannot stage conversion: {error}"))?;
    for item in fs::read_dir(source).map_err(|error| error.to_string())? {
        let item = item.map_err(|error| error.to_string())?;
        let kind = item.file_type().map_err(|error| error.to_string())?;
        let target = destination.join(item.file_name());
        if kind.is_dir() { copy_entity_directory(&item.path(), &target)?; }
        else if kind.is_file() { fs::copy(item.path(), target).map_err(|error| error.to_string())?; }
        else { return Err("Conversion cannot copy symlinks or special files.".into()); }
    }
    Ok(())
}

fn conversion_markdown(markdown: &str, entity_type: &str, id: Uuid, name: &str) -> Result<String, String> {
    let identity = format!("entity_type: {entity_type}\nentity_id: {id}\n");
    let mut lines = markdown.split_inclusive('\n');
    if lines.next().map(str::trim) != Some("---") {
        return Ok(format!("---\n{identity}name: {}\n---\n\n{markdown}", serde_json::to_string(name).map_err(|error| error.to_string())?));
    }
    let mut result = format!("---\n{identity}");
    for line in lines.by_ref() {
        if line.trim() == "---" {
            result.push_str(line);
            result.extend(lines);
            return Ok(result);
        }
        if !line.starts_with("entity_type:") && !line.starts_with("entity_id:") { result.push_str(line); }
    }
    Err("Source Markdown has an unterminated FrontMatter block.".into())
}

/// [REQ-04-RULE-028][REQ-04-RULE-029] Deletes an EXPERIENCE, FACT, or LINK
/// transactionally: revalidates lock/choices against current storage, updates
/// related LINKs and FACT/child reassignments, and archives deleted folders
/// and rows under `.hasm/deleted/<operation-id>/` instead of erasing them.
#[tauri::command]
pub async fn delete_entity(path: String, request: DeleteRequest) -> Result<DeleteResult, String> {
    let result = tauri::async_runtime::spawn_blocking(move || delete_entity_inner(&path, request))
        .await.map_err(|error| format!("Deletion worker failed: {error}"))?;
    match &result {
        Ok(_) => info!("[SEQ-MD-04][DELETE] entity deletion committed"),
        Err(error) => warn!("[SEQ-MD-04][DELETE] entity deletion failed: {error}"),
    }
    result
}

fn delete_entity_inner(path: &str, request: DeleteRequest) -> Result<DeleteResult, String> {
    let root = PathBuf::from(path);
    if !root.is_dir() {
        return Err("Workspace directory does not exist.".into());
    }
    require_owned_lock(&root)?;
    let (table, id_column) = entity_table(&request.entity_type)?;
    let mut connection = crate::hasm::service::open_connection(&root)?;
    let transaction = connection.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    require_owned_lock(&root)?;
    if !row_exists(&transaction, table, id_column, request.entity_id)? {
        return Err("Entity no longer exists; reload the workspace.".into());
    }

    let experiences = read_references(&transaction, "experience", "experience_id", "parent_experience_ids")?;
    let facts = read_references(&transaction, "fact", "fact_id", "experience_ids")?;
    let links = read_references(&transaction, "link", "link_id", "related_ids")?;
    let target_link_ids = if request.entity_type == "LINK" {
        Vec::new()
    } else {
        read_references(&transaction, table, id_column, "link_ids")?
            .remove(&request.entity_id).ok_or("Entity no longer exists; reload the workspace.")?
    };
    let mut related_links: HashSet<Uuid> = links.iter()
        .filter_map(|(id, endpoints)| endpoints.contains(&request.entity_id).then_some(*id))
        .collect();
    for id in target_link_ids {
        if !links.contains_key(&id) {
            return Err("A referenced LINK is missing; repair the workspace before deleting.".into());
        }
        related_links.insert(id);
    }
    if request.entity_type == "LINK" {
        related_links.clear();
    }
    let decisions = unique_map(request.link_decisions.into_iter().map(|item| (item.link_id, item.delete)))?;
    if decisions.keys().copied().collect::<HashSet<_>>() != related_links {
        return Err("Related LINKs changed; reload the workspace before deleting.".into());
    }

    let affected_facts: HashSet<Uuid> = if request.entity_type == "EXPERIENCE" {
        facts.iter().filter_map(|(id, ids)| ids.contains(&request.entity_id).then_some(*id)).collect()
    } else {
        HashSet::new()
    };
    if unique_set(request.fact_ids)? != affected_facts {
        return Err("Belonging FACTs changed; reload the workspace before deleting.".into());
    }
    let replacement = request.replacement_experience_id;
    if let Some(id) = replacement {
        if id == request.entity_id || !experiences.contains_key(&id) {
            return Err("Choose an existing replacement EXPERIENCE.".into());
        }
    }
    for id in &affected_facts {
        let current = &facts[id];
        if !current.iter().any(|value| *value != request.entity_id && experiences.contains_key(value)) && replacement.is_none() {
            return Err("Choose a replacement EXPERIENCE for FACTs without another EXPERIENCE.".into());
        }
    }
    let affected_children: HashSet<Uuid> = if request.entity_type == "EXPERIENCE" {
        experiences.iter().filter_map(|(id, ids)| (*id != request.entity_id && ids.contains(&request.entity_id)).then_some(*id)).collect()
    } else {
        HashSet::new()
    };
    let child_parents = unique_map(request.child_parents.into_iter().map(|item| (item.child_id, item.parent_id)))?;
    if child_parents.keys().copied().collect::<HashSet<_>>() != affected_children {
        return Err("Child EXPERIENCES changed or a replacement parent is missing.".into());
    }
    let mut updated_parents = experiences.clone();
    for (child, parent) in &child_parents {
        if *parent == request.entity_id || !experiences.contains_key(parent) {
            return Err("Choose an existing replacement parent.".into());
        }
        let parents = updated_parents.get_mut(child).ok_or("Child EXPERIENCE no longer exists.")?;
        parents.retain(|id| *id != request.entity_id);
        if !parents.contains(parent) { parents.push(*parent); }
    }
    for (child, parent) in &child_parents {
        if reaches(*parent, *child, request.entity_id, &updated_parents) {
            return Err("Choose a replacement parent that does not create an EXPERIENCE cycle.".into());
        }
    }

    let mut deleted_links: HashSet<Uuid> = decisions.into_iter()
        .filter_map(|(id, delete)| delete.then_some(id)).collect();
    if request.entity_type == "LINK" {
        deleted_links.insert(request.entity_id);
    }
    let mut deleted_ids = deleted_links.clone();
    deleted_ids.insert(request.entity_id);
    let mut entries = vec![archive_entry(&transaction, &request.entity_type, request.entity_id)?];
    for id in &deleted_links {
        if *id != request.entity_id {
            entries.push(archive_entry(&transaction, "LINK", *id)?);
        }
    }

    for (id, current) in &facts {
        if affected_facts.contains(id) {
            let mut next: Vec<_> = current.iter().copied().filter(|value| *value != request.entity_id).collect();
            if let Some(value) = replacement {
                if !next.contains(&value) { next.push(value); }
            }
            write_references(&transaction, "fact", "fact_id", "experience_ids", *id, &next)?;
        }
    }
    for (id, current) in &experiences {
        if let Some(parent) = child_parents.get(id) {
            let mut next: Vec<_> = current.iter().copied().filter(|value| *value != request.entity_id).collect();
            if !next.contains(parent) { next.push(*parent); }
            write_references(&transaction, "experience", "experience_id", "parent_experience_ids", *id, &next)?;
        }
    }
    for (id, current) in &links {
        if !deleted_links.contains(id) {
            let next: Vec<_> = current.iter().copied().filter(|value| !deleted_ids.contains(value)).collect();
            if next != *current {
                write_references(&transaction, "link", "link_id", "related_ids", *id, &next)?;
            }
        }
    }
    for (name, key) in [("person", "person_id"), ("experience", "experience_id"), ("fact", "fact_id")] {
        for (id, current) in read_references(&transaction, name, key, "link_ids")? {
            let next: Vec<_> = current.iter().copied().filter(|value| !deleted_links.contains(value)).collect();
            if next != current { write_references(&transaction, name, key, "link_ids", id, &next)?; }
        }
    }
    for entry in &entries {
        let (table, key) = entity_table(&entry.entity_type)?;
        transaction.execute(&format!("DELETE FROM {table} WHERE {key} = ?1"), [entry.entity_id.to_string()])
            .map_err(|error| error.to_string())?;
    }

    require_owned_lock(&root)?;
    let archive = prepare_archive(&root, &entries, None)?;
    if let Err(error) = move_to_archive(&root, &archive, &entries) {
        let rollback = restore_entries(&root, &archive, &entries);
        return Err(match rollback {
            Ok(()) => error,
            Err(restore_error) => format!("{error}; archive recovery required: {restore_error}"),
        });
    }
    if let Err(error) = transaction.commit() {
        recover_pending_archives(&root, &connection)
            .map_err(|recovery| format!("Database commit failed: {error}; archive recovery required: {recovery}"))?;
        if row_exists(&connection, table, id_column, request.entity_id)? {
            return Err(format!("Database commit failed and deletion was rolled back: {error}"));
        }
        let warning = format!("Deletion committed after a database error; verify the workspace: {error}");
        warn!("[SEQ-MD-04][DELETE] {warning}");
        return Ok(DeleteResult { archive_path: archive.to_string_lossy().to_string(), warning: Some(warning) });
    }
    let warning = fs::rename(archive.join("pending.json"), archive.join("complete.json"))
        .err().map(|error| format!("Deletion succeeded, but archive finalization needs recovery: {error}"));
    if let Some(message) = &warning { warn!("[SEQ-MD-04][DELETE] {message}"); }
    Ok(DeleteResult { archive_path: archive.to_string_lossy().to_string(), warning })
}

fn entity_table(entity_type: &str) -> Result<(&'static str, &'static str), String> {
    match entity_type {
        "EXPERIENCE" => Ok(("experience", "experience_id")),
        "FACT" => Ok(("fact", "fact_id")),
        "LINK" => Ok(("link", "link_id")),
        _ => Err("Only EXPERIENCE, FACT and LINK can be deleted.".into()),
    }
}

fn row_exists(connection: &Connection, table: &str, column: &str, id: Uuid) -> Result<bool, String> {
    connection.query_row(&format!("SELECT 1 FROM {table} WHERE {column} = ?1"), [id.to_string()], |row| row.get::<_, i64>(0))
        .optional().map(|value| value.is_some()).map_err(|error| error.to_string())
}

fn archive_entry(connection: &Connection, entity_type: &str, id: Uuid) -> Result<ArchiveEntry, String> {
    let (table, key) = entity_table(entity_type)?;
    let mut statement = connection.prepare(&format!("SELECT * FROM {table} WHERE {key} = ?1"))
        .map_err(|error| error.to_string())?;
    let columns: Vec<String> = statement.column_names().map(str::to_string).collect();
    let metadata = statement.query_row([id.to_string()], |row| {
        let mut values = HashMap::new();
        for (index, name) in columns.iter().enumerate() {
            let value = match row.get_ref(index)? {
                rusqlite::types::ValueRef::Null => serde_json::Value::Null,
                rusqlite::types::ValueRef::Integer(value) => value.into(),
                rusqlite::types::ValueRef::Real(value) => serde_json::Number::from_f64(value)
                    .map(serde_json::Value::Number).ok_or(rusqlite::Error::InvalidQuery)?,
                rusqlite::types::ValueRef::Text(value) => String::from_utf8(value.to_vec())
                    .map(serde_json::Value::String).map_err(|error| rusqlite::Error::FromSqlConversionFailure(index, rusqlite::types::Type::Text, Box::new(error)))?,
                rusqlite::types::ValueRef::Blob(_) => return Err(rusqlite::Error::InvalidQuery),
            };
            values.insert(name.clone(), value);
        }
        Ok(values)
    }).map_err(|error| format!("Cannot archive {entity_type} metadata: {error}"))?;
    Ok(ArchiveEntry { entity_type: entity_type.into(), entity_id: id, metadata })
}

fn read_references(connection: &Connection, table: &str, key: &str, column: &str) -> Result<HashMap<Uuid, Vec<Uuid>>, String> {
    let mut statement = connection.prepare(&format!("SELECT {key}, COALESCE({column}, '[]') FROM {table}"))
        .map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| error.to_string())?;
    let mut result = HashMap::new();
    for row in rows {
        let (id, references) = row.map_err(|error| error.to_string())?;
        let id = Uuid::parse_str(&id).map_err(|error| format!("Invalid {table} ID: {error}"))?;
        let references = serde_json::from_str(&references)
            .map_err(|error| format!("Invalid {table}.{column} for {id}: {error}"))?;
        result.insert(id, references);
    }
    Ok(result)
}

fn write_references(transaction: &Transaction<'_>, table: &str, key: &str, column: &str, id: Uuid, references: &[Uuid]) -> Result<(), String> {
    let json = serde_json::to_string(references).map_err(|error| error.to_string())?;
    transaction.execute(&format!("UPDATE {table} SET {column} = ?1 WHERE {key} = ?2"), params![json, id.to_string()])
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn unique_set(values: Vec<Uuid>) -> Result<HashSet<Uuid>, String> {
    let count = values.len();
    let set: HashSet<_> = values.into_iter().collect();
    if set.len() != count { return Err("Duplicate deletion choices.".into()); }
    Ok(set)
}

fn unique_map<T>(values: impl Iterator<Item = (Uuid, T)>) -> Result<HashMap<Uuid, T>, String> {
    let mut result = HashMap::new();
    for (id, value) in values {
        if result.insert(id, value).is_some() { return Err("Duplicate deletion choices.".into()); }
    }
    Ok(result)
}

fn reaches(start: Uuid, target: Uuid, deleted: Uuid, experiences: &HashMap<Uuid, Vec<Uuid>>) -> bool {
    let mut pending = vec![start];
    let mut visited = HashSet::new();
    while let Some(id) = pending.pop() {
        if id == target { return true; }
        if id != deleted && visited.insert(id) {
            if let Some(parents) = experiences.get(&id) { pending.extend(parents); }
        }
    }
    false
}

fn require_owned_lock(root: &Path) -> Result<(), String> {
    let contents = fs::read_to_string(root.join(".hasm").join("lock"))
        .map_err(|error| format!("Cannot verify workspace lock: {error}"))?;
    if contents.trim() != std::process::id().to_string() {
        return Err("Workspace is read-only or its lock is not owned by this process.".into());
    }
    Ok(())
}

fn plain_directory(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| format!("Cannot inspect {}: {error}", path.display()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(format!("Expected a non-symlink directory: {}", path.display()));
    }
    Ok(())
}

fn prepare_archive(root: &Path, entries: &[ArchiveEntry], conversion: Option<ConversionState>) -> Result<PathBuf, String> {
    plain_directory(&root.join(".hasm"))?;
    for entry in entries {
        plain_directory(&root.join(&entry.entity_type))?;
        plain_directory(&root.join(&entry.entity_type).join(entry.entity_id.to_string()))?;
    }
    let archive_root = root.join(".hasm").join("deleted");
    fs::create_dir_all(&archive_root).map_err(|error| format!("Cannot create archive: {error}"))?;
    plain_directory(&archive_root)?;
    let archive = archive_root.join(Uuid::new_v4().to_string());
    fs::create_dir(&archive).map_err(|error| format!("Cannot create archive: {error}"))?;
    let manifest = serde_json::to_vec(&ArchiveManifest { entries: entries.iter().map(|entry| ArchiveEntry {
        entity_type: entry.entity_type.clone(), entity_id: entry.entity_id, metadata: entry.metadata.clone(),
    }).collect(), conversion }).map_err(|error| error.to_string())?;
    let mut file = File::create(archive.join("pending.tmp")).map_err(|error| format!("Cannot write archive manifest: {error}"))?;
    file.write_all(&manifest).and_then(|_| file.sync_all()).map_err(|error| format!("Cannot write archive manifest: {error}"))?;
    fs::rename(archive.join("pending.tmp"), archive.join("pending.json"))
        .map_err(|error| format!("Cannot publish archive manifest: {error}"))?;
    Ok(archive)
}

fn move_to_archive(root: &Path, archive: &Path, entries: &[ArchiveEntry]) -> Result<(), String> {
    for entry in entries {
        let source = root.join(&entry.entity_type).join(entry.entity_id.to_string());
        let destination = archive.join(format!("{}-{}", entry.entity_type, entry.entity_id));
        fs::rename(&source, &destination).map_err(|error| format!("Cannot archive {}: {error}", source.display()))?;
    }
    Ok(())
}

fn restore_entries(root: &Path, archive: &Path, entries: &[ArchiveEntry]) -> Result<(), String> {
    for entry in entries {
        plain_directory(&root.join(&entry.entity_type))?;
        let source = archive.join(format!("{}-{}", entry.entity_type, entry.entity_id));
        let destination = root.join(&entry.entity_type).join(entry.entity_id.to_string());
        if source.exists() {
            if destination.exists() { return Err(format!("Both archive and original exist for {}", destination.display())); }
            fs::rename(&source, &destination).map_err(|error| format!("Cannot restore {}: {error}", destination.display()))?;
        } else if !destination.is_dir() {
            return Err(format!("Missing both archive and original for {}", destination.display()));
        }
    }
    fs::rename(archive.join("pending.json"), archive.join("rolled-back.json"))
        .map_err(|error| format!("Cannot finalize archive rollback: {error}"))?;
    Ok(())
}

fn recover_conversion(root: &Path, archive: &Path, connection: &Connection, entries: &[ArchiveEntry], conversion: &ConversionState) -> Result<(), String> {
    if entries.len() != 1 || !matches!(conversion.target_type.as_str(), "FACT" | "EXPERIENCE")
        || !matches!(entries[0].entity_type.as_str(), "FACT" | "EXPERIENCE")
        || entries[0].entity_type == conversion.target_type
        || (conversion.keep_original && entries[0].entity_id == conversion.target_id)
        || (!conversion.keep_original && entries[0].entity_id != conversion.target_id) {
        return Err("Invalid conversion recovery manifest.".into());
    }
    let source = &entries[0];
    let (table, key) = entity_table(&source.entity_type)?;
    let source_exists = row_exists(connection, table, key, source.entity_id)?;
    let (table, key) = entity_table(&conversion.target_type)?;
    let target_exists = row_exists(connection, table, key, conversion.target_id)?;
    let destination = root.join(&conversion.target_type).join(conversion.target_id.to_string());
    if target_exists && source_exists == conversion.keep_original {
        plain_directory(&destination)?;
        if !destination.join("main.md").is_file() { return Err("Converted Markdown missing; manual recovery required.".into()); }
        return fs::rename(archive.join("pending.json"), archive.join("complete.json")).map_err(|error| error.to_string());
    }
    if source_exists && !target_exists {
        for path in [destination, archive.join("target")] {
            if path.exists() {
                plain_directory(&path)?;
                fs::remove_dir_all(&path).map_err(|error| format!("Cannot roll back converted folder: {error}"))?;
            }
        }
        if conversion.keep_original {
            fs::rename(archive.join("pending.json"), archive.join("rolled-back.json")).map_err(|error| error.to_string())
        } else { restore_entries(root, archive, entries) }
    } else { Err("Inconsistent conversion archive; manual recovery is required.".into()) }
}

pub(super) fn recover_pending_archives(root: &Path, connection: &Connection) -> Result<(), String> {
    let archive_root = root.join(".hasm").join("deleted");
    if !archive_root.exists() { return Ok(()); }
    plain_directory(&root.join(".hasm"))?;
    plain_directory(&archive_root)?;
    for item in fs::read_dir(&archive_root).map_err(|error| format!("Cannot read deletion archive: {error}"))? {
        let archive = item.map_err(|error| error.to_string())?.path();
        let pending = archive.join("pending.json");
        if !pending.is_file() { continue; }
        require_owned_lock(root)?;
        plain_directory(&archive)?;
        let manifest: ArchiveManifest = serde_json::from_slice(&fs::read(&pending).map_err(|error| error.to_string())?)
            .map_err(|error| format!("Invalid deletion archive manifest: {error}"))?;
        if manifest.entries.is_empty() { return Err("Empty deletion archive manifest.".into()); }
        connection.execute_batch("BEGIN IMMEDIATE").map_err(|error| format!("Cannot lock deletion recovery: {error}"))?;
        let recovery = (|| {
            if let Some(conversion) = &manifest.conversion {
                return recover_conversion(root, &archive, connection, &manifest.entries, conversion);
            }
            let mut remaining = 0;
            for entry in &manifest.entries {
                let (table, key) = entity_table(&entry.entity_type)?;
                if row_exists(connection, table, key, entry.entity_id)? { remaining += 1; }
            }

            if remaining == manifest.entries.len() {
                restore_entries(root, &archive, &manifest.entries)
            } else if remaining == 0 {
                fs::rename(&pending, archive.join("complete.json")).map_err(|error| format!("Cannot finalize archive: {error}"))
            } else {
                Err("Inconsistent deletion archive; manual recovery is required.".into())
            }
        })();
        let rollback = connection.execute_batch("ROLLBACK").map_err(|error| error.to_string());
        recovery?;
        rollback?;
        if manifest.conversion.is_some() {
            info!("[SEQ-MD-04][CONVERT] recovered pending conversion archive");
        } else {
            info!("[SEQ-MD-04][DELETE] recovered pending deletion archive");
        }
    }
    Ok(())
}
