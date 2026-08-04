//! # link.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for LINK detail records.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkDetail {
    pub link_id: String,
    pub link_name: String,
    pub link_type: String,
    pub link_description_path: String,
    pub related_ids: Vec<String>,
    pub markdown: String,
    pub markdown_path: String,
}

impl LinkDetail {
    pub fn default_markdown_path(entity_id: &str) -> String {
        format!("LINK/{entity_id}/main.md")
    }

    pub fn title(&self) -> String {
        if self.link_name.trim().is_empty() {
            self.link_id.clone()
        } else {
            self.link_name.clone()
        }
    }

    pub fn subtitle(&self) -> String {
        if self.link_type.trim().is_empty() {
            self.link_id.clone()
        } else {
            format!("{} relation", self.link_type)
        }
    }
}