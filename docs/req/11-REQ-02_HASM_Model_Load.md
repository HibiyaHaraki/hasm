# REQ-02: Model Loading & Storage Verification (Formal Specification)

This specification defines the functional, data, and behavioral requirements for the model loading, database deserialization, storage verification, and progress streaming flow (`SEQ-02`) of the HASM Desktop Application.

---

## 1. System Invariants & Core Rules

* **[REQ-02-RULE-001] Route State Dependency:** Model loading MUST NOT execute without a valid `modelPath` string transferred via React Router state from `SEQ-01`.
* **[REQ-02-RULE-002] Sequential Phase Execution:** Model loading MUST execute sequentially in strict order: Phase 1 (Workspace Lock Check) → Phase 2 (Database Metadata Loading) → Phase 3 (Storage Folder Verification).
* **[REQ-02-RULE-003] Watchdog Reset on Progress Event:** During Phase 2 and Phase 3, the frontend Watchdog Timer MUST reset to 0ms upon receiving any progress event (`model-load-progress` or `model-verify-progress`).
* **[REQ-02-RULE-004] Watchdog Stale Timeout:** If no progress event is received for more than **10,000ms** during Phase 2 or Phase 3, the frontend MUST terminate loading and navigate to `/error-model`.
* **[REQ-02-RULE-005] Fatal Error Abort:** Any fatal error (missing lock file creation, corrupted DB schema, or missing storage folder) MUST immediately abort subsequent loading phases and navigate to `/error-model`.
* **[REQ-02-RULE-006] Warning Tolerance:** Non-fatal anomalies (e.g., unreferenced disk folders not registered in `hasm.db`) MUST NOT abort model loading, but MUST be captured as warnings and transferred to `/workspace`.

---

## 2. Technical Specifications & Data Contracts

### 2.1 IPC Payload Data Contracts

```rust
// [REQ-02-DATA-001] Model Loading Error Payload
#[derive(Serialize, Deserialize, Debug)]
pub struct ModelLoadingError {
    pub code: String,    // e.g., "ERR_DB_CORRUPTED", "ERR_MISSING_STORAGE_FOLDER"
    pub message: String, // Human-readable error description
    pub details: Option<Vec<String>>,
}

// [REQ-02-DATA-002] Lock Status Payload
#[derive(Serialize, Deserialize, Debug)]
pub struct LockStatus {
    pub is_locked: bool,
    pub holder_pid: Option<u32>,
}

// [REQ-02-DATA-003] Progress Event Payload
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModelProgressPayload {
    pub step: String,        // "DB_LOAD" | "STORAGE_VERIFY"
    pub current: usize,      // Processed item count
    pub total: usize,        // Total item count
    pub percentage: f32,     // Calculated percentage (0.0 - 100.0)
    pub message: String,     // Display text (e.g., "Loading FACT (450/1000)...")
}

// [REQ-02-DATA-004] Storage Verification Result Payload
#[derive(Serialize, Deserialize, Debug, Default)]
pub struct VerificationResult {
    pub missing_entities: Vec<(String, String)>,       // (EntityType, UUID)
    pub unreferenced_entities: Vec<(String, String)>,  // (EntityType, UUID)
}

```

---

## 3. Detailed Functional Requirements

### Step 1: Pre-condition & Component Mounting

* **[REQ-02-FUNC-101] Component Mounting:** React MUST mount `LoadingPage` component upon router navigation from `SEQ-01`.
* **[REQ-02-FUNC-102] Route State Capture:** React MUST capture `modelPath` from React Router `location.state`.
* **[REQ-02-FUNC-103] Initial Model Loading State:** When mounting, React MUST initialize `isModelLoading` state to `true`.
* **[REQ-02-FUNC-104] Initial Model Progress State:** When mounting, React MUST initialize `modelProgress` state to `0.0`.
* **[REQ-02-FUNC-105] Initial Processed Counter State:** When mounting, React MUST initialize `current` processed count state to `0`.
* **[REQ-02-FUNC-106] Initial Total Counter State:** When mounting, React MUST initialize `total` count state to `0`.
* **[REQ-02-FUNC-107] Initial Message State:** When mounting, React MUST initialize `loadingMessage` state to `"Initializing..."`.
* **[REQ-02-FUNC-108] Initial Error State:** When mounting, React MUST initialize `modelError` state to `null`.
* **[REQ-02-FUNC-109] Event Listener Setup:** When mounting, React MUST register IPC event listeners for `model-load-progress` and `model-verify-progress`.

