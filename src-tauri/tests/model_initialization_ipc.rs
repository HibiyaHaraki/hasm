use hasm_lib::hasm::{entity_creation_commands, entity_deletion_commands, entity_editor_commands, model_commands, visualizer_commands};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

struct NewModelFixture {
    root: PathBuf,
    window: tauri::WebviewWindow<tauri::test::MockRuntime>,
}

impl NewModelFixture {
    fn create() -> Self {
        let app = tauri::test::mock_builder()
            .invoke_handler(tauri::generate_handler![
                entity_creation_commands::create_hasm_workspace,
                entity_creation_commands::create_person,
                entity_creation_commands::create_experience,
                entity_creation_commands::create_fact,
                entity_creation_commands::create_link,
                entity_deletion_commands::convert_entity,
                model_commands::load_hasm_model_db,
                model_commands::verify_hasm_storage,
                entity_editor_commands::load_entity_detail,
            ])
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .unwrap();
        let fixture = Self {
            root: std::env::temp_dir().join(format!("hasm-new model-{}", uuid::Uuid::new_v4())),
            window: tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap(),
        };
        fixture.invoke("create_hasm_workspace", json!({ "targetDirectoryPath": fixture.root }));
        fixture.invoke("create_person", json!({
            "path": fixture.root,
            "payload": {
                "personName": "Test Person", "birthDate": "2000-02-29",
                "personDescription": "", "securityLevel": 1, "createLifeExperience": true
            }
        }));
        fixture
    }

    fn invoke(&self, command: &str, body: Value) -> Value {
        self.try_invoke(command, body).unwrap_or_else(|error| panic!("{command} failed: {error}"))
    }

    fn try_invoke(&self, command: &str, body: Value) -> Result<Value, String> {
        tauri::test::get_ipc_response(&self.window, tauri::webview::InvokeRequest {
            cmd: command.into(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: "http://tauri.localhost".parse().unwrap(),
            body: tauri::ipc::InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: tauri::test::INVOKE_KEY.into(),
        }).map_err(|error| error.to_string())?
            .deserialize::<Value>().map_err(|error| error.to_string())
    }

    fn load(&self) -> Value {
        self.invoke("load_hasm_model_db", json!({ "path": self.root }))
    }
}

// TC-08-IPC-FACTS-004: registered creation dispatch preserves existing FACT memberships.
#[test]
fn experience_creation_binds_existing_facts_through_registered_invokes() {
        let fixture = NewModelFixture::create();
        let initial = fixture.load();
        let first_fact = &initial["facts"][0]["factId"];
        let second_fact = fixture.invoke("create_fact", json!({
            "path": fixture.root, "payload": {
                "factName": "Second fact", "factDescription": "", "securityLevel": 1,
                "startTime": null, "endTime": null, "experienceIds": []
            }
        }));
        let created = fixture.invoke("create_experience", json!({
            "path": fixture.root, "payload": {
                "experienceName": "Shared context", "experienceDescription": "", "securityLevel": 1,
                "parentExperienceIds": [initial["experiences"][0]["experienceId"]],
                "factIds": [first_fact, second_fact["entityId"], first_fact]
            }
        }));
        let loaded = fixture.load();
        let facts = loaded["facts"].as_array().unwrap();
        let first = facts.iter().find(|fact| fact["factId"] == *first_fact).unwrap();
        assert_eq!(first["experienceIds"], json!([initial["experiences"][0]["experienceId"], created["entityId"]]));
        assert_eq!(first["personIds"], initial["facts"][0]["personIds"]);
        let second = facts.iter().find(|fact| fact["factId"] == second_fact["entityId"]).unwrap();
        assert_eq!(second["experienceIds"], json!([created["entityId"]]));
        assert!(Path::new(created["targetDirPath"].as_str().unwrap()).join("main.md").is_file());
        fixture.invoke("verify_hasm_storage", json!({ "path": fixture.root, "model": loaded }));
        for optional in [None, Some(json!([]))] {
            let before = fixture.load();
            let mut payload = json!({
                "experienceName": "Independent", "experienceDescription": "", "securityLevel": 1,
                "parentExperienceIds": []
            });
            if let Some(ids) = optional { payload["factIds"] = ids; }
            fixture.invoke("create_experience", json!({ "path": fixture.root, "payload": payload }));
            assert_eq!(fixture.load()["facts"], before["facts"], "Empty and legacy requests leave FACTs unchanged");
        }
}

