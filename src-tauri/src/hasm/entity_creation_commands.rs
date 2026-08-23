//! SEQ-08 commands for workspace scaffolding and entity creation.

use crate::hasm::definitions::{Experience, Fact, Link, Person};
use crate::hasm::types::{
    CreateExperienceRequest, CreateFactRequest, CreateLinkRequest, CreatePersonRequest,
    EntityCreationPayload, WorkspacePathPayload,
};
use log::{info, warn};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const WORKSPACE_TIMEOUT: Duration = Duration::from_millis(3000);
const ENTITY_TIMEOUT: Duration = Duration::from_millis(5000);
const LOCK_DIRECTORY: &str = ".hasm";
const LOCK_FILENAME: &str = "lock";

#[tauri::command]
pub fn create_hasm_workspace(target_directory_path: String) -> Result<WorkspacePathPayload, String> {
    let started = Instant::now();
    let root = PathBuf::from(target_directory_path.trim());
    let mut created_root = false;

    if target_directory_path.trim().is_empty() {
        return Err("ERR_WORKSPACE_CREATION_FAILED: Empty target path".to_string());
    }

    let result = (|| -> Result<(), String> {
        if root.exists() {
            if !root.is_dir() {
                return Err("ERR_WORKSPACE_CREATION_FAILED: Target path exists and is not a directory".to_string());
            }
            let is_empty = fs::read_dir(&root)
                .map_err(|error| format!("ERR_WORKSPACE_CREATION_FAILED: {error}"))?
                .next()
                .is_none();
            if !is_empty {
                return Err("ERR_WORKSPACE_CREATION_FAILED: Target directory is not empty".to_string());
            }
        } else {
            fs::create_dir_all(&root)
                .map_err(|error| format!("ERR_WORKSPACE_CREATION_FAILED: {error}"))?;
            created_root = true;
        }
        ensure_within(started, WORKSPACE_TIMEOUT, "ERR_WORKSPACE_CREATION_FAILED: Timeout")?;

        for entity_type in ["PERSON", "EXPERIENCE", "FACT", "LINK"] {
            fs::create_dir_all(root.join(entity_type))
                .map_err(|error| format!("ERR_WORKSPACE_CREATION_FAILED: {error}"))?;
        }

        let lock_dir = root.join(LOCK_DIRECTORY);
        fs::create_dir_all(&lock_dir).map_err(|error| format!("ERR_WORKSPACE_CREATION_FAILED: {error}"))?;
        fs::write(lock_dir.join(LOCK_FILENAME), std::process::id().to_string())
            .map_err(|error| format!("ERR_WORKSPACE_CREATION_FAILED: {error}"))?;

        let db_path = root.join("hasm.db");
        let connection = Connection::open(&db_path)
            .map_err(|error| format!("ERR_WORKSPACE_CREATION_FAILED: {error}"))?;
        ensure_schema(&connection)?;

        fs::copy(&db_path, root.join("main.db"))
            .map_err(|error| format!("ERR_WORKSPACE_CREATION_FAILED: {error}"))?;

        ensure_within(started, WORKSPACE_TIMEOUT, "ERR_WORKSPACE_CREATION_FAILED: Timeout")?;
        Ok(())
    })();

    if let Err(error) = result {
        if created_root {
            let _ = fs::remove_dir_all(&root);
        } else {
            cleanup_workspace_artifacts(&root);
        }
        warn!("[SEQ-MD-08][WORKSPACE] failed to scaffold workspace: {error}");
        return Err(error);
    }

    info!("[SEQ-MD-08][WORKSPACE] workspace scaffolded successfully");
    Ok(WorkspacePathPayload {
        path: root.to_string_lossy().to_string(),
    })
}

fn cleanup_workspace_artifacts(root: &Path) {
    for artifact in ["PERSON", "EXPERIENCE", "FACT", "LINK", ".hasm", "hasm.db", "main.db"] {
        let path = root.join(artifact);
        if path.is_dir() {
            let _ = fs::remove_dir_all(path);
        } else {
            let _ = fs::remove_file(path);
        }
    }
}

