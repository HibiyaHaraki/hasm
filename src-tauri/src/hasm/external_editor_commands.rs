//! SEQ-05 detached HASM Markdown editor invocation.
use crate::hasm::types::LaunchExternalAppPayload;
use log::info;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Manager};

const MARKDOWN_EXECUTABLE: &str = "hasm_markdown.exe";

/// [REQ-05-RULE-001][REQ-05-RULE-002][REQ-05-RULE-003][REQ-05-RULE-005]
/// [REQ-05-FUNC-102][REQ-05-FUNC-103][REQ-05-FUNC-105][REQ-05-FUNC-106]
/// [REQ-05-FUNC-108][REQ-05-FUNC-109][REQ-05-FUNC-111][REQ-05-FUNC-113]
/// Spawns the dedicated `hasm_markdown.exe` editor detached on the entity's
/// UUID directory, rejecting missing directories/executables, 5,000ms spawn
/// timeouts, and OS spawn failures with typed error codes.
#[tauri::command]
pub fn launch_external_markdown_app(app: AppHandle, model_root: String, entity_type: String, entity_id: String) -> Result<LaunchExternalAppPayload, String> {
    let target = entity_directory(&model_root, &entity_type, &entity_id)?;
    let executable = packaged_markdown_executable(&app)?;
    launch_detached(&executable, &target)?;
    info!("[SEQ-MD-05][LAUNCH] external Markdown editor spawned");
    Ok(LaunchExternalAppPayload { target_dir_path: target.to_string_lossy().to_string(), executable_path: executable.to_string_lossy().to_string() })
}

fn entity_directory(model_root: &str, entity_type: &str, entity_id: &str) -> Result<PathBuf, String> {
    if !matches!(entity_type, "PERSON" | "EXPERIENCE" | "FACT" | "LINK") { return Err("ERR_ENTITY_DIRECTORY_NOT_FOUND: unsupported entity type".to_string()); }
    let directory = Path::new(model_root).join(entity_type).join(entity_id);
    if directory.is_dir() { Ok(directory) } else { Err(format!("ERR_ENTITY_DIRECTORY_NOT_FOUND: {}", directory.display())) }
}

fn packaged_markdown_executable(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        if let Ok(executable) = executable_from_resource_dir(&resource_dir) {
            return Ok(executable);
        }
    }
    let development_stage = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries").join(MARKDOWN_EXECUTABLE);
    if development_stage.is_file() { Ok(development_stage) } else { Err(format!("ERR_MARKDOWN_EXECUTABLE_NOT_FOUND: {}", development_stage.display())) }
}

fn executable_from_resource_dir(resource_dir: &Path) -> Result<PathBuf, String> {
    let executable = resource_dir.join("binaries").join(MARKDOWN_EXECUTABLE);
    if executable.is_file() { Ok(executable) } else { Err(format!("ERR_MARKDOWN_EXECUTABLE_NOT_FOUND: {}", executable.display())) }
}

fn launch_detached(executable: &Path, target: &Path) -> Result<(), String> {
    let executable = executable.to_path_buf();
    let target = target.to_path_buf();
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        let _ = sender.send(spawn_process(&executable, &target));
    });
    receiver.recv_timeout(Duration::from_millis(5000)).map_err(|_| "ERR_LAUNCH_TIMEOUT: 5000".to_string())?
}