### Step 2: Phase 1 - Workspace Lock Check (Exclusive Access Control)

* **[REQ-02-FUNC-201] Lock Check IPC Invocation:** React MUST invoke `check_workspace_lock` with `{ path: modelPath }`.
* **[REQ-02-FUNC-202] Lock File Existence Check:** Rust MUST verify the physical existence of `.hasm/lock` under `modelPath`.
* **[REQ-02-FUNC-203] Lock File Creation:** If `.hasm/lock` does not exist, Rust MUST create `.hasm/lock` containing the current process PID and return `is_locked = false`.
* **[REQ-02-FUNC-204] Existing Lock Detection:** If `.hasm/lock` exists, Rust MUST read the holder PID and return `is_locked = true`.
* **[REQ-02-FUNC-205] Lock Check Hard Timeout:** React MUST enforce a strict **3,000ms** hard timeout for `check_workspace_lock`.
* **[REQ-02-FUNC-206] Lock Check Timeout Routing:** If `check_workspace_lock` exceeds 3,000ms, React MUST set `modelError` and navigate to `/error-model`.
* **[REQ-02-FUNC-207] Read-Only Mode Setting:** If `check_workspace_lock` returns `is_locked = true`, React MUST set state `isReadOnly` to `true`.
* **[REQ-02-FUNC-208] Read-Only Warning Store:** If `check_workspace_lock` returns `is_locked = true`, React MUST store a "Opened in Read-Only Mode" warning.
* **[REQ-02-FUNC-209] Read-Write Mode Setting:** If `check_workspace_lock` returns `is_locked = false`, React MUST set state `isReadOnly` to `false`.

### Step 3: Phase 2 - Database Metadata Loading & Progress Streaming

* **[REQ-02-FUNC-301] Watchdog Timer Initialization (Phase 2):** React MUST start a **10,000ms** Watchdog Timer prior to invoking `load_hasm_model_db`.
* **[REQ-02-FUNC-302] DB Load IPC Invocation:** React MUST invoke `load_hasm_model_db` with `{ path: modelPath }`.
* **[REQ-02-FUNC-303] DB File Connection:** Rust MUST attempt to open `hasm.db` at `modelPath/hasm.db`.
* **[REQ-02-FUNC-304] Corrupted DB Rejection:** If `hasm.db` is unreadable or corrupted, Rust MUST reject the invocation with `ERR_DB_CORRUPTED`.
* **[REQ-02-FUNC-305] HasmModel Instance Instantiation:** Rust MUST instantiate `HasmModel::new(modelPath)` binding `local_path`.
* **[REQ-02-FUNC-306] Person Deserialization:** Rust MUST query `PERSON` table, construct `Person` structs using `Person::new()`, and append them via `model.add_person()`.
* **[REQ-02-FUNC-307] Experience Deserialization:** Rust MUST query `EXPERIENCE` and `EXPERIENCE_TREE` tables, construct `Experience` structs, and append them via `model.add_experience()`.
* **[REQ-02-FUNC-308] Fact Deserialization:** Rust MUST query `FACT` and `FACT_EXPERIENCE` tables, construct `Fact` structs, and append them via `model.add_fact()`.
* **[REQ-02-FUNC-309] Link Deserialization:** Rust MUST query `LINK` and `LINK_RELATION` tables, construct `Link` structs, and append them via `model.add_link()`.
* **[REQ-02-FUNC-310] DB Progress Emission:** During Phase 2, Rust MUST emit `model-load-progress` events containing `ModelProgressPayload` (`step: "DB_LOAD"`).
* **[REQ-02-FUNC-311] DB Progress Reception:** Upon receiving `model-load-progress`, React MUST update UI states (`current`, `total`, `modelProgress`, `loadingMessage`).
* **[REQ-02-FUNC-312] Watchdog Timer Reset (Phase 2):** Upon receiving `model-load-progress`, React MUST reset the Watchdog Timer back to 0ms.
* **[REQ-02-FUNC-313] DB Watchdog Timeout Error:** If the Watchdog Timer reaches 10,000ms without a `model-load-progress` event, React MUST set `modelError` to "DB loading stalled" and navigate to `/error-model`.
* **[REQ-02-FUNC-314] DB Load Completion Store:** Upon successful resolution of `load_hasm_model_db`, React MUST store `hasmModelInstance` in React state and clear the Phase 2 Watchdog Timer.

