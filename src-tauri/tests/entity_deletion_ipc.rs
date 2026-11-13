use hasm_lib::hasm::{entity_deletion_commands, model_commands, visualizer_commands};
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::path::PathBuf;

const ROOT: &str = "22222222-2222-2222-2222-222222222221";
const TARGET: &str = "22222222-2222-2222-2222-222222222222";
const CHILD: &str = "22222222-2222-2222-2222-222222222223";
const FACT1: &str = "33333333-3333-3333-3333-333333333332";
const FACT2: &str = "33333333-3333-3333-3333-333333333334";
const LINK1: &str = "44444444-4444-4444-4444-444444444444";
const LINK2: &str = "44444444-4444-4444-4444-444444444445";

struct Fixture {
    root: PathBuf,
    window: tauri::WebviewWindow<tauri::test::MockRuntime>,
}

impl Fixture {
    fn new() -> Self {
        let app = tauri::test::mock_builder().invoke_handler(tauri::generate_handler![
            entity_deletion_commands::delete_entity,
            model_commands::load_hasm_model_db,
            model_commands::verify_hasm_storage,
        ]).build(tauri::test::mock_context(tauri::test::noop_assets())).unwrap();
        let demo = visualizer_commands::create_test_workspace_fixture().unwrap();
        let root = PathBuf::from(demo.path);
        std::fs::create_dir_all(root.join(".hasm")).unwrap();
        std::fs::write(root.join(".hasm").join("lock"), std::process::id().to_string()).unwrap();
        let window = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();
        Self { root, window }
    }

    fn invoke(&self, command: &str, body: Value) -> Result<Value, String> {
        tauri::test::get_ipc_response(&self.window, tauri::webview::InvokeRequest {
            cmd: command.into(), callback: tauri::ipc::CallbackFn(0), error: tauri::ipc::CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(body), headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        }).map_err(|error| error.to_string()).and_then(|body| body.deserialize::<Value>().map_err(|error| error.to_string()))
    }

    fn delete(&self, request: Value) -> Result<Value, String> {
        self.invoke("delete_entity", json!({ "path": self.root, "request": request }))
    }

    fn load(&self) -> Value {
        self.invoke("load_hasm_model_db", json!({ "path": self.root })).unwrap()
    }

    fn database(&self) -> Connection {
        Connection::open(self.root.join("main.db")).unwrap()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        if let Err(error) = std::fs::remove_dir_all(&self.root) {
            assert!(std::thread::panicking(), "Failed to clean test workspace: {error}");
        }
    }
}

fn request(entity_type: &str, entity_id: &str) -> Value {
    json!({ "entityType": entity_type, "entityId": entity_id, "factIds": [],
        "replacementExperienceId": null, "childParents": [], "linkDecisions": [] })
}

