//! # fact.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for FACT records.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fact {
    pub fact_id: Uuid,
    pub fact_description_path: String,
    pub branch_experience_ids: Vec<Uuid>,
    pub person_ids: Vec<Uuid>,
    pub link_ids: Vec<Uuid>,
    pub markdown: String,
    pub markdown_path: String,
}

impl Fact {
    pub fn default_markdown_path(entity_id: &Uuid) -> String {
        format!("FACT/{entity_id}/main.md")
    }

    pub fn title(&self) -> String {
        self.fact_id.to_string()
    }

    pub fn subtitle(&self) -> String {
        format!("{} people, {} links", self.person_ids.len(), self.link_ids.len())
    }
}