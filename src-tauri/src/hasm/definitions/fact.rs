//! # fact.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for FACT detail records.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactDetail {
    pub fact_id: String,
    pub fact_description_path: String,
    pub branch_experience_ids: Vec<String>,
    pub person_ids: Vec<String>,
    pub link_ids: Vec<String>,
    pub markdown: String,
    pub markdown_path: String,
}

impl FactDetail {
    pub fn default_markdown_path(entity_id: &str) -> String {
        format!("FACT/{entity_id}/main.md")
    }

    pub fn title(&self) -> String {
        self.fact_id.clone()
    }

    pub fn subtitle(&self) -> String {
        format!("{} people, {} links", self.person_ids.len(), self.link_ids.len())
    }
}