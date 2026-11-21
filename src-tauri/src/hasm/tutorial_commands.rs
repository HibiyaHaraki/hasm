//! Temporary tutorial workspace creation and lifecycle.

use crate::hasm::entity_creation_commands::{create_experience, create_fact, create_hasm_workspace, create_link, create_person};
use crate::hasm::service;
use crate::hasm::types::{CreateExperienceRequest, CreateFactRequest, CreateLinkRequest, CreatePersonRequest, WorkspacePathPayload};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

/// [REQ-02-RULE-016] Tracks only the tutorial workspace created by this application instance.
#[derive(Default)]
pub struct TutorialWorkspace(Mutex<Option<PathBuf>>);

/// [REQ-02-RULE-016] Creates an isolated example using the same workspace and entity creation paths as normal models.
#[tauri::command]
pub fn create_tutorial_workspace(state: State<'_, TutorialWorkspace>) -> Result<WorkspacePathPayload, String> {
    let mut active = state.0.lock().map_err(|error| error.to_string())?;
    if active.is_some() {
        return Err("A tutorial workspace is already active.".into());
    }
    let root = std::env::temp_dir().join(format!("hasm-tutorial-{}", Uuid::new_v4()));
    fs::create_dir(&root).map_err(|error| format!("Could not create tutorial directory: {error}"))?;
    let path = root.to_string_lossy().to_string();
    let result = (|| {
        create_hasm_workspace(path.clone())?;
        create_person(path.clone(), CreatePersonRequest {
            link: vec![], person_name: "Marie Curie".into(), person_description: "An example research timeline.".into(),
            security_level: 1, create_life_experience: true, birth_date: Some("1867-11-07".into()),
        })?;
        let model = service::read_model_database(&path)?;
        let life = model.experiences.first().ok_or("Tutorial life experience was not created.")?.experience_id;
        let research = create_experience(path.clone(), CreateExperienceRequest {
            link: vec![], experience_name: "Research".into(), experience_description: "A branch of the life timeline.".into(),
            security_level: 1, parent_experience_ids: vec![life], fact_ids: vec![],
        })?.entity_id;
        let first = create_fact(path.clone(), CreateFactRequest {
            link: vec![], fact_name: "Research on uranium rays".into(), fact_description: "An example event in the research branch.".into(),
            security_level: 1, start_time: Some("1897-01-01".into()), end_time: None, experience_ids: vec![research],
        })?.entity_id;
        let second = create_fact(path.clone(), CreateFactRequest {
            link: vec![], fact_name: "Discovery of radium".into(), fact_description: "A second example event.".into(),
            security_level: 1, start_time: Some("1898-12-26".into()), end_time: None, experience_ids: vec![research],
        })?.entity_id;
        create_link(path.clone(), CreateLinkRequest {
            link: vec![], link_type: "references".into(), link_description: "Connects two research events.".into(),
            origin_entity_type: "FACT".into(), origin_entity_id: first,
            target_entity_type: "FACT".into(), target_entity_id: second, security_level: 1,
        })?;
        Ok::<(), String>(())
    })();
    if let Err(error) = result {
        if let Err(cleanup) = fs::remove_dir_all(&root) {
            *active = Some(root.clone());
            return Err(format!("Tutorial creation failed: {error}; cleanup of {} failed: {cleanup}", root.display()));
        }
        return Err(format!("Tutorial creation failed: {error}"));
    }
    *active = Some(root);
    log::info!("[SEQ-MD-02][TUTORIAL] temporary workspace created");
    Ok(WorkspacePathPayload { path })
}

/// [REQ-02-RULE-016] Removes only the workspace tracked by this application instance.
#[tauri::command]
pub fn cleanup_tutorial_workspace(state: State<'_, TutorialWorkspace>) -> Result<(), String> {
    cleanup(&state)
}

/// [REQ-02-RULE-016] Removes the owned tutorial workspace on application close.
pub fn cleanup(state: &TutorialWorkspace) -> Result<(), String> {
    let mut active = state.0.lock().map_err(|error| error.to_string())?;
    if let Some(root) = active.as_ref() {
        if root.exists() {
            fs::remove_dir_all(root).map_err(|error| format!("Could not remove tutorial workspace: {error}"))?;
        }
        *active = None;
        log::info!("[SEQ-MD-02][TUTORIAL] temporary workspace removed");
    }
    Ok(())
}
