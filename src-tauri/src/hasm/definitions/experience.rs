//! # experience.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for EXPERIENCE records.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Experience {
    pub experience_id: Uuid,
    pub person_id: Uuid,
    pub experience_name: String,
    pub experience_description_path: String,
    pub parent_experience_ids: Vec<Uuid>,
    pub link_ids: Vec<Uuid>,
    pub markdown: String,
    pub markdown_path: String,
}

impl Experience {
    pub fn default_markdown_path(entity_id: &Uuid) -> String {
        format!("EXPERIENCE/{entity_id}/main.md")
    }

    pub fn title(&self) -> String {
        if self.experience_name.trim().is_empty() {
            self.experience_id.to_string()
        } else {
            self.experience_name.clone()
        }
    }

    pub fn subtitle(&self) -> String {
        format!("Owner {}", self.person_id)
    }
}