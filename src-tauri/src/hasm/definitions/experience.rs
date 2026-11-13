//! # experience.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for EXPERIENCE records.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// [REQ-02-FUNC-206] [REQ-02-FUNC-406] [REQ-04-RULE-010] EXPERIENCE domain record
/// loaded from main.db; carries owner PERSON, parent tree IDs, the shared external
/// URL array, and the metadata-only `markdown`/`markdown_path` contract.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Experience {
    #[serde(default)]
    pub link: Vec<String>,
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
    /// [REQ-02-FUNC-301] Canonical storage layout path `EXPERIENCE/{UUID}/main.md`.
    pub fn default_markdown_path(entity_id: &Uuid) -> String {
        format!("EXPERIENCE/{entity_id}/main.md")
    }

    /// [REQ-04-RULE-018] Human-readable title used instead of raw UUIDs in lists
    /// and entity references.
    pub fn title(&self) -> String {
        if self.experience_name.trim().is_empty() {
            self.experience_id.to_string()
        } else {
            self.experience_name.clone()
        }
    }

    /// [REQ-04-RULE-018] Readable secondary label (owner PERSON) for list rows.
    pub fn subtitle(&self) -> String {
        format!("Owner {}", self.person_id)
    }

    /// [REQ-04-FUNC-202] [REQ-04-FUNC-205] [REQ-04-RULE-011] Domain validation before
    /// persistence: external URLs, non-empty name, and 0..=5 security level
    /// (REQ-08-011).
    pub fn verify(&self, security_level: i32) -> Result<(), String> {
        super::validate_external_links(&self.link)?;
        if self.experience_name.trim().is_empty() {
            return Err("EntityValidationError::EmptyName".to_string());
        }
        if !(0..=5).contains(&security_level) {
            return Err("EntityValidationError::InvalidSecurityLevel".to_string());
        }
        Ok(())
    }
}