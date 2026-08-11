# REQ-06: Error Fallback & Recovery Flow (Formal Specification)

This specification defines the functional, data, time constraint, and error recovery navigation requirements for handling application system failures, model workspace corruption with granular appended error details, auto-repair folder creation, path-retaining app reboots, and Markdown syntax/file missing errors under `SEQ-06`.

---

## 1. System Invariants & Core Rules

* **[REQ-06-RULE-001] Safe Error Fallback:** When unrecoverable validation, process timeout, or file missing errors occur, the application MUST NOT crash or enter an undefined UI state. It MUST navigate to the corresponding error fallback screen (`/error-app`, `/error-model`, or `/error-markdown`).


* **[REQ-06-RULE-002] Error Context & Cause Appending:** Upon navigating to an error screen, the system MUST preserve and display relevant error metadata—including error codes, file/directory paths, target entity IDs, parser stderr output, and appended verification error details (`missing_entities`, `domain_validation_errors`).


* **[REQ-06-RULE-003] Path Retention on Reboot:** Rebooting the desktop application from `/error-app` MUST preserve the active HASM workspace path (if present) by spawning the new process with the `--path {retained_model_path}` CLI argument.


* **[REQ-06-RULE-004] Non-Destructive Auto-Repair:** Creating missing entity folders (`repair_missing_entity_folders`) MUST generate required `{UUID}` directories and default `main.md` templates without overwriting or corrupting existing files or database entries.


* **[REQ-06-RULE-005] Re-Verification Pre-condition:** Successful recovery from `/error-markdown` or `/error-model` MUST execute target validation before returning the user to normal operational pages (`/visualizer` or `/entity-detail/...`).



---

## 2. Technical Specifications & Data Contracts

### 2.1 IPC Payload & Navigation State Data Contracts

```rust
// [REQ-06-DATA-001] App Error Context Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppErrorContext {
    pub error_code: String,
    pub message: String,
    pub failed_component: String,
    pub retained_model_path: Option<String>,
}

// [REQ-06-DATA-002] Model Error Context Payload (With Appended Detail Arrays)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelErrorContext {
    pub error_code: String,
    pub model_path: String,
    pub message: String,
    pub missing_entities: Vec<(EntityType, Uuid)>, // Appended missing storage folders
    pub unreferenced_entities: Vec<(EntityType, Uuid)>,
    pub domain_validation_errors: Vec<(EntityType, Uuid, String)>,
}

// [REQ-06-DATA-003] Repair Missing Folders Request Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepairMissingFoldersRequest {
    pub workspace_path: String,
    pub missing_entities: Vec<(EntityType, Uuid)>,
}

// [REQ-06-DATA-004] Markdown Error Context Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkdownErrorContext {
    pub error_code: String, // "ERR_MARKDOWN_TIMEOUT" | "ERR_MARKDOWN_VERIFICATION_FAILED" | "ERR_MARKDOWN_FILE_NOT_FOUND"
    pub entity_type: String,
    pub entity_id: Uuid,
    pub target_path: String,
    pub stderr_output: Option<String>,
}

```

---

## 3. Detailed Functional Requirements

### Chapter 1: App System Error Recovery (`/error-app`)

* **[REQ-06-FUNC-101] App Error Screen Rendering:** Upon navigating to `/error-app`, React MUST render `ErrorAppPage.tsx` displaying system error code, message, failed component name, and `retained_model_path` if present.


* **[REQ-06-FUNC-102] App Validation Retry Trigger:** Clicking "Retry Validation" MUST set `isRetrying = true` and re-invoke `validate_hasm_app`.


* **[REQ-06-FUNC-103] App Retry Failure Display:** If `validate_hasm_app` fails again during retry, React MUST set `isRetrying = false` and update the error display with a failure toast.


* **[REQ-06-FUNC-104] App Retry Success Navigation:** Upon successful resolution of `validate_hasm_app`, React Router MUST navigate to `/select`.


* **[REQ-06-FUNC-105] App Reboot with Path Execution:** Clicking "Reboot Application" MUST invoke `reboot_app` passing `retained_model_path`. If `retained_model_path` exists, Rust MUST spawn `std::env::current_exe()` passing `--path {retained_model_path}` as a CLI argument and terminate the current desktop process.


* **[REQ-06-FUNC-106] Clean Application Exit:** Clicking "Exit Application" MUST invoke `exit_app` to terminate the desktop process cleanly.



### Chapter 2: Model Workspace Error Recovery & Folder Repair (`/error-model`)

* **[REQ-06-FUNC-201] Model Error Screen Rendering:** Upon navigating to `/error-model`, React MUST render `ErrorModelPage.tsx` displaying target `model_path`, workspace failure message, and the list of appended error reasons (`missing_entities`, `domain_validation_errors`).


* **[REQ-06-FUNC-202] Missing Folder Repair Action Visibility:** If `missing_entities` is non-empty, `ErrorModelPage.tsx` MUST render a "Create Missing Folders" button.


* **[REQ-06-FUNC-203] Folder Repair Command Execution:** Clicking "Create Missing Folders" MUST invoke `repair_missing_entity_folders` passing `workspace_path` and `missing_entities`. Rust MUST create the missing `{UUID}` directories, default `main.md` files, and `assets/` subdirectories on disk.


* **[REQ-06-FUNC-204] Repair Completion Feedback:** Upon successful completion of `repair_missing_entity_folders`, React MUST display an info toast ("Missing folders created successfully. Click 'Retry Loading'") and enable the "Retry Loading" action.


* **[REQ-06-FUNC-205] Model Load Retry Trigger:** Clicking "Retry Loading Model" MUST navigate to `/loading-model` passing `{ modelPath, forceReload: true }` in router state to re-trigger `SEQ-02`.


* **[REQ-06-FUNC-206] Select Page Fallback Navigation:** Clicking "Select Another Model" MUST navigate to `/select` without throwing state errors.



### Chapter 3: Markdown Syntax & File Error Recovery (`/error-markdown`)

* **[REQ-06-FUNC-301] Markdown Error Screen Rendering:** Upon navigating to `/error-markdown`, React MUST render `ErrorMarkdownPage.tsx` displaying target `entity_type`, `entity_id`, error code, and `stderr_output` if present.


* **[REQ-06-FUNC-302] External Repair Trigger:** Clicking "Fix in HASM Markdown App" MUST invoke `launch_external_markdown_app` (`SEQ-05`) targeting the entity UUID directory.


* **[REQ-06-FUNC-303] External Repair Guidance Toast:** Upon successful invocation of `launch_external_markdown_app`, React MUST display an info toast instructing the user to edit, save, and click "Retry Validation".


* **[REQ-06-FUNC-304] Markdown Re-verification Trigger:** Clicking "Retry Validation" MUST set `isRetrying = true` and invoke `reload_entity_markdown`.


* **[REQ-06-FUNC-305] Re-verification Failure Handling:** If `reload_entity_markdown` fails again during retry, React MUST set `isRetrying = false` and render an error toast detailing that syntax/file errors persist.


* **[REQ-06-FUNC-306] Re-verification Success Routing:** Upon successful resolution of `reload_entity_markdown`, React Router MUST navigate back to `/entity-detail/:entity_type/:entity_id`.


* **[REQ-06-FUNC-307] Safe Exit to Visualizer Navigation:** Clicking "Back to Visualizer" MUST navigate to `/visualizer`.