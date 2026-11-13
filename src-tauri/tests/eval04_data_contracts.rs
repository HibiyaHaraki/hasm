//! EVAL-04 IPC data-contract tests: the SEQ-04 load / mtime / reload / save
//! request and response payloads must round-trip through the registered Tauri
//! commands exactly as documented by REQ-04-DATA-001..008.
use hasm_lib::hasm::{commands, entity_editor_commands, visualizer_commands};
use serde_json::{json, Value};

fn build_app() -> (tauri::App<tauri::test::MockRuntime>, tauri::WebviewWindow<tauri::test::MockRuntime>) {
    let app = tauri::test::mock_builder()
        .invoke_handler(tauri::generate_handler![
            entity_editor_commands::load_entity_detail,
            entity_editor_commands::check_entity_mtime,
            entity_editor_commands::reload_entity_markdown,
            commands::save_fact_detail,
        ])
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .unwrap();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();
    (app, window)
}

fn invoke(window: &tauri::WebviewWindow<tauri::test::MockRuntime>, command: &str, body: Value) -> Result<Value, Value> {
    tauri::test::get_ipc_response(window, tauri::webview::InvokeRequest {
        cmd: command.into(),
        callback: tauri::ipc::CallbackFn(0),
        error: tauri::ipc::CallbackFn(1),
        url: "http://tauri.localhost".parse().unwrap(),
        body: tauri::ipc::InvokeBody::Json(body),
        headers: Default::default(),
        invoke_key: tauri::test::INVOKE_KEY.into(),
    }).map(|response| response.deserialize::<Value>().unwrap())
}

// TC-04-IPC-DATA-001: [REQ-04-DATA-001] [REQ-04-DATA-002] [REQ-04-DATA-003]
// [REQ-04-DATA-004] [REQ-04-DATA-005] [REQ-04-DATA-006] [REQ-04-DATA-007]
// Load, mtime-check, reload, and typed save payloads serialize with the exact
// documented camelCase fields through registered command dispatch.
#[test]
fn eval04_payload_contracts_round_trip_through_registered_invokes() {
    let (_app, window) = build_app();
    let demo = visualizer_commands::create_test_workspace_fixture().unwrap();
    let fact_id = "33333333-3333-3333-3333-333333333331";
    let request = json!({ "modelRoot": demo.path, "entityType": "FACT", "entityId": fact_id });

    // Load request/response contract (REQ-04-DATA-001 / REQ-04-DATA-002).
    let loaded = invoke(&window, "load_entity_detail", request.clone()).unwrap();
    assert_eq!(loaded["entityType"], "FACT");
    assert_eq!(loaded["entityId"], fact_id);
    assert!(loaded["name"].is_string());
    assert!(!loaded["markdownBody"].as_str().unwrap().is_empty());
    let loaded_mtime = loaded["loadedMtimeMs"].as_u64().unwrap();
    assert!(loaded_mtime > 0);
    assert!(loaded["detail"].is_object());

    // mtime request/response contract (REQ-04-DATA-004 / REQ-04-DATA-005).
    let mtime = invoke(&window, "check_entity_mtime", json!({
        "modelRoot": demo.path, "entityType": "FACT", "entityId": fact_id,
        "lastLoadedMtimeMs": loaded_mtime,
    })).unwrap();
    assert_eq!(mtime["isModified"], false);
    assert_eq!(mtime["isDeleted"], false);
    assert_eq!(mtime["currentMtimeMs"].as_u64().unwrap(), loaded_mtime);

    // Reload request/response contract (REQ-04-DATA-006 / REQ-04-DATA-007).
    let reloaded = invoke(&window, "reload_entity_markdown", request.clone()).unwrap();
    assert_eq!(reloaded["markdownBody"], loaded["markdownBody"]);
    assert_eq!(reloaded["loadedMtimeMs"].as_u64().unwrap(), loaded_mtime);

    // Typed save request contract and result payload (REQ-04-DATA-003).
    let mut detail = loaded["detail"].clone();
    detail["factName"] = json!("Contract updated");
    let saved = invoke(&window, "save_fact_detail", json!({ "modelRoot": demo.path, "detail": detail })).unwrap();
    assert!(saved["message"].as_str().unwrap().contains(fact_id));
    let after = invoke(&window, "load_entity_detail", request).unwrap();
    assert_eq!(after["detail"]["factName"], "Contract updated");
    assert_eq!(after["markdownBody"], loaded["markdownBody"]);

    std::fs::remove_dir_all(demo.path).unwrap();
}

