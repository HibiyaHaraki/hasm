//! # commands.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Tauri command handlers for opening and saving HASM model entities.

use crate::hasm::definitions::{ExperienceDetail, FactDetail, LinkDetail, PersonDetail};
use crate::hasm::service;
use crate::hasm::types::{ModelWorkspace, SaveResult};

#[tauri::command]
pub fn open_hasm_model(model_root: String) -> Result<ModelWorkspace, String> {
    service::open_hasm_model(&model_root)
}

#[tauri::command]
pub fn get_person_detail(model_root: String, entity_id: String) -> Result<PersonDetail, String> {
    service::get_person_detail(&model_root, &entity_id)
}

#[tauri::command]
pub fn get_experience_detail(
    model_root: String,
    entity_id: String,
) -> Result<ExperienceDetail, String> {
    service::get_experience_detail(&model_root, &entity_id)
}

#[tauri::command]
pub fn get_fact_detail(model_root: String, entity_id: String) -> Result<FactDetail, String> {
    service::get_fact_detail(&model_root, &entity_id)
}

#[tauri::command]
pub fn get_link_detail(model_root: String, entity_id: String) -> Result<LinkDetail, String> {
    service::get_link_detail(&model_root, &entity_id)
}

#[tauri::command]
pub fn save_person_detail(model_root: String, detail: PersonDetail) -> Result<SaveResult, String> {
    service::save_person_detail(&model_root, &detail)
}

#[tauri::command]
pub fn save_experience_detail(
    model_root: String,
    detail: ExperienceDetail,
) -> Result<SaveResult, String> {
    service::save_experience_detail(&model_root, &detail)
}

#[tauri::command]
pub fn save_fact_detail(model_root: String, detail: FactDetail) -> Result<SaveResult, String> {
    service::save_fact_detail(&model_root, &detail)
}

#[tauri::command]
pub fn save_link_detail(model_root: String, detail: LinkDetail) -> Result<SaveResult, String> {
    service::save_link_detail(&model_root, &detail)
}