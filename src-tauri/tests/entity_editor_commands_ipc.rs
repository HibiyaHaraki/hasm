use hasm_lib::hasm::{commands, entity_creation_commands, entity_editor_commands, visualizer_commands};
use serde_json::{json, Value};

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