// TC-04-IPC-DATA-002: [REQ-04-DATA-001] [REQ-04-DATA-002] [REQ-04-DATA-003]
// [REQ-04-DATA-004] [REQ-04-DATA-005] [REQ-04-DATA-006] [REQ-04-DATA-007]
// [REQ-04-DATA-008] [REQ-04-FUNC-104] [REQ-04-FUNC-106] [REQ-04-FUNC-503]
// [REQ-04-FUNC-504] [REQ-04-FUNC-508] Malformed requests, unknown entities,
// and deleted Markdown reject through dispatch with the documented explicit
// error strings instead of resolving fallback payloads.
#[test]
fn eval04_rejects_malformed_requests_with_explicit_editor_errors() {
    let (_app, window) = build_app();
    let demo = visualizer_commands::create_test_workspace_fixture().unwrap();
    let fact_id = "33333333-3333-3333-3333-333333333331";

    // Unknown entity id rejects (EntityNotFound contract, REQ-04-DATA-008).
    let unknown = invoke(&window, "load_entity_detail", json!({
        "modelRoot": demo.path, "entityType": "FACT", "entityId": "99999999-9999-9999-9999-999999999999",
    })).unwrap_err();
    assert!(unknown.as_str().unwrap().contains("not found"), "unexpected error: {unknown}");

    // Unsupported entity type rejects for both load and mtime requests.
    for command in ["load_entity_detail", "check_entity_mtime"] {
        let error = invoke(&window, command, json!({
            "modelRoot": demo.path, "entityType": "WORKSPACE", "entityId": fact_id, "lastLoadedMtimeMs": 0,
        })).unwrap_err();
        assert_eq!(error.as_str().unwrap(), "ERR_ENTITY_NOT_FOUND");
    }

    // A request missing its required field is rejected by serde, not defaulted.
    assert!(invoke(&window, "load_entity_detail", json!({ "modelRoot": demo.path, "entityType": "FACT" })).is_err());
    // A save whose detail payload is not the typed struct is rejected by serde.
    assert!(invoke(&window, "save_fact_detail", json!({ "modelRoot": demo.path, "detail": "not-an-object" })).is_err());

    // An unchanged file is never reported as externally modified.
    let loaded = invoke(&window, "load_entity_detail", json!({
        "modelRoot": demo.path, "entityType": "FACT", "entityId": fact_id,
    })).unwrap();
    let fresh = invoke(&window, "check_entity_mtime", json!({
        "modelRoot": demo.path, "entityType": "FACT", "entityId": fact_id,
        "lastLoadedMtimeMs": loaded["loadedMtimeMs"],
    })).unwrap();
    assert_eq!(fresh["isModified"], false);

    // Deleting main.md flips the deletion flag and rejects the manual reload
    // with the MARKDOWN marker that drives /error-markdown routing.
    std::fs::remove_file(format!("{}/FACT/{fact_id}/main.md", demo.path)).unwrap();
    let deleted = invoke(&window, "check_entity_mtime", json!({
        "modelRoot": demo.path, "entityType": "FACT", "entityId": fact_id,
        "lastLoadedMtimeMs": loaded["loadedMtimeMs"],
    })).unwrap();
    assert_eq!(deleted["isDeleted"], true);
    assert_eq!(deleted["isModified"], false);
    assert_eq!(deleted["currentMtimeMs"], 0);
    let reload_error = invoke(&window, "reload_entity_markdown", json!({
        "modelRoot": demo.path, "entityType": "FACT", "entityId": fact_id,
    })).unwrap_err();
    assert!(reload_error.as_str().unwrap().contains("ERR_MARKDOWN_FILE_NOT_FOUND"));

    std::fs::remove_dir_all(demo.path).unwrap();
}
