//! # fact.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for FACT records.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// [REQ-02-FUNC-206] [REQ-02-FUNC-406] [REQ-04-RULE-010] FACT domain record loaded
/// from main.db; carries occurrence timestamp, junction relationships, the shared
/// external URL array, and the metadata-only `markdown`/`markdown_path` contract.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fact {
    #[serde(default)]
    pub link: Vec<String>,
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
    /// [REQ-02-FUNC-301] Canonical storage layout path `FACT/{UUID}/main.md`.
    pub fn default_markdown_path(entity_id: &Uuid) -> String {
        format!("FACT/{entity_id}/main.md")
    }

    /// [REQ-04-RULE-018] Human-readable title used instead of raw UUIDs in lists
    /// and entity references.
    pub fn title(&self) -> String {
        if self.fact_name.trim().is_empty() {
            self.fact_id.to_string()
        } else {
            self.fact_name.clone()
        }
    }

    /// [REQ-04-RULE-018] Readable secondary label (people/link counts) for list rows.
    pub fn subtitle(&self) -> String {
        format!("{} people, {} links", self.person_ids.len(), self.link_ids.len())
    }

    /// [REQ-04-FUNC-202] [REQ-04-FUNC-203] [REQ-04-FUNC-205] [REQ-04-RULE-011] Domain
    /// validation before persistence: external URLs, non-empty name, 0..=5 security
    /// level, and chronological start <= end when both timestamps exist (REQ-08-012).
    pub fn verify(&self, start_time: Option<&str>, end_time: Option<&str>, security_level: i32) -> Result<(), String> {
        super::validate_external_links(&self.link)?;
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