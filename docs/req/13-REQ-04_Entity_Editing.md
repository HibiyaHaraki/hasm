# REQ-04: Entity MetaData Editing & Saving (Formal Specification)

This specification defines the functional, data, time constraint, and validation requirements for loading, modifying, persisting, and navigating entity metadata (PERSON, EXPERIENCE, FACT, LINK) under `SEQ-04`.

---

## 1. System Invariants & Core Rules

* **[REQ-04-RULE-001] Read-Only Markdown Scope:** The Entity Detail Page MUST ONLY modify metadata stored in SQLite (`hasm.db`). Direct file modifications to physical `main.md` files MUST NOT occur within this view.
* **[REQ-04-RULE-002] Dynamic Verification Timeout:** Markdown verification via `hasm_markdown.exe` MUST enforce a file-size-based dynamic timeout with a minimum of **3,000ms** and an upper safety cap of **15,000ms**.
* **[REQ-04-RULE-003] Atomic Database Transactions:** All metadata updates to SQLite (`hasm.db`) MUST be executed within an explicit database transaction (`BEGIN` / `COMMIT`) with a strict **5,000ms** hard timeout.
* **[REQ-04-RULE-004] Transaction Rollback Guarantee:** If a database transaction times out or encounters a SQL error, the system MUST execute a `ROLLBACK` and preserve the user's unpersisted input values in the React form state.
* **[REQ-04-RULE-005] Verification Invalidation on Save:** Upon successful metadata persistence to `hasm.db`, Rust MUST set the in-memory `HasmModel` flag `is_verified` to `false`.
* **[REQ-04-RULE-006] Domain Validation Pre-condition:** SQLite persistence MUST NOT execute if Rust domain validation (`entity.verify()`) fails.

---

## 2. Technical Specifications & Data Contracts

### 2.1 IPC Payload Data Contracts

```rust
// [REQ-04-DATA-001] Load Entity Request Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadEntityRequest {
    pub entity_type: String, // "PERSON" | "EXPERIENCE" | "FACT" | "LINK"
    pub entity_id: Uuid,
}

// [REQ-04-DATA-002] Entity Detail Response Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityDetailPayload {
    pub metadata: EntityMeta,
    pub markdown_body: String,
    pub timeout_used_ms: u64,
}

// [REQ-04-DATA-003] Save Metadata Request Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveEntityMetadataRequest {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub security_level: i32,
    pub start_time: Option<String>, // ISO8601 String
    pub end_time: Option<String>,   // ISO8601 String
}

// [REQ-04-DATA-004] Editor Error Payload Enum
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntityEditorError {
    EntityNotFound { id: String },
    MarkdownTimeout { timeout_ms: u64 },
    MarkdownVerificationFailed { exit_code: i32, stderr: String },
    EntityVerificationFailed { code: String, message: String },
    SaveTimeout { timeout_ms: u64 },
    DatabaseSaveFailed { message: String },
}

```

---

## 3. Detailed Functional Requirements

### Chapter 1: Loading Entity (`load_entity_detail`)

* **[REQ-04-FUNC-101] Component Mounting:** React MUST mount `EntityDetailPage` when navigating to `/entity-detail/:entity_type/:entity_id`.
* **[REQ-04-FUNC-102] Loading State Initialization:** React MUST initialize component state with `isEntityLoading = true` and `isMarkdownVerifying = true`.
* **[REQ-04-FUNC-103] Metadata Memory Extraction:** Rust MUST extract target `EntityMeta` from the active in-memory `HasmModel` using `entity_id`.
* **[REQ-04-FUNC-104] Missing Entity Error:** If `entity_id` does not exist in memory, Rust MUST reject the IPC request with `EntityNotFound`.
* **[REQ-04-FUNC-105] Missing Entity Routing:** Upon receiving `EntityNotFound`, React Router MUST navigate to `/error-model`.
* **[REQ-04-FUNC-106] Dynamic Timeout Calculation:** Rust MUST calculate the dynamic verification timeout using: $\min(3000 + \lfloor \frac{\text{SizeKB}}{100} \rfloor \times 1000, 15000)\text{ ms}$.
* **[REQ-04-FUNC-107] Verification Submodule Invocation:** Rust MUST spawn `hasm_markdown.exe verify --path {target_md_path}` monitored by the calculated dynamic timeout.
* **[REQ-04-FUNC-108] Markdown Timeout Termination:** If `hasm_markdown.exe` exceeds the dynamic timeout, Rust MUST terminate the child process and return `MarkdownTimeout`.
* **[REQ-04-FUNC-109] Markdown Timeout Routing:** Upon receiving `MarkdownTimeout`, React Router MUST navigate to `/error-markdown`.
* **[REQ-04-FUNC-110] Verification Process Failure:** If `hasm_markdown.exe` exits with a non-zero exit code, Rust MUST reject the IPC request with `MarkdownVerificationFailed`.
* **[REQ-04-FUNC-111] Verification Failure Routing:** Upon receiving `MarkdownVerificationFailed`, React Router MUST navigate to `/error-markdown`.
* **[REQ-04-FUNC-112] Markdown Payload Resolution:** Upon process exit code `0`, Rust MUST read raw Markdown body text and resolve `EntityDetailPayload`.
* **[REQ-04-FUNC-113] Ticket View Rendering:** React MUST store `EntityDetailPayload` in local state, set `isEntityLoading = false`, `isMarkdownVerifying = false`, and render the JIRA-style Ticket View.

