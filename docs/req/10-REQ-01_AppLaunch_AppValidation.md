# REQ-01: App Launch & App Validation (Formal Specification)

This specification defines the functional, data, and behavioral requirements for the startup, environment validation, and path selection flow (`SEQ-01`) of the HASM Desktop Application.

---

## 1. System Invariants & Core Rules

* **[REQ-01-RULE-001] Sequential Execution:** Validation checks MUST be executed sequentially in the strict order of Check 1 → Check 2 → Check 3/4.
* **[REQ-01-RULE-002] Critical Check Fatal Failure:** A failure during Check 1 or Check 2 MUST immediately abort subsequent IPC invocations and trigger navigation to `/error-app`.
* **[REQ-01-RULE-003] Path Check Graceful Fallback:** A path validation failure during Check 3 MUST NOT trigger `/error-app`, but MUST gracefully fall back to Check 4 (`/select` page).
* **[REQ-01-RULE-004] Mandatory Path Verification Before Load:** Under no circumstances shall the application navigate to `/loading-model` (`SEQ-02`) without a verified, existing local disk path (`modelPath`).
* **[REQ-01-RULE-005] Frontend Hard Timeout Enforcement:** All IPC calls interacting with external systems or the File System MUST enforce a hard timeout on the frontend to prevent UI thread lockup.
* **[REQ-01-RULE-006] Multi-Process Double-Booting Allowance:** The application MUST allow multiple OS process instances to run concurrently (double-booting), where each process operates with its own isolated memory space, React state, and backend context.

---

## 2. Technical Specifications & Data Contracts

### 2.1 IPC Command Interfaces

```rust
// [REQ-01-DATA-001] Error Payload Data Contract
#[derive(Serialize, Deserialize, Debug)]
pub struct AppValidationError {
    pub code: String,    // e.g., "ERR_MARKDOWN_APP_INVALID", "ERR_TARGET_PATH_NOT_FOUND"
    pub message: String, // Human-readable error description
}

// [REQ-01-DATA-002] Response Structure Data Contract
#[derive(Serialize, Deserialize, Debug)]
pub struct AppVersionResponse {
    pub is_model_selected: bool,
    pub path: Option<String>,
    pub version: String,
}

```

---

## 3. Detailed Functional Requirements

### Step 1: Initial Application Boot

* **[REQ-01-FUNC-101] Boot Mounting:** When the application mounts, React MUST set the initial state `isLoading` to `true`.
* **[REQ-01-FUNC-102] Boot Progress State:** When the application mounts, React MUST set the initial state `loadState` to `0`.
* **[REQ-01-FUNC-103] Boot Error State:** When the application mounts, React MUST set the initial state `error` to `null`.

### Step 2: Check 1 - Validate External HASM Markdown App

* **[REQ-01-FUNC-201] Markdown App IPC Invocation:** React MUST invoke `validate_hasm_markdown_app` upon completing Step 1.
* **[REQ-01-FUNC-202] Markdown App OS Verification:** Rust MUST verify that the external HASM Markdown Application executable exists and is callable on the host OS.
* **[REQ-01-FUNC-203] Markdown App Timeout Limit:** React MUST reject the invocation if `validate_hasm_markdown_app` does not respond within **5,000ms**.
* **[REQ-01-FUNC-204] Markdown App Error State Update:** On Check 1 error or timeout, React MUST set `isLoading` to `false` and store the error message in state.
* **[REQ-01-FUNC-205] Markdown App Error Routing:** On Check 1 error or timeout, React Router MUST navigate to `/error-app`.
* **[REQ-01-FUNC-206] Markdown App Success Progress:** On Check 1 success, React MUST update `loadState` to `1`.

### Step 3: Check 2 - Inspect App Version & CLI Arguments

