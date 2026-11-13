//! EVAL-01 splash fallback handoff and IPC payload contract through the mock runtime.

use hasm_lib::hasm::splash_commands::{
    self, SplashState, MAIN_WINDOW_LABEL, SPLASH_HANDOFF_EVENT, SPLASH_WINDOW_LABEL,
};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime};
use tauri::{App, Listener, WebviewWindow, WebviewWindowBuilder};

fn record_handoffs(app: &App<MockRuntime>) -> Arc<Mutex<Vec<String>>> {
    let handoffs = Arc::new(Mutex::new(Vec::new()));
    let sink = handoffs.clone();
    app.listen(SPLASH_HANDOFF_EVENT, move |event| {
        sink.lock()
            .unwrap()
            .push(serde_json::from_str::<String>(event.payload()).unwrap());
    });
    handoffs
}

fn build_app(started_at: Instant) -> (App<MockRuntime>, WebviewWindow<MockRuntime>) {
    let app = mock_builder()
        .manage(SplashState::new(started_at))
        .invoke_handler(tauri::generate_handler![splash_commands::complete_app_launch])
        .build(mock_context(noop_assets()))
        .unwrap();
    let main = WebviewWindowBuilder::new(&app, MAIN_WINDOW_LABEL, Default::default())
        .visible(false)
        .build()
        .unwrap();
    WebviewWindowBuilder::new(&app, SPLASH_WINDOW_LABEL, Default::default())
        .build()
        .unwrap();
    (app, main)
}

fn invoke_complete_raw(
    window: &WebviewWindow<MockRuntime>,
    body: Value,
) -> Result<tauri::ipc::InvokeResponseBody, Value> {
    tauri::test::get_ipc_response(
        window,
        tauri::webview::InvokeRequest {
            cmd: "complete_app_launch".into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        },
    )
}

// TC-01-RUST-019 [REQ-01-FUNC-005][REQ-01-RULE-009] Positive: the fallback handoff path
// (the function the 30 s fallback timer invokes for an unreported boot) shows the main
// window, closes the splash, and emits the handoff event with reason `fallback`,
// so a failed boot can never leave the splash open indefinitely.
#[test]
fn eval01_fallback_handoff_shows_main_window_with_fallback_reason() {
    let started_at = Instant::now()
        .checked_sub(Duration::from_secs(6))
        .unwrap_or_else(Instant::now);
    let (app, main) = build_app(started_at);
    let handoffs = record_handoffs(&app);

    splash_commands::show_main_window(&app.handle().clone(), "fallback");

    assert_eq!(*handoffs.lock().unwrap(), vec!["fallback".to_string()]);
    assert!(main.is_visible().unwrap(), "main window must be shown by the fallback handoff");
    // The mock runtime keeps closed windows registered, so the splash close is
    // observed through the emitted handoff event (sent only after show+close).
}

// TC-01-RUST-020 [REQ-01-DATA-003] Negative: a completion report that violates the
// documented command contract (missing / mistyped `outcome`) is rejected by the IPC
// layer, consumes no handoff, and a later well-formed report still succeeds.
#[test]
fn eval01_rejects_malformed_splash_handoff_payloads() {
    let started_at = Instant::now()
        .checked_sub(Duration::from_secs(6))
        .unwrap_or_else(Instant::now);
    let (app, main) = build_app(started_at);
    let handoffs = record_handoffs(&app);

    assert!(
        invoke_complete_raw(&main, json!({})).is_err(),
        "missing outcome must be rejected"
    );
    assert!(
        invoke_complete_raw(&main, json!({ "outcome": 42 })).is_err(),
        "non-string outcome must be rejected"
    );
    assert!(handoffs.lock().unwrap().is_empty(), "no handoff for malformed payloads");

    // The handoff is still available for a subsequent well-formed report.
    let delay = invoke_complete_raw(&main, json!({ "outcome": "select" }))
        .unwrap()
        .deserialize::<Value>()
        .unwrap()
        .as_u64()
        .unwrap();
    assert_eq!(delay, 0);
    assert_eq!(*handoffs.lock().unwrap(), vec!["select".to_string()]);
}
