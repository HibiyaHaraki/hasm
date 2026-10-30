//! EVAL-01 splash handoff through the registered Tauri invoke handler.

use hasm_lib::hasm::splash_commands::{
    self, SplashState, MAIN_WINDOW_LABEL, MIN_SPLASH_DURATION, SPLASH_HANDOFF_EVENT,
    SPLASH_WINDOW_LABEL,
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
        sink.lock().unwrap().push(serde_json::from_str::<String>(event.payload()).unwrap());
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

fn invoke_complete(window: &WebviewWindow<MockRuntime>, outcome: &str) -> u64 {
    tauri::test::get_ipc_response(window, tauri::webview::InvokeRequest {
        cmd: "complete_app_launch".into(),
        callback: tauri::ipc::CallbackFn(0),
        error: tauri::ipc::CallbackFn(1),
        url: "http://tauri.localhost".parse().unwrap(),
        body: tauri::ipc::InvokeBody::Json(json!({ "outcome": outcome })),
        headers: Default::default(),
        invoke_key: tauri::test::INVOKE_KEY.into(),
    })
    .unwrap()
    .deserialize::<Value>()
    .unwrap()
    .as_u64()
    .unwrap()
}

#[test]
fn splash_commands_hand_off_immediately_after_minimum_duration() {
    let started_at = Instant::now()
        .checked_sub(MIN_SPLASH_DURATION + Duration::from_millis(100))
        .unwrap_or_else(Instant::now);
    let (app, main) = build_app(started_at);
    let handoffs = record_handoffs(&app);

    assert_eq!(invoke_complete(&main, "select"), 0);
    assert_eq!(*handoffs.lock().unwrap(), vec!["select".to_string()]);

    // A repeated report (e.g. React StrictMode remount) is ignored.
    assert_eq!(invoke_complete(&main, "select"), 0);
    assert_eq!(handoffs.lock().unwrap().len(), 1);
}

#[test]
fn splash_commands_keep_splash_for_at_least_five_seconds_after_launch() {
    let (app, main) = build_app(Instant::now());
    let handoffs = record_handoffs(&app);

    let delay_ms = invoke_complete(&main, "error-app");
    assert!(delay_ms > 4_000 && delay_ms <= 5_000, "delay_ms={delay_ms}");
    assert!(handoffs.lock().unwrap().is_empty(), "splash handed off before 5 s");
    assert_eq!(invoke_complete(&main, "error-app"), 0, "handoff must be scheduled only once");
}
