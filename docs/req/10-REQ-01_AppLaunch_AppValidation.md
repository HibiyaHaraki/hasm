# REQ-01: App Launch & App Validation (Formal Specification)

This specification defines the functional, data, and behavioral requirements for the startup, environment validation, and path selection flow (`SEQ-01`) of the HASM Desktop Application.

---

## 1. System Invariants & Core Rules

1. **Guaranteed Execution Order:** Validation checks MUST be executed sequentially (Check 1 → Check 2 → Check 3/4). A failure at any step MUST immediately abort subsequent IPC invocations and trigger fail-safe navigation (`/error-app`).
2. **Fail-Safe Routing:** Under no circumstances shall the application navigate to `/loading-model` (`SEQ-02`) without a verified, existing local disk path (`modelPath`).
3. **Bounded Wait Time (Non-Blocking UI):** All IPC calls interacting with external systems or the File System MUST enforce a hard timeout on the frontend to prevent UI thread lockup.

---

## 2. Technical Specifications & Data Contracts

### 2.1 IPC Command Interfaces

```rust
// Error Payload returned by all validation commands
#[derive(Serialize, Deserialize, Debug)]
pub struct AppValidationError {
    pub code: String,    // e.g., "ERR_MARKDOWN_APP_INVALID", "ERR_TARGET_PATH_NOT_FOUND"
    pub message: String, // Human-readable error description
}

// Response structure for Check 2
#[derive(Serialize, Deserialize, Debug)]
pub struct AppVersionResponse {
    pub is_model_selected: bool,
    pub path: Option<String>,
    pub version: String,
}

```

---

## 3. Detailed Step-by-Step Functional Requirements

### Step 1: Initial Application Boot

* **Execution:** `React (App.tsx)`
* **Description:** When the application mounts, React sets its local/global initialization state to `{ isLoading: true, loadState: 0, error: null }`.

### Step 2: Check 1 - Validate External HASM Markdown App

* **Command:** `invoke('validate_hasm_markdown_app')`
* **Description:** React verifies that the external HASM Markdown Application executable is present and callable on the host OS.
* **Timeout Constraint:** Managed within a **5,000ms** threshold.
* **Error Handling:** On error, execution breaks immediately to `/error-app`.
* **Success:** React updates state to `loadState: 1`.



### Step 3: Check 2 - Inspect App Version & CLI Arguments

* **Command:** `invoke('validate_app_version')`
* **Description:** Rust checks `CARGO_PKG_VERSION` and `std::env::args()`.
* If launched via Explorer Context Menu with a folder path, `isModelSelected = true` and `path = Some("...")`.
* If launched directly via executable, `isModelSelected = false`.
* **Success:** React updates state to `loadState: 2` and stores `modelPath`.



### Step 4: Check 3 - Verify Folder Path Existence (CLI Argument Case)

* **Command:** `invoke('validate_hasm_folder_path', { path: modelPath })`
* **Condition:** Executed **ONLY** when `isModelSelected == true`.
* **Description:** Checks if the CLI-supplied path exists on disk (`Path::exists()`).
* **Timeout Constraint:** Managed within a **3,000ms** threshold.
* **Error Handling:** If non-existent, breaks immediately to `/error-app`.
* **Success:** React updates state to `loadState: 3`.



### Step 5: Check 4 - Manual Path Input & Real-time Validation (Manual Select Case)

* **Execution:** `Select Page Component`
* **Condition:** Executed **ONLY** when `isModelSelected == false`.
* **Description:** React navigates to `/select` and renders the path selection form/file picker. As the user types or chooses a path, React calls `validate_hasm_folder_path` in real-time.
* **Validation Logic:**
* **Debounce:** Input events are debounced by **300ms**.
* **Timeout Constraint:** Enforced with a **2,000ms** threshold. If checking a remote/unresponsive path exceeds 2 seconds, it treats the path as unverified and shows a timeout warning.
* **Path Valid:** Form button is enabled, inline warning is hidden.
* **Path Invalid:** Form button remains disabled, preventing submission of invalid paths.


* When the user clicks Submit, React captures the validated `modelPath` and re-enables `isLoading: true`.



### Step 6: Transition to SEQ-02

* **Execution:** `React Router`
* **Description:** With a 100% verified disk path guaranteed (`modelPath`), React routes to `/loading-model` to initiate `SEQ-02: Model Loading` (schema parsing and data structure loading).
