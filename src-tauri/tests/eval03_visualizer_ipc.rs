//! EVAL-03 IPC tests for the SEQ-03 visualizer layout command: the registered
//! `compute_visualizer_layout` invoke must stream the documented
//! `visualizer-layout-progress` payloads (REQ-03-DATA-002, REQ-03-FUNC-105) and
//! reject an empty model with the documented error payload without emitting
//! progress (REQ-03-RULE-001, REQ-03-DATA-004).
use hasm_lib::hasm::visualizer_commands;
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tauri::Listener;

fn build_app() -> (tauri::App<tauri::test::MockRuntime>, tauri::WebviewWindow<tauri::test::MockRuntime>) {
    let app = tauri::test::mock_builder()
        .invoke_handler(tauri::generate_handler![visualizer_commands::compute_visualizer_layout])
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .unwrap();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();
    (app, window)
}

fn record_progress(app: &tauri::App<tauri::test::MockRuntime>) -> Arc<Mutex<Vec<Value>>> {
    let events = Arc::new(Mutex::new(Vec::<Value>::new()));
    let captured = events.clone();
    app.listen("visualizer-layout-progress", move |event| {
        captured.lock().unwrap().push(serde_json::from_str(event.payload()).unwrap());
    });
    events
}

fn invoke_layout(window: &tauri::WebviewWindow<tauri::test::MockRuntime>, body: Value) -> Result<Value, Value> {
    tauri::test::get_ipc_response(window, tauri::webview::InvokeRequest {
        cmd: "compute_visualizer_layout".into(),
        callback: tauri::ipc::CallbackFn(0),
        error: tauri::ipc::CallbackFn(1),
        url: "http://tauri.localhost".parse().unwrap(),
        body: tauri::ipc::InvokeBody::Json(body),
        headers: Default::default(),
        invoke_key: tauri::test::INVOKE_KEY.into(),
    }).map(|response| response.deserialize::<Value>().unwrap())
}

// TC-03-RUST-IPC-001: [REQ-03-RULE-001] [REQ-03-DATA-004] [REQ-03-DATA-002] [REQ-03-FUNC-105]
// Negative: an empty model is rejected through the registered invoke with the documented
// `ERR_NO_ACTIVE_MODEL` error payload, and the failure path emits no layout progress events.
#[test]
fn eval03_rejects_empty_model_through_registered_invoke_without_progress() {
    let (app, window) = build_app();
    let events = record_progress(&app);
    let error = invoke_layout(&window, json!({
        "model": { "people": [], "experiences": [], "facts": [], "links": [] },
        "filter": { "timeScaleMode": "SequentialIndex", "zScaleFactor": 1.0 },
    })).unwrap_err();
    assert_eq!(error.as_str().unwrap(), "ERR_NO_ACTIVE_MODEL");
    assert!(events.lock().unwrap().is_empty(), "a rejected layout must not stream progress");
    // A request missing its required filter is rejected by serde, not defaulted.
    assert!(invoke_layout(&window, json!({
        "model": { "people": [], "experiences": [], "facts": [], "links": [] },
    })).is_err());
    assert!(events.lock().unwrap().is_empty());
}

// TC-03-RUST-IPC-002: [REQ-03-FUNC-105] [REQ-03-DATA-002] [REQ-03-DATA-003]
// Positive: a populated model streams `visualizer-layout-progress` events carrying the
// documented `current`/`total`/`percentage`/`message` payload fields and resolves the
// documented RenderPayload shape through the registered invoke.
#[test]
fn eval03_streams_progress_payload_contract_through_registered_invoke() {
    let (app, window) = build_app();
    let events = record_progress(&app);
    let demo = visualizer_commands::create_test_workspace_fixture().unwrap();
    let response = invoke_layout(&window, json!({
        "model": demo.model,
        "filter": { "timeScaleMode": "SequentialIndex", "zScaleFactor": 1.0 },
    })).unwrap();
    std::fs::remove_dir_all(demo.path).unwrap();
    let events = events.lock().unwrap();
    assert!(events.len() >= 2, "expected chunked progress emissions, got {}", events.len());
    for event in events.iter() {
        assert!(event["current"].is_u64());
        assert!(event["total"].is_u64());
        let percentage = event["percentage"].as_f64().unwrap();
        assert!((0.0..=100.0).contains(&percentage));
        assert!(!event["message"].as_str().unwrap().is_empty());
    }
    assert_eq!(events.last().unwrap()["percentage"].as_f64().unwrap(), 100.0);
    assert!(!response["nodes3d"].as_array().unwrap().is_empty());
    assert!(!response["lines3d"].as_array().unwrap().is_empty());
    assert!(response["warnings"].as_array().unwrap().is_empty());
}

// TC-03-IPC-OWNER-001 / TC-03-IPC-OWNER-002: recursive owner names and cycle/missing-parent
// handling must survive the registered Tauri command and serialized render payload.
#[test]
fn eval03_inherits_all_experience_owners_through_registered_invoke() {
    let (_app, window) = build_app();
    let mut demo = visualizer_commands::create_test_workspace_fixture().unwrap();
    let mut second_person = demo.model.people[0].clone();
    second_person.person_id = uuid::Uuid::new_v4();
    second_person.person_name = "Grace".into();
    let ada_id = demo.model.people[0].person_id;
    let grace_id = second_person.person_id;
    demo.model.people.push(second_person);
    let template = demo.model.experiences[0].clone();
    let root_id = uuid::Uuid::new_v4();
    let other_id = uuid::Uuid::new_v4();
    let parent_id = uuid::Uuid::new_v4();
    let child_id = uuid::Uuid::new_v4();
    let cycle_a = uuid::Uuid::new_v4();
    let cycle_b = uuid::Uuid::new_v4();
    let orphan = uuid::Uuid::new_v4();
    let make = |id, owner, parents| {
        let mut experience = template.clone();
        experience.experience_id = id;
        experience.person_id = owner;
        experience.parent_experience_ids = parents;
        experience
    };
    demo.model.experiences = vec![
        make(root_id, ada_id, vec![]),
        make(other_id, grace_id, vec![]),
        make(parent_id, uuid::Uuid::nil(), vec![root_id, other_id]),
        make(child_id, uuid::Uuid::nil(), vec![parent_id, root_id]),
        make(cycle_a, uuid::Uuid::nil(), vec![cycle_b, uuid::Uuid::new_v4()]),
        make(cycle_b, grace_id, vec![cycle_a]),
        make(orphan, uuid::Uuid::nil(), vec![uuid::Uuid::new_v4()]),
    ];
    demo.model.facts.clear();
    demo.model.links.clear();
    let response = invoke_layout(&window, json!({
        "model": demo.model,
        "filter": { "timeScaleMode": "SequentialIndex", "zScaleFactor": 1.0 },
    })).unwrap();
    std::fs::remove_dir_all(demo.path).unwrap();
    let nodes = response["nodes3d"].as_array().unwrap();
    let node = |id: uuid::Uuid| nodes.iter().find(|node| node["id"] == id.to_string()).unwrap();
    assert_eq!(node(child_id)["personName"], "Ada, Grace");
    assert_eq!(node(cycle_a)["personName"], "Grace");
    assert!(node(orphan)["personName"].is_null());
}