### Step 4: Phase 3 - Storage Folder Verification via Class Method

* **[REQ-02-FUNC-401] Watchdog Timer Initialization (Phase 3):** React MUST start a **10,000ms** Watchdog Timer prior to invoking `verify_hasm_storage`.
* **[REQ-02-FUNC-402] Storage Verify IPC Invocation:** React MUST invoke `verify_hasm_storage` passing `hasmModelInstance`.
* **[REQ-02-FUNC-403] Method Execution:** Rust MUST execute `model.verify_storage()` against the bound `local_path`.
* **[REQ-02-FUNC-404] Person Folder Check:** Rust MUST verify that `modelPath/PERSON/{UUID}/main.md` exists for every UUID returned by `model.get_person_uuids()`.
* **[REQ-02-FUNC-405] Experience Folder Check:** Rust MUST verify that `modelPath/EXPERIENCE/{UUID}/main.md` exists for every UUID returned by `model.get_experience_uuids()`.
* **[REQ-02-FUNC-406] Fact Folder Check:** Rust MUST verify that `modelPath/FACT/{UUID}/main.md` exists for every UUID returned by `model.get_fact_uuids()`.
* **[REQ-02-FUNC-407] Link Folder Check:** Rust MUST verify that `modelPath/LINK/{UUID}/main.md` exists for every UUID returned by `model.get_link_uuids()`.
* **[REQ-02-FUNC-408] Unreferenced Disk Folder Scan:** Rust MUST scan disk directories under `modelPath` and compare found folder UUIDs against `model.get_all_uuids()`.
* **[REQ-02-FUNC-409] Missing Entity Logging:** Rust MUST record any missing folder in `VerificationResult.missing_entities`.
* **[REQ-02-FUNC-410] Unreferenced Entity Logging:** Rust MUST record any unreferenced disk folder in `VerificationResult.unreferenced_entities`.
* **[REQ-02-FUNC-411] Storage Progress Emission:** During Phase 3, Rust MUST emit `model-verify-progress` events containing `ModelProgressPayload` (`step: "STORAGE_VERIFY"`).
* **[REQ-02-FUNC-412] Storage Progress Reception:** Upon receiving `model-verify-progress`, React MUST update UI states (`current`, `total`, `modelProgress`, `loadingMessage`).
* **[REQ-02-FUNC-413] Watchdog Timer Reset (Phase 3):** Upon receiving `model-verify-progress`, React MUST reset the Watchdog Timer back to 0ms.
* **[REQ-02-FUNC-414] Storage Watchdog Timeout Error:** If the Watchdog Timer reaches 10,000ms without a `model-verify-progress` event, React MUST set `modelError` to "Storage verification stalled" and navigate to `/error-model`.
* **[REQ-02-FUNC-415] Fatal Missing Entity Abort:** If `VerificationResult.has_fatal_error()` is `true`, Rust MUST reject `verify_hasm_storage` with `ERR_MISSING_STORAGE_FOLDER`.
* **[REQ-02-FUNC-416] Fatal Verification Failure Routing:** Upon rejection due to missing storage folders, React MUST update `modelError` and navigate to `/error-model`.
* **[REQ-02-FUNC-417] Storage Verification Success:** Upon successful resolution of `verify_hasm_storage`, React MUST clear the Phase 3 Watchdog Timer and update `modelProgress` to `100.0`.

### Step 5: Transition to SEQ-03 (Main Application Workspace)

* **[REQ-02-FUNC-501] Model Loading Flag Teardown:** Upon completing Phase 3, React MUST set `isModelLoading` to `false`.
* **[REQ-02-FUNC-502] Workspace Router Navigation:** Upon completing Phase 3, React Router MUST navigate to `/workspace`.
* **[REQ-02-FUNC-503] Workspace Model Data Transfer:** React Router MUST transfer `hasmModelInstance` via route state to `/workspace`.
* **[REQ-02-FUNC-504] Workspace Lock State Transfer:** React Router MUST transfer `isReadOnly` flag via route state to `/workspace`.
* **[REQ-02-FUNC-505] Workspace Warning Data Transfer:** React Router MUST transfer `unreferenced_entities` list via route state to `/workspace`.