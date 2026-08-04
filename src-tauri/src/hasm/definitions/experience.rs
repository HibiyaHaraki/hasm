//! # experience.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for EXPERIENCE detail records.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExperienceDetail {
    pub experience_id: String,
    pub person_id: String,
    pub experience_name: String,
    pub experience_description_path: String,
    pub parent_experience_ids: Vec<String>,
    pub link_ids: Vec<String>,
    pub markdown: String,
    pub markdown_path: String,
}

impl ExperienceDetail {
    pub fn default_markdown_path(entity_id: &str) -> String {
        format!("EXPERIENCE/{entity_id}/main.md")
    }

    pub fn title(&self) -> String {
        if self.experience_name.trim().is_empty() {
            self.experience_id.clone()
        } else {
            self.experience_name.clone()
        }
    }

    pub fn subtitle(&self) -> String {
        if self.person_id.trim().is_empty() {
            self.experience_id.clone()
        } else {
            format!("Owner {}", self.person_id)
        }
    }
}