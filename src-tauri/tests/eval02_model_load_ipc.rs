//! EVAL-02 registered-invoke coverage for the SEQ-02 lock, load, and verification
//! commands: fresh model replacement, streamed progress payload contracts, and
//! structured error propagation through the actual Tauri IPC dispatch.

use hasm_lib::hasm::model_commands;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

const ENTITY_TYPES: [&str; 4] = ["PERSON", "EXPERIENCE", "FACT", "LINK"];

struct IpcHarness {
    _app: tauri::App<tauri::test::MockRuntime>,
    window: tauri::WebviewWindow<tauri::test::MockRuntime>,
    load_events: Arc<Mutex<Vec<Value>>>,
    verify_events: Arc<Mutex<Vec<Value>>>,
}

impl IpcHarness {
    fn create() -> Self {
        let app = tauri::test::mock_builder()
            .invoke_handler(tauri::generate_handler![
                model_commands::check_workspace_lock,
                model_commands::release_workspace_lock,
                model_commands::load_hasm_model_db,
                model_commands::verify_hasm_storage,
            ])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let load_events = Arc::new(Mutex::new(Vec::<Value>::new()));
        let verify_events = Arc::new(Mutex::new(Vec::<Value>::new()));
        let captured_load = load_events.clone();
        use tauri::Listener;
        app.listen("model-load-progress", move |event| {
            captured_load.lock().unwrap().push(serde_json::from_str(event.payload()).unwrap());
        });
        let captured_verify = verify_events.clone();
        app.listen("model-verify-progress", move |event| {
            captured_verify.lock().unwrap().push(serde_json::from_str(event.payload()).unwrap());
        });
        let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();
        Self { _app: app, window, load_events, verify_events }
    }

    fn invoke(&self, command: &str, body: Value) -> Result<Value, Value> {
        tauri::test::get_ipc_response(&self.window, tauri::webview::InvokeRequest {
            cmd: command.into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        })
        .map(|body| body.deserialize::<Value>().unwrap())
    }
}

/// Builds a database-less workspace holding `per_type` folder-only entities per type,
/// with deterministic UUIDs derived from `tag` so two workspaces never share IDs.
fn folder_workspace(tag: u128, per_type: usize) -> PathBuf {
    let root = std::env::temp_dir().join(format!("hasm-eval02-ipc-{}", uuid::Uuid::new_v4()));
    for (type_index, entity_type) in ENTITY_TYPES.iter().enumerate() {
        for index in 0..per_type {
            let id = uuid::Uuid::from_u128((tag << 64) + (type_index as u128) * 1_000_000 + index as u128);
            let folder = root.join(entity_type).join(id.to_string());
            std::fs::create_dir_all(&folder).unwrap();
            std::fs::write(folder.join("main.md"), format!("# {entity_type} {index}\n\nbody")).unwrap();
        }
    }
    root
}

fn collection_ids(model: &Value, collection: &str, id_key: &str) -> Vec<String> {
    model[collection]
        .as_array()
        .unwrap()
        .iter()
        .map(|entity| entity[id_key].as_str().unwrap().to_string())
        .collect()
}

// TC-02-IPC-LOAD-001: [REQ-02-RULE-004][REQ-02-DATA-004][REQ-02-FUNC-202][REQ-02-FUNC-206]
// [REQ-02-FUNC-207][REQ-02-FUNC-301][REQ-02-FUNC-303] registered lock/load/verify round
// trip with ordered streamed payloads and a completely fresh model per load.
#[test]
fn loads_and_verifies_workspaces_through_registered_invokes() {
    let harness = IpcHarness::create();
    let first = folder_workspace(0xA, 2);
    let first_path = first.to_string_lossy().to_string();

    let lock = harness.invoke("check_workspace_lock", json!({ "path": first_path })).unwrap();
    assert_eq!(lock["isLocked"], json!(false));
    assert_eq!(lock["isReadOnly"], json!(false));
    assert_eq!(lock["isStaleRecovered"], json!(false));
    assert_eq!(lock["holderPid"], json!(std::process::id()));

    let model = harness.invoke("load_hasm_model_db", json!({ "path": first_path })).unwrap();
    for collection in ["people", "experiences", "facts", "links"] {
        assert_eq!(model[collection].as_array().unwrap().len(), 2, "{collection}");
    }
    for person in model["people"].as_array().unwrap() {
        assert_eq!(person["markdown"], json!(""));
        assert!(!person["markdownPath"].as_str().unwrap().is_empty());
    }

    // [REQ-02-DATA-004] every streamed payload carries the documented contract keys.
    let load_events = harness.load_events.lock().unwrap().clone();
    assert!(!load_events.is_empty(), "load progress events must stream");
    for event in &load_events {
        for key in ["step", "current", "total", "percentage", "message"] {
            assert!(event.get(key).is_some(), "progress payload missing {key}: {event}");
        }
    }
    // [REQ-02-FUNC-206] per-type stages stream sequentially through the real channel.
    let first_index = |step: &str| load_events.iter().position(|event| event["step"] == json!(step));
    let ordered: Vec<Option<usize>> = ["DB_SYNC", "DB_LOAD_PERSON", "DB_LOAD_EXPERIENCE", "DB_LOAD_FACT", "DB_LOAD_LINK"]
        .iter()
        .map(|step| first_index(step))
        .collect();
    assert!(ordered.iter().all(Option::is_some), "missing stage events: {ordered:?}");
    assert!(ordered.windows(2).all(|window| window[0] < window[1]), "stages out of order: {ordered:?}");

    let verification = harness
        .invoke("verify_hasm_storage", json!({ "path": first_path, "model": model }))
        .unwrap();
    assert_eq!(verification, json!({ "missingEntities": [], "unreferencedEntities": [] }));
    let verify_events = harness.verify_events.lock().unwrap().clone();
    assert!(!verify_events.is_empty(), "verification progress events must stream");
    assert!(verify_events.iter().all(|event| event["step"] == json!("STORAGE_VERIFY")));

    // [REQ-02-RULE-004] loading another workspace returns a fully replaced snapshot.
    let second = folder_workspace(0xB, 1);
    let second_path = second.to_string_lossy().to_string();
    let replaced = harness.invoke("load_hasm_model_db", json!({ "path": second_path })).unwrap();
    assert_eq!(replaced["people"].as_array().unwrap().len(), 1);
    let first_people = collection_ids(&model, "people", "personId");
    let second_people = collection_ids(&replaced, "people", "personId");
    assert!(second_people.iter().all(|id| !first_people.contains(id)), "stale entities leaked into the new model");

    harness.invoke("release_workspace_lock", json!({ "path": first_path })).unwrap();
    std::fs::remove_dir_all(first).unwrap();
    std::fs::remove_dir_all(second).unwrap();
}

