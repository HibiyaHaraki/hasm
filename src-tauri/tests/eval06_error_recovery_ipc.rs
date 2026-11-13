// ###################################################
// File Name : eval06_error_recovery_ipc.rs
// Purpose : EVAL-06 Rust-level error fallback & recovery tests (SEQ-MD-06)
// Description :
//   Covers the Markdown re-verification command used by /error-markdown
//   recovery, the appended missing-storage cause list behind /error-model,
//   the serialized error/recovery context payload contracts, the
//   non-destructive workspace/entity folder repair scaffolding, and the
//   clean-exit workspace lock release. Documented in
//   docs/eval/15-EVL-06_Error_Fallback.md.
// ###################################################
use hasm_lib::hasm::{entity_creation_commands, entity_editor_commands, model_commands, service, visualizer_commands};
use hasm_lib::hasm::types::{AppValidationError, AppVersionResponse, CreatePersonRequest, VerificationResult};
use serde_json::json;
use std::fs;
use std::path::Path;

const FACT_ID: &str = "33333333-3333-3333-3333-333333333331";

fn temp_root(tag: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!("hasm-eval06-{tag}-{}", uuid::Uuid::new_v4()))
}

// TC-06-RUST-101: successful re-verification returns the repaired Markdown payload.
#[test]
fn tc_06_rust_101_reload_entity_markdown_returns_repaired_payload() {
    let demo = visualizer_commands::create_test_workspace_fixture().unwrap();
    let markdown_path = Path::new(&demo.path).join("FACT").join(FACT_ID).join("main.md");
    // Simulate the external HASM Markdown fix performed from /error-markdown.
    fs::write(&markdown_path, "# Repaired Heading\n\nFixed body after external edit.\n").unwrap();

    let payload = entity_editor_commands::reload_entity_markdown(
        demo.path.clone(), "FACT".to_string(), FACT_ID.to_string(),
    ).unwrap();

    assert_eq!(payload.entity_type, "FACT");
    assert_eq!(payload.entity_id, FACT_ID);
    assert!(payload.markdown_body.contains("Repaired Heading"));
    assert!(payload.loaded_mtime_ms > 0);
    fs::remove_dir_all(demo.path).unwrap();
}

// TC-06-RUST-102: re-verification of broken storage rejects with the typed error code
// (consumed by SEQ-MD-06 /error-markdown routing) instead of panicking.
#[test]
fn tc_06_rust_102_reload_entity_markdown_rejects_missing_file_with_typed_error() {
    let demo = visualizer_commands::create_test_workspace_fixture().unwrap();
    let markdown_path = Path::new(&demo.path).join("FACT").join(FACT_ID).join("main.md");
    fs::remove_file(&markdown_path).unwrap();

    let error = entity_editor_commands::reload_entity_markdown(
        demo.path.clone(), "FACT".to_string(), FACT_ID.to_string(),
    ).unwrap_err();
    assert!(error.contains("ERR_MARKDOWN_FILE_NOT_FOUND"), "unexpected error: {error}");
    assert!(error.contains(FACT_ID), "error must append the failing target path: {error}");

    let unknown = entity_editor_commands::reload_entity_markdown(
        demo.path.clone(), "UNKNOWN".to_string(), FACT_ID.to_string(),
    ).unwrap_err();
    assert!(unknown.contains("ERR_ENTITY_NOT_FOUND"), "unexpected error: {unknown}");
    fs::remove_dir_all(demo.path).unwrap();
}

// TC-06-RUST-103: error/recovery context payloads round-trip losslessly through
// the camelCase IPC contract used by the error fallback screens.
#[test]
fn tc_06_rust_103_error_context_payloads_round_trip_with_camel_case() {
    let app_error = AppValidationError {
        code: "ERR_MARKDOWN_APP_INVALID".to_string(),
        message: "The HASM Markdown application is unavailable".to_string(),
    };
    let app_json = serde_json::to_value(&app_error).unwrap();
    assert_eq!(app_json, json!({
        "code": "ERR_MARKDOWN_APP_INVALID",
        "message": "The HASM Markdown application is unavailable"
    }));
    assert_eq!(serde_json::from_value::<AppValidationError>(app_json).unwrap(), app_error);

    // Retained workspace path payload consumed when the app re-enters the boot gate.
    let retained = AppVersionResponse {
        is_model_selected: true,
        path: Some("C:/retained.hasm".to_string()),
        version: "0.1.0".to_string(),
    };
    let retained_json = serde_json::to_value(&retained).unwrap();
    assert_eq!(retained_json["isModelSelected"], json!(true));
    assert_eq!(retained_json["path"], json!("C:/retained.hasm"));
    assert_eq!(serde_json::from_value::<AppVersionResponse>(retained_json).unwrap(), retained);

    let verification = VerificationResult {
        missing_entities: vec![format!("FACT/{FACT_ID}/main.md")],
        unreferenced_entities: vec!["PERSON/55555555-5555-5555-5555-555555555555".to_string()],
    };
    let verification_json = serde_json::to_value(&verification).unwrap();
    assert_eq!(verification_json["missingEntities"], json!([format!("FACT/{FACT_ID}/main.md")]));
    assert_eq!(verification_json["unreferencedEntities"].as_array().unwrap().len(), 1);
    assert_eq!(serde_json::from_value::<VerificationResult>(verification_json).unwrap(), verification);
}

