//! # person.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for PERSON records.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    pub person_id: Uuid,
    pub person_name: String,
    pub person_description_path: String,
    pub birthday: String,
    pub die: String,
    pub link_ids: Vec<Uuid>,
    pub markdown: String,
    pub markdown_path: String,
}

impl Person {
    pub fn default_markdown_path(entity_id: &Uuid) -> String {
        format!("PERSON/{entity_id}/main.md")
    }

    pub fn title(&self) -> String {
        if self.person_name.trim().is_empty() {
            self.person_id.to_string()
        } else {
            self.person_name.clone()
        }
    }

    pub fn subtitle(&self) -> String {
        if self.birthday.trim().is_empty() && self.die.trim().is_empty() {
            self.person_id.to_string()
        } else {
            format!("{} {}", self.birthday.trim(), self.die.trim()).trim().to_string()
        }
    }
}