// TC-02-IPC-LOAD-002 / TC-02-IPC-LOAD-003: [REQ-02-RULE-004][REQ-02-RULE-006]
// [REQ-02-DATA-005][REQ-02-FUNC-202][REQ-02-FUNC-206][REQ-02-FUNC-207][REQ-02-FUNC-301]
// [REQ-02-FUNC-303][REQ-02-FUNC-304][REQ-02-FUNC-410] corrupted databases and missing
// storage propagate structured errors through real dispatch; throttling bounds event
// volume; the next load is unaffected by the failed attempt.
#[test]
fn propagates_structured_load_and_verify_errors_through_registered_invokes() {
    let harness = IpcHarness::create();

    // A corrupted database must be refused with a descriptive error, not a partial model.
    let corrupted = folder_workspace(0xC, 1);
    let corrupted_path = corrupted.to_string_lossy().to_string();
    std::fs::write(corrupted.join("main.db"), b"this is not a sqlite database").unwrap();
    let error = harness
        .invoke("load_hasm_model_db", json!({ "path": corrupted_path }))
        .unwrap_err();
    let error_text = error.as_str().unwrap().to_string();
    assert!(error_text.to_lowercase().contains("database"), "unexpected corruption error: {error_text}");

    // [REQ-02-RULE-004] the failed attempt leaves no residue: a good workspace loads cleanly.
    let good = folder_workspace(0xD, 1);
    let good_path = good.to_string_lossy().to_string();
    let model = harness.invoke("load_hasm_model_db", json!({ "path": good_path })).unwrap();
    for collection in ["people", "experiences", "facts", "links"] {
        assert_eq!(model[collection].as_array().unwrap().len(), 1, "{collection}");
    }

    // [REQ-02-FUNC-304][REQ-02-DATA-005] a deleted main.md rejects verification with the
    // ERR_MISSING_STORAGE_FOLDER payload naming the exact relative path.
    let fact_id = model["facts"][0]["factId"].as_str().unwrap().to_string();
    std::fs::remove_file(good.join("FACT").join(&fact_id).join("main.md")).unwrap();
    let verify_events_before = harness.verify_events.lock().unwrap().len();
    let error = harness
        .invoke("verify_hasm_storage", json!({ "path": good_path, "model": model }))
        .unwrap_err();
    let error_text = error.as_str().unwrap().to_string();
    assert!(error_text.contains("ERR_MISSING_STORAGE_FOLDER"), "{error_text}");
    assert!(error_text.contains(&format!("FACT/{fact_id}/main.md")), "{error_text}");
    // [REQ-02-FUNC-303] verification streams progress even while discovering the miss.
    assert!(
        harness.verify_events.lock().unwrap().len() > verify_events_before,
        "verification must stream progress before rejecting"
    );

    // [REQ-02-FUNC-410] the 150ms throttle bounds bootstrap/load event volume: a
    // 1,200-entity bootstrap must emit far fewer events than its row count.
    let large = folder_workspace(0xE, 300);
    let large_path = large.to_string_lossy().to_string();
    let load_events_before = harness.load_events.lock().unwrap().len();
    let loaded = harness.invoke("load_hasm_model_db", json!({ "path": large_path })).unwrap();
    assert_eq!(loaded["people"].as_array().unwrap().len(), 300);
    let emitted = harness.load_events.lock().unwrap().len() - load_events_before;
    assert!(emitted < 300, "throttle failed: {emitted} events for 1,200 bootstrapped rows");

    std::fs::remove_dir_all(corrupted).unwrap();
    std::fs::remove_dir_all(good).unwrap();
    std::fs::remove_dir_all(large).unwrap();
}
