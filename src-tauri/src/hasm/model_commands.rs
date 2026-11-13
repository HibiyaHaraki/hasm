//! SEQ-02 workspace lock, model load, and storage verification commands.

use crate::hasm::service;
use crate::hasm::types::{LockStatus, ModelDatabase, ProgressPayload, VerificationResult};
use log::{info, warn};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::{AppHandle, Emitter, Runtime};

// Minimum wall-clock gap between progress emits so large packages stream smooth,
// frequent updates without flooding the IPC channel on every single row.
const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(150);

const LOCK_DIRECTORY: &str = ".hasm";
const LOCK_FILENAME: &str = "lock";
const ENTITY_TYPES: [&str; 4] = ["PERSON", "EXPERIENCE", "FACT", "LINK"];

/// [REQ-02-FUNC-103][REQ-02-FUNC-105][REQ-02-FUNC-107][REQ-02-FUNC-110][REQ-02-FUNC-409]
/// [REQ-02-RULE-002][REQ-02-RULE-010][REQ-02-RULE-015] Checks, acquires, or stale-recovers the
/// `.hasm/lock` file on a blocking worker so the WebView stays responsive.
#[tauri::command]
pub async fn check_workspace_lock(path: String) -> Result<LockStatus, String> {
    tauri::async_runtime::spawn_blocking(move || check_workspace_lock_blocking(path))
        .await
        .map_err(|error| {
            let message = format!("Workspace lock worker failed: {error}");
            log::error!("[SEQ-MD-02][LOCK] {message}");
            message
        })?
}

fn check_workspace_lock_blocking(path: String) -> Result<LockStatus, String> {
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
    if holder_pid == Some(std::process::id()) {
        info!("[SEQ-MD-02][LOCK] retaining workspace lock owned by this process");
        return Ok(unlocked_status(false));
    }
    if let Some(pid) = holder_pid {
        let is_active = process_is_active(pid).map_err(|error| {
            let message = format!("Failed to inspect workspace lock holder {pid}: {error}");
            log::error!("[SEQ-MD-02][LOCK] {message}");
            message
        })?;
        if is_active {
            warn!("[SEQ-MD-02][LOCK] workspace is active in another process");
            return Ok(LockStatus {
                is_locked: true,
                holder_pid,
                is_stale_recovered: false,
                is_read_only: true,
            });
        }
    }

    fs::remove_file(&lock_path).map_err(|error| error.to_string())?;
    write_lock(&lock_path)?;
    info!("[SEQ-MD-02][LOCK] stale workspace lock recovered");
    Ok(unlocked_status(true))
}

/// [REQ-02-RULE-003][REQ-02-FUNC-109] Deletes `.hasm/lock` so the workspace is released
/// on window close or clean workspace switching.
#[tauri::command]
pub fn release_workspace_lock(path: String) -> Result<(), String> {
    let lock_path = workspace_root(&path)?.join(LOCK_DIRECTORY).join(LOCK_FILENAME);
    if lock_path.exists() {
        fs::remove_file(lock_path).map_err(|error| error.to_string())?;
        info!("[SEQ-MD-02][LOCK] workspace lock released");
    }
    Ok(())
}

/// [REQ-07-RULE-003][REQ-07-FUNC-203] Releases the active workspace lock (unless read-only)
/// before the frontend clears its stores and navigates back to `/select`.
#[tauri::command]
pub fn switch_workspace_cleanly(current_model_path: String, is_read_only: bool) -> Result<(), String> {
    if !is_read_only {
        release_workspace_lock(current_model_path)?;
    }
    info!("[SEQ-MD-07][SWITCH] workspace switched cleanly");
    Ok(())
}

/// [REQ-02-FUNC-202][REQ-02-FUNC-206][REQ-02-FUNC-406][REQ-02-FUNC-410][REQ-02-RULE-008]
/// [REQ-02-RULE-015] Loads `hasm.db` metadata (no Markdown bodies) on a blocking worker,
/// streaming throttled per-entity-type progress events.
#[tauri::command]
pub async fn load_hasm_model_db<R: Runtime>(app: AppHandle<R>, path: String) -> Result<ModelDatabase, String> {
    // SEQ-MD-02: filesystem/SQLite work must not block WebView input or scrolling.
    tauri::async_runtime::spawn_blocking(move || load_hasm_model_db_blocking(app, path))
        .await
        .map_err(|error| {
            let message = format!("Database loading worker failed: {error}");
            log::error!("[SEQ-MD-02][LOAD] {message}");
            message
        })?
}

