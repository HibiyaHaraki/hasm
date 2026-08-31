//! # types.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Shared DTO and response type definitions for HASM commands.

use crate::hasm::definitions::{Experience, Fact, Link, Person};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppValidationError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppVersionResponse {
    pub is_model_selected: bool,
    pub path: Option<String>,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LockStatus {
    pub is_locked: bool,
    pub holder_pid: Option<u32>,
    pub is_stale_recovered: bool,
    pub is_read_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub step: String,
    pub current: usize,
    pub total: usize,
    pub percentage: f32,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VerificationResult {
    pub missing_entities: Vec<String>,
    pub unreferenced_entities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LayoutFilterRequest {
    pub time_scale_mode: String,
    pub z_scale_factor: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Node3dGeometry {
    pub id: String,
    pub entity_type: String,
    pub label: String,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub person_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_direct_fact: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_experience_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_entity_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Line3dGeometry {
    pub id: String,
    pub line_type: String,
    pub from: [f32; 3],
    pub to: [f32; 3],
    #[serde(skip_serializing_if = "Option::is_none")]
    pub control_points: Option<Vec<[f32; 3]>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RenderPayload {
    pub nodes_3d: Vec<Node3dGeometry>,
    pub lines_3d: Vec<Line3dGeometry>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualizerDemoPayload {
    pub path: String,
    pub model: ModelDatabase,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityDetailPayload {
    pub entity_type: String,
    pub entity_id: String,
    pub name: String,
    pub markdown_body: String,
    pub loaded_mtime_ms: u64,
    pub detail: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckMtimePayload {
    pub is_modified: bool,
    pub is_deleted: bool,
    pub current_mtime_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchExternalAppPayload {
    pub target_dir_path: String,
    pub executable_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntitySummary {
    pub id: String,
    pub title: String,
    pub subtitle: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelWorkspace {
    pub model_root: String,
    pub sections: BTreeMap<String, Vec<EntitySummary>>,
    pub counts: BTreeMap<String, usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDatabase {
    pub people: Vec<Person>,
    pub experiences: Vec<Experience>,
    pub facts: Vec<Fact>,
    pub links: Vec<Link>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePathPayload {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreatePersonRequest {
    pub person_name: String,
    pub person_description: String,
    pub security_level: i32,
    pub create_life_experience: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateExperienceRequest {
    pub experience_name: String,
    pub experience_description: String,
    pub security_level: i32,
    pub parent_experience_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateFactRequest {
    pub fact_name: String,
    pub fact_description: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub security_level: i32,
    pub experience_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateLinkRequest {
    pub link_type: String,
    pub link_description: String,
    pub origin_entity_type: String,
    pub origin_entity_id: Uuid,
    pub target_entity_type: String,
    pub target_entity_id: Uuid,
    pub security_level: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EntityCreationPayload {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub target_dir_path: String,
    pub created_at_ms: u64,
}