    // TC-08-IPC-FACTS-005: missing/corrupt FACTs, partial updates, and commit failure roll back.
#[test]
fn experience_fact_binding_failures_roll_back_through_registered_invokes() {
        for failure in ["missing", "corrupt", "sql", "commit"] {
            let fixture = NewModelFixture::create();
            let initial = fixture.load();
            let fact_id = initial["facts"][0]["factId"].as_str().unwrap();
            let connection = rusqlite::Connection::open(fixture.root.join("main.db")).unwrap();
            let selected = match failure {
                "missing" => json!([fact_id, uuid::Uuid::new_v4()]),
                "corrupt" => {
connection.execute("UPDATE fact SET experience_ids = 'invalid-json' WHERE fact_id = ?1", [fact_id]).unwrap();
json!([fact_id])
                },
                "sql" => {
let second = fixture.invoke("create_fact", json!({
    "path": fixture.root, "payload": {
        "factName": "Reject update", "factDescription": "", "securityLevel": 1,
        "startTime": null, "endTime": null, "experienceIds": []
    }
}));
connection.execute_batch("CREATE TRIGGER reject_fact_binding BEFORE UPDATE OF experience_ids ON fact WHEN OLD.fact_name = 'Reject update' BEGIN SELECT RAISE(ABORT, 'Injected binding failure'); END;").unwrap();
json!([fact_id, second["entityId"]])
            }
                "commit" => {
connection.execute_batch(
    "CREATE TABLE invalid_binding (fact_id TEXT REFERENCES fact(fact_id) DEFERRABLE INITIALLY DEFERRED);
     CREATE TRIGGER reject_commit AFTER INSERT ON experience BEGIN
     INSERT INTO invalid_binding VALUES ('00000000-0000-0000-0000-000000000000'); END;"
).unwrap();
json!([fact_id])
                }
                _ => unreachable!(),
            };
            let before: String = connection.query_row("SELECT experience_ids FROM fact WHERE fact_id = ?1", [fact_id], |row| row.get(0)).unwrap();
            let error = fixture.try_invoke("create_experience", json!({
                "path": fixture.root, "payload": {
"experienceName": "Must roll back", "experienceDescription": "", "securityLevel": 1,
"parentExperienceIds": [], "factIds": selected
                }
            })).unwrap_err();
            assert!(error.contains("ERR_ENTITY_CREATE_FAILED"), "{failure}: {error}");
            let after: String = connection.query_row("SELECT experience_ids FROM fact WHERE fact_id = ?1", [fact_id], |row| row.get(0)).unwrap();
            assert_eq!(after, before, "{failure}: FACT membership must roll back");
            let count: i64 = connection.query_row("SELECT COUNT(*) FROM experience", [], |row| row.get(0)).unwrap();
            assert_eq!(count, 1, "{failure}: no new EXPERIENCE row");
            assert_eq!(std::fs::read_dir(fixture.root.join("EXPERIENCE")).unwrap().count(), 1);
        }
    }

impl Drop for NewModelFixture {
    fn drop(&mut self) {
        if let Err(error) = std::fs::remove_dir_all(&self.root) {
            assert!(std::thread::panicking(), "Failed to clean test workspace: {error}");
        }
    }
}

fn conversion_request(fixture: &NewModelFixture, entity_type: &str, id: &Value, keep: bool) -> Value {
    let ticket = fixture.invoke("load_entity_detail", json!({
        "modelRoot": fixture.root, "entityType": entity_type, "entityId": id,
    }));
    let detail = &ticket["detail"];
    json!({
        "entityType": entity_type, "entityId": id, "keepOriginal": keep,
        "experienceIds": if entity_type == "FACT" { &detail["experienceIds"] } else { &detail["parentExperienceIds"] },
        "personId": if entity_type == "FACT" { detail["personIds"][0].clone() } else { Value::Null },
        "occurredAt": if entity_type == "EXPERIENCE" { json!("2026-11-14") } else { Value::Null },
        "loadedMtimeMs": ticket["loadedMtimeMs"],
    })
}

// TC-04-IPC-CONVERT-001: both directions and retention choices through real native dispatch.
#[test]
fn conversion_preserves_content_metadata_and_links_through_registered_invokes() {
    for source_type in ["FACT", "EXPERIENCE"] {
        for keep in [true, false] {
            let fixture = NewModelFixture::create();
            let initial = fixture.load();
            let parent_id = &initial["experiences"][0]["experienceId"];
            let source_id = if source_type == "FACT" { initial["facts"][0]["factId"].clone() } else {
                fixture.invoke("create_experience", json!({
                    "path": fixture.root, "payload": {
                        "experienceName": "Research", "experienceDescription": "", "securityLevel": 1,
                        "parentExperienceIds": [parent_id], "factIds": []
                    }
                }))["entityId"].clone()
            };
            let link = fixture.invoke("create_link", json!({
                "path": fixture.root, "payload": {
                    "linkType": "references", "linkDescription": "", "securityLevel": 1,
                    "originEntityType": source_type, "originEntityId": source_id,
                    "targetEntityType": "EXPERIENCE", "targetEntityId": parent_id
                }
            }));
            let connection = rusqlite::Connection::open(fixture.root.join("main.db")).unwrap();
            let table = source_type.to_lowercase();
            connection.execute(&format!("UPDATE {table} SET link = ?1, link_ids = ?2 WHERE {table}_id = ?3"),
                rusqlite::params![json!(["https://example.org/source"]).to_string(), json!([link["entityId"]]).to_string(), source_id.as_str().unwrap()]).unwrap();
            let source_dir = fixture.root.join(source_type).join(source_id.as_str().unwrap());
            let body = "\n# Preserved notes\r\n\nContent with an asset reference.\n";
            let original = format!("---\nentity_type: {source_type}\nentity_id: {}\ncustom: retained\n---\n{body}", source_id.as_str().unwrap());
            std::fs::write(source_dir.join("main.md"), &original).unwrap();
            std::fs::write(source_dir.join("assets").join("sample.bin"), [0, 1, 255]).unwrap();
            let request = conversion_request(&fixture, source_type, &source_id, keep);
            let result = fixture.invoke("convert_entity", json!({ "path": fixture.root, "request": request }));
            let target_type = if source_type == "FACT" { "EXPERIENCE" } else { "FACT" };
            assert_eq!(result["entityType"], target_type);
            assert_eq!(result["entityId"] == source_id, !keep);
            let target_dir = fixture.root.join(target_type).join(result["entityId"].as_str().unwrap());
            let target_markdown = std::fs::read_to_string(target_dir.join("main.md")).unwrap();
            assert!(target_markdown.contains(&format!("entity_type: {target_type}\n")));
            assert!(target_markdown.contains(&format!("entity_id: {}\n", result["entityId"].as_str().unwrap())));
            assert!(target_markdown.contains("custom: retained\n"));
            assert!(target_markdown.ends_with(body), "Markdown body must not change");
            assert_eq!(std::fs::read(target_dir.join("assets").join("sample.bin")).unwrap(), [0, 1, 255]);
            if keep {
                assert!(result["archivePath"].is_null());
                assert_eq!(std::fs::read_to_string(source_dir.join("main.md")).unwrap(), original);
            } else {
                assert!(!source_dir.exists());
                let archive = PathBuf::from(result["archivePath"].as_str().unwrap());
                assert_eq!(std::fs::read_to_string(archive.join(format!("{source_type}-{}", source_id.as_str().unwrap())).join("main.md")).unwrap(), original);
                let manifest: Value = serde_json::from_slice(&std::fs::read(archive.join("complete.json")).unwrap()).unwrap();
                assert_eq!(manifest["entries"][0]["metadata"]["link"], json!(["https://example.org/source"]).to_string());
                if source_type == "FACT" { assert_eq!(manifest["entries"][0]["metadata"]["occurred_at"], "2000-02-29"); }
            }
            let detail = fixture.invoke("load_entity_detail", json!({
                "modelRoot": fixture.root, "entityType": target_type, "entityId": result["entityId"]
            }));
            assert_eq!(detail["detail"]["link"], json!(["https://example.org/source"]));
            assert_eq!(detail["detail"]["linkIds"], json!([link["entityId"]]));
            if target_type == "EXPERIENCE" {
                assert_eq!(detail["detail"]["parentExperienceIds"], json!([parent_id]));
                assert_eq!(detail["detail"]["personId"], initial["people"][0]["personId"]);
            } else {
                assert_eq!(detail["detail"]["experienceIds"], json!([parent_id]));
                assert_eq!(detail["detail"]["occurredAt"], "2026-11-14");
            }
            let model = fixture.load();
            let endpoints = model["links"][0]["relatedIds"].as_array().unwrap();
            assert!(endpoints.contains(&source_id));
            assert!(endpoints.contains(&result["entityId"]));
            assert_eq!(endpoints.len(), if keep { 3 } else { 2 });
            fixture.invoke("verify_hasm_storage", json!({ "path": fixture.root, "model": model }));
        }
    }
}

// TC-04-IPC-CONVERT-002: dependencies, freshness, locks, and staging faults cannot discard data.
#[test]
fn conversion_rejects_unsafe_requests_and_rolls_back_through_registered_invokes() {
    let fixture = NewModelFixture::create();
    let initial = fixture.load();
    let experience_id = &initial["experiences"][0]["experienceId"];
    let fact_id = &initial["facts"][0]["factId"];
    let blocked = conversion_request(&fixture, "EXPERIENCE", experience_id, false);
    let error = fixture.try_invoke("convert_entity", json!({ "path": fixture.root, "request": blocked })).unwrap_err();
    assert!(error.contains("Keep the original"), "{error}");
    let copy = conversion_request(&fixture, "EXPERIENCE", experience_id, true);
    let mut invalid_date = copy.clone();
    invalid_date["occurredAt"] = json!("2026-02-30");
    let error = fixture.try_invoke("convert_entity", json!({ "path": fixture.root, "request": invalid_date })).unwrap_err();
    assert!(error.contains("Invalid FACT occurrence"), "{error}");
    fixture.invoke("convert_entity", json!({ "path": fixture.root, "request": copy }));
    assert!(fixture.root.join("EXPERIENCE").join(experience_id.as_str().unwrap()).is_dir());
    let mut stale = conversion_request(&fixture, "FACT", fact_id, false);
    stale["loadedMtimeMs"] = json!(0);
    let error = fixture.try_invoke("convert_entity", json!({ "path": fixture.root, "request": stale })).unwrap_err();
    assert!(error.contains("refresh"), "{error}");
    let valid = conversion_request(&fixture, "FACT", fact_id, false);
    std::fs::write(fixture.root.join(".hasm").join("lock"), "another-process").unwrap();
    let error = fixture.try_invoke("convert_entity", json!({ "path": fixture.root, "request": valid })).unwrap_err();
    assert!(error.contains("read-only"), "{error}");
    std::fs::write(fixture.root.join(".hasm").join("lock"), std::process::id().to_string()).unwrap();
    let connection = rusqlite::Connection::open(fixture.root.join("main.db")).unwrap();
    let mut missing = valid.clone();
    missing["experienceIds"] = json!([uuid::Uuid::new_v4()]);
    let error = fixture.try_invoke("convert_entity", json!({ "path": fixture.root, "request": missing })).unwrap_err();
    assert!(error.contains("existing EXPERIENCE"), "{error}");
    connection.execute("UPDATE fact SET experience_ids = 'not-json' WHERE fact_id = ?1", [fact_id.as_str().unwrap()]).unwrap();
    let error = fixture.try_invoke("convert_entity", json!({ "path": fixture.root, "request": valid })).unwrap_err();
    assert!(error.contains("Invalid source experience_ids"), "{error}");
    connection.execute("UPDATE fact SET experience_ids = ?1 WHERE fact_id = ?2",
        rusqlite::params![initial["facts"][0]["experienceIds"].to_string(), fact_id.as_str().unwrap()]).unwrap();
    connection.execute_batch("CREATE TRIGGER fail_conversion BEFORE INSERT ON experience BEGIN SELECT RAISE(ABORT, 'Injected conversion failure'); END;").unwrap();
    for keep in [true, false] {
        let before = fixture.load();
        let request = conversion_request(&fixture, "FACT", fact_id, keep);
        let error = fixture.try_invoke("convert_entity", json!({ "path": fixture.root, "request": request })).unwrap_err();
        assert!(error.contains("Injected conversion failure"), "{error}");
        assert_eq!(fixture.load(), before);
        assert!(fixture.root.join("FACT").join(fact_id.as_str().unwrap()).join("main.md").is_file());
        assert_eq!(std::fs::read_dir(fixture.root.join("EXPERIENCE")).unwrap().count(), 1);
    }
}

// TC-04-IPC-CONVERT-003: load-time recovery distinguishes uncommitted and committed conversions.
#[test]
fn conversion_pending_archives_recover_before_folder_synchronization() {
    for keep in [true, false] {
        for committed in [true, false] {
            let fixture = NewModelFixture::create();
            let initial = fixture.load();
            let source_id = &initial["facts"][0]["factId"];
            let request = conversion_request(&fixture, "FACT", source_id, keep);
            let result = fixture.invoke("convert_entity", json!({ "path": fixture.root, "request": request }));
            let archive = std::fs::read_dir(fixture.root.join(".hasm").join("deleted")).unwrap().next().unwrap().unwrap().path();
            let manifest: Value = serde_json::from_slice(&std::fs::read(archive.join("complete.json")).unwrap()).unwrap();
            std::fs::rename(archive.join("complete.json"), archive.join("pending.json")).unwrap();
            if !committed {
                let connection = rusqlite::Connection::open(fixture.root.join("main.db")).unwrap();
                connection.execute("DELETE FROM experience WHERE experience_id = ?1", [result["entityId"].as_str().unwrap()]).unwrap();
                if !keep {
                    let row = &manifest["entries"][0]["metadata"];
                    connection.execute("INSERT INTO fact (fact_id, fact_name, occurred_at, fact_description_path, experience_ids, person_ids, link_ids, link) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                        rusqlite::params![row["fact_id"].as_str().unwrap(), row["fact_name"].as_str().unwrap(), row["occurred_at"].as_str().unwrap(), row["fact_description_path"].as_str().unwrap(), row["experience_ids"].as_str().unwrap(), row["person_ids"].as_str().unwrap(), row["link_ids"].as_str().unwrap(), row["link"].as_str().unwrap()]).unwrap();
                }
            }
            let model = fixture.load();
            assert!(!archive.join("pending.json").exists());
            assert!(archive.join(if committed { "complete.json" } else { "rolled-back.json" }).is_file());
            if !committed {
                assert_eq!(model, initial, "Recovery must prevent phantom folder bootstrap");
                assert!(!fixture.root.join("EXPERIENCE").join(result["entityId"].as_str().unwrap()).exists());
            }
            fixture.invoke("verify_hasm_storage", json!({ "path": fixture.root, "model": model }));
        }
    }
}

// TC-08-IPC-BOOTSTRAP-002: independently reload the created workspace without adding other entities.
#[test]
fn new_model_loads_exactly_one_person_experience_and_fact() {
    let fixture = NewModelFixture::create();
    let model = fixture.load();
    for collection in ["people", "experiences", "facts"] {
        assert_eq!(model[collection].as_array().unwrap().len(), 1, "{collection}");
    }
    assert_eq!(model["links"].as_array().unwrap().len(), 0);
    let person = &model["people"][0];
    let experience = &model["experiences"][0];
    let fact = &model["facts"][0];
    assert_eq!(person["personName"], "Test Person");
    assert_eq!(person["birthday"], "2000-02-29");
    assert_eq!(experience["experienceName"], "Test Person Life");
    assert_eq!(experience["personId"], person["personId"]);
    assert_eq!(fact["factName"], "Test Person Birth date");
    assert_eq!(fact["occurredAt"], person["birthday"]);
    assert_eq!(fact["personIds"], json!([person["personId"]]));
    assert_eq!(fact["experienceIds"], json!([experience["experienceId"]]));
    fixture.invoke("verify_hasm_storage", json!({ "path": fixture.root, "model": model }));
    assert_eq!(fixture.load(), model, "Reopening must preserve the complete model");
}

fn markdown_cli(executable: &Path, mode: &str, directory: &Path) -> Output {
    let mut command = Command::new(executable);
    command.arg(mode).arg(directory);
    if mode == "verify" {
        command.arg("--json");
    }
    let mut child = command.stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()
        .unwrap_or_else(|error| panic!("Could not run {} {mode}: {error}", executable.display()));
    let started = Instant::now();
    loop {
        if child.try_wait().expect("Could not check Markdown CLI status").is_some() {
            break;
        }
        if started.elapsed() > Duration::from_secs(10) {
            child.kill().expect("Could not stop timed-out Markdown CLI");
            let output = child.wait_with_output().expect("Could not reap timed-out Markdown CLI");
            panic!("Markdown {mode} timed out for {}: {}", directory.display(), String::from_utf8_lossy(&output.stderr));
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    let output = child.wait_with_output().expect("Could not read Markdown CLI output");
    assert!(output.status.success(),
        "Markdown {mode} failed for {} ({}):\nstdout: {}\nstderr: {}",
        directory.display(), output.status,
        String::from_utf8_lossy(&output.stdout), String::from_utf8_lossy(&output.stderr));
    output
}

fn assert_markdown_loads(executable: &Path, directory: &Path, description: &str) {
    let verification = markdown_cli(executable, "verify", directory);
    let result: Value = serde_json::from_slice(&verification.stdout)
        .unwrap_or_else(|error| panic!("Invalid verification JSON: {error}\n{}", String::from_utf8_lossy(&verification.stdout)));
    assert_eq!(result["status"], "Valid", "{result}");
    assert_eq!(result["targetPath"], directory.to_string_lossy().as_ref());
    assert_eq!(result["missingAssets"], json!([]));
    assert_eq!(result["warnings"], json!([]));
    let preview = markdown_cli(executable, "preview", directory);
    let loaded = String::from_utf8(preview.stdout).expect("Markdown preview must be UTF-8");
    assert_eq!(loaded.replace("\r\n", "\n"), format!("{description}\n"),
        "HASM Markdown must load the complete description unchanged");
}

// TC-08-IPC-REL-001 / TC-05-CLI-CREATE-001: actual command serde, relationships, and editor loading.
#[test]
fn entity_creation_persists_selected_experiences_and_default_markdown() {
    let executable = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries").join("hasm_markdown.exe");
    assert!(executable.is_file(), "Build/stage HASM Markdown with npm run build:markdown before this test");
    let fixture = NewModelFixture::create();
    let initial = fixture.load();
    let parent_id = &initial["experiences"][0]["experienceId"];
    let second_parent = fixture.invoke("create_experience", json!({
        "path": fixture.root,
        "payload": {
            "experienceName": "Another parent", "experienceDescription": "",
            "securityLevel": 1, "parentExperienceIds": []
        }
    }));
    let selected_ids = json!([parent_id, second_parent["entityId"]]);
    let cases = [
        ("PERSON", "create_person", json!({
            "personName": "New person", "personDescription": "", "securityLevel": 1, "createLifeExperience": false
        })),
        ("EXPERIENCE", "create_experience", json!({
            "experienceName": "New branch", "experienceDescription": "", "securityLevel": 1, "parentExperienceIds": selected_ids
        })),
        ("FACT", "create_fact", json!({
            "factName": "New event", "factDescription": "", "securityLevel": 1,
            "startTime": "2026-01-01", "endTime": null, "experienceIds": selected_ids
        })),
        ("LINK", "create_link", json!({
            "linkType": "references", "linkDescription": "", "securityLevel": 1,
            "originEntityType": "PERSON", "originEntityId": initial["people"][0]["personId"],
            "targetEntityType": "EXPERIENCE", "targetEntityId": parent_id
        })),
    ];
    for (entity_type, command, payload) in cases {
        let created = fixture.invoke(command, json!({ "path": fixture.root, "payload": payload }));
        let detail = fixture.invoke("load_entity_detail", json!({
            "modelRoot": fixture.root, "entityType": entity_type, "entityId": created["entityId"]
        }));
        let directory = fixture.root.join(entity_type).join(created["entityId"].as_str().unwrap());
        let description = std::fs::read_to_string(directory.join("main.md")).unwrap();
        assert!(description.ends_with("\n\nWrite notes here.\n"), "{entity_type}: default description missing");
        assert!(description.contains(&format!("entity_type: {entity_type}\n")));
        assert!(description.contains(created["entityId"].as_str().unwrap()));
        assert_eq!(detail["markdownBody"], description);
        assert!(directory.join("assets").is_dir());
        assert!(!directory.join("assets.json").exists());
        assert_markdown_loads(&executable, &directory, &description);
        let model = fixture.load();
        if entity_type == "EXPERIENCE" {
            let experience = model["experiences"].as_array().unwrap().iter()
                .find(|entity| entity["experienceId"] == created["entityId"]).unwrap();
            assert_eq!(experience["parentExperienceIds"], selected_ids);
        }
        if entity_type == "FACT" {
            let fact = model["facts"].as_array().unwrap().iter()
                .find(|entity| entity["factId"] == created["entityId"]).unwrap();
            assert_eq!(fact["experienceIds"], selected_ids);
        }
        fixture.invoke("verify_hasm_storage", json!({ "path": fixture.root, "model": model }));
    }
}

// TC-05-CLI-BOOTSTRAP-001: run the real staged editor, not a mocked spawn or host-only reader.
#[test]
fn hasm_markdown_loads_every_new_model_description() {
    let executable = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries").join("hasm_markdown.exe");
    assert!(executable.is_file(), "Build/stage HASM Markdown with npm run build:markdown before this test");
    let fixture = NewModelFixture::create();
    let model = fixture.load();
    let mut checked = 0;
    for (collection, entity_type, id_key) in [
        ("people", "PERSON", "personId"),
        ("experiences", "EXPERIENCE", "experienceId"),
        ("facts", "FACT", "factId"),
    ] {
        let entities = model[collection].as_array().unwrap();
        assert_eq!(entities.len(), 1, "Expected exactly one {entity_type} description");
        for entity in entities {
            let id = entity[id_key].as_str().unwrap();
            let detail = fixture.invoke("load_entity_detail", json!({
                "modelRoot": fixture.root, "entityType": entity_type, "entityId": id
            }));
            let directory = fixture.root.join(entity_type).join(id);
            let description = std::fs::read_to_string(directory.join("main.md")).unwrap();
            assert!(!description.trim().is_empty(), "{entity_type} description is empty");
            assert_eq!(detail["markdownBody"], description);
            assert!(!directory.join("assets.json").exists(), "Test the actual asset-free scaffold");

            assert_markdown_loads(&executable, &directory, &description);
            assert_eq!(std::fs::read_to_string(directory.join("main.md")).unwrap(), description);
            assert!(!directory.join("assets.json").exists(), "Opening must not mutate the scaffold");
            checked += 1;
        }
    }
    assert_eq!(checked, 3, "All three model descriptions must load");
    assert_eq!(fixture.load(), model, "Description loading must not change the HASM model");
}

// TC-08-IPC-BOOTSTRAP-001: real dispatch, persistence, rollback, reload, and graph binding.
#[test]
fn initializes_birth_entities_through_registered_invokes() {
    let app = tauri::test::mock_builder()
        .invoke_handler(tauri::generate_handler![
            entity_creation_commands::create_hasm_workspace,
            entity_creation_commands::create_person,
            model_commands::load_hasm_model_db,
            model_commands::verify_hasm_storage,
            visualizer_commands::compute_visualizer_layout,
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
        }).map(|body| body.deserialize::<Value>().unwrap())
    };
    let root = std::env::temp_dir().join(format!("hasm-birth-ipc-{}", uuid::Uuid::new_v4()));
    let path = root.to_string_lossy().to_string();
    invoke("create_hasm_workspace", json!({ "targetDirectoryPath": path })).unwrap();
    let mut payload = json!({
        "personName": "Person", "birthDate": "2000-02-29", "personDescription": "",
        "securityLevel": 1, "createLifeExperience": true
    });

    for date in ["", "2001-02-29", "1900-02-29", "2000-04-31", "0000-01-01",
        "2000-00-01", "2000-01-00", "2000-13-01", "2000-1-01", "not-a-date"]
    {
        payload["birthDate"] = json!(date);
        assert!(invoke("create_person", json!({ "path": path, "payload": payload }))
            .unwrap_err().as_str().unwrap().contains("ERR_INVALID_BIRTH_DATE"));
    }
    payload["birthDate"] = json!("2000-02-29");
    payload["createLifeExperience"] = json!(false);
    assert!(invoke("create_person", json!({ "path": path, "payload": payload }))
        .unwrap_err().as_str().unwrap().contains("requires a Life EXPERIENCE"));
    payload["createLifeExperience"] = json!(true);

    // Fail after PERSON and EXPERIENCE scaffolding to verify the whole bootstrap rolls back.
    let connection = rusqlite::Connection::open(root.join("main.db")).unwrap();
    connection.execute_batch(
        "CREATE TRIGGER reject_birth BEFORE INSERT ON fact BEGIN SELECT RAISE(ABORT, 'birth insert failed'); END;"
    ).unwrap();
    assert!(invoke("create_person", json!({ "path": path, "payload": payload }))
        .unwrap_err().as_str().unwrap().contains("birth insert failed"));
    for entity_type in ["PERSON", "EXPERIENCE", "FACT"] {
        assert_eq!(std::fs::read_dir(root.join(entity_type)).unwrap().count(), 0);
    }
    for table in ["person", "experience", "fact"] {
        assert_eq!(connection.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get::<_, i64>(0)).unwrap(), 0);
    }
    connection.execute_batch("DROP TRIGGER reject_birth;").unwrap();
    drop(connection);

    let created = invoke("create_person", json!({ "path": path, "payload": payload })).unwrap();
    let model = invoke("load_hasm_model_db", json!({ "path": path })).unwrap();
    for collection in ["people", "experiences", "facts"] {
        assert_eq!(model[collection].as_array().unwrap().len(), 1);
    }
    assert!(model["links"].as_array().unwrap().is_empty());
    let person = &model["people"][0];
    let experience = &model["experiences"][0];
    let fact = &model["facts"][0];
    assert_eq!(person["personId"], created["entityId"]);
    assert_eq!(person["birthday"], "2000-02-29");
    assert_eq!(experience["experienceName"], "Person Life");
    assert_eq!(experience["personId"], person["personId"]);
    assert_eq!(fact["factName"], "Person Birth date");
    assert_eq!(fact["occurredAt"], person["birthday"]);
    assert_eq!(fact["experienceIds"], json!([experience["experienceId"]]));
    assert_eq!(fact["personIds"], json!([person["personId"]]));
    for (entity_type, entity, id_key) in [
        ("PERSON", person, "personId"),
        ("EXPERIENCE", experience, "experienceId"),
        ("FACT", fact, "factId"),
    ] {
        let directory = root.join(entity_type).join(entity[id_key].as_str().unwrap());
        assert!(directory.join("assets").is_dir());
        let markdown = std::fs::read_to_string(directory.join("main.md")).unwrap();
        assert!(markdown.contains(entity[id_key].as_str().unwrap()));
        assert_eq!(entity["link"], json!([]));
    }
    invoke("verify_hasm_storage", json!({ "path": path, "model": model })).unwrap();
    let layout = invoke("compute_visualizer_layout", json!({
        "model": model, "filter": { "timeScaleMode": "SequentialIndex", "zScaleFactor": 1.0 }
    })).unwrap();
    assert!(layout["nodes3d"].as_array().unwrap().iter().any(|node| node["id"] == fact["factId"]));

    // Older PERSON callers omit birthDate and must retain the existing behavior.
    payload.as_object_mut().unwrap().remove("birthDate");
    invoke("create_person", json!({ "path": path, "payload": payload })).unwrap();
    let reloaded = invoke("load_hasm_model_db", json!({ "path": path })).unwrap();
    assert_eq!(reloaded["people"].as_array().unwrap().len(), 2);
    assert_eq!(reloaded["experiences"].as_array().unwrap().len(), 2);
    assert_eq!(reloaded["facts"].as_array().unwrap().len(), 1);
    std::fs::remove_dir_all(root).unwrap();
}
