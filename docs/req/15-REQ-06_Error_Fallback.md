# REQ-06: Error Fallback & Recovery Flow (Formal Specification)

This specification defines the functional, data, time constraint, and error recovery navigation requirements for handling application system failures, model workspace corruption, and Markdown syntax/file missing errors under `SEQ-06`.

---

## 1. System Invariants & Core Rules

* **[REQ-06-RULE-001] Safe Error Fallback:** When unrecoverable validation, process timeout, or file missing errors occur, the application MUST NOT crash or enter an undefined UI state. It MUST navigate to the corresponding error fallback screen (`/error-app`, `/error-model`, or `/error-markdown`).
* **[REQ-06-RULE-002] Error Context Preservation:** Upon navigating to an error screen, the system MUST preserve relevant error metadata (error code, file/directory path, target entity ID, and parser stderr output) to present actionable feedback to the user.
* **[REQ-06-RULE-003] Non-Destructive Recovery:** User recovery actions (such as "Retry", "Fix in HASM App", or "Select Another Model") MUST NOT corrupt in-memory or on-disk state.
* **[REQ-06-RULE-004] Re-Verification Pre-condition:** Successful recovery from `/error-markdown` or `/error-model` MUST execute target validation before returning the user to normal operational pages (`/visualizer` or `/entity-detail/...`).

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
}

// [REQ-06-DATA-002] Model Error Context Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelErrorContext {
    pub error_code: String,
    pub model_path: String,
    pub message: String,
}

// [REQ-06-DATA-003] Markdown Error Context Payload
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

* **[REQ-06-FUNC-101] App Error Screen Rendering:** Upon navigating to `/error-app`, React MUST render `ErrorAppPage.tsx` displaying the system error code, message, and failed component name.
* **[REQ-06-FUNC-102] App Validation Retry Trigger:** Clicking "Retry Validation" MUST set `isRetrying = true` and re-invoke `validate_hasm_app`.
* **[REQ-06-FUNC-103] App Retry Failure Display:** If `validate_hasm_app` fails again during retry, React MUST set `isRetrying = false` and update the error display with a failure toast.
* **[REQ-06-FUNC-104] App Retry Success Navigation:** Upon successful resolution of `validate_hasm_app`, React Router MUST navigate to `/select`.
* **[REQ-06-FUNC-105] Clean Application Exit:** Clicking "Exit Application" MUST invoke `exit_app` to terminate the desktop process cleanly.

### Chapter 2: Model Workspace Error Recovery (`/error-model`)

* **[REQ-06-FUNC-201] Model Error Screen Rendering:** Upon navigating to `/error-model`, React MUST render `ErrorModelPage.tsx` displaying the target `model_path` and workspace failure reason.
* **[REQ-06-FUNC-202] Model Load Retry Trigger:** Clicking "Retry Loading Model" MUST navigate to `/loading-model` passing `{ modelPath, forceReload: true }` in router state to re-trigger `SEQ-02`.
* **[REQ-06-FUNC-203] Select Page Fallback Navigation:** Clicking "Select Another Model" MUST navigate to `/select` without throwing state errors.

### Chapter 3: Markdown Syntax & File Error Recovery (`/error-markdown`)

* **[REQ-06-FUNC-301] Markdown Error Screen Rendering:** Upon navigating to `/error-markdown`, React MUST render `ErrorMarkdownPage.tsx` displaying the target `entity_type`, `entity_id`, error code, and `stderr_output` if present.
* **[REQ-06-FUNC-302] External Repair Trigger:** Clicking "Fix in HASM Markdown App" MUST invoke `launch_external_markdown_app` (`SEQ-05`) targeting the entity UUID directory.
* **[REQ-06-FUNC-303] External Repair Guidance Toast:** Upon successful invocation of `launch_external_markdown_app`, React MUST display an info toast instructing the user to edit, save, and click "Retry Validation".
* **[REQ-06-FUNC-304] Markdown Re-verification Trigger:** Clicking "Retry Validation" MUST set `isRetrying = true` and invoke `reload_entity_markdown`.
* **[REQ-06-FUNC-305] Re-verification Failure Handling:** If `reload_entity_markdown` fails again during retry, React MUST set `isRetrying = false` and render an error toast detailing that syntax/file errors persist.
* **[REQ-06-FUNC-306] Re-verification Success Routing:** Upon successful resolution of `reload_entity_markdown`, React Router MUST navigate back to `/entity-detail/:entity_type/:entity_id`.
* **[REQ-06-FUNC-307] Safe Exit to Visualizer Navigation:** Clicking "Back to Visualizer" MUST navigate to `/visualizer`.