#[tauri::command]
pub fn create_person(path: String, payload: CreatePersonRequest) -> Result<EntityCreationPayload, String> {
    let started = Instant::now();
    let root = workspace_root(&path)?;
    let person_id = Uuid::new_v4();
    create_person_with_id(&root, payload, person_id, started)
}

#[tauri::command]
pub fn create_experience(path: String, payload: CreateExperienceRequest) -> Result<EntityCreationPayload, String> {
    let started = Instant::now();
    let root = workspace_root(&path)?;
    let experience_id = Uuid::new_v4();

    let experience = Experience {
        experience_id,
        person_id: Uuid::nil(),
        experience_name: payload.experience_name.clone(),
        experience_description_path: Experience::default_markdown_path(&experience_id),
        parent_experience_ids: payload.parent_experience_ids.clone(),
        link_ids: Vec::new(),
        markdown: markdown_template("EXPERIENCE", &experience_id, &payload.experience_name, &payload.experience_description),
        markdown_path: String::new(),
    };
    experience.verify(payload.security_level)?;

    let mut connection = open_workspace_connection(&root)?;
    let transaction = connection.transaction().map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;
    let mut created_dirs = Vec::new();

    if let Err(error) = (|| -> Result<(), String> {
        insert_experience(&transaction, &experience)?;
        scaffold_entity_files(&root, "EXPERIENCE", &experience_id, &experience.markdown)?;
        created_dirs.push(root.join("EXPERIENCE").join(experience_id.to_string()));
        ensure_within(started, ENTITY_TIMEOUT, "ERR_ENTITY_CREATE_TIMEOUT")?;
        Ok(())
    })() {
        rollback_and_cleanup(transaction, &created_dirs);
        return Err(error);
    }

    transaction
        .commit()
        .map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;

    Ok(EntityCreationPayload {
        entity_type: "EXPERIENCE".to_string(),
        entity_id: experience_id,
        target_dir_path: root.join("EXPERIENCE").join(experience_id.to_string()).to_string_lossy().to_string(),
        created_at_ms: now_ms(),
    })
}

#[tauri::command]
pub fn create_fact(path: String, payload: CreateFactRequest) -> Result<EntityCreationPayload, String> {
    let started = Instant::now();
    let root = workspace_root(&path)?;
    create_fact_with_id(&root, payload, Uuid::new_v4(), started)
}

#[tauri::command]
pub fn create_link(path: String, payload: CreateLinkRequest) -> Result<EntityCreationPayload, String> {
    let started = Instant::now();
    let root = workspace_root(&path)?;
    let link_id = Uuid::new_v4();

    let link = Link {
        link_id,
        link_name: payload.link_type.clone(),
        link_type: payload.link_type.clone(),
        link_description_path: Link::default_markdown_path(&link_id),
        related_ids: vec![payload.origin_entity_id, payload.target_entity_id],
        markdown: markdown_template("LINK", &link_id, &payload.link_type, &payload.link_description),
        markdown_path: String::new(),
    };
    link.verify()?;
    if !(0..=5).contains(&payload.security_level) {
        return Err("EntityValidationError::InvalidSecurityLevel".to_string());
    }

    let mut connection = open_workspace_connection(&root)?;
    let transaction = connection.transaction().map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;

    if !entity_exists(&transaction, &payload.origin_entity_type, payload.origin_entity_id)?
        || !entity_exists(&transaction, &payload.target_entity_type, payload.target_entity_id)?
    {
        return Err("OrphanLinkError".to_string());
    }

    let mut created_dirs = Vec::new();
    if let Err(error) = (|| -> Result<(), String> {
        insert_link(&transaction, &link)?;
        scaffold_entity_files(&root, "LINK", &link_id, &link.markdown)?;
        created_dirs.push(root.join("LINK").join(link_id.to_string()));
        ensure_within(started, ENTITY_TIMEOUT, "ERR_ENTITY_CREATE_TIMEOUT")?;
        Ok(())
    })() {
        rollback_and_cleanup(transaction, &created_dirs);
        return Err(error);
    }

    transaction
        .commit()
        .map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;

    Ok(EntityCreationPayload {
        entity_type: "LINK".to_string(),
        entity_id: link_id,
        target_dir_path: root.join("LINK").join(link_id.to_string()).to_string_lossy().to_string(),
        created_at_ms: now_ms(),
    })
}

