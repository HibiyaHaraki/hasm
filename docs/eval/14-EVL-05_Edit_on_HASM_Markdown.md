# EVAL-05: External Markdown App Invocation Test Specification

This document defines the comprehensive test matrix, acceptance criteria, and traceability mapping for validating the custom `hasm_markdown.exe` application invocation workflow, non-blocking process spawning, directory path parameter passing, spawn timeout execution, missing binary handling, and multi-instance launch capabilities (`SEQ-05` / `REQ-05`).

Tests are structured across three distinct test levels: **Desktop App Level (E2E / System Integration)**, **React Level (Frontend Component & Form State)**, and **Tauri Level (Rust Domain Engine & Process Command Contract)**.

---

## 1. Desktop App Level Tests (E2E / System Integration)

These integration tests verify end-to-end user flows for launching `hasm_markdown.exe` from any Entity Detail Ticket Page, verifying process detachment, toast notification rendering, and multi-instance concurrency.

| Test ID | Trace Requirement ID | Test Type | Test Scenario | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-05-E2E-001** | `REQ-05-RULE-001``REQ-05-RULE-002``REQ-05-RULE-003``REQ-05-FUNC-101``REQ-05-FUNC-113``REQ-05-FUNC-114` | Positive (Normal) | Launch `hasm_markdown.exe` from Entity Detail Ticket | 1. Open any Entity Detail Ticket (`/entity-detail/:entity_type/:entity_id`).2. Click "Edit Markdown in HASM App" button. | 1. IPC `launch_external_markdown_app` is invoked.2. `hasm_markdown.exe` process launches detached with target directory path argument.3. HASM main window remains completely interactive.4. Info toast displays ("Opened HASM Markdown App. Click 'Refresh Markdown' after saving."). |
| **TC-05-E2E-002** | `REQ-05-FUNC-115` | Positive (Concurrency) | Spawn Multiple Instances of `hasm_markdown.exe` | 1. Click "Edit Markdown in HASM App" on `FACT A`.2. Click "Edit Markdown in HASM App" on `EXPERIENCE B`. | 1. Two separate `hasm_markdown.exe` OS processes spawn independently.2. No process lock or IPC hang occurs in the main HASM application. |
| **TC-05-E2E-003** | `REQ-05-FUNC-106``REQ-05-FUNC-107` | Negative (Missing Binary) | Attempt Launch with Missing `hasm_markdown.exe` Binary | 1. Delete or rename `hasm_markdown.exe` in the runtime bin directory.2. Click "Edit Markdown in HASM App" button. | 1. IPC rejects with `HasmMarkdownExecutableNotFound`.2. Error modal displays ("hasm_markdown.exe application binary is missing."). |

---

## 2. React Level Tests (Frontend Component & Form State)

These unit and component tests focus on `EntityDetailPage.tsx` button triggers, promise handling, and user feedback rendering (info toasts, error toasts, and error modal dialogs).

| Test ID | Trace Requirement ID | Test Type | Component / Target | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-05-REACT-001** | `REQ-05-FUNC-101``REQ-05-FUNC-114` | Positive (UI Feedback) | `EntityDetailPage.tsx` | 1. Click "Edit Markdown in HASM App".2. Mock `launch_external_markdown_app` to resolve `LaunchExternalAppPayload`. | 1. Info toast renders with text: "Opened HASM Markdown App. Click 'Refresh Markdown' after saving." |
| **TC-05-REACT-002** | `REQ-05-FUNC-103``REQ-05-FUNC-104` | Negative (Error Toast) | `EntityDetailPage.tsx` | 1. Click "Edit Markdown in HASM App".2. Mock IPC reject with `EntityDirectoryNotFound`. | 1. Error toast renders informing user that entity folder does not exist on disk. |
| **TC-05-REACT-003** | `REQ-05-FUNC-106``REQ-05-FUNC-107` | Negative (Error Modal) | `EntityDetailPage.tsx` | 1. Click "Edit Markdown in HASM App".2. Mock IPC reject with `HasmMarkdownExecutableNotFound`. | 1. Error modal renders detailing missing `hasm_markdown.exe` binary. |
| **TC-05-REACT-004** | `REQ-05-FUNC-109``REQ-05-FUNC-110` | Negative (Error Modal) | `EntityDetailPage.tsx` | 1. Click "Edit Markdown in HASM App".2. Mock IPC reject with `LaunchTimeout`. | 1. Error modal renders informing user that launch attempt timed out. |
| **TC-05-REACT-005** | `REQ-05-FUNC-111``REQ-05-FUNC-112` | Negative (Error Toast) | `EntityDetailPage.tsx` | 1. Click "Edit Markdown in HASM App".2. Mock IPC reject with `ProcessSpawnFailed`. | 1. Error toast renders displaying OS process spawn failure message. |

---

## 3. Tauri Level Tests (Rust Domain Engine & Process Command Contract)

These unit and integration tests verify IPC payload contracts, directory existence checks, binary path resolution, Command argument formatting, and 5,000ms spawn timeout enforcement using `cargo test`.

| Test ID | Trace Requirement ID | Test Type | Rust Module / Function | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-05-RUST-001** | `REQ-05-DATA-001``REQ-05-DATA-002``REQ-05-DATA-003` | Positive (Contract) | `commands::external_editor` | 1. Instantiate `LaunchExternalAppRequest`, `LaunchExternalAppPayload`, and `ExternalEditorError`.2. Serialize and deserialize JSON. | 1. All struct and enum fields serialize/deserialize with 100% type safety. |
| **TC-05-RUST-002** | `REQ-05-RULE-003``REQ-05-FUNC-102``REQ-05-FUNC-108` | Positive (Command Args) | `launch_external_markdown_app` | 1. Target `entity_type = "FACT"`, `entity_id = UUID_A`.2. Invoke `launch_external_markdown_app`. | 1. Resolves path `{workspace}/FACT/{UUID_A}/`.2. Formats `Command::new("hasm_markdown.exe").arg("{workspace}/FACT/{UUID_A}/")` correctly. |
| **TC-05-RUST-003** | `REQ-05-FUNC-103` | Negative (Missing Folder) | `launch_external_markdown_app` | 1. Pass non-existent `entity_id`.2. Invoke command. | 1. Directory existence check fails.2. Rejects prior to spawn with `Err(EntityDirectoryNotFound)`. |
| **TC-05-RUST-004** | `REQ-05-RULE-001``REQ-05-FUNC-105``REQ-05-FUNC-106` | Negative (Missing Binary) | `launch_external_markdown_app` | 1. Mock bin directory without `hasm_markdown.exe`.2. Invoke command. | 1. Executable path check fails.2. Rejects with `Err(HasmMarkdownExecutableNotFound)`. |
| **TC-05-RUST-005** | `REQ-05-RULE-005``REQ-05-FUNC-109` | Performance (Timeout) | `launch_external_markdown_app` | 1. Inject mock process spawn block exceeding 5,000ms.2. Invoke command. | 1. Spawn operation aborts at 5,000ms.2. Rejects with `Err(LaunchTimeout { timeout_ms: 5000 })`. |
| **TC-05-RUST-006** | `REQ-05-RULE-004` | Isolation (DB Access) | `launch_external_markdown_app` | 1. Monitor SQLite database handle pool during `launch_external_markdown_app` execution. | 1. Zero database read/write queries or locks are executed against `hasm.db`. |