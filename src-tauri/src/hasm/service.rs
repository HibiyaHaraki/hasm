//! # service.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Service layer for reading and writing HASM model workspace data.

use crate::hasm::definitions::{ExperienceDetail, FactDetail, LinkDetail, PersonDetail};
use crate::hasm::types::{EntitySummary, ModelWorkspace, SaveResult};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

const ENTITY_TYPES: [&str; 4] = ["PERSON", "EXPERIENCE", "FACT", "LINK"];

pub fn open_hasm_model(model_root: &str) -> Result<ModelWorkspace, String> {
    // Step 1. Validate model root and open DB connection.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;

    // Step 2. Sync folder-based entities into DB bootstrap rows.
    sync_directories_to_db(&connection, &root)?;

    // Step 3. Load each entity section list.
    let people = list_people(&connection)?;
    let experiences = list_experiences(&connection)?;
    let facts = list_facts(&connection)?;
    let links = list_links(&connection)?;

    // Step 4. Build section map for frontend workspace payload.
    let mut sections = BTreeMap::new();
    sections.insert("PERSON".to_string(), people);
    sections.insert("EXPERIENCE".to_string(), experiences);
    sections.insert("FACT".to_string(), facts);
    sections.insert("LINK".to_string(), links);

    // Step 5. Build per-entity counts from loaded sections.
    let mut counts = BTreeMap::new();
    for entity_type in ENTITY_TYPES {
        let count = sections.get(entity_type).map(|items| items.len()).unwrap_or(0);
        counts.insert(entity_type.to_string(), count);
    }

    // Step 6. Return normalized model workspace snapshot.
    Ok(ModelWorkspace {
        model_root: root.to_string_lossy().to_string(),
        sections,
        counts,
    })
}