fn create_person_with_id(
    root: &Path,
    payload: CreatePersonRequest,
    person_id: Uuid,
    started: Instant,
) -> Result<EntityCreationPayload, String> {
    let person = Person {
        person_id,
        person_name: payload.person_name.clone(),
        person_description_path: Person::default_markdown_path(&person_id),
        birthday: String::new(),
        die: String::new(),
        link_ids: Vec::new(),
        markdown: markdown_template("PERSON", &person_id, &payload.person_name, &payload.person_description),
        markdown_path: String::new(),
    };
    person.verify(payload.security_level)?;

    let mut connection = open_workspace_connection(root)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;

    let mut created_dirs = Vec::new();
    if let Err(error) = (|| -> Result<(), String> {
        insert_person(&transaction, &person)?;
        scaffold_entity_files(root, "PERSON", &person_id, &person.markdown)?;
        created_dirs.push(root.join("PERSON").join(person_id.to_string()));

        if payload.create_life_experience {
            let root_experience_id = Uuid::new_v4();
            let root_experience = Experience {
                experience_id: root_experience_id,
                person_id,
                experience_name: format!("{} Root Experience", payload.person_name.trim()),
                experience_description_path: Experience::default_markdown_path(&root_experience_id),
                parent_experience_ids: Vec::new(),
                link_ids: Vec::new(),
                markdown: markdown_template(
                    "EXPERIENCE",
                    &root_experience_id,
                    "Root Experience",
                    "Auto-generated root stream.",
                ),
                markdown_path: String::new(),
            };
            insert_experience(&transaction, &root_experience)?;
            scaffold_entity_files(root, "EXPERIENCE", &root_experience_id, &root_experience.markdown)?;
            created_dirs.push(root.join("EXPERIENCE").join(root_experience_id.to_string()));
        }

        ensure_within(started, ENTITY_TIMEOUT, "ERR_ENTITY_CREATE_TIMEOUT")?;
        Ok(())
    })() {
        rollback_and_cleanup(transaction, &created_dirs);
        return Err(error);
    }

    transaction
        .commit()
        .map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;

    Ok(EntityCreationPayload {
        entity_type: "PERSON".to_string(),
        entity_id: person_id,
        target_dir_path: root
            .join("PERSON")
            .join(person_id.to_string())
            .to_string_lossy()
            .to_string(),
        created_at_ms: now_ms(),
    })
}

fn create_fact_with_id(
    root: &Path,
    payload: CreateFactRequest,
    fact_id: Uuid,
    started: Instant,
) -> Result<EntityCreationPayload, String> {
    let occurred_at = payload.start_time.clone().unwrap_or_default();
    let fact = Fact {
        fact_id,
        fact_name: payload.fact_name.clone(),
        occurred_at,
        fact_description_path: Fact::default_markdown_path(&fact_id),
        experience_ids: payload.experience_ids.clone(),
        person_ids: Vec::new(),
        link_ids: Vec::new(),
        markdown: markdown_template("FACT", &fact_id, &payload.fact_name, &payload.fact_description),
        markdown_path: String::new(),
    };
    fact.verify(
        payload.start_time.as_deref(),
        payload.end_time.as_deref(),
        payload.security_level,
    )?;

    let mut connection = open_workspace_connection(root)?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;

    let mut created_dirs = Vec::new();
    if let Err(error) = (|| -> Result<(), String> {
        insert_fact(&transaction, &fact)?;
        scaffold_entity_files(root, "FACT", &fact_id, &fact.markdown)?;
        created_dirs.push(root.join("FACT").join(fact_id.to_string()));
        ensure_within(started, ENTITY_TIMEOUT, "ERR_ENTITY_CREATE_TIMEOUT")?;
        Ok(())
    })() {
        rollback_and_cleanup(transaction, &created_dirs);
        return Err(error);
    }

    transaction
        .commit()
        .map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;

    Ok(EntityCreationPayload {
        entity_type: "FACT".to_string(),
        entity_id: fact_id,
        target_dir_path: root.join("FACT").join(fact_id.to_string()).to_string_lossy().to_string(),
        created_at_ms: now_ms(),
    })
}