// TC-06-RUST-104: storage verification appends every missing entity path to the
// fatal error so /error-model can display the exact repair targets.
#[test]
fn tc_06_rust_104_verify_hasm_storage_appends_missing_entity_paths() {
    let app = tauri::test::mock_builder()
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .unwrap();
    let demo = visualizer_commands::create_test_workspace_fixture().unwrap();
    let model = service::read_model_database(&demo.path).unwrap();

    // Intact workspace verifies cleanly before the fault is injected.
    let verified = tauri::async_runtime::block_on(
        model_commands::verify_hasm_storage(app.handle().clone(), demo.path.clone(), model.clone()),
    ).unwrap();
    assert!(verified.missing_entities.is_empty());

    fs::remove_file(Path::new(&demo.path).join("FACT").join(FACT_ID).join("main.md")).unwrap();
    let error = tauri::async_runtime::block_on(
        model_commands::verify_hasm_storage(app.handle().clone(), demo.path.clone(), model),
    ).unwrap_err();
    assert!(error.contains("ERR_MISSING_STORAGE_FOLDER"), "unexpected error: {error}");
    assert!(error.contains(FACT_ID), "error must append the missing entity path: {error}");
    fs::remove_dir_all(demo.path).unwrap();
}

// TC-06-RUST-105: folder repair scaffolding creates the required {UUID} directory,
// default main.md template, and assets/ subdirectory on disk.
#[test]
fn tc_06_rust_105_workspace_repair_scaffolds_entity_folders() {
    let root = temp_root("repair");
    let payload = entity_creation_commands::create_hasm_workspace(
        root.to_string_lossy().to_string(),
    ).unwrap();
    for entity_type in ["PERSON", "EXPERIENCE", "FACT", "LINK"] {
        assert!(root.join(entity_type).is_dir(), "missing {entity_type} directory");
    }
    assert!(root.join("hasm.db").is_file());

    let created = entity_creation_commands::create_person(
        payload.path.clone(),
        CreatePersonRequest {
            link: Vec::new(),
            person_name: "Repaired Person".to_string(),
            person_description: "Restored after missing folder repair.".to_string(),
            security_level: 1,
            create_life_experience: false,
            birth_date: None,
        },
    ).unwrap();
    let entity_dir = root.join("PERSON").join(created.entity_id.to_string());
    assert!(entity_dir.is_dir());
    assert!(entity_dir.join("assets").is_dir());
    let template = fs::read_to_string(entity_dir.join("main.md")).unwrap();
    assert!(template.contains("Repaired Person"), "default template must carry the entity name");
    fs::remove_dir_all(root).unwrap();
}

// TC-06-RUST-106: repair scaffolding is non-destructive — a non-empty target is
// refused with a typed error and existing files stay untouched.
#[test]
fn tc_06_rust_106_workspace_repair_refuses_non_empty_target() {
    let root = temp_root("nondestructive");
    fs::create_dir_all(&root).unwrap();
    let precious = root.join("existing.txt");
    fs::write(&precious, "precious user data").unwrap();

    let error = entity_creation_commands::create_hasm_workspace(
        root.to_string_lossy().to_string(),
    ).unwrap_err();
    assert!(error.contains("ERR_WORKSPACE_CREATION_FAILED"), "unexpected error: {error}");
    assert_eq!(fs::read_to_string(&precious).unwrap(), "precious user data");
    assert!(!root.join("PERSON").exists(), "refused repair must not scaffold directories");
    assert!(!root.join("hasm.db").exists(), "refused repair must not create a database");
    fs::remove_dir_all(root).unwrap();
}

// TC-06-RUST-107: the clean application exit path releases the workspace lock
// and stays idempotent when the lock is already gone.
#[test]
fn tc_06_rust_107_clean_exit_releases_workspace_lock() {
    let root = temp_root("exit");
    let lock_dir = root.join(".hasm");
    fs::create_dir_all(&lock_dir).unwrap();
    let lock_file = lock_dir.join("lock");
    fs::write(&lock_file, std::process::id().to_string()).unwrap();

    model_commands::release_workspace_lock(root.to_string_lossy().to_string()).unwrap();
    assert!(!lock_file.exists(), "lock file must be removed on clean exit");
    // A second release (lock already gone) must stay a clean no-op.
    model_commands::release_workspace_lock(root.to_string_lossy().to_string()).unwrap();
    fs::remove_dir_all(root).unwrap();
}

// TC-06-RUST-108: exit-time lock release on an unavailable workspace reports a
// typed error (no panic), and a read-only switch never touches foreign locks.
#[test]
fn tc_06_rust_108_clean_exit_rejects_missing_workspace_without_panic() {
    let missing = temp_root("missing").to_string_lossy().to_string();
    let error = model_commands::release_workspace_lock(missing.clone()).unwrap_err();
    assert!(error.contains("Workspace directory does not exist"), "unexpected error: {error}");
    let switch_error = model_commands::switch_workspace_cleanly(missing.clone(), false).unwrap_err();
    assert!(switch_error.contains("Workspace directory does not exist"), "unexpected error: {switch_error}");
    // Read-only sessions skip the release entirely, so switching stays safe.
    model_commands::switch_workspace_cleanly(missing, true).unwrap();
}
