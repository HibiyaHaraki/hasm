//! SEQ-02 workspace lock, model load, and storage verification commands.

use crate::hasm::service;
use crate::hasm::types::{LockStatus, ModelDatabase, ProgressPayload, VerificationResult};
use log::{info, warn};
use std::fs;
use std::path::{Path, PathBuf};
use sysinfo::{Pid, System};
use tauri::{AppHandle, Emitter};

const LOCK_DIRECTORY: &str = ".hasm";
const LOCK_FILENAME: &str = "lock";
const ENTITY_TYPES: [&str; 4] = ["PERSON", "EXPERIENCE", "FACT", "LINK"];

#[tauri::command]
pub fn check_workspace_lock(path: String) -> Result<LockStatus, String> {
    let root = workspace_root(&path)?;
    let lock_directory = root.join(LOCK_DIRECTORY);
    fs::create_dir_all(&lock_directory).map_err(|error| error.to_string())?;
    let lock_path = lock_directory.join(LOCK_FILENAME);

    if !lock_path.exists() {
        write_lock(&lock_path)?;
        info!("[SEQ-MD-02][LOCK] acquired workspace lock");
        return Ok(unlocked_status(false));
    }

    let holder_pid = fs::read_to_string(&lock_path)
        .ok()
        .and_then(|contents| contents.trim().parse::<u32>().ok());
    if holder_pid.is_some_and(process_is_active) {
        warn!("[SEQ-MD-02][LOCK] workspace is active in another process");
        return Ok(LockStatus {
            is_locked: true,
            holder_pid,
            is_stale_recovered: false,
            is_read_only: true,
        });
    }

    fs::remove_file(&lock_path).map_err(|error| error.to_string())?;
    write_lock(&lock_path)?;
    info!("[SEQ-MD-02][LOCK] stale workspace lock recovered");
    Ok(unlocked_status(true))
}

#[tauri::command]
pub fn release_workspace_lock(path: String) -> Result<(), String> {
    let lock_path = workspace_root(&path)?.join(LOCK_DIRECTORY).join(LOCK_FILENAME);
    if lock_path.exists() {
        fs::remove_file(lock_path).map_err(|error| error.to_string())?;
        info!("[SEQ-MD-02][LOCK] workspace lock released");
    }
    Ok(())
}

#[tauri::command]
pub fn load_hasm_model_db(app: AppHandle, path: String) -> Result<ModelDatabase, String> {
    emit_progress(&app, "DB_LOAD", 0, 4, "Opening workspace database")?;
    let model = service::read_model_database(&path)?;
    let counts = [model.people.len(), model.experiences.len(), model.facts.len(), model.links.len()];
    for (index, (entity_type, count)) in ENTITY_TYPES.iter().zip(counts).enumerate() {
        emit_progress(&app, "DB_LOAD", index + 1, 4, &format!("Loaded {count} {entity_type} records"))?;
    }
    info!("[SEQ-MD-02][LOAD] database metadata loaded");
    Ok(model)
}

#[tauri::command]
pub fn verify_hasm_storage(
    app: AppHandle,
    path: String,
    model: ModelDatabase,
) -> Result<VerificationResult, String> {
    let root = workspace_root(&path)?;
    let expected = expected_markdown_paths(&model);
    let total = expected.len().max(1);
    let mut missing_entities = Vec::new();

    for (index, entity_path) in expected.iter().enumerate() {
        if !root.join(entity_path).is_file() {
            missing_entities.push(entity_path.clone());
        }
        emit_progress(&app, "STORAGE_VERIFY", index + 1, total, "Verifying workspace storage")?;
    }

    if !missing_entities.is_empty() {
        warn!("[SEQ-MD-02][VERIFY] required Markdown files are missing");
        return Err(format!("ERR_MISSING_STORAGE_FOLDER: {}", missing_entities.join(", ")));
    }

    let unreferenced_entities = find_unreferenced_entity_folders(&root, &expected)?;
    info!("[SEQ-MD-02][VERIFY] workspace storage verified");
    Ok(VerificationResult { missing_entities, unreferenced_entities })
}

