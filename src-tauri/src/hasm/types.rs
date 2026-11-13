//! # types.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Shared DTO and response type definitions for HASM commands.

use crate::hasm::definitions::{Experience, Fact, Link, Person};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;

/// [REQ-01-DATA-001] Error payload contract for SEQ-01 app launch validation failures.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppValidationError {
    pub code: String,
    pub message: String,
}

/// [REQ-01-DATA-002] Version/CLI-path inspection response returned by `validate_app_version`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppVersionResponse {
    pub is_model_selected: bool,
    pub path: Option<String>,
    pub version: String,
}

/// [REQ-02-DATA-002] Workspace lock status payload returned by `check_workspace_lock`,
/// covering active-holder detection and stale-lock recovery reporting.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LockStatus {
    pub is_locked: bool,
    pub holder_pid: Option<u32>,
    pub is_stale_recovered: bool,
    pub is_read_only: bool,
}

/// [REQ-02-DATA-004] Progress stream event payload emitted on `model-load-progress`
/// and `model-verify-progress` channels during SEQ-02 load/verification.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub step: String,
    pub current: usize,
    pub total: usize,
    pub percentage: f32,
    pub message: String,
}

/// [REQ-02-FUNC-301] [REQ-02-RULE-006] Storage verification result listing missing
/// `main.md` directories (fatal) and unreferenced folder entities (warnings).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VerificationResult {
    pub missing_entities: Vec<String>,
    pub unreferenced_entities: Vec<String>,
}

/// [REQ-03-DATA-001] Layout filter request payload for `compute_visualizer_layout`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LayoutFilterRequest {
    pub time_scale_mode: String,
    pub z_scale_factor: f32,
}

/// [REQ-03-DATA-003] Node geometry entry of the final 3D render payload.
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

/// [REQ-03-DATA-003] Line geometry entry of the final 3D render payload; LINK entries
/// carry endpoint entity IDs for the renderers.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Line3dGeometry {
    pub id: String,
    pub line_type: String,
    pub from: [f32; 3],
    pub to: [f32; 3],
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub control_points: Option<Vec<[f32; 3]>>,
}

/// [REQ-03-DATA-003] Final 3D render payload resolved by `compute_visualizer_layout`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RenderPayload {
    pub nodes_3d: Vec<Node3dGeometry>,
    pub lines_3d: Vec<Line3dGeometry>,
    pub warnings: Vec<String>,
}

/// [REQ-07-FUNC-501] Test-only populated workspace fixture returned by
/// `create_test_workspace_fixture` so evaluation suites stay deterministic
/// without relying on local absolute paths.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestWorkspaceFixture {
    pub path: String,
    pub model: ModelDatabase,
}

/// [REQ-04-DATA-002] [REQ-04-FUNC-114] Entity detail response payload resolved by
/// `load_entity_detail` with metadata, raw Markdown body, and `loaded_mtime_ms`.
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

/// [REQ-04-DATA-005] Window-focus mtime check response reporting external
/// modification ([REQ-04-FUNC-503]) and deletion ([REQ-04-FUNC-504]) of `main.md`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckMtimePayload {
    pub is_modified: bool,
    pub is_deleted: bool,
    pub current_mtime_ms: u64,
}

/// [REQ-05-DATA-002] [REQ-05-FUNC-113] Launch response payload resolved after a
/// successful detached `hasm_markdown.exe` spawn.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LaunchExternalAppPayload {
    pub target_dir_path: String,
    pub executable_path: String,
}

/// [REQ-02-DATA-007] Human-readable per-entity list row (UUID, title, subtitle)
/// inside `ModelWorkspace` sections; the title falls back to the UUID when the
/// entity has no name.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntitySummary {
    pub id: String,
    pub title: String,
    pub subtitle: String,
}

/// [REQ-02-DATA-006] Workspace snapshot (sections and counts per entity type)
/// returned by `open_hasm_model` without reading Markdown bodies.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelWorkspace {
    pub model_root: String,
    pub sections: BTreeMap<String, Vec<EntitySummary>>,
    pub counts: BTreeMap<String, usize>,
}

/// [REQ-02-FUNC-207] [REQ-02-RULE-008] In-memory HASM model snapshot: all four
/// entity collections with metadata-only bodies (`markdownPath` populated,
/// `markdown` empty on metadata-only loads).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDatabase {
    pub people: Vec<Person>,
    pub experiences: Vec<Experience>,
    pub facts: Vec<Fact>,
    pub links: Vec<Link>,
}

/// [REQ-04-FUNC-213] Success message payload resolved by the typed metadata save
/// commands and whole-model save.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub message: String,
}

/// [REQ-08-002] Created workspace path returned by `create_hasm_workspace` after
/// atomic scaffolding. REQ-08 IDs use a non-standard format; see traceability report.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePathPayload {
    pub path: String,
}

/// [REQ-04-RULE-010] [REQ-08-010] [REQ-08-015] PERSON creation request: shared
/// external URL array, name/security-level validation inputs, and optional
/// birth-date Life bootstrap fields.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreatePersonRequest {
    #[serde(default)]
    pub link: Vec<String>,
    pub person_name: String,
    pub person_description: String,
    pub security_level: i32,
    pub create_life_experience: bool,
    #[serde(default)]
    pub birth_date: Option<String>,
}

/// [REQ-04-RULE-010] [REQ-08-011] [REQ-08-017] EXPERIENCE creation request with
/// shared external URL array and parent EXPERIENCE UUID selections.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateExperienceRequest {
    #[serde(default)]
    pub link: Vec<String>,
    pub experience_name: String,
    pub experience_description: String,
    pub security_level: i32,
    pub parent_experience_ids: Vec<Uuid>,
}

/// [REQ-04-RULE-010] [REQ-08-012] FACT creation request with shared external URL
/// array, optional chronological start/end times, and belonging EXPERIENCE UUIDs.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateFactRequest {
    #[serde(default)]
    pub link: Vec<String>,
    pub fact_name: String,
    pub fact_description: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub security_level: i32,
    pub experience_ids: Vec<Uuid>,
}

/// [REQ-04-RULE-010] [REQ-08-013] [REQ-08-019] LINK creation request with shared
/// external URL array and typed origin/target endpoint UUIDs (self-loop forbidden).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateLinkRequest {
    #[serde(default)]
    pub link: Vec<String>,
    pub link_type: String,
    pub link_description: String,
    pub origin_entity_type: String,
    pub origin_entity_id: Uuid,
    pub target_entity_type: String,
    pub target_entity_id: Uuid,
    pub security_level: i32,
}

/// [REQ-08-020] [REQ-08-021] Creation response identifying the new entity and its
/// scaffolded directory. REQ-08 IDs use a non-standard format; see traceability report.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EntityCreationPayload {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub target_dir_path: String,
    pub created_at_ms: u64,
}
