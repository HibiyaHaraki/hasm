# REQ-04: Entity MetaData Editing & Saving (Formal Specification)

This specification defines the functional, data, time constraint, and validation requirements for loading, modifying, persisting, checking external modification/deletion timestamps, refreshing Markdown, and navigating entity metadata (PERSON, EXPERIENCE, FACT, LINK) under `SEQ-04`.

---

## 1. System Invariants & Core Rules

* **[REQ-04-RULE-001] Read-Only Markdown Scope:** The Entity Detail Page MUST ONLY modify metadata stored in SQLite (`hasm.db`). Direct file modifications to physical `main.md` files MUST NOT occur within this view during metadata save.
* **[REQ-04-RULE-002] Dynamic Verification Timeout:** Markdown verification via `hasm_markdown.exe` MUST enforce a file-size-based dynamic timeout with a minimum of **3,000ms** and an upper safety cap of **15,000ms**.
* **[REQ-04-RULE-003] Atomic Database Transactions:** All metadata updates to SQLite (`hasm.db`) MUST be executed within an explicit database transaction (`BEGIN` / `COMMIT`) with a strict **5,000ms** hard timeout.
* **[REQ-04-RULE-004] Transaction Rollback Guarantee:** If a database transaction times out or encounters a SQL error, the system MUST execute a `ROLLBACK` and preserve the user's unpersisted input values in the React form state.
* **[REQ-04-RULE-005] Verification Invalidation on Save:** Upon successful metadata persistence to `hasm.db`, Rust MUST set the in-memory `HasmModel` flag `is_verified` to `false`.
* **[REQ-04-RULE-006] Domain Validation Pre-condition:** SQLite persistence MUST NOT execute if Rust domain validation (`entity.verify()`) fails.
* **[REQ-04-RULE-007] Non-Blocking Window Focus mtime Check:** Window focus events MUST execute a lightweight `mtime` and existence check (< 10ms execution) without locking the UI, triggering database calls, or invoking `hasm_markdown.exe`.

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
    pub loaded_mtime_ms: u64, // UNIX Epoch ms
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

// [REQ-04-DATA-004] Check mtime Request Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckMtimeRequest {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub last_loaded_mtime_ms: u64,
}

// [REQ-04-DATA-005] Check mtime Response Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckMtimePayload {
    pub is_modified: bool,
    pub is_deleted: bool, // True if target main.md/dir is missing on disk
    pub current_mtime_ms: u64,
}

// [REQ-04-DATA-006] Reload Markdown Request Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReloadMarkdownRequest {
    pub entity_type: String,
    pub entity_id: Uuid,
}

// [REQ-04-DATA-007] Reload Markdown Response Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReloadMarkdownPayload {
    pub markdown_body: String,
    pub new_mtime_ms: u64,
    pub timeout_used_ms: u64,
}