fn workspace_root(path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(path);
    if root.is_dir() { Ok(root) } else { Err(format!("Workspace directory does not exist: {path}")) }
}

fn write_lock(lock_path: &Path) -> Result<(), String> {
    fs::write(lock_path, std::process::id().to_string()).map_err(|error| error.to_string())
}

fn unlocked_status(is_stale_recovered: bool) -> LockStatus {
    LockStatus { is_locked: false, holder_pid: Some(std::process::id()), is_stale_recovered, is_read_only: false }
}

fn process_is_active(pid: u32) -> bool {
    let system = System::new_all();
    system.process(Pid::from_u32(pid)).is_some()
}

fn emit_progress(app: &AppHandle, step: &str, current: usize, total: usize, message: &str) -> Result<(), String> {
    let event_name = if step == "STORAGE_VERIFY" { "model-verify-progress" } else { "model-load-progress" };
    app.emit(event_name, ProgressPayload {
        step: step.to_string(), current, total, percentage: (current as f32 / total as f32) * 100.0, message: message.to_string(),
    }).map_err(|error| error.to_string())
}

fn expected_markdown_paths(model: &ModelDatabase) -> Vec<String> {
    model.people.iter().map(|entity| entity.person_description_path.clone())
        .chain(model.experiences.iter().map(|entity| entity.experience_description_path.clone()))
        .chain(model.facts.iter().map(|entity| entity.fact_description_path.clone()))
        .chain(model.links.iter().map(|entity| entity.link_description_path.clone()))
        .collect()
}

