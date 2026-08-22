//! # types.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Shared DTO and response type definitions for HASM commands.

use crate::hasm::definitions::{Experience, Fact, Link, Person};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

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
