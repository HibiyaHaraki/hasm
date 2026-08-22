//! SEQ-04 generic entity detail, mtime, and Markdown reload IPC.
use crate::hasm::service;
use crate::hasm::types::{CheckMtimePayload, EntityDetailPayload};
use std::fs;

#[tauri::command]
pub fn load_entity_detail(model_root: String, entity_type: String, entity_id: String) -> Result<EntityDetailPayload, String> {
    let detail = detail_value(&model_root, &entity_type, &entity_id)?;
    let markdown_path = detail.get("markdownPath").and_then(|value| value.as_str()).ok_or("ERR_ENTITY_NOT_FOUND")?;
    let metadata = fs::metadata(markdown_path).map_err(|_| format!("ERR_MARKDOWN_FILE_NOT_FOUND: {markdown_path}"))?;
    let loaded_mtime_ms = metadata.modified().map_err(|error| error.to_string())?.duration_since(std::time::UNIX_EPOCH).map_err(|error| error.to_string())?.as_millis() as u64;
    let markdown_body = detail.get("markdown").and_then(|value| value.as_str()).unwrap_or_default().to_string();
    let name = detail.get("personName").or_else(|| detail.get("experienceName")).or_else(|| detail.get("factName")).or_else(|| detail.get("linkName")).and_then(|value| value.as_str()).unwrap_or_default().to_string();
    Ok(EntityDetailPayload { entity_type, entity_id, name, markdown_body, loaded_mtime_ms, detail })
}

#[tauri::command]
pub fn check_entity_mtime(model_root: String, entity_type: String, entity_id: String, last_loaded_mtime_ms: u64) -> Result<CheckMtimePayload, String> {
    let detail = detail_value(&model_root, &entity_type, &entity_id)?;
    let path = detail.get("markdownPath").and_then(|value| value.as_str()).ok_or("ERR_ENTITY_NOT_FOUND")?;
    let metadata = match fs::metadata(path) { Ok(value) => value, Err(_) => return Ok(CheckMtimePayload { is_modified: false, is_deleted: true, current_mtime_ms: 0 }) };
    let current_mtime_ms = metadata.modified().map_err(|error| error.to_string())?.duration_since(std::time::UNIX_EPOCH).map_err(|error| error.to_string())?.as_millis() as u64;
    Ok(CheckMtimePayload { is_modified: current_mtime_ms > last_loaded_mtime_ms, is_deleted: false, current_mtime_ms })
}

#[tauri::command]
pub fn reload_entity_markdown(model_root: String, entity_type: String, entity_id: String) -> Result<EntityDetailPayload, String> { load_entity_detail(model_root, entity_type, entity_id) }

fn detail_value(root: &str, entity_type: &str, id: &str) -> Result<serde_json::Value, String> {
    match entity_type {
        "PERSON" => serde_json::to_value(service::get_person_detail(root, id)?).map_err(|error| error.to_string()),
        "EXPERIENCE" => serde_json::to_value(service::get_experience_detail(root, id)?).map_err(|error| error.to_string()),
        "FACT" => serde_json::to_value(service::get_fact_detail(root, id)?).map_err(|error| error.to_string()),
        "LINK" => serde_json::to_value(service::get_link_detail(root, id)?).map_err(|error| error.to_string()),
        _ => Err("ERR_ENTITY_NOT_FOUND".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::hasm::visualizer_commands::create_visualizer_demo_workspace;

    #[test]
    fn loads_and_reloads_every_entity_from_a_populated_workspace() {
        let demo = create_visualizer_demo_workspace().unwrap();
        let cases = [
            ("PERSON", "11111111-1111-1111-1111-111111111111"),
            ("EXPERIENCE", "22222222-2222-2222-2222-222222222221"),
            ("FACT", "33333333-3333-3333-3333-333333333331"),
            ("LINK", "44444444-4444-4444-4444-444444444444"),
        ];
        for (entity_type, entity_id) in cases {
            let loaded = load_entity_detail(demo.path.clone(), entity_type.to_string(), entity_id.to_string()).unwrap();
            assert!(!loaded.markdown_body.is_empty());
            assert_eq!(loaded.entity_type, entity_type);
            let reloaded = reload_entity_markdown(demo.path.clone(), entity_type.to_string(), entity_id.to_string()).unwrap();
            assert_eq!(reloaded.entity_id, entity_id);
        }
        fs::remove_dir_all(demo.path).unwrap();
    }

    #[test]
    fn reports_deleted_markdown_without_database_access() {
        let demo = create_visualizer_demo_workspace().unwrap();
        let entity_id = "33333333-3333-3333-3333-333333333331";
        let loaded = load_entity_detail(demo.path.clone(), "FACT".to_string(), entity_id.to_string()).unwrap();
        fs::remove_file(format!("{}/FACT/{entity_id}/main.md", demo.path)).unwrap();
        let mtime = check_entity_mtime(demo.path.clone(), "FACT".to_string(), entity_id.to_string(), loaded.loaded_mtime_ms).unwrap();
        assert!(mtime.is_deleted);
        assert!(reload_entity_markdown(demo.path.clone(), "FACT".to_string(), entity_id.to_string()).unwrap_err().contains("ERR_MARKDOWN_FILE_NOT_FOUND"));
        fs::remove_dir_all(demo.path).unwrap();
    }

    #[test]
    fn persists_metadata_for_every_entity_type() {
        let demo = create_visualizer_demo_workspace().unwrap();
        let mut person = service::get_person_detail(&demo.path, "11111111-1111-1111-1111-111111111111").unwrap(); 
        person.person_name = "Ada Updated".to_string(); 
        service::save_person_detail(&demo.path, &person).unwrap(); 
        assert_eq!(service::get_person_detail(&demo.path, &person.person_id.to_string()).unwrap().person_name, "Ada Updated");
        let mut experience = service::get_experience_detail(&demo.path, "22222222-2222-2222-2222-222222222221").unwrap(); 
        experience.experience_name = "Life Updated".to_string(); 
        service::save_experience_detail(&demo.path, &experience).unwrap(); 
        assert_eq!(service::get_experience_detail(&demo.path, &experience.experience_id.to_string()).unwrap().experience_name, "Life Updated");
        let mut fact = service::get_fact_detail(&demo.path, "33333333-3333-3333-3333-333333333331").unwrap(); 
        fact.fact_name = "Foundation Updated".to_string(); 
        service::save_fact_detail(&demo.path, &fact).unwrap(); 
        assert_eq!(service::get_fact_detail(&demo.path, &fact.fact_id.to_string()).unwrap().fact_name, "Foundation Updated");
        let mut link = service::get_link_detail(&demo.path, "44444444-4444-4444-4444-444444444444").unwrap(); 
        link.link_name = "Supports Updated".to_string(); 
        service::save_link_detail(&demo.path, &link).unwrap(); 
        assert_eq!(service::get_link_detail(&demo.path, &link.link_id.to_string()).unwrap().link_name, "Supports Updated");
        fs::remove_dir_all(demo.path).unwrap();
    }
}