fn find_unreferenced_entity_folders(root: &Path, expected: &[String]) -> Result<Vec<String>, String> {
    let mut unreferenced = Vec::new();
    for entity_type in ENTITY_TYPES {
        let directory = root.join(entity_type);
        if !directory.is_dir() { continue; }
        for entry in fs::read_dir(directory).map_err(|error| error.to_string())? {
            let markdown = entry.map_err(|error| error.to_string())?.path().join("main.md");
            let relative = markdown.strip_prefix(root).map_err(|error| error.to_string())?.to_string_lossy().replace('\\', "/");
            if markdown.is_file() && !expected.iter().any(|path| path == &relative) { unreferenced.push(relative); }
        }
    }
    Ok(unreferenced)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use serde_json::json;
    use std::time::{SystemTime, UNIX_EPOCH};

    const PERSON_ID: &str = "11111111-1111-1111-1111-111111111111";
    const EXPERIENCE_ID: &str = "22222222-2222-2222-2222-222222222222";
    const FACT_ID: &str = "33333333-3333-3333-3333-333333333333";
    const LINK_ID: &str = "44444444-4444-4444-4444-444444444444";

    fn fixture_workspace() -> PathBuf {
        let root = std::env::temp_dir().join(format!("hasm-seq-02-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        for (entity_type, id, title) in [("PERSON", PERSON_ID, "Ada"), ("EXPERIENCE", EXPERIENCE_ID, "Research"), ("FACT", FACT_ID, "Publication"), ("LINK", LINK_ID, "Mentors")] {
            let folder = root.join(entity_type).join(id);
            fs::create_dir_all(folder.join("assets")).unwrap();
            fs::write(folder.join("main.md"), format!("# {title}\n\nFixture content for SEQ-02.")).unwrap();
        }
        let connection = Connection::open(root.join("hasm.db")).unwrap();
        connection.execute_batch(&format!(
            "CREATE TABLE person (person_id TEXT PRIMARY KEY, person_name TEXT, person_description_path TEXT, birthday TEXT, die TEXT, link_ids TEXT);
             CREATE TABLE experience (experience_id TEXT PRIMARY KEY, person_id TEXT, experience_name TEXT, experience_description_path TEXT, parent_experience_ids TEXT, link_ids TEXT);
             CREATE TABLE fact (fact_id TEXT PRIMARY KEY, fact_name TEXT, occurred_at TEXT, fact_description_path TEXT, experience_ids TEXT, person_ids TEXT, link_ids TEXT);
             CREATE TABLE link (link_id TEXT PRIMARY KEY, link_name TEXT, link_type TEXT, link_description_path TEXT, related_ids TEXT);
             INSERT INTO person VALUES ('{PERSON_ID}', 'Ada', 'PERSON/{PERSON_ID}/main.md', '1815-12-10', '', '[\"{LINK_ID}\"]');
             INSERT INTO experience VALUES ('{EXPERIENCE_ID}', '{PERSON_ID}', 'Research', 'EXPERIENCE/{EXPERIENCE_ID}/main.md', '[]', '[]');
             INSERT INTO fact VALUES ('{FACT_ID}', 'Publication', '2026-01-15', 'FACT/{FACT_ID}/main.md', '[\"{EXPERIENCE_ID}\"]', '[\"{PERSON_ID}\"]', '[\"{LINK_ID}\"]');
             INSERT INTO link VALUES ('{LINK_ID}', 'Mentors', 'relationship', 'LINK/{LINK_ID}/main.md', '[\"{PERSON_ID}\", \"{FACT_ID}\"]');"
        )).unwrap();
        root
    }

    #[test]
    fn creates_recovers_and_releases_workspace_locks() {
        let root = fixture_workspace();
        let root_string = root.to_string_lossy().to_string();
        assert!(!check_workspace_lock(root_string.clone()).unwrap().is_read_only);
        assert!(check_workspace_lock(root_string.clone()).unwrap().is_read_only);
        release_workspace_lock(root_string.clone()).unwrap();
        fs::create_dir_all(root.join(LOCK_DIRECTORY)).unwrap();
        fs::write(root.join(LOCK_DIRECTORY).join(LOCK_FILENAME), "999999").unwrap();
        assert!(check_workspace_lock(root_string.clone()).unwrap().is_stale_recovered);
        release_workspace_lock(root_string).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn serializes_workspace_lock_payload() {
        let status = LockStatus {
            is_locked: false,
            holder_pid: Some(42),
            is_stale_recovered: true,
            is_read_only: false,
        };
        assert_eq!(serde_json::to_value(status).unwrap(), json!({
            "isLocked": false,
            "holderPid": 42,
            "isStaleRecovered": true,
            "isReadOnly": false
        }));
    }

    #[test]
    fn loads_non_empty_database_and_verifies_all_entity_markdown_paths() {
        let root = fixture_workspace();
        let model = service::read_model_database(&root.to_string_lossy()).unwrap();
        assert_eq!((model.people.len(), model.experiences.len(), model.facts.len(), model.links.len()), (1, 1, 1, 1));
        assert!(expected_markdown_paths(&model).iter().all(|path| root.join(path).is_file()));
        assert!(find_unreferenced_entity_folders(&root, &expected_markdown_paths(&model)).unwrap().is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn detects_missing_markdown_in_a_populated_workspace_fixture() {
        let root = fixture_workspace();
        let model = service::read_model_database(&root.to_string_lossy()).unwrap();
        fs::remove_file(root.join("FACT").join(FACT_ID).join("main.md")).unwrap();
        let missing = expected_markdown_paths(&model).into_iter()
            .filter(|path| !root.join(path).is_file()).collect::<Vec<_>>();
        assert_eq!(missing, vec![format!("FACT/{FACT_ID}/main.md")]);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn identifies_unreferenced_markdown_folders_in_a_populated_workspace_fixture() {
        let root = fixture_workspace();
        let model = service::read_model_database(&root.to_string_lossy()).unwrap();
        let extra = root.join("PERSON").join("55555555-5555-5555-5555-555555555555");
        fs::create_dir_all(extra.join("assets")).unwrap();
        fs::write(extra.join("main.md"), "# Unreferenced\n\nFixture content.").unwrap();

        assert_eq!(
            find_unreferenced_entity_folders(&root, &expected_markdown_paths(&model)).unwrap(),
            vec!["PERSON/55555555-5555-5555-5555-555555555555/main.md"]
        );
        fs::remove_dir_all(root).unwrap();
    }
}