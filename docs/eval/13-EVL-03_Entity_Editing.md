# EVAL-04: Entity MetaData Editing & Saving Test Specification

This document defines the comprehensive test matrix, acceptance criteria, and traceability mapping for validating the Entity MetaData Editing & Saving workflow, single-entity domain validations, SQLite persistence transactions with dynamic/fixed timeouts, and route navigation guards (`SEQ-04` / `REQ-04`).

Tests are structured across three distinct test levels: **Desktop App Level (E2E / Integration)**, **React Level (Frontend Component & Form State)**, and **Tauri Level (Rust Domain Engine & Database Contract)**.

---

## 1. Desktop App Level Tests (E2E / System Integration)

These integration tests verify end-to-end user flows on the JIRA-style ticket page, including loading, saving metadata with auto-invalidation, canceling edits, and navigating back to the Visualizer.

| Test ID | Trace Requirement ID | Test Type | Test Scenario | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-04-E2E-001** | `REQ-04-RULE-001``REQ-04-FUNC-101``REQ-04-FUNC-112``REQ-04-FUNC-113` | Positive (Normal) | Load Entity Detail Ticket View | 1. Click a 3D node in `SEQ-03`.2. Observe route transition to `/entity-detail/:entity_type/:entity_id`. | 1. Page mounts and fetches metadata from Rust memory.2. `hasm_markdown.exe` verifies `main.md` and renders JIRA-style ticket view successfully. |
| **TC-04-E2E-002** | `REQ-04-RULE-003``REQ-04-RULE-005``REQ-04-FUNC-212``REQ-04-FUNC-213` | Positive (Persistence) | Save Valid Metadata In-Place | 1. Modify `security_level` and `description` on the detail ticket.2. Click "Save". | 1. MetaData persists to `hasm.db`.2. Rust sets `is_verified = false`.3. Success toast displays; user remains on current detail page. |
| **TC-04-E2E-003** | `REQ-04-FUNC-301``REQ-04-FUNC-302``REQ-04-FUNC-304` | Positive (Interaction) | Cancel Edits with Unsaved Changes | 1. Modify `name` field (`isDirty == true`).2. Click "Cancel".3. Select "Discard Changes" in modal. | 1. Confirmation modal renders.2. Selecting "Discard Changes" reverts form fields to original values. |
| **TC-04-E2E-004** | `REQ-04-FUNC-401``REQ-04-FUNC-402``REQ-04-FUNC-403` | Positive (Cascade) | Return to Visualizer After Saving (Trigger SEQ-02 Re-verification) | 1. Save metadata modifications (`is_verified = false`).2. Click "Back to Visualizer". | 1. Navigates to `/visualizer`.2. `SEQ-03` Guard 2 intercepts unverified state and redirects to `/loading-model` for re-verification. |

---

## 2. React Level Tests (Frontend Component & Form State)

These unit and component tests focus on `EntityDetailPage.tsx`, state variable isolation (`isEntityLoading`, `isMarkdownVerifying`, `isEntitySaving`), form dirty checking, modal dialogs, and error toast/popup rendering.

| Test ID | Trace Requirement ID | Test Type | Component / Target | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-04-REACT-001** | `REQ-04-FUNC-102``REQ-04-FUNC-113` | Positive (State) | `EntityDetailPage.tsx` | 1. Mount component with target params.2. Check state flags during and after load. | 1. Initializes with `isEntityLoading = true` & `isMarkdownVerifying = true`.2. Upon payload resolve, both flags set to `false`. |
| **TC-04-REACT-002** | `REQ-04-FUNC-105` | Negative (Routing) | `EntityDetailPage.tsx` | 1. Mock `load_entity_detail` to return `EntityNotFound`. | 1. React Router navigates immediately to `/error-model`. |
| **TC-04-REACT-003** | `REQ-04-FUNC-109``REQ-04-FUNC-111` | Negative (Routing) | `EntityDetailPage.tsx` | 1. Mock `load_entity_detail` to return `MarkdownTimeout` or `MarkdownVerificationFailed`. | 1. React Router navigates immediately to `/error-markdown`. |
| **TC-04-REACT-004** | `REQ-04-FUNC-201``REQ-04-FUNC-207` | Negative (Validation) | `EntityDetailPage.tsx` | 1. Submit edit payload with `start_time > end_time`.2. Mock IPC reject with `EntityVerificationFailed`. | 1. `isEntitySaving` resets to `false`.2. Error popup displays validation message; form state preserved for user correction. |
| **TC-04-REACT-005** | `REQ-04-FUNC-210``REQ-04-FUNC-211` | Negative (Error UI) | `EntityDetailPage.tsx` | 1. Click "Save".2. Mock IPC reject with `SaveTimeout` or `DatabaseSaveFailed`. | 1. `isEntitySaving` resets to `false`.2. Error popup/toast renders informing user that DB changes were rolled back. |
| **TC-04-REACT-006** | `REQ-04-FUNC-302``REQ-04-FUNC-303` | Positive (Modal) | `DiscardModal.tsx` | 1. Edit a field.2. Click "Cancel".3. Click "Keep Editing" in modal. | 1. Modal closes; modified form inputs remain intact. |

