//! SEQ-01 Tauri commands for app startup validation and workspace selection.

use crate::hasm::types::{AppValidationError, AppVersionResponse};
use log::{info, warn};
use std::env;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

const MARKDOWN_EXECUTABLE: &str = "hasm_markdown.exe";

/// [REQ-01-FUNC-202][REQ-01-FUNC-207] Verifies the HASM Markdown executable exists in
/// packaged resources or the development staging directory in every build profile.
#[tauri::command]
pub fn validate_hasm_markdown_app<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), AppValidationError> {
    let executable = markdown_executable_path(&app)?;
    validate_markdown_executable(&executable)
}

/// [REQ-01-FUNC-302][REQ-01-FUNC-303][REQ-01-FUNC-304][REQ-01-FUNC-305][REQ-01-FUNC-306][REQ-01-FUNC-311]
/// Reads `CARGO_PKG_VERSION` and inspects CLI arguments for a quote-normalized workspace path.
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

/// [REQ-01-FUNC-402][REQ-01-RULE-007] Verifies the quote-normalized workspace path
/// exists on disk as a directory, rejecting with `ERR_TARGET_PATH_NOT_FOUND` otherwise.
#[tauri::command]
pub fn validate_hasm_folder_path(path: String) -> Result<(), AppValidationError> {
    let normalized_path = normalize_workspace_path(&path);
    let candidate = Path::new(&normalized_path);
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

fn markdown_executable_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, AppValidationError> {
    let packaged_executable = app
        .path()
        .resource_dir()
        .map(|resource_dir| resource_dir.join("binaries").join(MARKDOWN_EXECUTABLE));
    if let Ok(executable) = &packaged_executable {
        if executable.is_file() {
            return Ok(executable.clone());
        }
    }

    let development_executable = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(MARKDOWN_EXECUTABLE);
    if development_executable.is_file() {
        info!("[SEQ-MD-01][MARKDOWN] staged development Markdown app found");
        return Ok(development_executable);
    }

    packaged_executable.map_err(|error| {
        validation_error(
            "ERR_MARKDOWN_APP_INVALID",
            format!("Cannot resolve application resources: {error}"),
        )
    })
}

fn validate_markdown_executable(executable: &Path) -> Result<(), AppValidationError> {
    if executable.is_file() {
        info!("[SEQ-MD-01][MARKDOWN] packaged Markdown app found");
        return Ok(());
    }

    warn!("[SEQ-MD-01][MARKDOWN] HASM Markdown app missing");
    Err(validation_error(
        "ERR_MARKDOWN_APP_INVALID",
        "The HASM Markdown application is unavailable",
    ))
}

fn parse_launch_path(args: &[String]) -> Option<String> {
    let mut values = args.iter().skip(1);
    while let Some(value) = values.next() {
        if value == "--path" {
            return values
                .next()
                .map(|path| normalize_workspace_path(path))
                .filter(|path| !path.is_empty());
        }

        if !value.starts_with('-') && !value.is_empty() {
            return Some(normalize_workspace_path(value));
        }
    }

    None
}

fn normalize_workspace_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.len() >= 2 && trimmed.starts_with('"') && trimmed.ends_with('"') {
        trimmed[1..trimmed.len() - 1].trim().to_string()
    } else {
        trimmed.to_string()
    }
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
        assert_eq!(
            parse_launch_path(&["hasm.exe".into(), "--path".into(), "\"C:/workspace with spaces\"".into()]),
            Some("C:/workspace with spaces".to_string())
        );
        assert_eq!(
            parse_launch_path(&["hasm.exe".into(), "\"C:/workspace with spaces\"".into()]),
            Some("C:/workspace with spaces".to_string())
        );
        assert_eq!(parse_launch_path(&["hasm.exe".into()]), None);
    }

    #[test]
    fn validates_existing_directories_and_rejects_missing_paths() {
        let directory = env::temp_dir().join(format!("hasm-seq-01-{}", std::process::id()));
        fs::create_dir_all(&directory).unwrap();

        assert!(validate_hasm_folder_path(directory.to_string_lossy().to_string()).is_ok());
        assert!(validate_hasm_folder_path(format!("\"{}\"", directory.display())).is_ok());
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

    // [REQ-01-RULE-007][REQ-01-FUNC-304][REQ-01-FUNC-305][REQ-01-FUNC-306][REQ-01-FUNC-311]
    // Negative: unmatched/inner quotes stay literal and flag-only or empty launch
    // arguments never produce a selected model path.
    #[test]
    fn keeps_unmatched_quotes_literal_and_ignores_flag_only_launch_args() {
        // Unmatched leading quote is not stripped; the literal text is preserved.
        assert_eq!(normalize_workspace_path("  \"C:/unclosed  "), "\"C:/unclosed");
        // Inner quotes remain literal.
        assert_eq!(normalize_workspace_path("C:/a\"b"), "C:/a\"b");
        // Flag-only or trailing `--path` arguments yield no model selection.
        assert_eq!(parse_launch_path(&["hasm.exe".into(), "--path".into()]), None);
        assert_eq!(parse_launch_path(&["hasm.exe".into(), "--verbose".into()]), None);
        assert_eq!(
            parse_launch_path(&["hasm.exe".into(), "--path".into(), "\"\"".into()]),
            None
        );
        // An unmatched-quote path is rejected as a literal, non-existent path.
        let error = validate_hasm_folder_path("\"C:/unclosed-hasm-path".to_string()).unwrap_err();
        assert_eq!(error.code, "ERR_TARGET_PATH_NOT_FOUND");
    }

    // [REQ-01-DATA-001][REQ-01-DATA-002][REQ-01-FUNC-302]
    // Negative: payloads missing contract fields are rejected on deserialization,
    // including a response that drops the CARGO_PKG_VERSION-backed version field.
    #[test]
    fn rejects_payloads_missing_contract_fields() {
        assert!(serde_json::from_value::<AppValidationError>(json!({ "code": "ERR_X" })).is_err());
        assert!(serde_json::from_value::<AppValidationError>(json!({ "message": "m" })).is_err());
        assert!(serde_json::from_value::<AppVersionResponse>(json!({
            "path": null,
            "version": "0.1.0"
        }))
        .is_err());
        assert!(serde_json::from_value::<AppVersionResponse>(json!({
            "isModelSelected": false,
            "path": null
        }))
        .is_err());
        // Positive-direction guard inside the same contract: the full payload round-trips.
        let roundtrip: AppVersionResponse = serde_json::from_value(json!({
            "isModelSelected": false,
            "path": null,
            "version": env!("CARGO_PKG_VERSION")
        }))
        .unwrap();
        assert_eq!(roundtrip.version, env!("CARGO_PKG_VERSION"));
    }

    // [REQ-01-RULE-008] Negative: path validation stays filesystem-only; URL-like
    // input is rejected as a non-existent literal path without contacting the network.
    #[test]
    fn rejects_url_like_paths_without_network_access() {
        for url in ["https://example.com/workspace", "http://127.0.0.1/icons"] {
            let error = validate_hasm_folder_path(url.to_string()).unwrap_err();
            assert_eq!(error.code, "ERR_TARGET_PATH_NOT_FOUND");
        }
    }

    #[test]
    fn rejects_missing_markdown_executable() {
        let error = validate_markdown_executable(Path::new("does-not-exist.exe")).unwrap_err();
        assert_eq!(error.code, "ERR_MARKDOWN_APP_INVALID");
    }

    #[test]
    fn accepts_existing_markdown_executable() {
        let executable = env::temp_dir().join(format!(
            "hasm-markdown-validation-{}.exe",
            std::process::id()
        ));
        fs::write(&executable, []).unwrap();

        assert!(validate_markdown_executable(&executable).is_ok());

        fs::remove_file(executable).unwrap();
    }
}