//! EVAL-07 clean workspace switching IPC contract (SEQ-MD-07) and the
//! deterministic evaluation workspace fixture command, exercised through the
//! Tauri mock runtime so the registered invoke path is covered end-to-end.

use hasm_lib::hasm::{model_commands, visualizer_commands};
use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
use tauri::{App, WebviewWindow, WebviewWindowBuilder};

fn build_app() -> (App<MockRuntime>, WebviewWindow<MockRuntime>) {
    let app = mock_builder()
        .invoke_handler(tauri::generate_handler![model_commands::switch_workspace_cleanly])
        .build(mock_context(noop_assets()))
        .unwrap();
    let window = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    (app, window)
}

fn invoke(
    window: &WebviewWindow<MockRuntime>,
    cmd: &str,
    body: Value,
) -> Result<tauri::ipc::InvokeResponseBody, Value> {
    tauri::test::get_ipc_response(
        window,
        tauri::webview::InvokeRequest {
            cmd: cmd.into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        },
    )
}

// TC-07-RUST-004 [REQ-07-DATA-001][REQ-07-RULE-003][REQ-07-FUNC-203] Positive: the exact
// camelCase payload the frontend sends ({ currentModelPath, isReadOnly }) resolves through
// the registered `switch_workspace_cleanly` invoke and releases `.hasm/lock` read-write.
#[test]
fn tc_07_rust_004_switch_releases_lock_through_registered_invoke() {
    let (_app, window) = build_app();
    let fixture = visualizer_commands::create_test_workspace_fixture().unwrap();
    let root = PathBuf::from(&fixture.path);
    std::fs::create_dir_all(root.join(".hasm")).unwrap();
    let lock_path = root.join(".hasm").join("lock");
    std::fs::write(&lock_path, std::process::id().to_string()).unwrap();

    let response = invoke(
        &window,
        "switch_workspace_cleanly",
        json!({ "currentModelPath": fixture.path, "isReadOnly": false }),
    )
    .unwrap()
    .deserialize::<Value>()
    .unwrap();

    assert_eq!(response, Value::Null, "clean switch must resolve with Ok(())");
    assert!(!lock_path.exists(), "read-write switch must delete .hasm/lock");
    std::fs::remove_dir_all(root).unwrap();
}

// TC-07-RUST-005 [REQ-07-DATA-001][REQ-07-RULE-003][REQ-07-FUNC-203] Negative: payloads
// violating the SwitchWorkspaceRequest contract (missing / mistyped currentModelPath) are
// rejected by the IPC layer, and a read-write switch on an unknown workspace path fails
// instead of silently pretending the lock was released.
#[test]
fn tc_07_rust_005_switch_rejects_malformed_payload_and_unknown_path() {
    let (_app, window) = build_app();

    assert!(
        invoke(&window, "switch_workspace_cleanly", json!({ "isReadOnly": false })).is_err(),
        "missing currentModelPath must be rejected"
    );
    assert!(
        invoke(
            &window,
            "switch_workspace_cleanly",
            json!({ "currentModelPath": 42, "isReadOnly": false }),
        )
        .is_err(),
        "non-string currentModelPath must be rejected"
    );

    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let missing = std::env::temp_dir().join(format!("hasm-eval07-missing-{nanos}"));
    let error = invoke(
        &window,
        "switch_workspace_cleanly",
        json!({ "currentModelPath": missing.to_string_lossy(), "isReadOnly": false }),
    )
    .unwrap_err();
    assert!(
        error
            .as_str()
            .unwrap()
            .contains("Workspace directory does not exist"),
        "unknown workspace path must fail the read-write lock release: {error}"
    );
}

// TC-07-RUST-006 [REQ-07-FUNC-501] Positive: `create_test_workspace_fixture` scaffolds an
// isolated temporary workspace with deterministic entity content (same UUIDs and counts on
// every call) so evaluation suites never depend on local absolute paths.
#[test]
fn tc_07_rust_006_fixture_scaffolds_deterministic_populated_workspace() {
    let first = visualizer_commands::create_test_workspace_fixture().unwrap();
    let second = visualizer_commands::create_test_workspace_fixture().unwrap();
    assert_ne!(first.path, second.path, "each fixture must be isolated");

    for fixture in [&first, &second] {
        let root = PathBuf::from(&fixture.path);
        assert!(root.starts_with(std::env::temp_dir()), "fixture must live in the temp dir");
        assert!(root.join("hasm.db").is_file());
        assert!(root
            .join("FACT")
            .join("33333333-3333-3333-3333-333333333335")
            .join("main.md")
            .is_file());
        assert_eq!(fixture.model.people.len(), 1);
        assert_eq!(fixture.model.experiences.len(), 3);
        assert_eq!(fixture.model.facts.len(), 5);
        assert_eq!(fixture.model.links.len(), 1);
    }

    let first_ids = first.model.facts.iter().map(|fact| fact.fact_id.to_string()).collect::<Vec<_>>();
    let second_ids = second.model.facts.iter().map(|fact| fact.fact_id.to_string()).collect::<Vec<_>>();
    assert_eq!(first_ids, second_ids, "fixture content must be deterministic");

    std::fs::remove_dir_all(first.path).unwrap();
    std::fs::remove_dir_all(second.path).unwrap();
}

// TC-07-RUST-007 [REQ-07-FUNC-501] Negative: the fixture command must stay unreachable from
// production UI flows. The production invoke registration (src/lib.rs) must not expose it,
// and a runtime without it rejects the command name instead of scaffolding temp data.
#[test]
fn tc_07_rust_007_fixture_command_not_reachable_from_production_ui() {
    let registration = include_str!("../src/lib.rs");
    assert!(
        !registration.contains("create_test_workspace_fixture"),
        "src/lib.rs must not register create_test_workspace_fixture as a frontend command"
    );

    let (_app, window) = build_app();
    assert!(
        invoke(&window, "create_test_workspace_fixture", json!({})).is_err(),
        "invoking the unregistered fixture command must be rejected"
    );
}