* **[REQ-01-FUNC-301] Version Inspection IPC Invocation:** React MUST invoke `validate_app_version` upon completing Check 1.
* **[REQ-01-FUNC-302] Version Reading:** Rust MUST read the current package version from `CARGO_PKG_VERSION`.
* **[REQ-01-FUNC-303] CLI Arguments Parsing:** Rust MUST inspect `std::env::args()` for passed CLI path arguments.
* **[REQ-01-FUNC-304] Context Menu Boot Flag Setting:** If a valid argument string is present in `std::env::args()`, Rust MUST set `is_model_selected` to `true` in the IPC response.
* **[REQ-01-FUNC-305] Context Menu Boot Path Extraction:** If a valid argument string is present in `std::env::args()`, Rust MUST return the path in the IPC response payload.
* **[REQ-01-FUNC-306] Direct Boot Flag Setting:** If no argument string is present in `std::env::args()`, Rust MUST set `is_model_selected` to `false` in the IPC response.
* **[REQ-01-FUNC-307] Check 2 Error State Update:** On Check 2 error, React MUST set `isLoading` to `false` and store the error message in state.
* **[REQ-01-FUNC-308] Check 2 Error Routing:** On Check 2 error, React Router MUST navigate to `/error-app`.
* **[REQ-01-FUNC-309] Check 2 Success Progress:** On Check 2 success, React MUST update `loadState` to `2`.
* **[REQ-01-FUNC-310] Model Path State Store:** On Check 2 success, React MUST store the returned `modelPath` in React state.

### Step 4: Check 3 - Verify Folder Path Existence (CLI Argument Case)

* **[REQ-01-FUNC-401] CLI Path Check Execution Condition:** React MUST invoke `validate_hasm_folder_path` with `modelPath` ONLY when `isModelSelected` is `true`.
* **[REQ-01-FUNC-402] Disk Path Existence Verification:** Rust MUST verify whether the supplied `modelPath` exists on disk using `Path::exists()`.
* **[REQ-01-FUNC-403] CLI Path Check Timeout Limit:** React MUST reject the invocation if `validate_hasm_folder_path` during Check 3 does not respond within **3,000ms**.
* **[REQ-01-FUNC-404] CLI Path Failure Error State:** If the path does not exist or times out, React MUST update the `error` state with a "Specified HASM path does not exist" message.
* **[REQ-01-FUNC-405] CLI Path Failure Flag Reset:** If the path does not exist or times out, React MUST set `isModelSelected` to `false`.
* **[REQ-01-FUNC-406] CLI Path Success Progress:** On Check 3 success, React MUST update `loadState` to `3`.

### Step 5: Check 4 - Manual Path Input & Real-time Validation (Manual / Fallback Case)

* **[REQ-01-FUNC-501] Direct Boot Navigation:** If `isModelSelected` is `false` after Check 2 or Check 3, React MUST set `isLoading` to `false`.
* **[REQ-01-FUNC-502] Select Page Routing:** If `isModelSelected` is `false` after Check 2 or Check 3, React Router MUST navigate to `/select`.
* **[REQ-01-FUNC-503] Real-time Input Validation Trigger:** On the `/select` page, React MUST invoke `validate_hasm_folder_path` whenever the user inputs or selects a folder path.
* **[REQ-01-FUNC-504] Real-time Input Debounce:** The trigger for real-time path validation MUST be debounced by **300ms**.
* **[REQ-01-FUNC-505] Real-time Input Timeout Limit:** React MUST reject the real-time validation if `validate_hasm_folder_path` does not respond within **2,000ms**.
* **[REQ-01-FUNC-506] Valid Path Form Enable:** When real-time validation succeeds within 2,000ms, React MUST enable the form 'Submit' button.
* **[REQ-01-FUNC-507] Valid Path Warning Clear:** When real-time validation succeeds within 2,000ms, React MUST clear any active inline warnings.
* **[REQ-01-FUNC-508] Invalid Path Form Disable:** When real-time validation fails or times out (>2,000ms), React MUST disable the form 'Submit' button.
* **[REQ-01-FUNC-509] Invalid Path Warning Display:** When real-time validation fails or times out (>2,000ms), React MUST display an inline timeout or invalid path warning.
* **[REQ-01-FUNC-510] Form Submit State Capture:** When the user clicks the enabled 'Submit' button, React MUST capture the validated `inputPath` as `modelPath`.
* **[REQ-01-FUNC-511] Form Submit Loading State:** When the user clicks the enabled 'Submit' button, React MUST set `isLoading` to `true`.

### Step 6: Transition to SEQ-02

* **[REQ-01-FUNC-601] Loading-Model Page Navigation:** When all validation checks pass and `modelPath` is guaranteed valid, React Router MUST navigate to `/loading-model`.
* **[REQ-01-FUNC-602] Route State Transfer:** React Router MUST transfer `modelPath` via route state during navigation to `/loading-model`.