fn workspace_root(path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(path);
    if !root.is_dir() {
        return Err(format!("Workspace directory does not exist: {path}"));
    }
    for entity_type in ["PERSON", "EXPERIENCE", "FACT", "LINK"] {
        if !root.join(entity_type).is_dir() {
            return Err(format!("Workspace missing entity folder: {entity_type}"));
        }
    }
    Ok(root)
}

fn open_workspace_connection(root: &Path) -> Result<Connection, String> {
    let db_path = if root.join("main.db").is_file() {
        root.join("main.db")
    } else {
        root.join("hasm.db")
    };
    let connection = Connection::open(db_path).map_err(|error| error.to_string())?;
    ensure_schema(&connection)?;
    Ok(connection)
}

fn ensure_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS person (
                person_id UUID PRIMARY KEY,
                person_name TEXT NOT NULL DEFAULT '',
                person_description_path TEXT NOT NULL DEFAULT '',
                birthday TEXT NOT NULL DEFAULT '',
                die TEXT NOT NULL DEFAULT '',
                link_ids TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS experience (
                experience_id UUID PRIMARY KEY,
                person_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
                experience_name TEXT NOT NULL DEFAULT '',
                experience_description_path TEXT NOT NULL DEFAULT '',
                parent_experience_ids TEXT NOT NULL DEFAULT '[]',
                link_ids TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS fact (
                fact_id UUID PRIMARY KEY,
                fact_name TEXT NOT NULL DEFAULT '',
                occurred_at TEXT NOT NULL DEFAULT '',
                fact_description_path TEXT NOT NULL DEFAULT '',
                experience_ids TEXT NOT NULL DEFAULT '[]',
                person_ids TEXT NOT NULL DEFAULT '[]',
                link_ids TEXT NOT NULL DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS link (
                link_id UUID PRIMARY KEY,
                link_name TEXT NOT NULL DEFAULT '',
                link_type TEXT NOT NULL DEFAULT '',
                link_description_path TEXT NOT NULL DEFAULT '',
                related_ids TEXT NOT NULL DEFAULT '[]'
            );",
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn rollback_and_cleanup(transaction: Transaction<'_>, created_dirs: &[PathBuf]) {
    let _ = transaction.rollback();
    for path in created_dirs.iter().rev() {
        let _ = fs::remove_dir_all(path);
    }
}

fn insert_person(transaction: &Transaction<'_>, person: &Person) -> Result<(), String> {
    transaction
        .execute(
            "INSERT INTO person (person_id, person_name, person_description_path, birthday, die, link_ids)
             VALUES (?1, ?2, ?3, '', '', '[]')",
            params![
                person.person_id.to_string(),
                person.person_name,
                person.person_description_path,
            ],
        )
        .map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;
    Ok(())
}

fn insert_experience(transaction: &Transaction<'_>, experience: &Experience) -> Result<(), String> {
    transaction
        .execute(
            "INSERT INTO experience (experience_id, person_id, experience_name, experience_description_path, parent_experience_ids, link_ids)
             VALUES (?1, ?2, ?3, ?4, ?5, '[]')",
            params![
                experience.experience_id.to_string(),
                experience.person_id.to_string(),
                experience.experience_name,
                experience.experience_description_path,
                serde_json::to_string(&experience.parent_experience_ids).map_err(|error| error.to_string())?,
            ],
        )
        .map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;
    Ok(())
}

fn insert_fact(transaction: &Transaction<'_>, fact: &Fact) -> Result<(), String> {
    transaction
        .execute(
            "INSERT INTO fact (fact_id, fact_name, occurred_at, fact_description_path, experience_ids, person_ids, link_ids)
             VALUES (?1, ?2, ?3, ?4, ?5, '[]', '[]')",
            params![
                fact.fact_id.to_string(),
                fact.fact_name,
                fact.occurred_at,
                fact.fact_description_path,
                serde_json::to_string(&fact.experience_ids).map_err(|error| error.to_string())?,
            ],
        )
        .map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;
    Ok(())
}

fn insert_link(transaction: &Transaction<'_>, link: &Link) -> Result<(), String> {
    transaction
        .execute(
            "INSERT INTO link (link_id, link_name, link_type, link_description_path, related_ids)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                link.link_id.to_string(),
                link.link_name,
                link.link_type,
                link.link_description_path,
                serde_json::to_string(&link.related_ids).map_err(|error| error.to_string())?,
            ],
        )
        .map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;
    Ok(())
}

fn entity_exists(transaction: &Transaction<'_>, entity_type: &str, entity_id: Uuid) -> Result<bool, String> {
    let (table, id_column) = match entity_type {
        "PERSON" => ("person", "person_id"),
        "EXPERIENCE" => ("experience", "experience_id"),
        "FACT" => ("fact", "fact_id"),
        _ => return Ok(false),
    };

    let sql = format!("SELECT 1 FROM {table} WHERE {id_column} = ?1 LIMIT 1");
    let value = transaction
        .query_row(&sql, [entity_id.to_string()], |row| row.get::<_, i64>(0))
        .optional()
        .map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;

    Ok(value.is_some())
}

fn scaffold_entity_files(root: &Path, entity_type: &str, entity_id: &Uuid, markdown: &str) -> Result<(), String> {
    let entity_dir = root.join(entity_type).join(entity_id.to_string());
    fs::create_dir_all(entity_dir.join("assets")).map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;
    fs::write(entity_dir.join("main.md"), markdown).map_err(|error| format!("ERR_ENTITY_CREATE_FAILED: {error}"))?;
    Ok(())
}

fn markdown_template(entity_type: &str, entity_id: &Uuid, name: &str, description: &str) -> String {
    format!(
        "---\nentity_type: {entity_type}\nentity_id: {entity_id}\nname: {name}\n---\n\n{description}\n",
        name = if name.trim().is_empty() { "Untitled" } else { name.trim() },
        description = if description.trim().is_empty() {
            "Write notes here."
        } else {
            description.trim()
        }
    )
}

fn ensure_within(started: Instant, limit: Duration, timeout_error: &str) -> Result<(), String> {
    if started.elapsed() > limit {
        return Err(timeout_error.to_string());
    }
    Ok(())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hasm::service;

    fn temp_workspace_path(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "hasm-seq-08-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }

    #[test]
    fn scaffolds_workspace_and_entity_directories() {
        let root = temp_workspace_path("workspace");
        let payload = create_hasm_workspace(root.to_string_lossy().to_string()).unwrap();

        assert!(PathBuf::from(&payload.path).join("PERSON").is_dir());
        assert!(PathBuf::from(&payload.path).join("EXPERIENCE").is_dir());
        assert!(PathBuf::from(&payload.path).join("FACT").is_dir());
        assert!(PathBuf::from(&payload.path).join("LINK").is_dir());
        assert!(PathBuf::from(&payload.path).join("hasm.db").is_file());
        assert!(PathBuf::from(&payload.path).join("main.db").is_file());
        assert!(PathBuf::from(&payload.path).join(LOCK_DIRECTORY).join(LOCK_FILENAME).is_file());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rolls_back_workspace_on_creation_failure() {
        let root = temp_workspace_path("workspace-error");
        fs::write(&root, "occupied").unwrap();

        let error = create_hasm_workspace(root.to_string_lossy().to_string()).unwrap_err();
        assert!(error.contains("ERR_WORKSPACE_CREATION_FAILED"));
        assert!(root.is_file());

        fs::remove_file(root).unwrap();
    }

    #[test]
    fn verifies_domain_invariants_for_all_entity_types() {
        let person = Person {
            person_id: Uuid::new_v4(),
            person_name: "Ada".to_string(),
            person_description_path: String::new(),
            birthday: String::new(),
            die: String::new(),
            link_ids: Vec::new(),
            markdown: String::new(),
            markdown_path: String::new(),
        };
        assert!(person.verify(1).is_ok());
        assert!(person.verify(9).is_err());

        let experience = Experience {
            experience_id: Uuid::new_v4(),
            person_id: Uuid::nil(),
            experience_name: "Root".to_string(),
            experience_description_path: String::new(),
            parent_experience_ids: Vec::new(),
            link_ids: Vec::new(),
            markdown: String::new(),
            markdown_path: String::new(),
        };
        assert!(experience.verify(2).is_ok());

        let fact = Fact {
            fact_id: Uuid::new_v4(),
            fact_name: "Launch".to_string(),
            occurred_at: "2026-01-01".to_string(),
            fact_description_path: String::new(),
            experience_ids: Vec::new(),
            person_ids: Vec::new(),
            link_ids: Vec::new(),
            markdown: String::new(),
            markdown_path: String::new(),
        };
        assert!(fact.verify(Some("2026-01-01"), Some("2026-02-01"), 3).is_ok());
        assert!(fact.verify(Some("2026-02-01"), Some("2026-01-01"), 3).is_err());

        let link = Link {
            link_id: Uuid::new_v4(),
            link_name: "references".to_string(),
            link_type: "references".to_string(),
            link_description_path: String::new(),
            related_ids: vec![Uuid::new_v4(), Uuid::new_v4()],
            markdown: String::new(),
            markdown_path: String::new(),
        };
        assert!(link.verify().is_ok());
    }

    #[test]
    fn creates_person_experience_fact_and_link_in_real_workspace() {
        let root = temp_workspace_path("all-entities");
        create_hasm_workspace(root.to_string_lossy().to_string()).unwrap();

        let person = create_person(
            root.to_string_lossy().to_string(),
            CreatePersonRequest {
                person_name: "John Doe".to_string(),
                person_description: "Person description".to_string(),
                security_level: 1,
                create_life_experience: true,
            },
        )
        .unwrap();

        let mut model = service::read_model_database(&root.to_string_lossy()).unwrap();
        assert_eq!(model.people.len(), 1);
        assert_eq!(model.experiences.len(), 1);
        let root_experience_id = model.experiences[0].experience_id;

        let experience = create_experience(
            root.to_string_lossy().to_string(),
            CreateExperienceRequest {
                experience_name: "Research".to_string(),
                experience_description: "Experience description".to_string(),
                security_level: 2,
                parent_experience_ids: vec![root_experience_id],
            },
        )
        .unwrap();

        let fact = create_fact(
            root.to_string_lossy().to_string(),
            CreateFactRequest {
                fact_name: "First Commit".to_string(),
                fact_description: "Fact description".to_string(),
                start_time: Some("2026-08-12".to_string()),
                end_time: Some("2026-08-12".to_string()),
                security_level: 1,
                experience_ids: vec![experience.entity_id],
            },
        )
        .unwrap();

        let link = create_link(
            root.to_string_lossy().to_string(),
            CreateLinkRequest {
                link_type: "references".to_string(),
                link_description: "Link description".to_string(),
                origin_entity_type: "FACT".to_string(),
                origin_entity_id: fact.entity_id,
                target_entity_type: "EXPERIENCE".to_string(),
                target_entity_id: experience.entity_id,
                security_level: 1,
            },
        )
        .unwrap();

        model = service::read_model_database(&root.to_string_lossy()).unwrap();
        assert_eq!(model.people.len(), 1);
        assert_eq!(model.experiences.len(), 2);
        assert_eq!(model.facts.len(), 1);
        assert_eq!(model.links.len(), 1);

        assert!(root.join("PERSON").join(person.entity_id.to_string()).join("main.md").is_file());
        assert!(root.join("EXPERIENCE").join(experience.entity_id.to_string()).join("main.md").is_file());
        assert!(root.join("FACT").join(fact.entity_id.to_string()).join("main.md").is_file());
        assert!(root.join("LINK").join(link.entity_id.to_string()).join("main.md").is_file());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_invalid_inputs_and_rolls_back_fact_creation() {
        let root = temp_workspace_path("negative");
        create_hasm_workspace(root.to_string_lossy().to_string()).unwrap();

        let empty_name_error = create_person(
            root.to_string_lossy().to_string(),
            CreatePersonRequest {
                person_name: "   ".to_string(),
                person_description: String::new(),
                security_level: 1,
                create_life_experience: false,
            },
        )
        .unwrap_err();
        assert!(empty_name_error.contains("EmptyName"));

        let time_error = create_fact(
            root.to_string_lossy().to_string(),
            CreateFactRequest {
                fact_name: "Backdated".to_string(),
                fact_description: String::new(),
                start_time: Some("2026-08-12".to_string()),
                end_time: Some("2020-01-01".to_string()),
                security_level: 1,
                experience_ids: Vec::new(),
            },
        )
        .unwrap_err();
        assert!(time_error.contains("TimeInversion"));

        let person = create_person(
            root.to_string_lossy().to_string(),
            CreatePersonRequest {
                person_name: "Owner".to_string(),
                person_description: String::new(),
                security_level: 1,
                create_life_experience: false,
            },
        )
        .unwrap();
        let self_loop_error = create_link(
            root.to_string_lossy().to_string(),
            CreateLinkRequest {
                link_type: "references".to_string(),
                link_description: String::new(),
                origin_entity_type: "PERSON".to_string(),
                origin_entity_id: person.entity_id,
                target_entity_type: "PERSON".to_string(),
                target_entity_id: person.entity_id,
                security_level: 1,
            },
        )
        .unwrap_err();
        assert!(self_loop_error.contains("SelfLoopLink"));

        let orphan_error = create_link(
            root.to_string_lossy().to_string(),
            CreateLinkRequest {
                link_type: "references".to_string(),
                link_description: String::new(),
                origin_entity_type: "PERSON".to_string(),
                origin_entity_id: person.entity_id,
                target_entity_type: "FACT".to_string(),
                target_entity_id: Uuid::new_v4(),
                security_level: 1,
            },
        )
        .unwrap_err();
        assert!(orphan_error.contains("OrphanLinkError"));

        let fixed_fact_id = Uuid::parse_str("33333333-3333-3333-3333-333333333333").unwrap();
        let conflicting_path = root.join("FACT").join(fixed_fact_id.to_string());
        fs::write(&conflicting_path, "not a directory").unwrap();

        let failed = create_fact_with_id(
            &root,
            CreateFactRequest {
                fact_name: "Conflicting".to_string(),
                fact_description: String::new(),
                start_time: Some("2026-08-12".to_string()),
                end_time: Some("2026-08-12".to_string()),
                security_level: 1,
                experience_ids: Vec::new(),
            },
            fixed_fact_id,
            Instant::now(),
        )
        .unwrap_err();
        assert!(failed.contains("ERR_ENTITY_CREATE_FAILED"));

        let model = service::read_model_database(&root.to_string_lossy()).unwrap();
        assert!(model.facts.is_empty());

        fs::remove_file(conflicting_path).unwrap();
        fs::remove_dir_all(root).unwrap();
    }
}
