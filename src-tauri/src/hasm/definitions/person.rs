//! # person.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for PERSON records.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// [REQ-02-FUNC-206] [REQ-02-FUNC-406] [REQ-04-RULE-010] PERSON domain record loaded
/// from main.db; carries the shared external URL array and metadata-only
/// `markdown`/`markdown_path` contract.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    #[serde(default)]
    pub link: Vec<String>,
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
    /// [REQ-02-FUNC-301] Canonical storage layout path `PERSON/{UUID}/main.md`.
    pub fn default_markdown_path(entity_id: &Uuid) -> String {
        format!("PERSON/{entity_id}/main.md")
    }

    /// [REQ-04-RULE-018] Human-readable title used instead of raw UUIDs in lists
    /// and entity references.
    pub fn title(&self) -> String {
        if self.person_name.trim().is_empty() {
            self.person_id.to_string()
        } else {
            self.person_name.clone()
        }
    }

    /// [REQ-04-RULE-018] Readable secondary label (birth/death dates) for list rows.
    pub fn subtitle(&self) -> String {
        if self.birthday.trim().is_empty() && self.die.trim().is_empty() {
            self.person_id.to_string()
        } else {
            format!("{} {}", self.birthday.trim(), self.die.trim()).trim().to_string()
        }
    }

    /// [REQ-04-FUNC-202] [REQ-04-FUNC-205] [REQ-04-RULE-011] Domain validation before
    /// persistence: external URLs, non-empty name, and 0..=5 security level
    /// (REQ-08-010).
    pub fn verify(&self, security_level: i32) -> Result<(), String> {
        super::validate_external_links(&self.link)?;
        if self.person_name.trim().is_empty() {
            return Err("EntityValidationError::EmptyName".to_string());
        }
        if !(0..=5).contains(&security_level) {
            return Err("EntityValidationError::InvalidSecurityLevel".to_string());
        }
        Ok(())
    }
}