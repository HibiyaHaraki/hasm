# REQ-02: Model Loading & Storage Verification (Formal Specification)

This specification defines the functional, data, time constraint, and error handling requirements for checking/releasing workspace locks, loading metadata from SQLite (`hasm.db`) into the `HasmModel` Rust domain class, progress streaming, Watchdog Timeout protection, and storage structure verification under `SEQ-02`.

---

## 1. System Invariants & Core Rules

* **[REQ-02-RULE-001] Single Writer Workspace Lock:** A HASM workspace directory MUST NOT be opened in Read-Write mode by more than one process simultaneously.
* **[REQ-02-RULE-002] Stale Lock Auto-Recovery:** If a workspace `.hasm/lock` file exists but its recorded `holder_pid` is dead in the OS process table, Rust MUST automatically clean up the stale lock and acquire a fresh Read-Write lock without prompting the user.
* **[REQ-02-RULE-003] Graceful Lock Release on Close:** When the user closes the application window (via the top-right "X" button, OS menu, or system shortcut), the application MUST intercept `tauri://close-requested` and execute `release_workspace_lock` to delete `.hasm/lock` within 1,000ms.
* **[REQ-02-RULE-004] Atomic Memory Invalidation:** Loading a new model MUST completely purge and replace any existing in-memory `HasmModel` instance.
* **[REQ-02-RULE-005] Watchdog Progress Guarantee:** Long-running database load and storage verification operations MUST emit progress events at least once every **10,000ms**. Failure to emit events within this threshold MUST trigger a Watchdog Timeout and route to `/error-model`.
* **[REQ-02-RULE-006] Fatal Missing Directory Guard:** If `verify_storage()` detects missing physical directories (`main.md`) for loaded database entities, `has_fatal_error()` MUST return `true`, blocking navigation to `/visualizer` and redirecting to `/error-model`.
* **[REQ-02-RULE-007] Linear Scale Invariant:** Every phase of the model load and storage verification path MUST be at worst linear in the number of entities. No phase may perform a per-entity scan of a collection whose size grows with the package.
* **[REQ-02-RULE-008] Metadata-Only Load Invariant:** `load_hasm_model_db` MUST NOT read entity Markdown bodies from disk. The returned model carries `markdownPath` for every entity and an empty `markdown`; bodies are read only when a single entity ticket is opened under SEQ-04.
* **[REQ-02-RULE-009] Idempotent Bootstrap Invariant:** Re-opening an unchanged package MUST NOT write any row to `main.db`. Folder-to-database bootstrap MUST insert only entity folders that have no corresponding row.

---

## 2. Technical Specifications & Data Contracts

### 2.1 IPC Payload Data Contracts

```rust
// [REQ-02-DATA-001] Check Workspace Lock Request Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckWorkspaceLockRequest {
    pub path: String,
}

// [REQ-02-DATA-002] Workspace Lock Status Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockStatus {
    pub is_locked: bool,
    pub holder_pid: Option<u32>,
    pub is_stale_recovered: bool, // True if a stale lock from a crashed PID was cleaned
    pub is_read_only: bool,
}

// [REQ-02-DATA-003] Release Workspace Lock Request Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseWorkspaceLockRequest {
    pub path: String,
}

// [REQ-02-DATA-004] Progress Stream Event Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressPayload {
    pub step: String, // "DB_LOAD" | "STORAGE_VERIFY"
    pub current: usize,
    pub total: usize,
    pub percentage: f32,
    pub message: String,
}

// [REQ-02-DATA-005] Model Load Error Payload Enum
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ModelLoadingError {
    LockCheckTimeout { timeout_ms: u64 },
    DbCorrupted { message: String },
    LoadStalledTimeout { threshold_ms: u64 },
    MissingStorageFolder { missing: Vec<(EntityType, Uuid)> },
}

```

---

## 3. Detailed Functional Requirements

