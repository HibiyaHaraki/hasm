//! # person.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for PERSON detail records.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonDetail {
    pub person_id: String,
    pub person_name: String,
    pub person_description_path: String,
    pub birthday: String,
    pub die: String,
    pub link_ids: Vec<String>,
    pub markdown: String,
    pub markdown_path: String,
}

impl PersonDetail {
    pub fn default_markdown_path(entity_id: &str) -> String {
        format!("PERSON/{entity_id}/main.md")
    }

    pub fn title(&self) -> String {
        if self.person_name.trim().is_empty() {
            self.person_id.clone()
        } else {
            self.person_name.clone()
        }
    }

    pub fn subtitle(&self) -> String {
        if self.birthday.trim().is_empty() && self.die.trim().is_empty() {
            self.person_id.clone()
        } else {
            format!("{} {}", self.birthday.trim(), self.die.trim()).trim().to_string()
        }
    }
}