fn spawn_process(executable: &Path, target: &Path) -> Result<(), String> {
    let mut command = Command::new(executable);
    command.arg(target);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0000_0200);
    }
    command.spawn().map(|_| ()).map_err(|error| format!("ERR_PROCESS_SPAWN_FAILED: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use std::time::Instant;

    /// Collision-free scratch directory so concurrent test runs stay isolated.
    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let dir = std::env::temp_dir().join(format!("hasm-seq-05-{label}-{}-{nanos}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn serializes_launch_payload_and_resolves_target_directory() {
        let root = std::env::temp_dir().join("hasm-seq-05-target");
        let target = root.join("FACT").join("id-1");
        fs::create_dir_all(&target).unwrap();
        assert_eq!(entity_directory(&root.to_string_lossy(), "FACT", "id-1").unwrap(), target);
        assert_eq!(serde_json::to_value(LaunchExternalAppPayload { target_dir_path: "C:/target".to_string(), executable_path: "C:/hasm_markdown.exe".to_string() }).unwrap(), json!({ "targetDirPath": "C:/target", "executablePath": "C:/hasm_markdown.exe" }));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_missing_entity_directory_and_missing_executable() {
        assert!(entity_directory("C:/missing", "FACT", "id").unwrap_err().contains("ERR_ENTITY_DIRECTORY_NOT_FOUND"));
        assert!(executable_from_resource_dir(Path::new("C:/missing")).unwrap_err().contains("ERR_MARKDOWN_EXECUTABLE_NOT_FOUND"));
    }

    /// [REQ-05-RULE-001][REQ-05-RULE-006][REQ-05-FUNC-105][REQ-05-FUNC-106]
    /// TC-05-RUST-007: the staged `binaries/hasm_markdown.exe` layout resolves
    /// to the dedicated submodule executable without any rejection.
    #[test]
    fn tc_05_rust_007_resolves_staged_markdown_executable_from_binaries_layout() {
        let resource_dir = unique_temp_dir("stage");
        let staged = resource_dir.join("binaries").join(MARKDOWN_EXECUTABLE);
        fs::create_dir_all(staged.parent().unwrap()).unwrap();
        fs::write(&staged, b"stub-executable").unwrap();
        let resolved = executable_from_resource_dir(&resource_dir).unwrap();
        assert_eq!(resolved, staged);
        assert_eq!(resolved.file_name().unwrap().to_string_lossy(), "hasm_markdown.exe");
        fs::remove_dir_all(resource_dir).unwrap();
    }

    /// [REQ-05-RULE-003][REQ-05-FUNC-102][REQ-05-DATA-001] TC-05-RUST-008:
    /// entity types outside the PERSON/EXPERIENCE/FACT/LINK request contract
    /// never resolve a target path, even when a matching directory physically
    /// exists on disk.
    #[test]
    fn tc_05_rust_008_rejects_unsupported_entity_type_before_path_resolution() {
        let root = unique_temp_dir("types");
        fs::create_dir_all(root.join("NOTE").join("id-1")).unwrap();
        for entity_type in ["NOTE", "fact", "..", "FACT/.."] {
            let error = entity_directory(&root.to_string_lossy(), entity_type, "id-1").unwrap_err();
            assert!(error.contains("ERR_ENTITY_DIRECTORY_NOT_FOUND"), "{entity_type}: {error}");
        }
        fs::remove_dir_all(root).unwrap();
    }

    /// [REQ-05-RULE-002][REQ-05-RULE-005][REQ-05-FUNC-109][REQ-05-FUNC-111]
    /// TC-05-RUST-009: a spawn failure resolves promptly inside the 5,000ms
    /// bound and maps to `ERR_PROCESS_SPAWN_FAILED`, not the expiry error.
    #[test]
    fn tc_05_rust_009_spawn_failure_maps_to_process_spawn_failed_within_bound() {
        let root = unique_temp_dir("spawn");
        let target = root.join("FACT").join("id-1");
        fs::create_dir_all(&target).unwrap();
        let missing_executable = root.join("missing").join(MARKDOWN_EXECUTABLE);
        let started = Instant::now();
        let error = launch_detached(&missing_executable, &target).unwrap_err();
        assert!(started.elapsed() < Duration::from_millis(5000), "launch_detached blocked the caller");
        assert!(error.contains("ERR_PROCESS_SPAWN_FAILED"), "{error}");
        assert!(!error.contains("ERR_LAUNCH_TIMEOUT"), "{error}");
        fs::remove_dir_all(root).unwrap();
    }

    /// [REQ-05-RULE-002][REQ-05-FUNC-108][REQ-05-FUNC-115] TC-05-RUST-010:
    /// concurrent launch attempts on identical and distinct target directories
    /// each resolve independently without locking the main process.
    #[test]
    fn tc_05_rust_010_concurrent_launch_failures_resolve_independently() {
        let root = unique_temp_dir("concurrent");
        let shared = root.join("FACT").join("id-shared");
        let distinct = root.join("EXPERIENCE").join("id-distinct");
        fs::create_dir_all(&shared).unwrap();
        fs::create_dir_all(&distinct).unwrap();
        let missing_executable = root.join("missing").join(MARKDOWN_EXECUTABLE);
        let started = Instant::now();
        let handles: Vec<_> = [&shared, &shared, &distinct, &distinct]
            .into_iter()
            .map(|target| {
                let executable = missing_executable.clone();
                let target = target.clone();
                std::thread::spawn(move || launch_detached(&executable, &target))
            })
            .collect();
        for handle in handles {
            let error = handle.join().unwrap().unwrap_err();
            assert!(error.contains("ERR_PROCESS_SPAWN_FAILED"), "{error}");
        }
        assert!(started.elapsed() < Duration::from_millis(5000), "concurrent launches serialized or deadlocked");
        fs::remove_dir_all(root).unwrap();
    }

    /// [REQ-05-RULE-004] TC-05-RUST-011: resolving the launch target leaves a
    /// co-located `hasm.db` byte-identical, writable, and deletable (no handle
    /// is held by the launch path).
    #[test]
    fn tc_05_rust_011_target_resolution_leaves_database_untouched() {
        let root = unique_temp_dir("db-ok");
        let database = root.join("hasm.db");
        fs::write(&database, b"sqlite-content").unwrap();
        let target = root.join("FACT").join("id-1");
        fs::create_dir_all(&target).unwrap();
        assert_eq!(entity_directory(&root.to_string_lossy(), "FACT", "id-1").unwrap(), target);
        assert_eq!(fs::read(&database).unwrap(), b"sqlite-content");
        fs::OpenOptions::new().write(true).open(&database).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    /// [REQ-05-RULE-004] TC-05-RUST-012: even a failing spawn attempt performs
    /// zero reads/writes/locks against `hasm.db` in the workspace.
    #[test]
    fn tc_05_rust_012_failed_spawn_leaves_database_unlocked_and_unmodified() {
        let root = unique_temp_dir("db-err");
        let database = root.join("hasm.db");
        fs::write(&database, b"sqlite-content").unwrap();
        let target = root.join("FACT").join("id-1");
        fs::create_dir_all(&target).unwrap();
        let missing_executable = root.join("missing").join(MARKDOWN_EXECUTABLE);
        assert!(launch_detached(&missing_executable, &target).is_err());
        assert_eq!(fs::read(&database).unwrap(), b"sqlite-content");
        fs::OpenOptions::new().write(true).open(&database).unwrap();
        fs::remove_dir_all(root).unwrap();
    }

    /// [REQ-05-DATA-002] TC-05-RUST-014: malformed launch payload shapes
    /// (missing field, snake_case keys, non-object) fail deserialization.
    #[test]
    fn tc_05_rust_014_rejects_malformed_launch_payload_shapes() {
        assert!(serde_json::from_value::<LaunchExternalAppPayload>(json!({ "targetDirPath": "C:/target" })).is_err());
        assert!(serde_json::from_value::<LaunchExternalAppPayload>(json!({ "target_dir_path": "C:/target", "executable_path": "C:/hasm_markdown.exe" })).is_err());
        assert!(serde_json::from_value::<LaunchExternalAppPayload>(json!("C:/target")).is_err());
    }

    /// [REQ-05-DATA-003][REQ-05-FUNC-113] TC-05-RUST-013: every launch failure
    /// path resolves no payload and carries exactly one documented typed
    /// `ExternalEditorError` code.
    #[test]
    fn tc_05_rust_013_failure_paths_use_typed_error_codes_without_payload() {
        let root = unique_temp_dir("codes");
        let target = root.join("FACT").join("id-1");
        fs::create_dir_all(&target).unwrap();
        let missing_executable = root.join("missing").join(MARKDOWN_EXECUTABLE);
        let errors = [
            entity_directory(&root.to_string_lossy(), "FACT", "id-absent").err(),
            executable_from_resource_dir(&root).err(),
            launch_detached(&missing_executable, &target).err(),
        ];
        let documented = ["ERR_ENTITY_DIRECTORY_NOT_FOUND", "ERR_MARKDOWN_EXECUTABLE_NOT_FOUND", "ERR_LAUNCH_TIMEOUT", "ERR_PROCESS_SPAWN_FAILED"];
        for error in errors {
            let error = error.expect("failure path must resolve no payload");
            assert_eq!(documented.iter().filter(|code| error.contains(*code)).count(), 1, "{error}");
        }
        fs::remove_dir_all(root).unwrap();
    }
}