### Chapter 1: Workspace Lock Management (`check_workspace_lock` / `release_workspace_lock`)

* **[REQ-02-FUNC-101] Lock Check Invocation:** Upon mounting `LoadingModelPage.tsx`, React MUST invoke `check_workspace_lock` passing `modelPath`.
* **[REQ-02-FUNC-102] Fixed Lock Check Timeout:** `check_workspace_lock` execution MUST enforce a strict **3,000ms** hard timeout. If exceeded, Rust MUST reject with `LockCheckTimeout` and React Router MUST navigate to `/error-model`.
* **[REQ-02-FUNC-103] Active Process Lock Detection:** If `.hasm/lock` exists and the recorded `holder_pid` matches an active OS process, Rust MUST return `LockStatus { is_locked: true, is_read_only: true }`.
* **[REQ-02-FUNC-104] Read-Only State Display:** Upon receiving `is_read_only == true`, React MUST update state to Read-Only mode and display a warning banner ("Opened in Read-Only Mode").
* **[REQ-02-FUNC-105] Stale Lock Recovery Check:** If `.hasm/lock` exists but `holder_pid` is not found in the OS process table, Rust MUST delete the file, create a new `.hasm/lock` with the current PID, and return `is_stale_recovered = true`.
* **[REQ-02-FUNC-106] Stale Recovery Notification:** Upon receiving `is_stale_recovered == true`, React MUST set `isReadOnly = false` and display an info toast ("Recovered stale lock file from previous process crash").
* **[REQ-02-FUNC-107] Absent Lock File Creation:** If `.hasm/lock` does not exist, Rust MUST create `.hasm/lock` containing the current PID and return `is_locked = false, is_read_only = false`.
* **[REQ-02-FUNC-108] Window Close Listener Attachment:** React MUST attach a listener for Tauri's `tauri://close-requested` event.
* **[REQ-02-FUNC-109] Window Close Lock Release Execution:** When `tauri://close-requested` fires, if `isReadOnly == false`, the application MUST invoke `release_workspace_lock` to delete `.hasm/lock` within **1,000ms** before terminating the process.

### Chapter 2: Database Metadata Loading (`load_hasm_model_db`)

* **[REQ-02-FUNC-201] Progress Stream Listener Setup:** React MUST subscribe to `model-load-progress` and `model-verify-progress` events prior to triggering model load commands.
* **[REQ-02-FUNC-202] Database Connection Verification:** Rust MUST attempt to open `path/hasm.db`. If corrupted or schema validation fails, Rust MUST reject with `DbCorrupted` and React Router MUST navigate to `/error-model`.
* **[REQ-02-FUNC-203] Load Watchdog Timer Initialization:** React MUST start a 10,000ms Watchdog Timer upon invoking `load_hasm_model_db`.
* **[REQ-02-FUNC-204] Progress Event Reset:** Receiving a `model-load-progress` event MUST reset the React Watchdog Timer to 0ms and update progress UI state (`current`, `total`, `modelProgress`).
* **[REQ-02-FUNC-205] Watchdog Timeout Trigger:** If 10,000ms elapses without receiving a progress event, React MUST abort loading, set `modelError = "DB loading stalled"`, and navigate to `/error-model`.
* **[REQ-02-FUNC-206] Granular Entity Ingestion:** Rust MUST load `PERSON`, `EXPERIENCE`, `FACT`, and `LINK` records sequentially, populating junction relationships and emitting progress events for each step.
* **[REQ-02-FUNC-207] In-Memory Model Resolution:** Upon successful database load, Rust MUST resolve `Ok(HasmModel)` and store it in Rust backend memory.

### Chapter 3: Storage Verification (`verify_hasm_storage`)

