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
    pub fact_name: String,
    pub occurred_at: String,
    pub fact_description_path: String,
    pub experience_ids: Vec<Uuid>,
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
        if self.fact_name.trim().is_empty() {
            self.fact_id.to_string()
        } else {
            self.fact_name.clone()
        }
    }

    pub fn subtitle(&self) -> String {
        format!("{} people, {} links", self.person_ids.len(), self.link_ids.len())
    }

    pub fn verify(&self, start_time: Option<&str>, end_time: Option<&str>, security_level: i32) -> Result<(), String> {
        if self.fact_name.trim().is_empty() {
            return Err("EntityValidationError::EmptyName".to_string());
        }
        if !(0..=5).contains(&security_level) {
            return Err("EntityValidationError::InvalidSecurityLevel".to_string());
        }
        if let (Some(start), Some(end)) = (start_time, end_time) {
            if !start.trim().is_empty() && !end.trim().is_empty() && start > end {
                return Err("EntityValidationError::TimeInversion".to_string());
            }
        }
        Ok(())
    }
}