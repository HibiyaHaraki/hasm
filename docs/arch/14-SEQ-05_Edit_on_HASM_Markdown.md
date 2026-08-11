# SEQ-05: External Markdown App Invocation (Detailed Architecture Specification)

This document provides the detailed architectural specification for invoking the custom `hasm_markdown.exe` desktop application targeting an entity's UUID directory path directly from an Entity Detail Page (`3. Entity Detail Pages`).

* **Diagram Location:** `4. Common Actions` (`CommonActions`)
* **Key Tauri Function:** `launch_external_markdown_app`
* **Description:** Demonstrates resolving an entity's directory path, spawning the dedicated `hasm_markdown.exe` application as a detached child process without locking the HASM UI, enforcing a strict 5,000ms process spawn timeout, and providing user feedback instructing them to use the "Refresh Markdown" action (`SEQ-04` Chapter 5) after completing external edits.

---

## 1. Data Contracts & Time Constraints

### 1.1 IPC Data Definitions (Rust / TypeScript Interface)

```rust
// Payload for launch_external_markdown_app command
#[derive(Debug, Serialize, Deserialize)]
pub struct LaunchExternalAppRequest {
    pub entity_type: String, // "PERSON" | "EXPERIENCE" | "FACT" | "LINK"
    pub entity_id: Uuid,
}

// Response payload for launch_external_markdown_app command
#[derive(Debug, Serialize, Deserialize)]
pub struct LaunchExternalAppPayload {
    pub target_dir_path: String,
    pub executable_path: String, // Path to hasm_markdown.exe
}

// Error Enum returned to Frontend
#[derive(Debug, Serialize, Deserialize)]
pub enum ExternalEditorError {
    EntityDirectoryNotFound { path: String },
    HasmMarkdownExecutableNotFound { path: String }, // hasm_markdown.exe binary missing
    LaunchTimeout { timeout_ms: u64 },
    ProcessSpawnFailed { message: String },
}

```

### 1.2 Time Constraints Policy Matrix

| Operation | Timeout Rule | Timeout Value | Timeout Action & Handling |
| --- | --- | --- | --- |
| **Process Spawn & Detach** (`launch_external_markdown_app`) | Fixed Hard Timeout | **5,000 ms** | Terminate spawn attempt; return `ERR_LAUNCH_TIMEOUT`; display Error Modal to user. |

---

## 2. Sequence Architecture Chapters

### Participant Lifecycle Legend

* **User**: End user interacting with the Entity Detail Ticket UI.
* **React**: `EntityDetailPage.tsx` (JIRA Task Ticket Interface State Manager).
* **Bridge**: `Tauri IPC Bridge / invoke()`.
* **Rust**: `external_editor.rs` in Rust backend.
* **HasmApp**: Dedicated `hasm_markdown.exe` application process.
* **FS**: Local File System (Entity UUID Directory / Binary Path).

---

### Chapter 1: Launch HASM Markdown application

Triggered when the user clicks the **"Edit Markdown in HASM App"** button on any Entity Detail Page (`3.1` ~ `3.4`). Rust resolves the target Entity UUID directory path, verifies that `hasm_markdown.exe` exists, and spawns it as a detached child process.

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant React as React (EntityDetailPage.tsx)
    participant Bridge as Tauri IPC Bridge
    participant Rust as Rust Command (external_editor.rs)
    participant HasmApp as Submodule App (hasm_markdown.exe)
    participant FS as File System (Entity Directory / Binary)

    Note over User,FS: Pre-condition: User is viewing an Entity Detail Page and clicks "Edit Markdown in HASM App".

    User->>React: Click "Edit Markdown in HASM App" Button
    
    React->>Bridge: invoke('launch_external_markdown_app', { entityType, entityId })
    Bridge->>Rust: IPC: launch_external_markdown_app(entityType, entityId)

    rect rgb(15, 23, 42)
        Note over Rust,FS: 1. Resolve Entity Directory & Executable Path
        Rust->>FS: Resolve Directory Path: {workspace}/{entityType}/{entityId}/
        
        alt Target Entity Directory Missing on Disk
            FS-->>Rust: Directory Not Found
            Rust-->>Bridge: Return Err(EntityDirectoryNotFound)
            Bridge-->>React: Reject Promise
            React->>User: Display Toast Error ("Entity folder does not exist on disk.")
        end

        Rust->>FS: Resolve hasm_markdown.exe Binary Path
        
        alt hasm_markdown.exe Binary Missing
            FS-->>Rust: Executable Not Found
            Rust-->>Bridge: Return Err(HasmMarkdownExecutableNotFound)
            Bridge-->>React: Reject Promise
            React->>User: Display Error Modal ("hasm_markdown.exe application binary is missing.")
        end

        Note over Rust,HasmApp: 2. Process Spawn Execution with 5,000ms Timeout
        
        break On Process Spawn Timeout (> 5,000ms Execution)
            Rust-->>Bridge: Return Err(LaunchTimeout { timeout_ms: 5000 })
            Bridge-->>React: Reject Promise
            React->>User: Display Error Modal ("Launching HASM Markdown App timed out.")
        end

        Rust->>HasmApp: Command::new("hasm_markdown.exe").arg(target_dir_path).spawn()

        alt Process Spawn Failed (Permission / System Error)
            HasmApp-->>Rust: OS Error (PermissionDenied / General Failure)
            Rust-->>Bridge: Return Err(ProcessSpawnFailed)
            Bridge-->>React: Reject Promise
            React->>User: Display Toast Error ("Failed to launch hasm_markdown.exe process.")
        else Process Spawn Succeeded
            HasmApp-->>User: Open HASM Markdown App Window targeting Entity Directory
            Rust-->>Bridge: Return Ok(LaunchExternalAppPayload)
            Bridge-->>React: Resolve Promise
            React->>User: Display Info Toast ("Opened HASM Markdown App. Click 'Refresh Markdown' after saving.")
            Note over React,User: User edits in HASM Markdown App and manually clicks 'Refresh Markdown' (SEQ-04 Chapter 5) when done.
        end
    end