### Chapter 2: Save Edited Entity Information (`save_entity_metadata`)

* **[REQ-04-FUNC-201] Save State Initialization:** Upon clicking the "Save" button, React MUST set `isEntitySaving = true`.
* **[REQ-04-FUNC-202] Domain Verification Execution:** Prior to database persistence, Rust MUST instantiate the entity domain model and invoke `entity.verify()`.
* **[REQ-04-FUNC-203] Time Inversion Rule:** `Fact` and `Experience` validation MUST fail if both `start_time` and `end_time` exist and `start_time > end_time`.
* **[REQ-04-FUNC-204] Link Loop Rule:** `Link` validation MUST fail if `source_id == target_id`.
* **[REQ-04-FUNC-205] Mandatory Field Rule:** Entity validation MUST fail if `name` is empty or consists solely of whitespace.
* **[REQ-04-FUNC-206] Domain Verification Error Reject:** If `entity.verify()` fails, Rust MUST reject the IPC request with `EntityVerificationFailed`.
* **[REQ-04-FUNC-207] Domain Verification Error Display:** Upon receiving `EntityVerificationFailed`, React MUST set `isEntitySaving = false` and display an error modal detailing the validation message.
* **[REQ-04-FUNC-208] Database Transaction Timeout:** SQLite transaction execution MUST enforce a strict **5,000ms** hard timeout.
* **[REQ-04-FUNC-209] Transaction Timeout Rollback:** If SQLite update exceeds 5,000ms, Rust MUST execute `ROLLBACK` and reject IPC with `SaveTimeout`.
* **[REQ-04-FUNC-210] Transaction Timeout Display:** Upon receiving `SaveTimeout`, React MUST set `isEntitySaving = false` and display an error popup ("Save operation timed out").
* **[REQ-04-FUNC-211] Database Error Rollback:** If SQLite update fails due to lock or SQL error, Rust MUST execute `ROLLBACK` and reject IPC with `DatabaseSaveFailed`.
* **[REQ-04-FUNC-212] Model Verification Invalidation:** Upon successful transaction `COMMIT`, Rust MUST update the in-memory `HasmModel` flag `is_verified = false`.
* **[REQ-04-FUNC-213] Save Success State Update:** Upon resolution of `save_entity_metadata`, React MUST update local form state, set `isEntitySaving = false`, `isDirty = false`, display a success toast, and remain on the current page.

### Chapter 3: Cancel Editing Entity Information

* **[REQ-04-FUNC-301] Unsaved Changes Detection:** Clicking "Cancel" MUST check if the form state is dirty (`isDirty == true`).
* **[REQ-04-FUNC-302] Confirmation Modal Display:** If `isDirty == true`, React MUST display a confirmation modal ("Discard unsaved changes?").
* **[REQ-04-FUNC-303] Keep Editing Option:** Selecting "Keep Editing" MUST dismiss the modal and preserve modified form inputs.
* **[REQ-04-FUNC-304] Discard Changes Option:** Selecting "Discard Changes" MUST revert form inputs to the original saved payload, set `isDirty = false`, and return to read mode.

### Chapter 4: Back to Visualizer Navigation

* **[REQ-04-FUNC-401] Navigation Exit Guard:** Clicking "Back to Visualizer" MUST prompt for confirmation if `isDirty == true`.
* **[REQ-04-FUNC-402] Visualizer Route Transition:** React Router MUST navigate to `/visualizer`.
* **[REQ-04-FUNC-403] Re-verification Cascade Trigger:** If metadata was saved (`is_verified == false`), `SEQ-03` Guard 2 MUST intercept the `/visualizer` load and redirect to `/loading-model` for full workspace re-verification.