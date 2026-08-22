//! SEQ-05 detached HASM Markdown editor invocation.
use crate::hasm::types::LaunchExternalAppPayload;
use log::info;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Manager};

const MARKDOWN_EXECUTABLE: &str = "hasm_markdown.exe";

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
}