* **[REQ-02-FUNC-301] Encapsulated Storage Check:** Rust MUST invoke `model.verify_storage()` to inspect physical directory structure (`{workspace}/{ENTITY_TYPE}/{UUID}/main.md`).
* **[REQ-02-FUNC-302] Storage Watchdog Protection:** `verify_hasm_storage` MUST be monitored by a 10,000ms Watchdog Timer on the React frontend.
* **[REQ-02-FUNC-303] Chunked Progress Streaming:** Rust MUST emit `model-verify-progress` events during folder scanning.
* **[REQ-02-FUNC-304] Fatal Missing Directory Handling:** If `VerificationResult.has_fatal_error()` returns `true` (missing required `main.md` directories), Rust MUST reject IPC with `MissingStorageFolder` and React Router MUST navigate to `/error-model`.
* **[REQ-02-FUNC-305] Verification State Flag Setting:** Upon successful verification completion, Rust MUST set the in-memory `HasmModel` flag `is_verified = true`.
* **[REQ-02-FUNC-306] Visualizer Navigation:** Upon successful resolution of storage verification, React Router MUST navigate to `/visualizer` passing loaded model context.

### Chapter 4: Large Package Performance (`load_hasm_model_db` / `verify_hasm_storage`)

The reference package for all requirements in this chapter holds **60,000 entities**, approximately 15,000 of each entity type.

* **[REQ-02-FUNC-401] Load Time Budget:** Opening a 60,000-entity package MUST complete lock acquisition, metadata load, and storage verification within **20,000 ms** total on a release build backed by local SSD storage.
* **[REQ-02-FUNC-402] Transactional Folder Bootstrap:** Folder-to-database bootstrap MUST execute inside a single transaction using cached prepared statements. Per-row autocommit MUST NOT be used.
* **[REQ-02-FUNC-403] Differential Bootstrap:** Before inserting, Rust MUST read the existing entity ID set for each table and MUST issue an `INSERT` only for folders absent from that set (see `[REQ-02-RULE-009]`).
* **[REQ-02-FUNC-404] Storage Engine Tuning:** Every `main.db` connection MUST apply `journal_mode = WAL`, `synchronous = NORMAL`, `temp_store = MEMORY`, and a negative `cache_size` before executing any statement.
* **[REQ-02-FUNC-405] Indexed List Ordering:** The schema MUST provide an index matching each entity list `ORDER BY COALESCE(NULLIF(<name>, ''), <id>)` key, plus an index on `experience(person_id)`. List queries MUST NOT materialize a temporary sort B-tree.
* **[REQ-02-FUNC-406] Metadata-Only Payload:** `load_hasm_model_db` MUST request a metadata-only read and MUST return entities whose `markdown` field is empty and whose `markdownPath` field is populated (see `[REQ-02-RULE-008]`).
* **[REQ-02-FUNC-407] Single Load Per Navigation:** The frontend MUST invoke `load_hasm_model_db` at most once per workspace open and MUST forward the returned model directly to `verify_hasm_storage` without re-reading the package.
* **[REQ-02-FUNC-408] Constant-Time Set Membership in Verification:** `verify_hasm_storage` MUST resolve expected-path membership through a hash set. A linear scan of the expected-path collection per scanned folder MUST NOT be used.
* **[REQ-02-FUNC-409] Targeted Process Table Access:** `check_workspace_lock` MUST refresh only the recorded `holder_pid` and MUST NOT enumerate the full OS process table.
* **[REQ-02-FUNC-410] Bootstrap Progress Streaming:** The folder bootstrap phase MUST emit `model-load-progress` events subject to the 150 ms throttle, so it cannot trip the `[REQ-02-RULE-005]` watchdog on large packages.
* **[REQ-02-FUNC-411] Ownership Constraint Relaxation:** The `experience` table MUST NOT declare a SQL foreign key on `person_id`, and foreign key enforcement MUST remain disabled, so folder-only EXPERIENCE entities can be bootstrapped with the nil-UUID owner placeholder before their owning PERSON is known. Ownership validity MUST be enforced in the domain layer.