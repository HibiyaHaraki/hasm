//! # types.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Shared DTO and response type definitions for HASM commands.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

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
pub struct SaveResult {
    pub message: String,
}
