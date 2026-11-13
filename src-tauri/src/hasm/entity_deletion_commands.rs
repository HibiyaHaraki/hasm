//! SEQ-04 entity deletion, relationship updates, and recoverable storage.

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
    let archive = prepare_archive(&root, &entries)?;
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

fn prepare_archive(root: &Path, entries: &[ArchiveEntry]) -> Result<PathBuf, String> {
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
    }).collect() }).map_err(|error| error.to_string())?;
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
        info!("[SEQ-MD-04][DELETE] recovered pending deletion archive");
    }
    Ok(())
}