#[test]
fn tc_04_ipc_delete_001_experience_reassignment_and_link_choices() {
    let fixture = Fixture::new();
    let connection = fixture.database();
    connection.execute("UPDATE link SET related_ids = ?1 WHERE link_id = ?2",
        params![json!([TARGET, FACT1]).to_string(), LINK1]).unwrap();
    connection.execute("INSERT INTO link (link_id, link_name, link_type, link_description_path, related_ids, link) VALUES (?1, 'Delete relation', 'references', ?2, ?3, '[]')",
        params![LINK2, format!("LINK/{LINK2}/main.md"), json!([TARGET, FACT2]).to_string()]).unwrap();
    connection.execute("UPDATE experience SET link_ids = ?1 WHERE experience_id = ?2", params![json!([LINK1, LINK2]).to_string(), TARGET]).unwrap();
    connection.execute("UPDATE fact SET link_ids = ?1 WHERE fact_id = ?2", params![json!([LINK1, LINK2]).to_string(), FACT1]).unwrap();
    drop(connection);
    std::fs::create_dir_all(fixture.root.join("LINK").join(LINK2).join("assets")).unwrap();
    std::fs::write(fixture.root.join("LINK").join(LINK2).join("main.md"), "Link to archive").unwrap();
    std::fs::write(fixture.root.join("EXPERIENCE").join(TARGET).join("assets").join("example.txt"), "asset").unwrap();

    let mut deletion = request("EXPERIENCE", TARGET);
    deletion["factIds"] = json!([FACT1, FACT2]);
    deletion["childParents"] = json!([{ "childId": CHILD, "parentId": ROOT }]);
    deletion["linkDecisions"] = json!([{ "linkId": LINK1, "delete": false }, { "linkId": LINK2, "delete": true }]);
    let error = fixture.delete(deletion.clone()).unwrap_err();
    assert!(error.contains("replacement EXPERIENCE"), "{error}");
    assert!(fixture.root.join("EXPERIENCE").join(TARGET).is_dir());
    deletion["replacementExperienceId"] = json!(ROOT);
    let result = fixture.delete(deletion).unwrap();
    let archive = PathBuf::from(result["archivePath"].as_str().unwrap());
    assert_eq!(std::fs::read_to_string(archive.join(format!("EXPERIENCE-{TARGET}")).join("assets").join("example.txt")).unwrap(), "asset");
    assert_eq!(std::fs::read_to_string(archive.join(format!("LINK-{LINK2}")).join("main.md")).unwrap(), "Link to archive");
    let manifest: Value = serde_json::from_slice(&std::fs::read(archive.join("complete.json")).unwrap()).unwrap();
    assert_eq!(manifest["entries"][0]["metadata"]["experience_name"], "Research");
    assert!(!fixture.root.join("EXPERIENCE").join(TARGET).exists());
    assert!(!fixture.root.join("LINK").join(LINK2).exists());
    let model = fixture.load();
    assert!(model["experiences"].as_array().unwrap().iter().all(|item| item["experienceId"] != TARGET));
    let child = model["experiences"].as_array().unwrap().iter().find(|item| item["experienceId"] == CHILD).unwrap();
    assert_eq!(child["parentExperienceIds"], json!([ROOT]));
    for id in [FACT1, FACT2] {
        let fact = model["facts"].as_array().unwrap().iter().find(|item| item["factId"] == id).unwrap();
        assert_eq!(fact["experienceIds"], json!([ROOT]));
    }
    let fact = model["facts"].as_array().unwrap().iter().find(|item| item["factId"] == FACT1).unwrap();
    assert_eq!(fact["linkIds"], json!([LINK1]));
    assert_eq!(model["links"].as_array().unwrap().len(), 1);
    assert_eq!(model["links"][0]["relatedIds"], json!([FACT1]));
    let verification = fixture.invoke("verify_hasm_storage", json!({ "path": fixture.root, "model": model })).unwrap();
    assert_eq!(verification["unreferencedEntities"], json!([]));
}

#[test]
fn tc_04_ipc_delete_002_fact_and_link_cleanup_and_archive() {
    let fixture = Fixture::new();
    let connection = fixture.database();
    connection.execute("UPDATE link SET related_ids = ?1 WHERE link_id = ?2",
        params![json!([FACT1, TARGET]).to_string(), LINK1]).unwrap();
    connection.execute("UPDATE experience SET link_ids = ?1 WHERE experience_id = ?2",
        params![json!([LINK1]).to_string(), TARGET]).unwrap();
    drop(connection);
    let mut deletion = request("FACT", FACT1);
    deletion["linkDecisions"] = json!([{ "linkId": LINK1, "delete": false }]);
    let result = fixture.delete(deletion).unwrap();
    let archive = PathBuf::from(result["archivePath"].as_str().unwrap());
    assert!(archive.join(format!("FACT-{FACT1}")).join("main.md").is_file());
    let model = fixture.load();
    assert!(model["facts"].as_array().unwrap().iter().all(|item| item["factId"] != FACT1));
    assert_eq!(model["links"][0]["relatedIds"], json!([TARGET]));
    let result = fixture.delete(request("LINK", LINK1)).unwrap();
    assert!(PathBuf::from(result["archivePath"].as_str().unwrap()).join(format!("LINK-{LINK1}")).join("main.md").is_file());
    let model = fixture.load();
    assert_eq!(model["links"], json!([]));
    let experience = model["experiences"].as_array().unwrap().iter().find(|item| item["experienceId"] == TARGET).unwrap();
    assert_eq!(experience["linkIds"], json!([]));
}

#[test]
fn tc_04_ipc_delete_003_rejects_stale_choices_read_only_and_missing_storage() {
    let fixture = Fixture::new();
    let mut deletion = request("EXPERIENCE", TARGET);
    deletion["factIds"] = json!([FACT1, FACT2]);
    deletion["replacementExperienceId"] = json!(ROOT);
    deletion["childParents"] = json!([{ "childId": CHILD, "parentId": ROOT }]);
    fixture.database().execute("UPDATE link SET related_ids = ?1 WHERE link_id = ?2",
        params![json!([TARGET, FACT1]).to_string(), LINK1]).unwrap();
    let error = fixture.delete(deletion.clone()).unwrap_err();
    assert!(error.contains("Related LINKs changed"), "{error}");
    deletion["linkDecisions"] = json!([{ "linkId": LINK1, "delete": true }]);
    std::fs::write(fixture.root.join(".hasm").join("lock"), "0").unwrap();
    let error = fixture.delete(deletion.clone()).unwrap_err();
    assert!(error.contains("read-only"), "{error}");
    std::fs::write(fixture.root.join(".hasm").join("lock"), std::process::id().to_string()).unwrap();
    let original = fixture.root.join("LINK").join(LINK1);
    let held = fixture.root.join("held-link");
    std::fs::rename(&original, &held).unwrap();
    assert!(fixture.delete(deletion).is_err());
    std::fs::rename(&held, &original).unwrap();
    let model = fixture.load();
    assert!(model["experiences"].as_array().unwrap().iter().any(|item| item["experienceId"] == TARGET));
    assert!(model["links"].as_array().unwrap().iter().any(|item| item["linkId"] == LINK1));
    assert!(fixture.delete(request("PERSON", "11111111-1111-1111-1111-111111111111")).is_err());
}

