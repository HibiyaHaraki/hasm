//! # link.rs
//! Hibiya Haraki (August, 2026)
//! ## Purpose
//! Data structure for LINK records.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// [REQ-02-FUNC-206] [REQ-02-FUNC-406] [REQ-04-RULE-010] LINK domain record loaded
/// from main.db; carries relationship type, related endpoint IDs, the shared external
/// URL array, and the metadata-only `markdown`/`markdown_path` contract.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    #[serde(default)]
    pub link: Vec<String>,
    pub link_id: Uuid,
    pub link_name: String,
    pub link_type: String,
    pub link_description_path: String,
    pub related_ids: Vec<Uuid>,
    pub markdown: String,
    pub markdown_path: String,
}

impl Link {
    /// [REQ-02-FUNC-301] Canonical storage layout path `LINK/{UUID}/main.md`.
    pub fn default_markdown_path(entity_id: &Uuid) -> String {
        format!("LINK/{entity_id}/main.md")
    }

    /// [REQ-04-RULE-018] Human-readable title used instead of raw UUIDs in lists
    /// and entity references.
    pub fn title(&self) -> String {
        if self.link_name.trim().is_empty() {
            self.link_id.to_string()
        } else {
            self.link_name.clone()
        }
    }

    /// [REQ-04-RULE-018] Readable secondary label (relationship type) for list rows.
    pub fn subtitle(&self) -> String {
        if self.link_type.trim().is_empty() {
            self.link_id.to_string()
        } else {
            format!("{} relation", self.link_type)
        }
    }

    /// [REQ-04-FUNC-202] [REQ-04-FUNC-204] [REQ-04-RULE-011] Domain validation before
    /// persistence: external URLs, non-empty link type, and self-loop rejection when
    /// origin and target endpoints are identical (REQ-08-013).
    pub fn verify(&self) -> Result<(), String> {
        super::validate_external_links(&self.link)?;
        if self.link_type.trim().is_empty() {
            return Err("EntityValidationError::EmptyLinkType".to_string());
        }
        if self.related_ids.len() >= 2 && self.related_ids[0] == self.related_ids[1] {
            return Err("EntityValidationError::SelfLoopLink".to_string());
        }
        Ok(())
    }
}