fn load_hasm_model_db_blocking<R: Runtime>(app: AppHandle<R>, path: String) -> Result<ModelDatabase, String> {
    emit_progress(&app, "DB_LOAD", 0, 1, "Opening workspace database")?;

    let mut last_emit = Instant::now();
    let mut last_step = String::new();
    // Metadata-only load: entity Markdown bodies stay on disk until SEQ-04 opens a
    // single ticket, which keeps the SEQ-02 IPC payload proportional to entity count.
    let model = service::read_model_database_with_stage_progress(&path, false, &mut |step, current, total, message| {
        let now = Instant::now();
        if step != last_step || current >= total || now.duration_since(last_emit) >= PROGRESS_EMIT_INTERVAL {
            last_emit = now;
            last_step = step.to_string();
            if let Err(error) = emit_progress(&app, step, current, total, message) {
                warn!("[SEQ-MD-02][LOAD] failed to emit progress: {error}");
            }
        }
    })?;

    emit_progress(
        &app,
        "DB_LOAD",
        1,
        1,
        &format!(
            "Loaded {} PERSON, {} EXPERIENCE, {} FACT, {} LINK records",
            model.people.len(),
            model.experiences.len(),
            model.facts.len(),
            model.links.len()
        ),
    )?;
    info!("[SEQ-MD-02][LOAD] database metadata loaded");
    Ok(model)
}

/// [REQ-02-FUNC-301][REQ-02-FUNC-303][REQ-02-FUNC-304][REQ-02-FUNC-408][REQ-02-RULE-006]
/// [REQ-02-RULE-015] Verifies every loaded entity's `main.md` exists (fatal when missing)
/// and reports unreferenced folders, streaming `model-verify-progress` on a blocking worker.
#[tauri::command]
pub async fn verify_hasm_storage<R: Runtime>(
    app: AppHandle<R>,
    path: String,
    model: ModelDatabase,
) -> Result<VerificationResult, String> {
    tauri::async_runtime::spawn_blocking(move || verify_hasm_storage_blocking(app, path, model))
        .await
        .map_err(|error| {
            let message = format!("Storage verification worker failed: {error}");
            log::error!("[SEQ-MD-02][VERIFY] {message}");
            message
        })?
}

fn verify_hasm_storage_blocking<R: Runtime>(
    app: AppHandle<R>,
    path: String,
    model: ModelDatabase,
) -> Result<VerificationResult, String> {
    let root = workspace_root(&path)?;
    let expected = expected_markdown_paths(&model);
    let total = expected.len().max(1);
    let mut missing_entities = Vec::new();
    let mut last_emit = Instant::now();

    for (index, entity_path) in expected.iter().enumerate() {
        if !root.join(entity_path).is_file() {
            missing_entities.push(entity_path.clone());
        }
        let current = index + 1;
        let now = Instant::now();
        if current >= total || now.duration_since(last_emit) >= PROGRESS_EMIT_INTERVAL {
            last_emit = now;
            emit_progress(&app, "STORAGE_VERIFY", current, total, "Verifying workspace storage")?;
        }
    }

    if !missing_entities.is_empty() {
        warn!("[SEQ-MD-02][VERIFY] required Markdown files are missing");
        return Err(format!("ERR_MISSING_STORAGE_FOLDER: {}", missing_entities.join(", ")));
    }

    let unreferenced_entities = find_unreferenced_entity_folders(Some(&app), &root, &expected)?;
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

fn process_is_active(pid: u32) -> Result<bool, String> {
    // Refresh only the one PID that holds the lock; a full `System::new_all()` snapshot
    // enumerates every process on the machine on each workspace open.
    let mut system = System::new().map_err(|error| error.to_string())?;
    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
        true,
        ProcessRefreshKind::nothing(),
    );
    Ok(system.process(Pid::from_u32(pid)).is_some())
}

