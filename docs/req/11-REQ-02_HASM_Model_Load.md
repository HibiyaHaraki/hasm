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