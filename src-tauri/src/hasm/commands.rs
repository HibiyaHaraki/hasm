//! # commands.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Tauri command handlers for opening and saving HASM model entities.

use crate::hasm::definitions::{Experience, Fact, Link, Person};
use crate::hasm::service;
use crate::hasm::types::{ModelDatabase, ModelWorkspace, SaveResult};

/// [REQ-02-RULE-009][REQ-02-FUNC-403] Opens a workspace snapshot, bootstrapping into the
/// database only entity folders that have no corresponding row.
#[tauri::command]
pub fn open_hasm_model(model_root: String) -> Result<ModelWorkspace, String> {
    service::open_hasm_model(&model_root)
}

/// [REQ-04-RULE-008][REQ-04-RULE-010] Reads a single PERSON row, including its external
/// link array, in time independent of package size.
#[tauri::command]
pub fn get_person_detail(model_root: String, entity_id: String) -> Result<Person, String> {
    service::get_person_detail(&model_root, &entity_id)
}

/// [REQ-04-RULE-008][REQ-04-RULE-010] Reads a single EXPERIENCE row, including its external
/// link array, in time independent of package size.
#[tauri::command]
pub fn get_experience_detail(
    model_root: String,
    entity_id: String,
) -> Result<Experience, String> {
    service::get_experience_detail(&model_root, &entity_id)
}

/// [REQ-04-RULE-008][REQ-04-RULE-010] Reads a single FACT row, including its external
/// link array, in time independent of package size.
#[tauri::command]
pub fn get_fact_detail(model_root: String, entity_id: String) -> Result<Fact, String> {
    service::get_fact_detail(&model_root, &entity_id)
}

/// [REQ-04-RULE-008][REQ-04-RULE-010] Reads a single LINK row, including its external
/// link array, in time independent of package size.
#[tauri::command]
pub fn get_link_detail(model_root: String, entity_id: String) -> Result<Link, String> {
    service::get_link_detail(&model_root, &entity_id)
}

/// [REQ-04-RULE-008][REQ-04-RULE-010][REQ-04-RULE-011][REQ-04-RULE-016][REQ-04-RULE-017]
/// Typed PERSON save: validates external links and upserts only the edited entity row.
#[tauri::command]
pub fn save_person_detail(model_root: String, detail: Person) -> Result<SaveResult, String> {
    service::save_person_detail(&model_root, &detail)
}

/// [REQ-04-RULE-008][REQ-04-RULE-010][REQ-04-RULE-011][REQ-04-RULE-016][REQ-04-RULE-017]
/// Typed EXPERIENCE save: validates external links and upserts only the edited entity row.
#[tauri::command]
pub fn save_experience_detail(
    model_root: String,
    detail: Experience,
) -> Result<SaveResult, String> {
    service::save_experience_detail(&model_root, &detail)
}

/// [REQ-04-RULE-008][REQ-04-RULE-010][REQ-04-RULE-011][REQ-04-RULE-016][REQ-04-RULE-017]
/// Typed FACT save: validates external links and upserts only the edited entity row.
#[tauri::command]
pub fn save_fact_detail(model_root: String, detail: Fact) -> Result<SaveResult, String> {
    service::save_fact_detail(&model_root, &detail)
}

/// [REQ-04-RULE-008][REQ-04-RULE-010][REQ-04-RULE-011][REQ-04-RULE-016][REQ-04-RULE-017]
/// Typed LINK save: validates external links and upserts only the edited entity row.
#[tauri::command]
pub fn save_link_detail(model_root: String, detail: Link) -> Result<SaveResult, String> {
    service::save_link_detail(&model_root, &detail)
}

/// [REQ-04-RULE-010] Whole-model database read; external link arrays round-trip unchanged.
#[tauri::command]
pub fn read_model_database(model_root: String) -> Result<ModelDatabase, String> {
    service::read_model_database(&model_root)
}

/// [REQ-04-RULE-010] Whole-model database save; external link arrays round-trip unchanged.
#[tauri::command]
pub fn save_model_database(model_root: String, model: ModelDatabase) -> Result<SaveResult, String> {
    service::save_model_database(&model_root, &model)
}