fn emit_progress<R: Runtime>(app: &AppHandle<R>, step: &str, current: usize, total: usize, message: &str) -> Result<(), String> {
    let event_name = if step == "STORAGE_VERIFY" { "model-verify-progress" } else { "model-load-progress" };
    app.emit(event_name, ProgressPayload {
        step: step.to_string(), current, total,
        percentage: if total == 0 { 100.0 } else { (current as f32 / total as f32) * 100.0 },
        message: message.to_string(),
    }).map_err(|error| error.to_string())
}

fn expected_markdown_paths(model: &ModelDatabase) -> Vec<String> {
    model.people.iter().map(|entity| entity.person_description_path.clone())
        .chain(model.experiences.iter().map(|entity| entity.experience_description_path.clone()))
        .chain(model.facts.iter().map(|entity| entity.fact_description_path.clone()))
        .chain(model.links.iter().map(|entity| entity.link_description_path.clone()))
        .collect()
}

fn find_unreferenced_entity_folders<R: Runtime>(
    app: Option<&AppHandle<R>>,
    root: &Path,
    expected: &[String],
) -> Result<Vec<String>, String> {
    // Pre-scan directory entries first so a real total is known and progress can
    // stream smoothly (large workspaces previously ran this whole scan with zero
    // progress emits, tripping the frontend's watchdog).
    let mut entries_by_type = Vec::new();
    let mut total = 0usize;
    for entity_type in ENTITY_TYPES {
        let directory = root.join(entity_type);
        let entries = if directory.is_dir() {
            fs::read_dir(&directory)
                .map_err(|error| error.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|error| error.to_string())?
        } else {
            Vec::new()
        };
        total += entries.len();
        entries_by_type.push((entity_type, entries));
    }
    let total = total.max(1);

    // Set membership instead of a linear scan per folder; the previous `Vec::any` made
    // this loop O(N^2), which dominated verification time for large packages.
    let expected_paths: HashSet<&str> = expected.iter().map(String::as_str).collect();

    let mut unreferenced = Vec::new();
    let mut processed = 0usize;
    let mut last_emit = Instant::now();

    for (entity_type, entries) in entries_by_type {
        for entry in entries {
            let markdown = entry.path().join("main.md");
            let relative = markdown.strip_prefix(root).map_err(|error| error.to_string())?.to_string_lossy().replace('\\', "/");
            if markdown.is_file() && !expected_paths.contains(relative.as_str()) { unreferenced.push(relative); }

            processed += 1;
            let now = Instant::now();
            if let Some(app) = app {
                if processed >= total || now.duration_since(last_emit) >= PROGRESS_EMIT_INTERVAL {
                    last_emit = now;
                    emit_progress(app, "STORAGE_VERIFY", processed, total, &format!("Scanning {entity_type} folders"))?;
                }
            }
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
        assert!(!check_workspace_lock_blocking(root_string.clone()).unwrap().is_read_only);
        for _ in 0..12 {
            let status = check_workspace_lock_blocking(root_string.clone()).unwrap();
            assert!(!status.is_read_only);
            assert!(!status.is_stale_recovered);
            assert_eq!(status.holder_pid, Some(std::process::id()));
        }
        release_workspace_lock(root_string.clone()).unwrap();
        fs::create_dir_all(root.join(LOCK_DIRECTORY)).unwrap();
        fs::write(root.join(LOCK_DIRECTORY).join(LOCK_FILENAME), "999999").unwrap();
        assert!(check_workspace_lock_blocking(root_string.clone()).unwrap().is_stale_recovered);
        release_workspace_lock(root_string).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn keeps_other_live_process_workspaces_read_only() {
        let root = fixture_workspace();
        let root_string = root.to_string_lossy().to_string();
        check_workspace_lock_blocking(root_string.clone()).unwrap();
        let mut system = System::new().expect("process system should initialize");
        let current = Pid::from_u32(std::process::id());
        system.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[current]), true, ProcessRefreshKind::nothing(),
        );
        let other_pid = system.process(current).unwrap().parent().unwrap().as_u32();
        assert_ne!(other_pid, std::process::id());
        let lock = root.join(LOCK_DIRECTORY).join(LOCK_FILENAME);
        fs::write(&lock, other_pid.to_string()).unwrap();
        let status = check_workspace_lock_blocking(root_string).unwrap();
        assert!(status.is_read_only);
        assert_eq!(status.holder_pid, Some(other_pid));
        assert_eq!(fs::read_to_string(lock).unwrap(), other_pid.to_string());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn switches_workspace_cleanly_with_and_without_lock_release() {
        let root = fixture_workspace();
        let root_string = root.to_string_lossy().to_string();

        check_workspace_lock_blocking(root_string.clone()).unwrap();
        let lock_path = root.join(LOCK_DIRECTORY).join(LOCK_FILENAME);
        assert!(lock_path.is_file());

        switch_workspace_cleanly(root_string.clone(), false).unwrap();
        assert!(!lock_path.exists());

        check_workspace_lock_blocking(root_string.clone()).unwrap();
        assert!(lock_path.exists());
        switch_workspace_cleanly(root_string.clone(), true).unwrap();
        assert!(lock_path.exists());

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
        assert!(find_unreferenced_entity_folders::<tauri::Wry>(None, &root, &expected_markdown_paths(&model)).unwrap().is_empty());
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
            find_unreferenced_entity_folders::<tauri::Wry>(None, &root, &expected_markdown_paths(&model)).unwrap(),
            vec!["PERSON/55555555-5555-5555-5555-555555555555/main.md"]
        );
        fs::remove_dir_all(root).unwrap();
    }

    /// Creates a workspace holding `per_type` folder-only entities of each type and no
    /// database, so the load path has to bootstrap every row.
    fn scale_fixture_workspace(per_type: usize) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "hasm-seq-02-scale-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        for (type_index, entity_type) in ENTITY_TYPES.iter().enumerate() {
            for index in 0..per_type {
                let id = uuid::Uuid::from_u128(
                    0x1000_0000_0000_0000_0000_0000_0000_0000u128
                        + (type_index as u128) * 1_000_000
                        + index as u128,
                );
                let folder = root.join(entity_type).join(id.to_string());
                fs::create_dir_all(&folder).unwrap();
                fs::write(folder.join("main.md"), format!("# {entity_type} {index}\n\nbody")).unwrap();
            }
        }
        root
    }

    // TC-02-RUST-PERF-001
    #[test]
    fn loads_large_package_metadata_without_reading_entity_markdown() {
        let per_type = 500;
        let root = scale_fixture_workspace(per_type);
        let root_string = root.to_string_lossy().to_string();

        let model = service::read_model_database_with_progress(&root_string, false, &mut |_, _, _| {}).unwrap();

        assert_eq!(model.people.len(), per_type);
        assert_eq!(model.experiences.len(), per_type);
        assert_eq!(model.facts.len(), per_type);
        assert_eq!(model.links.len(), per_type);
        assert!(model.people.iter().all(|entity| entity.markdown.is_empty()));
        assert!(model.facts.iter().all(|entity| entity.markdown.is_empty()));
        assert!(model.people.iter().all(|entity| !entity.markdown_path.is_empty()));

        // Storage verification must stay linear: a quadratic scan of this fixture would
        // not complete inside the SEQ-02 budget.
        assert!(find_unreferenced_entity_folders::<tauri::Wry>(None, &root, &expected_markdown_paths(&model)).unwrap().is_empty());

        fs::remove_dir_all(root).unwrap();
    }

    // TC-02-RUST-PERF-002
    #[test]
    fn reloading_an_unchanged_package_inserts_no_additional_rows() {
        let per_type = 200;
        let root = scale_fixture_workspace(per_type);
        let root_string = root.to_string_lossy().to_string();

        service::read_model_database_with_progress(&root_string, false, &mut |_, _, _| {}).unwrap();
        let reloaded = service::read_model_database_with_progress(&root_string, false, &mut |_, _, _| {}).unwrap();

        assert_eq!(reloaded.people.len(), per_type);
        let connection = Connection::open(root.join("main.db")).unwrap();
        for (table, id_column) in [("person", "person_id"), ("experience", "experience_id"), ("fact", "fact_id"), ("link", "link_id")] {
            let distinct: i64 = connection
                .query_row(&format!("SELECT COUNT(DISTINCT {id_column}) FROM {table}"), [], |row| row.get(0))
                .unwrap();
            assert_eq!(distinct as usize, per_type, "{table} gained duplicate bootstrap rows");
        }
        // [REQ-02-FUNC-411] Folder-only EXPERIENCE bootstrap must succeed with the
        // nil-UUID owner placeholder because no SQL foreign key blocks it.
        let nil_owners: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM experience WHERE person_id = '00000000-0000-0000-0000-000000000000'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(nil_owners as usize, per_type, "bootstrapped EXPERIENCE rows must carry the nil-UUID owner placeholder");
        drop(connection);
        fs::remove_dir_all(root).unwrap();
    }

    // TC-02-RUST-011 / TC-02-RUST-012: [REQ-02-FUNC-409] targeted holder-PID liveness probe.
    #[test]
    fn inspects_only_the_recorded_holder_pid_for_liveness() {
        assert!(process_is_active(std::process::id()).unwrap(), "the current process must be reported alive");
        assert!(!process_is_active(999_999).unwrap(), "a dead holder PID must be reported inactive");
    }

    // TC-02-RUST-013: [REQ-02-DATA-001][REQ-02-DATA-002][REQ-02-DATA-003][REQ-02-DATA-004]
    // invalid workspace roots and malformed payloads are refused with descriptive errors.
    #[test]
    fn surfaces_descriptive_errors_for_invalid_roots_and_malformed_payloads() {
        let missing = std::env::temp_dir().join(format!(
            "hasm-seq-02-missing-{}",
            SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()
        ));
        let missing_string = missing.to_string_lossy().to_string();
        let error = check_workspace_lock_blocking(missing_string.clone()).unwrap_err();
        assert!(error.contains("does not exist"), "{error}");
        assert!(!missing.exists(), "an invalid workspace must not gain lock scaffolding");
        let error = release_workspace_lock(missing_string).unwrap_err();
        assert!(error.contains("does not exist"), "{error}");

        // Malformed IPC payloads must be refused instead of silently defaulted.
        assert!(serde_json::from_value::<LockStatus>(json!({ "isLocked": "yes" })).is_err());
        assert!(serde_json::from_value::<LockStatus>(json!({ "holderPid": 42 })).is_err());
        assert!(serde_json::from_value::<ProgressPayload>(json!({ "step": "DB_LOAD" })).is_err());
        assert!(serde_json::from_value::<ProgressPayload>(json!({
            "step": "DB_LOAD", "current": "two", "total": 4, "percentage": 50.0, "message": ""
        }))
        .is_err());
    }

    // TC-02-RUST-014: [REQ-02-RULE-008][REQ-02-FUNC-406] metadata-only loads never read
    // entity Markdown bodies, so a deleted body surfaces at storage verification instead.
    #[test]
    fn loads_metadata_without_touching_markdown_bodies() {
        let root = fixture_workspace();
        fs::remove_file(root.join("PERSON").join(PERSON_ID).join("main.md")).unwrap();

        let model = service::read_model_database_with_progress(&root.to_string_lossy(), false, &mut |_, _, _| {}).unwrap();
        assert_eq!((model.people.len(), model.experiences.len(), model.facts.len(), model.links.len()), (1, 1, 1, 1));
        assert!(model.people.iter().all(|entity| entity.markdown.is_empty() && !entity.markdown_path.is_empty()));
        assert!(model.facts.iter().all(|entity| entity.markdown.is_empty() && !entity.markdown_path.is_empty()));

        let missing: Vec<String> = expected_markdown_paths(&model)
            .into_iter()
            .filter(|path| !root.join(path).is_file())
            .collect();
        assert_eq!(missing, vec![format!("PERSON/{PERSON_ID}/main.md")]);
        fs::remove_dir_all(root).unwrap();
    }

    // TC-02-RUST-015: [REQ-02-RULE-009][REQ-02-FUNC-403] reopening an unchanged package
    // must not commit any write to main.db (observed via PRAGMA data_version).
    #[test]
    fn reopens_unchanged_package_without_database_writes() {
        let per_type = 25;
        let root = scale_fixture_workspace(per_type);
        let root_string = root.to_string_lossy().to_string();
        service::read_model_database_with_progress(&root_string, false, &mut |_, _, _| {}).unwrap();

        let observer = Connection::open(root.join("main.db")).unwrap();
        let before: i64 = observer.query_row("PRAGMA data_version", [], |row| row.get(0)).unwrap();
        let reloaded = service::read_model_database_with_progress(&root_string, false, &mut |_, _, _| {}).unwrap();
        let after: i64 = observer.query_row("PRAGMA data_version", [], |row| row.get(0)).unwrap();

        assert_eq!(before, after, "reopening an unchanged package must not write to main.db");
        assert_eq!(reloaded.people.len(), per_type);
        drop(observer);
        fs::remove_dir_all(root).unwrap();
    }

    // TC-02-RUST-016: [REQ-02-FUNC-402] bootstrap runs in one transaction, so a failing
    // insert rolls back every previously inserted row instead of leaving autocommit debris.
    #[test]
    fn rolls_back_the_entire_bootstrap_when_one_insert_fails() {
        let root = scale_fixture_workspace(5);
        let root_string = root.to_string_lossy().to_string();
        {
            let connection = Connection::open(root.join("main.db")).unwrap();
            service::ensure_schema(&connection).unwrap();
            connection
                .execute_batch(
                    "CREATE TRIGGER abort_bootstrap BEFORE INSERT ON fact BEGIN SELECT RAISE(ABORT, 'bootstrap insert aborted'); END;",
                )
                .unwrap();
        }

        let error = service::read_model_database_with_progress(&root_string, false, &mut |_, _, _| {}).unwrap_err();
        assert!(error.contains("bootstrap insert aborted"), "{error}");

        let connection = Connection::open(root.join("main.db")).unwrap();
        for table in ["person", "experience", "fact", "link"] {
            let count: i64 = connection
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0))
                .unwrap();
            assert_eq!(count, 0, "{table} kept rows from the aborted single-transaction bootstrap");
        }
        drop(connection);
        fs::remove_dir_all(root).unwrap();
    }

    // TC-02-RUST-017: [REQ-02-FUNC-404][REQ-02-FUNC-405][REQ-02-FUNC-411] tuning pragmas,
    // index-backed list ordering without temporary sort B-trees, and relaxed ownership.
    #[test]
    fn keeps_tuning_pragmas_and_relaxed_ownership_on_every_connection() {
        let root = scale_fixture_workspace(2);
        let root_string = root.to_string_lossy().to_string();
        service::read_model_database_with_progress(&root_string, false, &mut |_, _, _| {}).unwrap();

        let connection = service::open_connection(&root).unwrap();
        let synchronous: i64 = connection.query_row("PRAGMA synchronous", [], |row| row.get(0)).unwrap();
        assert_eq!(synchronous, 1, "synchronous must be NORMAL");
        let temp_store: i64 = connection.query_row("PRAGMA temp_store", [], |row| row.get(0)).unwrap();
        assert_eq!(temp_store, 2, "temp_store must be MEMORY");
        let cache_size: i64 = connection.query_row("PRAGMA cache_size", [], |row| row.get(0)).unwrap();
        assert!(cache_size < 0, "cache_size must stay negative (KiB-based), got {cache_size}");
        let foreign_keys: i64 = connection.query_row("PRAGMA foreign_keys", [], |row| row.get(0)).unwrap();
        assert_eq!(foreign_keys, 0, "foreign key enforcement must stay disabled");

        // The experience table must not declare a SQL foreign key on person_id, so an
        // owner-less EXPERIENCE row can be stored before its PERSON exists.
        let declared_foreign_keys: i64 = {
            let mut statement = connection.prepare("PRAGMA foreign_key_list(experience)").unwrap();
            let rows = statement.query_map([], |_| Ok(())).unwrap();
            rows.count() as i64
        };
        assert_eq!(declared_foreign_keys, 0, "experience.person_id must not carry a SQL foreign key");
        connection
            .execute(
                "INSERT INTO experience (experience_id, person_id) VALUES ('99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888888')",
                [],
            )
            .unwrap();

        // No entity list ordering may materialize a temporary sort B-tree.
        for (table, name_column, id_column) in [
            ("person", "person_name", "person_id"),
            ("experience", "experience_name", "experience_id"),
            ("fact", "fact_name", "fact_id"),
            ("link", "link_name", "link_id"),
        ] {
            let mut statement = connection
                .prepare(&format!(
                    "EXPLAIN QUERY PLAN SELECT {id_column} FROM {table} ORDER BY COALESCE(NULLIF({name_column}, ''), {id_column})"
                ))
                .unwrap();
            let details: Vec<String> = statement
                .query_map([], |row| row.get::<_, String>(3))
                .unwrap()
                .collect::<Result<_, _>>()
                .unwrap();
            assert!(
                details.iter().all(|detail| !detail.to_uppercase().contains("TEMP B-TREE")),
                "{table} list ordering used a temporary sort B-tree: {details:?}"
            );
        }
        drop(connection);
        fs::remove_dir_all(root).unwrap();
    }

    // TC-02-RUST-018 / TC-02-RUST-019: [REQ-02-RULE-005][REQ-02-RULE-007][REQ-02-FUNC-206]
    // [REQ-02-FUNC-401][REQ-02-FUNC-408][REQ-02-FUNC-410] ordered stage streaming with real
    // per-type totals, no watchdog-length silence, and a linear folder scan at scale.
    #[test]
    fn streams_ordered_stage_progress_without_watchdog_gaps_at_scale() {
        let per_type = 500;
        let root = scale_fixture_workspace(per_type);
        let root_string = root.to_string_lossy().to_string();

        let mut events: Vec<(Instant, String, usize, usize)> = Vec::new();
        let model = service::read_model_database_with_stage_progress(&root_string, false, &mut |step, current, total, _| {
            events.push((Instant::now(), step.to_string(), current, total));
        })
        .unwrap();
        assert_eq!(model.people.len(), per_type);

        // Stages must run strictly sequentially: folder sync then per-type loads.
        let mut stage_sequence: Vec<String> = Vec::new();
        for (_, step, _, _) in &events {
            if stage_sequence.last() != Some(step) {
                stage_sequence.push(step.clone());
            }
        }
        assert_eq!(
            stage_sequence,
            ["DB_SYNC", "DB_LOAD_PERSON", "DB_LOAD_EXPERIENCE", "DB_LOAD_FACT", "DB_LOAD_LINK"],
            "stages must stream in sequential order exactly once"
        );
        for stage in ["DB_LOAD_PERSON", "DB_LOAD_EXPERIENCE", "DB_LOAD_FACT", "DB_LOAD_LINK"] {
            assert!(
                events.iter().any(|(_, step, _, total)| step == stage && *total == per_type),
                "{stage} must report the real per-type total"
            );
        }

        // [REQ-02-RULE-005] no silent gap may approach the 10,000ms watchdog threshold.
        let max_gap = events
            .windows(2)
            .map(|window| window[1].0.duration_since(window[0].0))
            .max()
            .unwrap();
        assert!(max_gap < Duration::from_secs(10), "progress stalled for {max_gap:?}");

        // [REQ-02-FUNC-408][REQ-02-RULE-007] hash-set folder scan stays linear at scale.
        let started = Instant::now();
        assert!(find_unreferenced_entity_folders::<tauri::Wry>(None, &root, &expected_markdown_paths(&model)).unwrap().is_empty());
        assert!(started.elapsed() < Duration::from_secs(10), "folder scan exceeded the linear-time budget");

        fs::remove_dir_all(root).unwrap();
    }

    // TC-02-RUST-PERF-003
    #[test]
    fn tunes_sqlite_for_large_packages_and_indexes_every_list_sort_key() {
        let root = scale_fixture_workspace(2);
        let root_string = root.to_string_lossy().to_string();
        service::read_model_database_with_progress(&root_string, false, &mut |_, _, _| {}).unwrap();

        let connection = Connection::open(root.join("main.db")).unwrap();
        let journal_mode: String = connection.query_row("PRAGMA journal_mode", [], |row| row.get(0)).unwrap();
        assert_eq!(journal_mode.to_lowercase(), "wal");

        for index_name in ["idx_person_sort", "idx_experience_sort", "idx_fact_sort", "idx_link_sort", "idx_experience_person"] {
            let count: i64 = connection
                .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?1", [index_name], |row| row.get(0))
                .unwrap();
            assert_eq!(count, 1, "missing index {index_name}");
        }

        // The list query must stream from the sort index instead of materializing a
        // temporary B-tree over every entity row.
        let plan: String = connection
            .query_row(
                "EXPLAIN QUERY PLAN SELECT person_id FROM person ORDER BY COALESCE(NULLIF(person_name, ''), person_id)",
                [],
                |row| row.get(3),
            )
            .unwrap();
        assert!(plan.contains("idx_person_sort"), "unexpected query plan: {plan}");

        drop(connection);
        fs::remove_dir_all(root).unwrap();
    }
}