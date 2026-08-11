# REQ-05: External Markdown App Invocation (Formal Specification)

This specification defines the functional, data, time constraint, and error handling requirements for spawning the custom `hasm_markdown.exe` desktop editor process targeting an entity's UUID directory path under `SEQ-05`.

---

## 1. System Invariants & Core Rules

* **[REQ-05-RULE-001] Dedicated Submodule Execution:** The system MUST ONLY spawn `hasm_markdown.exe` as the external editor application. Generic third-party editors (e.g., VS Code, Obsidian) MUST NOT be invoked.
* **[REQ-05-RULE-002] Fire-and-Forget Spawn Model:** Spawning `hasm_markdown.exe` MUST be executed in a detached, non-blocking mode. The main HASM application MUST NOT lock UI execution or block waiting for process exit.
* **[REQ-05-RULE-003] Directory Target Parameter:** The spawned `hasm_markdown.exe` process MUST accept a single argument specifying the entity's target UUID directory path (`{workspace}/{entityType}/{entityId}/`).
* **[REQ-05-RULE-004] Database Non-Interference:** The `hasm_markdown.exe` process MUST operate solely on file system Markdown content and MUST NOT attempt direct access, lock, or modification of `hasm.db`.
* **[REQ-05-RULE-005] Process Spawn Timeout:** Spawning the `hasm_markdown.exe` process MUST enforce a hard timeout of **5,000ms**.

---

## 2. Technical Specifications & Data Contracts

### 2.1 IPC Payload Data Contracts

```rust
// [REQ-05-DATA-001] Launch External App Request Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchExternalAppRequest {
    pub entity_type: String, // "PERSON" | "EXPERIENCE" | "FACT" | "LINK"
    pub entity_id: Uuid,
}

// [REQ-05-DATA-002] Launch External App Response Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchExternalAppPayload {
    pub target_dir_path: String,
    pub executable_path: String, // Absolute path to hasm_markdown.exe
}

// [REQ-05-DATA-003] External Editor Error Payload Enum
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExternalEditorError {
    EntityDirectoryNotFound { path: String },
    HasmMarkdownExecutableNotFound { path: String },
    LaunchTimeout { timeout_ms: u64 },
    ProcessSpawnFailed { message: String },
}

```

---

## 3. Detailed Functional Requirements

### Chapter 1: Launch HASM Markdown Application (`launch_external_markdown_app`)

* **[REQ-05-FUNC-101] Launch Action Trigger:** Clicking "Edit Markdown in HASM App" on any Entity Detail Page MUST invoke the `launch_external_markdown_app` IPC command.
* **[REQ-05-FUNC-102] Target Directory Resolution:** Rust MUST resolve the absolute target entity directory path as `{workspace}/{entityType}/{entityId}/`.
* **[REQ-05-FUNC-103] Missing Directory Check:** If the target entity directory does not exist on disk, Rust MUST reject the IPC call with `EntityDirectoryNotFound`.
* **[REQ-05-FUNC-104] Missing Directory Error Toast:** Upon receiving `EntityDirectoryNotFound`, React MUST display an error toast ("Entity folder does not exist on disk.").
* **[REQ-05-FUNC-105] Executable Binary Resolution:** Rust MUST verify the physical existence of the `hasm_markdown.exe` binary in the application's runtime bin path.
* **[REQ-05-FUNC-106] Missing Executable Check:** If `hasm_markdown.exe` binary is missing on disk, Rust MUST reject the IPC call with `HasmMarkdownExecutableNotFound`.
* **[REQ-05-FUNC-107] Missing Executable Error Modal:** Upon receiving `HasmMarkdownExecutableNotFound`, React MUST display an error modal ("hasm_markdown.exe application binary is missing.").
* **[REQ-05-FUNC-108] Process Spawn Execution:** Rust MUST execute `std::process::Command::new("hasm_markdown.exe").arg(target_dir_path).spawn()`.
* **[REQ-05-FUNC-109] Spawn Timeout Termination:** If the spawn operation exceeds **5,000ms**, Rust MUST abort the spawn attempt and reject IPC with `LaunchTimeout`.
* **[REQ-05-FUNC-110] Spawn Timeout Display:** Upon receiving `LaunchTimeout`, React MUST display an error modal ("Launching HASM Markdown App timed out.").
* **[REQ-05-FUNC-111] OS Spawn Error Handling:** If process spawn fails due to OS permission or system errors, Rust MUST reject IPC with `ProcessSpawnFailed`.
* **[REQ-05-FUNC-112] OS Spawn Error Display:** Upon receiving `ProcessSpawnFailed`, React MUST display an error toast ("Failed to launch hasm_markdown.exe process.").
* **[REQ-05-FUNC-113] Successful Spawn Payload Resolution:** Upon successful detached process spawn, Rust MUST resolve `LaunchExternalAppPayload`.
* **[REQ-05-FUNC-114] Launch Guidance Toast:** Upon resolution of `launch_external_markdown_app`, React MUST display an info toast ("Opened HASM Markdown App. Click 'Refresh Markdown' after saving.").
* **[REQ-05-FUNC-115] Multi-Instance Concurrency Support:** The launch command MUST allow spawning multiple independent instances of `hasm_markdown.exe` for distinct or identical directory paths without throwing concurrency locks in the main HASM process.