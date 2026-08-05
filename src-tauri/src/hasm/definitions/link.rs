//! # link.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for LINK records.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    pub link_id: Uuid,
    pub link_name: String,
    pub link_type: String,
    pub link_description_path: String,
    pub related_ids: Vec<Uuid>,
    pub markdown: String,
    pub markdown_path: String,
}

impl Link {
    pub fn default_markdown_path(entity_id: &Uuid) -> String {
        format!("LINK/{entity_id}/main.md")
    }

    pub fn title(&self) -> String {
        if self.link_name.trim().is_empty() {
            self.link_id.to_string()
        } else {
            self.link_name.clone()
        }
    }

    pub fn subtitle(&self) -> String {
        if self.link_type.trim().is_empty() {
            self.link_id.to_string()
        } else {
            format!("{} relation", self.link_type)
        }
    }
}