// [REQ-04-DATA-008] Editor Error Payload Enum
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntityEditorError {
    EntityNotFound { id: String },
    MarkdownFileNotFound { path: String }, // Returned when main.md is missing on disk
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
* **[REQ-04-FUNC-102] Loading State Initialization:** React MUST initialize component state with `isEntityLoading = true`, `isMarkdownVerifying = true`, `hasExternalChanges = false`, and `isMarkdownDeleted = false`.
* **[REQ-04-FUNC-103] Metadata Memory Extraction:** Rust MUST extract target `EntityMeta` from the active in-memory `HasmModel` using `entity_id`.
* **[REQ-04-FUNC-104] Missing Entity Error:** If `entity_id` does not exist in memory, Rust MUST reject the IPC request with `EntityNotFound`.
* **[REQ-04-FUNC-105] Missing Entity Routing:** Upon receiving `EntityNotFound`, React Router MUST navigate to `/error-model`.
* **[REQ-04-FUNC-106] Missing File Error on Load:** If the physical `main.md` file or directory is missing during load, Rust MUST reject the request with `MarkdownFileNotFound`.
* **[REQ-04-FUNC-107] Missing File Routing:** Upon receiving `MarkdownFileNotFound`, React Router MUST navigate to `/error-markdown`.
* **[REQ-04-FUNC-108] Dynamic Timeout Calculation:** Rust MUST calculate the dynamic verification timeout using: $\min(3000 + \lfloor \frac{\text{SizeKB}}{100} \rfloor \times 1000, 15000)\text{ ms}$.
* **[REQ-04-FUNC-109] Verification Submodule Invocation:** Rust MUST spawn `hasm_markdown.exe verify --path {target_dir_path}` monitored by the calculated dynamic timeout.
* **[REQ-04-FUNC-110] Markdown Timeout Termination:** If `hasm_markdown.exe` exceeds the dynamic timeout, Rust MUST terminate the child process and return `MarkdownTimeout`.
* **[REQ-04-FUNC-111] Markdown Timeout Routing:** Upon receiving `MarkdownTimeout`, React Router MUST navigate to `/error-markdown`.
* **[REQ-04-FUNC-112] Verification Process Failure:** If `hasm_markdown.exe` exits with a non-zero exit code, Rust MUST reject the IPC request with `MarkdownVerificationFailed`.
* **[REQ-04-FUNC-113] Verification Failure Routing:** Upon receiving `MarkdownVerificationFailed`, React Router MUST navigate to `/error-markdown`.
* **[REQ-04-FUNC-114] Markdown Payload Resolution:** Upon process exit code `0`, Rust MUST read raw Markdown body text, fetch file `loaded_mtime_ms`, and resolve `EntityDetailPayload`.
* **[REQ-04-FUNC-115] Ticket View Rendering:** React MUST store `EntityDetailPayload` and `loaded_mtime_ms` in local state, set `isEntityLoading = false`, `isMarkdownVerifying = false`, and render the JIRA-style Ticket View.

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

### Chapter 5: Window Focus mtime Check & Refresh Entity Markdown (`check_entity_mtime` / `reload_entity_markdown`)

* **[REQ-04-FUNC-501] Window Focus Listener:** React MUST attach a window `focus` event listener to trigger `check_entity_mtime` with `last_loaded_mtime_ms`.
* **[REQ-04-FUNC-502] Fast File Metadata Query:** Rust `check_entity_mtime` MUST query `main.md` file system metadata without parsing file content or opening SQLite connections.
* **[REQ-04-FUNC-503] External Modification Detection:** If disk `current_mtime_ms` is greater than `last_loaded_mtime_ms`, Rust MUST resolve `CheckMtimePayload` with `is_modified = true` and `is_deleted = false`.
* **[REQ-04-FUNC-504] External Deletion Detection:** If `main.md` or the entity directory is missing on disk during window focus check, Rust MUST resolve `CheckMtimePayload` with `is_deleted = true` and `is_modified = false`.
* **[REQ-04-FUNC-505] Modification Action Highlighting:** Upon receiving `is_modified = true`, React MUST set `hasExternalChanges = true`, `isMarkdownDeleted = false`, and render the "Refresh Markdown" button with an alert style (Amber theme with a pulsing badge).
* **[REQ-04-FUNC-506] Deletion Action Highlighting:** Upon receiving `is_deleted = true`, React MUST set `isMarkdownDeleted = true`, `hasExternalChanges = true`, display a warning toast ("Markdown file deleted on disk"), and render the "Refresh Markdown" button with a danger style (Red theme).
* **[REQ-04-FUNC-507] Manual Refresh Invocation:** Clicking the highlighted "Refresh Markdown" button MUST invoke `reload_entity_markdown` and set `isMarkdownVerifying = true`.
* **[REQ-04-FUNC-508] Reload File Deletion Handling:** If `reload_entity_markdown` is invoked when `main.md` is deleted, Rust MUST reject IPC with `MarkdownFileNotFound`, and React Router MUST navigate to `/error-markdown`.
* **[REQ-04-FUNC-509] Dynamic Timeout Reload Verification:** `reload_entity_markdown` MUST calculate dynamic timeouts based on `main.md` file size and re-verify syntax via `hasm_markdown.exe`.
* **[REQ-04-FUNC-510] Refresh Verification Error:** If `hasm_markdown.exe` returns a non-zero exit code during refresh, Rust MUST reject IPC with `MarkdownVerificationFailed`, and React MUST display an error toast without updating the UI body.
* **[REQ-04-FUNC-511] State Reset Upon Successful Refresh:** Upon successful resolution of `reload_entity_markdown`, React MUST update `markdown_body`, set `last_loaded_mtime_ms = new_mtime_ms`, set `hasExternalChanges = false`, set `isMarkdownDeleted = false`, reset the "Refresh Markdown" button to normal style, and display a success toast.