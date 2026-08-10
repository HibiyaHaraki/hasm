# REQ-01: App Launch & App Validation (Formal Specification)

This specification defines the functional, data, and behavioral requirements for the startup, environment validation, and path selection flow (`SEQ-01`) of the HASM Desktop Application.

---

## 1. System Invariants & Core Rules

* **[REQ-01-RULE-001] Guaranteed Execution Order:** Validation checks MUST be executed sequentially (Check 1 → Check 2 → Check 3/4). A failure at any step MUST immediately abort subsequent IPC invocations and trigger fail-safe navigation (`/error-app`).
* **[REQ-01-RULE-002] Fail-Safe Routing:** Under no circumstances shall the application navigate to `/loading-model` (`SEQ-02`) without a verified, existing local disk path (`modelPath`).
* **[REQ-01-RULE-003] Bounded Wait Time (Non-Blocking UI):** All IPC calls interacting with external systems or the File System MUST enforce a hard timeout on the frontend to prevent UI thread lockup.

---

## 2. Technical Specifications & Data Contracts

### 2.1 IPC Command Interfaces

```rust
// [REQ-01-DATA-001] Error Payload returned by all validation commands
#[derive(Serialize, Deserialize, Debug)]
pub struct AppValidationError {
    pub code: String,    // e.g., "ERR_MARKDOWN_APP_INVALID", "ERR_TARGET_PATH_NOT_FOUND"
    pub message: String, // Human-readable error description
}

// [REQ-01-DATA-002] Response structure for Check 2
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

* **[REQ-01-FUNC-101] Initial State Setup:**
* **Execution:** `React (App.tsx)`
* **Description:** When the application mounts, React MUST initialize state to `{ isLoading: true, loadState: 0, error: null }`.



### Step 2: Check 1 - Validate External HASM Markdown App

* **[REQ-01-FUNC-201] Markdown App Verification:**
* **Command:** `invoke('validate_hasm_markdown_app')`
* **Description:** React MUST verify that the external HASM Markdown Application executable is present and callable on the host OS.
* **Timeout Constraint:** MUST terminate and fail if execution exceeds **5,000ms**.
* **Error Handling:** On error/timeout, execution MUST break immediately and route to `/error-app`.
* **Success Behavior:** React MUST update state to `loadState: 1`.



### Step 3: Check 2 - Inspect App Version & CLI Arguments

* **[REQ-01-FUNC-301] CLI Argument & Version Inspection:**
* **Command:** `invoke('validate_app_version')`
* **Description:** Rust MUST read `CARGO_PKG_VERSION` and parse `std::env::args()`.
* If booted via File Explorer Context Menu with a folder path argument, set `isModelSelected = true` and `path = Some("...")`.
* If booted directly via executable without arguments, set `isModelSelected = false`.


* **Success Behavior:** React MUST update state to `loadState: 2` and store `modelPath`.



### Step 4: Check 3 - Verify Folder Path Existence (CLI Argument Case)

* **[REQ-01-FUNC-401] CLI Path Existence Check:**
* **Command:** `invoke('validate_hasm_folder_path', { path: modelPath })`
* **Condition:** Executed **ONLY** when `isModelSelected == true`.
* **Description:** Rust MUST verify if the CLI-supplied path exists on disk via `Path::exists()`.
* **Timeout Constraint:** MUST terminate and fail if execution exceeds **3,000ms**.
* **Error Handling:** If path does not exist or times out, execution MUST break immediately and route to `/error-app`.
* **Success Behavior:** React MUST update state to `loadState: 3`.



### Step 5: Check 4 - Manual Path Input & Real-time Validation (Manual Select Case)

* **[REQ-01-FUNC-501] Manual Selection & Real-time Validation:**
* **Execution:** `Select Page Component`
* **Condition:** Executed **ONLY** when `isModelSelected == false`.
* **Description:** React MUST navigate to `/select` and display the path input form/file picker.
* **Validation Logic:**
* **Debounce:** Input trigger MUST be debounced by **300ms**.
* **Timeout Constraint:** Enforced with a **2,000ms** threshold. If checking a remote/unresponsive path exceeds 2 seconds, treat the path as unverified and show inline warning.
* **Path Valid:** Form submit button MUST be enabled, inline warning hidden.
* **Path Invalid:** Form submit button MUST remain disabled, preventing submission.


* **Submit Behavior:** Upon user submission, React MUST store `modelPath` and re-enable `isLoading: true`.



### Step 6: Transition to SEQ-02

* **[REQ-01-FUNC-601] Router Transition:**
* **Execution:** `React Router`
* **Description:** Upon completing all checks with a verified `modelPath`, React MUST navigate to `/loading-model` to initiate `SEQ-02: Model Loading`.