use hasm_lib::hasm::{commands, entity_creation_commands, entity_editor_commands, model_commands, visualizer_commands};
use serde_json::{json, Value};
use tauri::Listener;

#[test]
fn model_commands_entity_stage_progress_through_registered_invoke() {
    let app = tauri::test::mock_builder()
        .invoke_handler(tauri::generate_handler![
            model_commands::load_hasm_model_db,
            model_commands::verify_hasm_storage,
        ])
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .unwrap();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();
    let events = std::sync::Arc::new(std::sync::Mutex::new(Vec::<Value>::new()));
    let progress_threads = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
    let load_threads = progress_threads.clone();
    let captured = events.clone();
    app.listen("model-load-progress", move |event| {
        load_threads.lock().unwrap().push(std::thread::current().id());
        captured.lock().unwrap().push(serde_json::from_str(event.payload()).unwrap());
    });
    let verify_threads = progress_threads.clone();
    app.listen("model-verify-progress", move |_| {
        verify_threads.lock().unwrap().push(std::thread::current().id());
    });
    let demo = visualizer_commands::create_visualizer_demo_workspace().unwrap();
    let empty = std::env::temp_dir().join(format!("hasm-empty-progress-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&empty).unwrap();
    for entity_type in ["PERSON", "EXPERIENCE", "FACT", "LINK"] {
        std::fs::create_dir(empty.join(entity_type)).unwrap();
    }
    for path in [demo.path, empty.to_string_lossy().to_string()] {
        events.lock().unwrap().clear();
        let response = tauri::test::get_ipc_response(&window, tauri::webview::InvokeRequest {
            cmd: "load_hasm_model_db".into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(json!({ "path": path })),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        }).unwrap().deserialize::<Value>().unwrap();
        let events = events.lock().unwrap();
        let mut previous_end = 0;
        for (stage, collection) in [
            ("DB_LOAD_PERSON", "people"), ("DB_LOAD_EXPERIENCE", "experiences"),
            ("DB_LOAD_FACT", "facts"), ("DB_LOAD_LINK", "links"),
        ] {
            let first = events.iter().position(|event| event["step"] == stage).unwrap();
            let last = events.iter().rposition(|event| event["step"] == stage).unwrap();
            assert!(first >= previous_end);
            let total = response[collection].as_array().unwrap().len();
            assert_eq!(events[first]["current"], 0);
            assert_eq!(events[last]["current"], total);
            assert_eq!(events[last]["total"], total);
            assert_eq!(events[last]["percentage"], 100.0);
            assert!(events[first..=last].iter().all(|event| {
                event["step"] == stage && event["percentage"].as_f64().unwrap().is_finite()
            }));
            previous_end = last;
        }
        assert!(events.iter().any(|event| event["step"] == "DB_SYNC"));
        drop(events);
        let before_verify = progress_threads.lock().unwrap().len();
        tauri::test::get_ipc_response(&window, tauri::webview::InvokeRequest {
            cmd: "verify_hasm_storage".into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(json!({ "path": path, "model": response })),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        }).unwrap();
        let threads = progress_threads.lock().unwrap();
        if response["facts"].as_array().unwrap().len() > 0 {
            assert!(threads.len() > before_verify);
        }
        // TC-02-IPC-RESPONSIVE-001: actual generated handlers must leave the invoking thread.
        assert!(threads.iter().all(|id| *id != std::thread::current().id()));
        drop(threads);
        std::fs::remove_dir_all(path).unwrap();
    }
}

// TC-04-IPC-LINK-001: exercise generated command dispatch, serde, and SQLite together.
#[test]
fn entity_editor_commands_external_links_round_trip_through_registered_tauri_invokes() {
    let app = tauri::test::mock_builder()
        .invoke_handler(tauri::generate_handler![
            entity_editor_commands::load_entity_detail,
            commands::save_person_detail,
            commands::save_experience_detail,
            commands::save_fact_detail,
            commands::save_link_detail,
            entity_creation_commands::create_person,
            entity_creation_commands::create_experience,
            entity_creation_commands::create_fact,
            entity_creation_commands::create_link,
        ])
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .unwrap();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();
    let invoke = |command: &str, body: Value| {
        tauri::test::get_ipc_response(&window, tauri::webview::InvokeRequest {
            cmd: command.into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        }).map(|response| response.deserialize::<Value>().unwrap())
    };
    let demo = visualizer_commands::create_visualizer_demo_workspace().unwrap();
    let urls = json!(["https://x.com/ada/status/123", "https://www.google.com/maps/place/Tokyo", "http://example.org/?q=one%20two#section"]);
    for (entity_type, id) in [
        ("PERSON", "11111111-1111-1111-1111-111111111111"),
        ("EXPERIENCE", "22222222-2222-2222-2222-222222222221"),
        ("FACT", "33333333-3333-3333-3333-333333333331"),
        ("LINK", "44444444-4444-4444-4444-444444444444"),
    ] {
        let request = json!({ "modelRoot": demo.path, "entityType": entity_type, "entityId": id });
        let loaded = invoke("load_entity_detail", request.clone()).unwrap();
        assert_eq!(loaded["detail"]["link"], json!([]));
        let original_markdown = loaded["markdownBody"].clone();
        let mut detail = loaded["detail"].clone();
        detail["link"] = urls.clone();
        let command = format!("save_{}_detail", entity_type.to_lowercase());
        let save = |detail: Value| invoke(&command, json!({ "modelRoot": demo.path, "detail": detail }));
        save(detail.clone()).unwrap();
        let reloaded = invoke("load_entity_detail", request.clone()).unwrap();
        assert_eq!(reloaded["detail"]["link"], urls);
        assert_eq!(reloaded["markdownBody"], original_markdown);
        for field in ["linkIds", "relatedIds", "parentExperienceIds"] {
            assert_eq!(reloaded["detail"][field], loaded["detail"][field]);
        }

        detail["link"] = json!(["javascript:alert(1)"]);
        assert!(save(detail.clone()).unwrap_err().as_str().unwrap().contains("ERR_INVALID_EXTERNAL_LINK"));
        assert_eq!(invoke("load_entity_detail", request.clone()).unwrap()["detail"]["link"], urls);
        detail["link"] = json!("not an array");
        assert!(save(detail.clone()).is_err());
        detail["link"] = json!([]);
        save(detail.clone()).unwrap();
        assert_eq!(invoke("load_entity_detail", request.clone()).unwrap()["detail"]["link"], json!([]));
        detail.as_object_mut().unwrap().remove("link");
        save(detail).unwrap();

        // TC-04-IPC-INLINE-001: reader-first detail editors keep typed metadata intact.
        let fields = match entity_type {
            "PERSON" => json!({
                "birthday": "1815-12-10", "die": "1852-11-27",
                "linkIds": ["44444444-4444-4444-4444-444444444444"]
            }),
            "EXPERIENCE" => json!({
                "personId": "11111111-1111-1111-1111-111111111111",
                "parentExperienceIds": ["22222222-2222-2222-2222-222222222222"],
                "linkIds": ["44444444-4444-4444-4444-444444444444"]
            }),
            "FACT" => json!({
                "occurredAt": "2026-10-29",
                "experienceIds": ["22222222-2222-2222-2222-222222222221"],
                "personIds": ["11111111-1111-1111-1111-111111111111"],
                "linkIds": ["44444444-4444-4444-4444-444444444444"]
            }),
            "LINK" => json!({
                "linkType": "supports",
                "relatedIds": ["11111111-1111-1111-1111-111111111111", "33333333-3333-3333-3333-333333333331"]
            }),
            _ => unreachable!(),
        };
        let before = invoke("load_entity_detail", request.clone()).unwrap();
        let mut edited = before["detail"].clone();
        for (field, value) in fields.as_object().unwrap() {
            edited[field] = value.clone();
        }
        save(edited.clone()).unwrap();
        let after = invoke("load_entity_detail", request).unwrap();
        assert_eq!(after["detail"], edited);
        assert_eq!(after["markdownBody"], before["markdownBody"]);
        assert_eq!(after["name"], before["name"]);
    }
    let create_cases = [
        ("PERSON", json!({
            "personName": "New person", "personDescription": "", "securityLevel": 1, "createLifeExperience": false
        })),
        ("EXPERIENCE", json!({
            "experienceName": "New experience", "experienceDescription": "", "securityLevel": 1, "parentExperienceIds": []
        })),
        ("FACT", json!({
            "factName": "New fact", "factDescription": "", "securityLevel": 1, "startTime": null, "endTime": null, "experienceIds": []
        })),
        ("LINK", json!({
            "linkType": "references", "linkDescription": "", "securityLevel": 1,
            "originEntityType": "PERSON", "originEntityId": "11111111-1111-1111-1111-111111111111",
            "targetEntityType": "FACT", "targetEntityId": "33333333-3333-3333-3333-333333333331"
        })),
    ];
    for (entity_type, mut payload) in create_cases {
        let command = format!("create_{}", entity_type.to_lowercase());
        payload["link"] = json!(["file:///not-allowed"]);
        assert!(invoke(&command, json!({ "path": demo.path, "payload": payload }))
            .unwrap_err().as_str().unwrap().contains("ERR_INVALID_EXTERNAL_LINK"));
        payload["link"] = urls.clone();
        let created = invoke(&command, json!({ "path": demo.path, "payload": payload })).unwrap();
        let loaded = invoke("load_entity_detail", json!({
            "modelRoot": demo.path, "entityType": entity_type, "entityId": created["entityId"]
        })).unwrap();
        assert_eq!(loaded["detail"]["link"], urls);
    }
    std::fs::remove_dir_all(demo.path).unwrap();
}

// TC-NAV-IPC-001: the actual load/verify/layout commands must survive repeated saved tickets.
#[test]
fn entity_editor_commands_navigation_robustness() {
    let started = std::time::Instant::now();
    let app = tauri::test::mock_builder()
        .invoke_handler(tauri::generate_handler![
            model_commands::check_workspace_lock,
            model_commands::load_hasm_model_db,
            model_commands::verify_hasm_storage,
            visualizer_commands::compute_visualizer_layout,
            entity_editor_commands::load_entity_detail,
            commands::save_person_detail,
            commands::save_experience_detail,
            commands::save_fact_detail,
            commands::save_link_detail,
        ])
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .unwrap();
    let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();
    let invoke = |command: &str, body: Value| {
        tauri::test::get_ipc_response(&window, tauri::webview::InvokeRequest {
            cmd: command.into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        }).unwrap_or_else(|error| panic!("{command}: {error}")).deserialize::<Value>().unwrap()
    };
    let demo = visualizer_commands::create_visualizer_demo_workspace().unwrap();
    for cycle in 0..3 {
        for (entity_type, id, name_key) in [
            ("PERSON", "11111111-1111-1111-1111-111111111111", "personName"),
            ("EXPERIENCE", "22222222-2222-2222-2222-222222222221", "experienceName"),
            ("FACT", "33333333-3333-3333-3333-333333333331", "factName"),
            ("LINK", "44444444-4444-4444-4444-444444444444", "linkName"),
        ] {
            let loaded = invoke("load_entity_detail", json!({ "modelRoot": demo.path, "entityType": entity_type, "entityId": id }));
            let mut detail = loaded["detail"].clone();
            detail[name_key] = json!(format!("{entity_type} cycle {cycle}"));
            detail["link"] = json!(["https://example.org/reference"]);
            invoke(&format!("save_{}_detail", entity_type.to_lowercase()), json!({ "modelRoot": demo.path, "detail": detail }));
            let lock = invoke("check_workspace_lock", json!({ "path": demo.path }));
            assert_eq!(lock["isReadOnly"], false);
            assert_eq!(lock["isStaleRecovered"], false);
            let model = invoke("load_hasm_model_db", json!({ "path": demo.path }));
            let verification = invoke("verify_hasm_storage", json!({ "path": demo.path, "model": model }));
            assert_eq!(verification["missingEntities"], json!([]));
            let layout = invoke("compute_visualizer_layout", json!({
                "model": model, "filter": { "timeScaleMode": "SequentialIndex", "zScaleFactor": 1.0 }
            }));
            assert!(!layout["nodes3d"].as_array().unwrap().is_empty());
            let reloaded = invoke("load_entity_detail", json!({ "modelRoot": demo.path, "entityType": entity_type, "entityId": id }));
            assert_eq!(reloaded["detail"][name_key], detail[name_key]);
            assert_eq!(reloaded["detail"]["link"], detail["link"]);
            assert_eq!(reloaded["markdownBody"], loaded["markdownBody"]);
        }
    }
    // Actual corruption must still fail, rather than being hidden by the lifecycle guards.
    let fact_path = std::path::Path::new(&demo.path).join("FACT")
        .join("33333333-3333-3333-3333-333333333331").join("main.md");
    std::fs::remove_file(fact_path).unwrap();
    let model = hasm_lib::hasm::service::read_model_database(&demo.path).unwrap();
    let error = tauri::async_runtime::block_on(
        model_commands::verify_hasm_storage(app.handle().clone(), demo.path.clone(), model),
    ).unwrap_err();
    assert!(error.contains("ERR_MISSING_STORAGE_FOLDER"));
    std::fs::remove_dir_all(demo.path).unwrap();
    assert!(started.elapsed() < std::time::Duration::from_secs(120));
}