#[test]
fn tc_04_ipc_delete_004_restores_pending_archives_before_folder_sync() {
    let fixture = Fixture::new();
    let archive = fixture.root.join(".hasm").join("deleted").join("interrupted");
    std::fs::create_dir_all(&archive).unwrap();
    let manifest = json!({ "entries": [{ "entity_type": "FACT", "entity_id": FACT1, "metadata": {} }] });
    std::fs::write(archive.join("pending.json"), serde_json::to_vec(&manifest).unwrap()).unwrap();
    std::fs::rename(fixture.root.join("FACT").join(FACT1), archive.join(format!("FACT-{FACT1}"))).unwrap();
    let model = fixture.load();
    assert!(model["facts"].as_array().unwrap().iter().any(|item| item["factId"] == FACT1));
    assert!(fixture.root.join("FACT").join(FACT1).join("main.md").is_file());
    assert!(archive.join("rolled-back.json").is_file());
    let result = fixture.delete(request("FACT", FACT1)).unwrap();
    let completed = PathBuf::from(result["archivePath"].as_str().unwrap());
    std::fs::rename(completed.join("complete.json"), completed.join("pending.json")).unwrap();
    let model = fixture.load();
    assert!(model["facts"].as_array().unwrap().iter().all(|item| item["factId"] != FACT1));
    assert!(completed.join("complete.json").is_file());
}

#[test]
fn tc_04_ipc_delete_005_rejects_cycles_across_multiple_child_reparentings() {
    let fixture = Fixture::new();
    let extra = "22222222-2222-2222-2222-222222222224";
    fixture.database().execute(
        "INSERT INTO experience (experience_id, person_id, experience_name, experience_description_path, parent_experience_ids, link_ids, link) VALUES (?1, ?2, 'Extra', ?3, ?4, '[]', '[]')",
        params![extra, "11111111-1111-1111-1111-111111111111", format!("EXPERIENCE/{extra}/main.md"), json!([TARGET]).to_string()],
    ).unwrap();
    std::fs::create_dir_all(fixture.root.join("EXPERIENCE").join(extra)).unwrap();
    std::fs::write(fixture.root.join("EXPERIENCE").join(extra).join("main.md"), "# Extra").unwrap();
    let mut deletion = request("EXPERIENCE", TARGET);
    deletion["factIds"] = json!([FACT1, FACT2]);
    deletion["replacementExperienceId"] = json!(ROOT);
    deletion["childParents"] = json!([{ "childId": CHILD, "parentId": extra }, { "childId": extra, "parentId": CHILD }]);
    let error = fixture.delete(deletion).unwrap_err();
    assert!(error.contains("cycle"), "{error}");
    assert!(fixture.root.join("EXPERIENCE").join(TARGET).is_dir());
    assert!(fixture.load()["experiences"].as_array().unwrap().iter().any(|item| item["experienceId"] == TARGET));
}

#[test]
fn tc_04_ipc_delete_006_preserves_other_fact_placements_without_replacement() {
    let fixture = Fixture::new();
    let connection = fixture.database();
    for id in [FACT1, FACT2] {
        connection.execute("UPDATE fact SET experience_ids = ?1 WHERE fact_id = ?2",
            params![json!([TARGET, ROOT]).to_string(), id]).unwrap();
    }
    drop(connection);
    let mut deletion = request("EXPERIENCE", TARGET);
    deletion["factIds"] = json!([FACT1, FACT2]);
    deletion["childParents"] = json!([{ "childId": CHILD, "parentId": ROOT }]);
    fixture.delete(deletion).unwrap();
    let model = fixture.load();
    for id in [FACT1, FACT2] {
        let fact = model["facts"].as_array().unwrap().iter().find(|item| item["factId"] == id).unwrap();
        assert_eq!(fact["experienceIds"], json!([ROOT]));
    }
}