---

## 3. Tauri Level Tests (Rust Domain Engine & Database Contract)

These unit and integration tests verify IPC data contracts, Rust entity-level domain validations (`entity.verify()`), dynamic markdown timeouts, and SQLite transaction rollback guarantees (`hasm.db`) using `cargo test`.

| Test ID | Trace Requirement ID | Test Type | Rust Module / Function | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-04-RUST-001** | `REQ-04-DATA-001``REQ-04-DATA-002``REQ-04-DATA-003``REQ-04-DATA-004` | Positive (Contract) | `models::entity_editor` | 1. Instantiate `LoadEntityRequest`, `EntityDetailPayload`, `SaveEntityMetadataRequest`, and `EntityEditorError`.2. Serialize and deserialize JSON. | 1. All struct fields serialize and deserialize with 100% type safety. |
| **TC-04-RUST-002** | `REQ-04-RULE-006``REQ-04-FUNC-202``REQ-04-FUNC-203` | Negative (Domain Rule) | `Fact::verify()` / `Experience::verify()` | 1. Create `Fact` struct with `start_time = "2026-08-01"` and `end_time = "2026-05-01"`.2. Execute `verify()`. | 1. Returns `Err(EntityValidationError)` due to time inversion ($t_{\text{start}} > t_{\text{end}}$). |
| **TC-04-RUST-003** | `REQ-04-FUNC-204` | Negative (Domain Rule) | `Link::verify()` | 1. Create `Link` struct with `source_id == target_id`.2. Execute `verify()`. | 1. Returns `Err(EntityValidationError)` (self-loop forbidden). |
| **TC-04-RUST-004** | `REQ-04-FUNC-205``REQ-04-FUNC-206` | Negative (Domain Rule) | `save_entity_metadata` | 1. Pass request with `name = "   "`.2. Invoke `save_entity_metadata`. | 1. Rejects prior to DB write with `EntityVerificationFailed`. |
| **TC-04-RUST-005** | `REQ-04-RULE-002``REQ-04-FUNC-106``REQ-04-FUNC-108` | Performance (Timeout) | `load_entity_detail` | 1. Mock `main.md` file size = 500 KB (Calculated timeout = 8,000ms).2. Mock `hasm_markdown.exe` process hang exceeding 8,000ms. | 1. Kills child process at exactly 8,000ms.2. Returns `Err(MarkdownTimeout { timeout_ms: 8000 })`. |
| **TC-04-RUST-006** | `REQ-04-RULE-003``REQ-04-RULE-004``REQ-04-FUNC-208``REQ-04-FUNC-209` | Negative (Timeout Rollback) | `save_entity_metadata` | 1. Lock SQLite database to force transaction delay.2. Execute `save_entity_metadata`.3. Advance timer past 5,000ms. | 1. Executes SQLite `ROLLBACK`.2. Rejects with `SaveTimeout`.3. `hasm.db` remains unchanged. |
| **TC-04-RUST-007** | `REQ-04-RULE-005``REQ-04-FUNC-212` | Positive (State Invalidation) | `save_entity_metadata` | 1. Execute valid `save_entity_metadata`.2. Check in-memory `HasmModel` flag. | 1. SQLite transaction `COMMIT` succeeds.2. In-memory `HasmModel.is_verified` is updated to `false`. |