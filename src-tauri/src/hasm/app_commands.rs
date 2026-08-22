//! SEQ-01 Tauri commands for app startup validation and workspace selection.

use crate::hasm::types::{AppValidationError, AppVersionResponse};
use log::{info, warn};
use std::env;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const MARKDOWN_EXECUTABLE: &str = "hasm_markdown.exe";
const SKIP_MARKDOWN_APP_VALIDATION_IN_DEVELOPMENT: bool = true;

#[tauri::command]
pub fn validate_hasm_markdown_app(app: AppHandle) -> Result<(), AppValidationError> {
    if markdown_validation_is_skipped() {
        warn!("[SEQ-MD-01][MARKDOWN] validation skipped by development flag");
        return Ok(());
    }

    let executable = markdown_executable_path(&app)?;
    validate_markdown_executable(&executable)
}

#[tauri::command]
pub fn validate_app_version() -> Result<AppVersionResponse, AppValidationError> {
    let args: Vec<String> = env::args().collect();
    let path = parse_launch_path(&args);

    info!(
        "[SEQ-MD-01][VERSION] inspected launch arguments; is_model_selected={}",
        path.is_some()
    );

    Ok(AppVersionResponse {
        is_model_selected: path.is_some(),
        path,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[tauri::command]
pub fn validate_hasm_folder_path(path: String) -> Result<(), AppValidationError> {
    let candidate = Path::new(&path);
    if candidate.is_dir() {
        info!("[SEQ-MD-01][PATH] workspace directory accepted");
        return Ok(());
    }

    warn!("[SEQ-MD-01][PATH] workspace directory rejected");
    Err(validation_error(
        "ERR_TARGET_PATH_NOT_FOUND",
        "Specified HASM path does not exist or is not a directory",
    ))
}

fn markdown_executable_path(app: &AppHandle) -> Result<PathBuf, AppValidationError> {
    let resource_dir = app.path().resource_dir().map_err(|error| {
        validation_error(
            "ERR_MARKDOWN_APP_INVALID",
            format!("Cannot resolve application resources: {error}"),
        )
    })?;

    Ok(resource_dir.join("binaries").join(MARKDOWN_EXECUTABLE))
}

fn validate_markdown_executable(executable: &Path) -> Result<(), AppValidationError> {
    if executable.is_file() {
        info!("[SEQ-MD-01][MARKDOWN] packaged Markdown app found");
        return Ok(());
    }

    warn!("[SEQ-MD-01][MARKDOWN] packaged Markdown app missing");
    Err(validation_error(
        "ERR_MARKDOWN_APP_INVALID",
        "The packaged HASM Markdown application is unavailable",
    ))
}

fn markdown_validation_is_skipped() -> bool {
    development_skip_enabled(
        cfg!(debug_assertions),
        SKIP_MARKDOWN_APP_VALIDATION_IN_DEVELOPMENT,
    )
}

fn development_skip_enabled(is_debug_build: bool, development_flag: bool) -> bool {
    is_debug_build && development_flag
}

fn parse_launch_path(args: &[String]) -> Option<String> {
    let mut values = args.iter().skip(1);
    while let Some(value) = values.next() {
        if value == "--path" {
            return values.next().filter(|path| !path.is_empty()).cloned();
        }

        if !value.starts_with('-') && !value.is_empty() {
            return Some(value.clone());
        }
    }

    None
}

fn validation_error(code: impl Into<String>, message: impl Into<String>) -> AppValidationError {
    AppValidationError {
        code: code.into(),
        message: message.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;

    #[test]
    fn serializes_validation_payloads_with_camel_case_keys() {
        let response = AppVersionResponse {
            is_model_selected: true,
            path: Some("C:/workspace".to_string()),
            version: "0.1.0".to_string(),
        };

        assert_eq!(serde_json::to_value(response).unwrap(), json!({
            "isModelSelected": true,
            "path": "C:/workspace",
            "version": "0.1.0"
        }));

        let error = validation_error("ERR_MARKDOWN_APP_INVALID", "Missing Markdown app");
        assert_eq!(serde_json::to_value(error).unwrap(), json!({
            "code": "ERR_MARKDOWN_APP_INVALID",
            "message": "Missing Markdown app"
        }));
    }

    #[test]
    fn parses_flag_and_positional_launch_paths() {
        assert_eq!(
            parse_launch_path(&["hasm.exe".into(), "--path".into(), "C:/workspace".into()]),
            Some("C:/workspace".to_string())
        );
        assert_eq!(
            parse_launch_path(&["hasm.exe".into(), "C:/workspace".into()]),
            Some("C:/workspace".to_string())
        );
        assert_eq!(parse_launch_path(&["hasm.exe".into()]), None);
    }

    #[test]
    fn validates_existing_directories_and_rejects_missing_paths() {
        let directory = env::temp_dir().join(format!("hasm-seq-01-{}", std::process::id()));
        fs::create_dir_all(&directory).unwrap();

        assert!(validate_hasm_folder_path(directory.to_string_lossy().to_string()).is_ok());
        let missing = directory.join("missing");
        let error = validate_hasm_folder_path(missing.to_string_lossy().to_string()).unwrap_err();
        assert_eq!(error.code, "ERR_TARGET_PATH_NOT_FOUND");

        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn treats_malicious_path_text_as_a_literal_path() {
        let error = validate_hasm_folder_path("C:\\valid; rm -rf".to_string()).unwrap_err();
        assert_eq!(error.code, "ERR_TARGET_PATH_NOT_FOUND");
    }

    #[test]
    fn rejects_missing_markdown_executable() {
        let error = validate_markdown_executable(Path::new("does-not-exist.exe")).unwrap_err();
        assert_eq!(error.code, "ERR_MARKDOWN_APP_INVALID");
    }

    #[test]
    fn keeps_markdown_validation_override_debug_only() {
        assert!(!development_skip_enabled(false, true));
        assert!(!development_skip_enabled(true, false));
        assert!(development_skip_enabled(true, true));
    }
}