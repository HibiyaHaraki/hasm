//! EVAL-01 multi-process double-booting: the automatable core of REQ-01-RULE-006.
//!
//! A packaged double-boot launches two OS processes; the isolation contract that can
//! be verified deterministically is that each app instance owns a fully independent
//! backend context (managed splash state, event channel, and workspace validation),
//! with no cross-instance contamination.

use hasm_lib::hasm::{app_commands, splash_commands};
use hasm_lib::hasm::splash_commands::{
    SplashState, MAIN_WINDOW_LABEL, SPLASH_HANDOFF_EVENT, SPLASH_WINDOW_LABEL,
};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
use tauri::{App, Listener, WebviewWindow, WebviewWindowBuilder};

fn build_instance() -> (App<MockRuntime>, WebviewWindow<MockRuntime>, Arc<Mutex<Vec<String>>>) {
    let started_at = Instant::now()
        .checked_sub(Duration::from_secs(6))
        .unwrap_or_else(Instant::now);
    let app = mock_builder()
        .manage(SplashState::new(started_at))
        .invoke_handler(tauri::generate_handler![
            splash_commands::complete_app_launch,
            app_commands::validate_hasm_folder_path
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let main = WebviewWindowBuilder::new(&app, MAIN_WINDOW_LABEL, Default::default())
        .visible(false)
        .build()
        .unwrap();
    WebviewWindowBuilder::new(&app, SPLASH_WINDOW_LABEL, Default::default())
        .build()
        .unwrap();
    let handoffs = Arc::new(Mutex::new(Vec::new()));
    let sink = handoffs.clone();
    app.listen(SPLASH_HANDOFF_EVENT, move |event| {
        sink.lock()
            .unwrap()
            .push(serde_json::from_str::<String>(event.payload()).unwrap());
    });
    (app, main, handoffs)
}

fn invoke(window: &WebviewWindow<MockRuntime>, cmd: &str, body: Value) -> Result<Value, Value> {
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
    .map(|response| response.deserialize::<Value>().unwrap())
}

// TC-01-RUST-021 [REQ-01-RULE-006] Positive: two concurrently running app instances
// keep isolated backend contexts. Each instance validates its own workspace folder,
// and each instance's splash handoff fires independently exactly once; instance A's
// handoff neither triggers nor consumes instance B's handoff.
#[test]
fn eval01_two_app_instances_keep_isolated_backend_state() {
    let (_app_a, main_a, handoffs_a) = build_instance();
    let (_app_b, main_b, handoffs_b) = build_instance();

    // Each instance validates its own workspace folder independently.
    let dir_a = std::env::temp_dir().join(format!("hasm-eval01-a-{}", std::process::id()));
    let dir_b = std::env::temp_dir().join(format!("hasm-eval01-b-{}", std::process::id()));
    std::fs::create_dir_all(&dir_a).unwrap();
    std::fs::create_dir_all(&dir_b).unwrap();
    assert!(invoke(&main_a, "validate_hasm_folder_path", json!({ "path": dir_a.to_string_lossy() })).is_ok());
    assert!(invoke(&main_b, "validate_hasm_folder_path", json!({ "path": dir_b.to_string_lossy() })).is_ok());

    // Instance A hands off; instance B's state is untouched.
    assert_eq!(
        invoke(&main_a, "complete_app_launch", json!({ "outcome": "loading-model" }))
            .unwrap()
            .as_u64(),
        Some(0)
    );
    assert_eq!(*handoffs_a.lock().unwrap(), vec!["loading-model".to_string()]);
    assert!(handoffs_b.lock().unwrap().is_empty(), "instance B must not see A's handoff");

    // Instance B still performs its own first handoff independently.
    assert_eq!(
        invoke(&main_b, "complete_app_launch", json!({ "outcome": "select" }))
            .unwrap()
            .as_u64(),
        Some(0)
    );
    assert_eq!(*handoffs_b.lock().unwrap(), vec!["select".to_string()]);
    assert_eq!(handoffs_a.lock().unwrap().len(), 1, "instance A handed off exactly once");

    std::fs::remove_dir_all(dir_a).ok();
    std::fs::remove_dir_all(dir_b).ok();
}