pub fn get_person_detail(model_root: &str, entity_id: &str) -> Result<PersonDetail, String> {
    // Step 1. Validate/open/sync before detail lookup.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Query person row and compose detail payload with markdown content.
    connection
        .query_row(
            "SELECT person_id, person_name, person_description_path, birthday, die, link_ids
             FROM person WHERE person_id = ?1",
            [entity_id],
            |row| {
                let description_path: String = row.get(2)?;
                Ok(PersonDetail {
                    person_id: row.get(0)?,
                    person_name: row.get(1)?,
                    person_description_path: description_path.clone(),
                    birthday: row.get(3)?,
                    die: row.get(4)?,
                    link_ids: parse_json_array(&row.get::<_, String>(5)?),
                    markdown: read_markdown(&root, &description_path),
                    markdown_path: resolve_markdown_path(&root, &description_path)
                        .to_string_lossy()
                        .to_string(),
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("PERSON not found: {entity_id}"))
}

pub fn get_experience_detail(model_root: &str, entity_id: &str) -> Result<ExperienceDetail, String> {
    // Step 1. Validate/open/sync before detail lookup.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Query experience row and compose detail payload with markdown content.
    connection
        .query_row(
            "SELECT experience_id, person_id, experience_name, experience_description_path,
                    parent_experience_ids, link_ids
             FROM experience WHERE experience_id = ?1",
            [entity_id],
            |row| {
                let description_path: String = row.get(3)?;
                Ok(ExperienceDetail {
                    experience_id: row.get(0)?,
                    person_id: row.get(1)?,
                    experience_name: row.get(2)?,
                    experience_description_path: description_path.clone(),
                    parent_experience_ids: parse_json_array(&row.get::<_, String>(4)?),
                    link_ids: parse_json_array(&row.get::<_, String>(5)?),
                    markdown: read_markdown(&root, &description_path),
                    markdown_path: resolve_markdown_path(&root, &description_path)
                        .to_string_lossy()
                        .to_string(),
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("EXPERIENCE not found: {entity_id}"))
}

pub fn get_fact_detail(model_root: &str, entity_id: &str) -> Result<FactDetail, String> {
    // Step 1. Validate/open/sync before detail lookup.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Query fact row and compose detail payload with markdown content.
    connection
        .query_row(
            "SELECT fact_id, fact_description_path, branch_experience_ids, person_ids, link_ids
             FROM fact WHERE fact_id = ?1",
            [entity_id],
            |row| {
                let description_path: String = row.get(1)?;
                Ok(FactDetail {
                    fact_id: row.get(0)?,
                    fact_description_path: description_path.clone(),
                    branch_experience_ids: parse_json_array(&row.get::<_, String>(2)?),
                    person_ids: parse_json_array(&row.get::<_, String>(3)?),
                    link_ids: parse_json_array(&row.get::<_, String>(4)?),
                    markdown: read_markdown(&root, &description_path),
                    markdown_path: resolve_markdown_path(&root, &description_path)
                        .to_string_lossy()
                        .to_string(),
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("FACT not found: {entity_id}"))
}

pub fn get_link_detail(model_root: &str, entity_id: &str) -> Result<LinkDetail, String> {
    // Step 1. Validate/open/sync before detail lookup.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Query link row and compose detail payload with markdown content.
    connection
        .query_row(
            "SELECT link_id, link_name, link_type, link_description_path, related_ids
             FROM link WHERE link_id = ?1",
            [entity_id],
            |row| {
                let description_path: String = row.get(3)?;
                Ok(LinkDetail {
                    link_id: row.get(0)?,
                    link_name: row.get(1)?,
                    link_type: row.get(2)?,
                    link_description_path: description_path.clone(),
                    related_ids: parse_json_array(&row.get::<_, String>(4)?),
                    markdown: read_markdown(&root, &description_path),
                    markdown_path: resolve_markdown_path(&root, &description_path)
                        .to_string_lossy()
                        .to_string(),
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("LINK not found: {entity_id}"))
}

pub fn save_person_detail(model_root: &str, detail: &PersonDetail) -> Result<SaveResult, String> {
    // Step 1. Validate/open/sync before persistence.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Resolve markdown target path and write markdown file.
    let description_path = sanitize_relative_path(
        &detail.person_description_path,
        PersonDetail::default_markdown_path(&detail.person_id),
    );
    write_markdown(&root, &description_path, &detail.markdown)?;

    // Step 3. Upsert person detail row into DB.
    connection
        .execute(
            "INSERT INTO person (person_id, person_name, person_description_path, birthday, die, link_ids)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(person_id) DO UPDATE SET
                person_name = excluded.person_name,
                person_description_path = excluded.person_description_path,
                birthday = excluded.birthday,
                die = excluded.die,
                link_ids = excluded.link_ids",
            params![
                detail.person_id,
                detail.person_name,
                description_path,
                detail.birthday,
                detail.die,
                to_json_array(&detail.link_ids),
            ],
        )
        .map_err(|error| error.to_string())?;

    // Step 4. Return save result message.
    Ok(SaveResult {
        message: format!("Saved PERSON {}", detail.person_id),
    })
}

pub fn save_experience_detail(
    model_root: &str,
    detail: &ExperienceDetail,
) -> Result<SaveResult, String> {
    // Step 1. Validate/open/sync before persistence.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Resolve markdown target path and write markdown file.
    let description_path = sanitize_relative_path(
        &detail.experience_description_path,
        ExperienceDetail::default_markdown_path(&detail.experience_id),
    );
    write_markdown(&root, &description_path, &detail.markdown)?;

    // Step 3. Upsert experience detail row into DB.
    connection
        .execute(
            "INSERT INTO experience (experience_id, person_id, experience_name, experience_description_path,
                                     parent_experience_ids, link_ids)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(experience_id) DO UPDATE SET
                person_id = excluded.person_id,
                experience_name = excluded.experience_name,
                experience_description_path = excluded.experience_description_path,
                parent_experience_ids = excluded.parent_experience_ids,
                link_ids = excluded.link_ids",
            params![
                detail.experience_id,
                detail.person_id,
                detail.experience_name,
                description_path,
                to_json_array(&detail.parent_experience_ids),
                to_json_array(&detail.link_ids),
            ],
        )
        .map_err(|error| error.to_string())?;

    // Step 4. Return save result message.
    Ok(SaveResult {
        message: format!("Saved EXPERIENCE {}", detail.experience_id),
    })
}

pub fn save_fact_detail(model_root: &str, detail: &FactDetail) -> Result<SaveResult, String> {
    // Step 1. Validate/open/sync before persistence.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Resolve markdown target path and write markdown file.
    let description_path = sanitize_relative_path(
        &detail.fact_description_path,
        FactDetail::default_markdown_path(&detail.fact_id),
    );
    write_markdown(&root, &description_path, &detail.markdown)?;

    // Step 3. Upsert fact detail row into DB.
    connection
        .execute(
            "INSERT INTO fact (fact_id, fact_description_path, branch_experience_ids, person_ids, link_ids)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(fact_id) DO UPDATE SET
                fact_description_path = excluded.fact_description_path,
                branch_experience_ids = excluded.branch_experience_ids,
                person_ids = excluded.person_ids,
                link_ids = excluded.link_ids",
            params![
                detail.fact_id,
                description_path,
                to_json_array(&detail.branch_experience_ids),
                to_json_array(&detail.person_ids),
                to_json_array(&detail.link_ids),
            ],
        )
        .map_err(|error| error.to_string())?;

    // Step 4. Return save result message.
    Ok(SaveResult {
        message: format!("Saved FACT {}", detail.fact_id),
    })
}

pub fn save_link_detail(model_root: &str, detail: &LinkDetail) -> Result<SaveResult, String> {
    // Step 1. Validate/open/sync before persistence.
    let root = validate_model_root(model_root)?;
    let connection = open_connection(&root)?;
    sync_directories_to_db(&connection, &root)?;

    // Step 2. Resolve markdown target path and write markdown file.
    let description_path = sanitize_relative_path(
        &detail.link_description_path,
        LinkDetail::default_markdown_path(&detail.link_id),
    );
    write_markdown(&root, &description_path, &detail.markdown)?;

    // Step 3. Upsert link detail row into DB.
    connection
        .execute(
            "INSERT INTO link (link_id, link_name, link_type, link_description_path, related_ids)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(link_id) DO UPDATE SET
                link_name = excluded.link_name,
                link_type = excluded.link_type,
                link_description_path = excluded.link_description_path,
                related_ids = excluded.related_ids",
            params![
                detail.link_id,
                detail.link_name,
                detail.link_type,
                description_path,
                to_json_array(&detail.related_ids),
            ],
        )
        .map_err(|error| error.to_string())?;

    // Step 4. Return save result message.
    Ok(SaveResult {
        message: format!("Saved LINK {}", detail.link_id),
    })
}

fn validate_model_root(model_root: &str) -> Result<PathBuf, String> {
    // Step 1. Validate root existence and directory type.
    let root = PathBuf::from(model_root);
    if !root.exists() {
        return Err(format!("Model root does not exist: {model_root}"));
    }
    if !root.is_dir() {
        return Err(format!("Model root is not a directory: {model_root}"));
    }

    // Step 2. Validate required entity folders.
    for entity_type in ENTITY_TYPES {
        let path = root.join(entity_type);
        if !path.exists() {
            return Err(format!("Missing required folder: {}", path.to_string_lossy()));
        }
    }

    // Step 3. Validate required SQLite database file.
    let db_path = root.join("hasm.db");
    if !db_path.exists() {
        return Err(format!("Missing hasm.db in {}", root.to_string_lossy()));
    }

    Ok(root)
}

fn open_connection(model_root: &Path) -> Result<Connection, String> {
    // Step 1. Open hasm.db connection from model root.
    let db_path = model_root.join("hasm.db");
    let connection = Connection::open(db_path).map_err(|error| error.to_string())?;

    // Step 2. Ensure required schema exists.
    ensure_schema(&connection)?;
    Ok(connection)
}

fn ensure_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS person (
                person_id TEXT PRIMARY KEY,
                person_name TEXT NOT NULL DEFAULT '',
                person_description_path TEXT NOT NULL DEFAULT '',
                birthday TEXT NOT NULL DEFAULT '',
                die TEXT NOT NULL DEFAULT '',
                link_ids TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS experience (
                experience_id TEXT PRIMARY KEY,
                person_id TEXT NOT NULL DEFAULT '',
                experience_name TEXT NOT NULL DEFAULT '',
                experience_description_path TEXT NOT NULL DEFAULT '',
                parent_experience_ids TEXT NOT NULL DEFAULT '[]',
                link_ids TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS fact (
                fact_id TEXT PRIMARY KEY,
                fact_description_path TEXT NOT NULL DEFAULT '',
                branch_experience_ids TEXT NOT NULL DEFAULT '[]',
                person_ids TEXT NOT NULL DEFAULT '[]',
                link_ids TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS link (
                link_id TEXT PRIMARY KEY,
                link_name TEXT NOT NULL DEFAULT '',
                link_type TEXT NOT NULL DEFAULT '',
                link_description_path TEXT NOT NULL DEFAULT '',
                related_ids TEXT NOT NULL DEFAULT '[]'
            );",
        )
        .map_err(|error| error.to_string())
}

fn sync_directories_to_db(connection: &Connection, model_root: &Path) -> Result<(), String> {
    // Step 1. Sync PERSON folders into DB rows when missing.
    for entity_id in read_entity_directories(model_root, "PERSON")? {
        let description_path = PersonDetail::default_markdown_path(&entity_id);
        connection
            .execute(
                "INSERT OR IGNORE INTO person (person_id, person_name, person_description_path, birthday, die, link_ids)
                 VALUES (?1, '', ?2, '', '', '[]')",
                params![entity_id, description_path],
            )
            .map_err(|error| error.to_string())?;
    }

    // Step 2. Sync EXPERIENCE folders into DB rows when missing.
    for entity_id in read_entity_directories(model_root, "EXPERIENCE")? {
        let description_path = ExperienceDetail::default_markdown_path(&entity_id);
        connection
            .execute(
                "INSERT OR IGNORE INTO experience (experience_id, person_id, experience_name, experience_description_path, parent_experience_ids, link_ids)
                 VALUES (?1, '', '', ?2, '[]', '[]')",
                params![entity_id, description_path],
            )
            .map_err(|error| error.to_string())?;
    }

    // Step 3. Sync FACT folders into DB rows when missing.
    for entity_id in read_entity_directories(model_root, "FACT")? {
        let description_path = FactDetail::default_markdown_path(&entity_id);
        connection
            .execute(
                "INSERT OR IGNORE INTO fact (fact_id, fact_description_path, branch_experience_ids, person_ids, link_ids)
                 VALUES (?1, ?2, '[]', '[]', '[]')",
                params![entity_id, description_path],
            )
            .map_err(|error| error.to_string())?;
    }

    // Step 4. Sync LINK folders into DB rows when missing.
    for entity_id in read_entity_directories(model_root, "LINK")? {
        let description_path = LinkDetail::default_markdown_path(&entity_id);
        connection
            .execute(
                "INSERT OR IGNORE INTO link (link_id, link_name, link_type, link_description_path, related_ids)
                 VALUES (?1, '', '', ?2, '[]')",
                params![entity_id, description_path],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn list_people(connection: &Connection) -> Result<Vec<EntitySummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT person_id, person_name, birthday, die
             FROM person ORDER BY COALESCE(NULLIF(person_name, ''), person_id)",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            let person_id: String = row.get(0)?;
            let person_name: String = row.get(1)?;
            let birthday: String = row.get(2)?;
            let die: String = row.get(3)?;

            let detail = PersonDetail {
                person_id: person_id.clone(),
                person_name,
                person_description_path: String::new(),
                birthday,
                die,
                link_ids: Vec::new(),
                markdown: String::new(),
                markdown_path: String::new(),
            };

            Ok(EntitySummary {
                id: person_id,
                title: detail.title(),
                subtitle: detail.subtitle(),
            })
        })
        .map_err(|error| error.to_string())?;

    collect_rows(rows)
}

fn list_experiences(connection: &Connection) -> Result<Vec<EntitySummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT experience_id, person_id, experience_name
             FROM experience ORDER BY COALESCE(NULLIF(experience_name, ''), experience_id)",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            let experience_id: String = row.get(0)?;
            let detail = ExperienceDetail {
                experience_id: experience_id.clone(),
                person_id: row.get(1)?,
                experience_name: row.get(2)?,
                experience_description_path: String::new(),
                parent_experience_ids: Vec::new(),
                link_ids: Vec::new(),
                markdown: String::new(),
                markdown_path: String::new(),
            };

            Ok(EntitySummary {
                id: experience_id,
                title: detail.title(),
                subtitle: detail.subtitle(),
            })
        })
        .map_err(|error| error.to_string())?;

    collect_rows(rows)
}

fn list_facts(connection: &Connection) -> Result<Vec<EntitySummary>, String> {
    let mut statement = connection
        .prepare("SELECT fact_id, person_ids, link_ids FROM fact ORDER BY fact_id")
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            let fact_id: String = row.get(0)?;
            let detail = FactDetail {
                fact_id: fact_id.clone(),
                fact_description_path: String::new(),
                branch_experience_ids: Vec::new(),
                person_ids: parse_json_array(&row.get::<_, String>(1)?),
                link_ids: parse_json_array(&row.get::<_, String>(2)?),
                markdown: String::new(),
                markdown_path: String::new(),
            };

            Ok(EntitySummary {
                id: fact_id,
                title: detail.title(),
                subtitle: detail.subtitle(),
            })
        })
        .map_err(|error| error.to_string())?;

    collect_rows(rows)
}

fn list_links(connection: &Connection) -> Result<Vec<EntitySummary>, String> {
    let mut statement = connection
        .prepare(
            "SELECT link_id, link_name, link_type FROM link ORDER BY COALESCE(NULLIF(link_name, ''), link_id)",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            let link_id: String = row.get(0)?;
            let detail = LinkDetail {
                link_id: link_id.clone(),
                link_name: row.get(1)?,
                link_type: row.get(2)?,
                link_description_path: String::new(),
                related_ids: Vec::new(),
                markdown: String::new(),
                markdown_path: String::new(),
            };

            Ok(EntitySummary {
                id: link_id,
                title: detail.title(),
                subtitle: detail.subtitle(),
            })
        })
        .map_err(|error| error.to_string())?;

    collect_rows(rows)
}

fn read_entity_directories(model_root: &Path, entity_type: &str) -> Result<Vec<String>, String> {
    // Step 1. Walk the target entity directory.
    let entity_path = model_root.join(entity_type);
    let mut entity_ids = Vec::new();
    let entries = fs::read_dir(&entity_path)
        .map_err(|error| format!("Failed to read {}: {error}", entity_path.display()))?;

    // Step 2. Collect child folder names as entity IDs.
    for entry in entries {
        let entry = entry.map_err(|error| format!("Failed to inspect directory entry: {error}"))?;
        if entry.path().is_dir() {
            entity_ids.push(entry.file_name().to_string_lossy().to_string());
        }
    }

    // Step 3. Sort and return deterministic entity ID list.
    entity_ids.sort();
    Ok(entity_ids)
}

fn read_markdown(model_root: &Path, relative_path: &str) -> String {
    let path = resolve_markdown_path(model_root, relative_path);
    fs::read_to_string(path).unwrap_or_default()
}

fn write_markdown(model_root: &Path, relative_path: &str, markdown: &str) -> Result<(), String> {
    let path = resolve_markdown_path(model_root, relative_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create markdown directory {}: {error}", parent.display()))?;
    }
    fs::write(&path, markdown).map_err(|error| format!("Failed to write {}: {error}", path.display()))
}

fn resolve_markdown_path(model_root: &Path, relative_path: &str) -> PathBuf {
    let normalized = sanitize_relative_path(relative_path, String::new());
    if normalized.is_empty() {
        model_root.join("main.md")
    } else {
        model_root.join(normalized)
    }
}

fn sanitize_relative_path(value: &str, fallback: String) -> String {
    let normalized = value.trim().replace('\\', "/");
    if normalized.is_empty() {
        fallback
    } else {
        normalized
    }
}

fn parse_json_array(value: &str) -> Vec<String> {
    serde_json::from_str(value).unwrap_or_default()
}

fn to_json_array(values: &[String]) -> String {
    serde_json::to_string(values).unwrap_or_else(|_| "[]".to_string())
}

fn collect_rows<T>(rows: rusqlite::MappedRows<'_, impl FnMut(&rusqlite::Row<'_>) -> rusqlite::Result<T>>) -> Result<Vec<T>, String> {
    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|error| error.to_string())?);
    }
    Ok(items)
}