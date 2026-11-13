# EVAL-05: External Markdown App Invocation Test Specification

This document defines the comprehensive test matrix, acceptance criteria, and traceability mapping for validating the custom `hasm_markdown.exe` application invocation workflow, non-blocking process spawning, directory path parameter passing, spawn timeout execution, missing binary handling, and multi-instance launch capabilities (`SEQ-05` / `REQ-05`).

Tests are structured across three distinct test levels: **Desktop App Level (E2E / System Integration)**, **React Level (Frontend Component & Form State)**, and **Tauri Level (Rust Domain Engine & Process Command Contract)**.

Automated React and IPC coverage runs through `npm run test:eval-05`; Rust command-path coverage runs through `cargo test external_editor_commands` from `src-tauri`. The packaged binary is staged by `npm run build:markdown` before distribution builds.

## Automated Test Inventory

| Test IDs covered | Executable test file / command | CI job |
| --- | --- | --- |
| `TC-05-REACT-001` to `TC-05-REACT-005` | `test/seq05.test.jsx` via `npm run test:eval-05` | Frontend: EVAL-05 React and IPC tests |
| `TC-05-REACT-006` (all four entity types): rendered preview button -> real JS wrapper -> mocked native transport, asserting exact invoke name/payload | `test/seq05.test.jsx` via `npm run test:eval-05` | Frontend: EVAL-05 React and IPC tests |
| `TC-05-REACT-007`: document click and focused Enter/Space launch the existing editor without an inline Markdown form | `test/seq05.test.jsx` via `npm run test:eval-05` | Frontend: EVAL-05 React and IPC tests |
| `TC-05-REACT-008`: selecting document text or activating a hyperlink does not launch the external editor | `test/seq05.test.jsx` via `npm run test:eval-05` | Frontend: EVAL-05 React and IPC tests |
| `TC-05-REACT-009` exact error-surface message contract and `TC-05-REACT-010` no-guidance-on-failure check | `test/seq05.test.jsx` via `npm run test:eval-05` | Frontend: EVAL-05 React and IPC tests |
| SEQ-05 launch IPC argument contract | `test/eval-05-ipc.test.js` via `npm run test:eval-05` | Frontend: EVAL-05 React and IPC tests |
| `TC-05-RUST-001` to `TC-05-RUST-004` target-path, payload, and missing-resource checks | `src-tauri/src/hasm/external_editor_commands.rs` via `cargo test external_editor_commands` | Rust: EVAL-05 Rust external editor tests |
| `TC-05-RUST-007` to `TC-05-RUST-014` staging layout, entity-type request contract, spawn-error mapping within the 5,000ms bound, concurrent launch isolation, database non-interference, typed error-code, and payload shape checks | `src-tauri/src/hasm/external_editor_commands.rs` via `cargo test external_editor_commands` | Rust: EVAL-05 Rust external editor tests |
| Markdown binary build/staging contract | `npm run build:markdown` and `Test-Path src-tauri/binaries/hasm_markdown.exe` | Frontend: Build frontend |
| `TC-05-CLI-BOOTSTRAP-001`: real staged binary verifies and loads all PERSON / Life EXPERIENCE / birth FACT descriptions from a newly created model | `cargo test --manifest-path src-tauri/Cargo.toml --test model_initialization_ipc hasm_markdown_loads_every_new_model_description` | Local/integration validation with staged executable |
| `TC-05-CLI-CREATE-001`: real staged binary verifies/loads default descriptions for all four manually created entity types; registered commands persist selected EXPERIENCE relationships | `cargo test --manifest-path src-tauri/Cargo.toml --test model_initialization_ipc entity_creation_persists_selected_experiences_and_default_markdown` | Local/integration validation with staged executable |

`TC-05-RUST-005` timeout injection, `TC-05-RUST-006` database-handle monitoring, and live detached-process/multi-instance desktop rows are acceptance scenarios; CI intentionally does not launch desktop editor windows. `TC-05-RUST-011`/`TC-05-RUST-012` automate the file-level database non-interference checks (byte-identical, writable, deletable `hasm.db`) that complement the manual handle-pool monitoring.

The component-to-invoke tests do not assert that a desktop editor window
mounted the document. Native launch uses the folder contract and requires the
editor's `main.md`; `assets.json` is optional, so asset-free HASM entity folders
open with an empty manifest (editor tests `TC-MD-01-RUST-006`/`007`). Standalone
`.md` input is not supported.

The new-model CLI integration case runs the staged executable's `verify` and
`preview` commands for each generated entity folder without creating an
`assets.json`. It checks successful exit status, valid verification JSON with
no diagnostics, and preview output equal to the full persisted description.
Host `load_entity_detail` and a subsequent model reload are also checked through
registered Tauri invokes. This is actual headless binary loading, not proof that
an interactive editor window mounted/rendered the document. The test fails
explicitly when the staged executable is missing and bounds each child to
10 seconds.

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
| **TC-05-REACT-006** | `REQ-05-FUNC-101``REQ-05-DATA-001``REQ-05-FUNC-114` | Positive (Invoke Contract) | `test/seq05.test.jsx` — `TC-05-REACT-006 preview Edit button reaches the real invoke wrapper for %s` (PERSON / EXPERIENCE / FACT / LINK) | 1. Render the ticket with the real JS wrapper and mocked native transport.2. Click "Edit Markdown in HASM App", then the rendered preview. | 1. `invoke("launch_external_markdown_app", { modelRoot, entityType, entityId })` is called with the exact request keys for every entity type.2. Guidance toast renders after the payload resolves. |
| **TC-05-REACT-007** | `REQ-05-FUNC-101` | Positive (Launch Trigger) | `test/seq05.test.jsx` — `TC-05-REACT-007 clicking or keyboard-activating Markdown content launches the existing editor` | 1. Click the rendered Markdown content.2. Press Enter and Space on the focused preview. | 1. Each activation invokes `launchExternalMarkdownApp` with the current workspace, entity type, and entity ID.2. No inline Markdown form (textbox) appears. |
| **TC-05-REACT-008** | `REQ-05-FUNC-101` | Negative (Suppressed Trigger) | `test/seq05.test.jsx` — `TC-05-REACT-008 selecting text or activating document links does not launch the editor` | 1. Select preview text, then click the document.2. Activate a preview hyperlink. | 1. `launchExternalMarkdownApp` is never invoked.2. The hyperlink opens through the opener plugin instead. |
| **TC-05-REACT-009** | `REQ-05-FUNC-104``REQ-05-FUNC-107``REQ-05-FUNC-110``REQ-05-FUNC-112` | Positive (Error Surface Contract) | `test/seq05.test.jsx` — `TC-05-REACT-009 renders the exact translated message surface for every documented launch error code` | 1. For each documented launch error code, mock the IPC failure.2. Click "Edit Markdown in HASM App". | 1. Each code renders exactly its documented user-facing message ("Entity folder does not exist on disk.", "hasm_markdown.exe application binary is missing.", "Launching HASM Markdown App timed out.", "Failed to launch hasm_markdown.exe process.").2. The raw `ERR_*` code never leaks into the page. |
| **TC-05-REACT-010** | `REQ-05-FUNC-114` | Negative (No Guidance on Failure) | `test/seq05.test.jsx` — `TC-05-REACT-010 suppresses the refresh guidance toast when the launch invoke fails` | 1. Mock `launch_external_markdown_app` to reject.2. Click "Edit Markdown in HASM App". | 1. The info toast "Opened HASM Markdown App. Click 'Refresh Markdown' after saving." is NOT rendered.2. The launch button stays enabled and the page remains interactive. |

---

## 3. Tauri Level Tests (Rust Domain Engine & Process Command Contract)

These unit and integration tests verify IPC payload contracts, directory existence checks, binary path resolution, Command argument formatting, and 5,000ms spawn timeout enforcement using `cargo test`.

| Test ID | Trace Requirement ID | Test Type | Rust Module / Function | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-05-RUST-001** | `REQ-05-DATA-001``REQ-05-DATA-002``REQ-05-DATA-003` | Positive (Contract) | `commands::external_editor` | 1. Instantiate `LaunchExternalAppRequest`, `LaunchExternalAppPayload`, and `ExternalEditorError`.2. Serialize and deserialize JSON. | 1. All struct and enum fields serialize/deserialize with 100% type safety. |
| **TC-05-RUST-002** | `REQ-05-RULE-003``REQ-05-FUNC-102``REQ-05-FUNC-103``REQ-05-FUNC-108` | Positive (Command Args) | `launch_external_markdown_app` | 1. Target `entity_type = "FACT"`, `entity_id = UUID_A` with the directory present on disk.2. Invoke `launch_external_markdown_app`. | 1. Resolves path `{workspace}/FACT/{UUID_A}/` (existing-directory check passes without `EntityDirectoryNotFound`).2. Formats `Command::new("hasm_markdown.exe").arg("{workspace}/FACT/{UUID_A}/")` correctly. |
| **TC-05-RUST-003** | `REQ-05-FUNC-103` | Negative (Missing Folder) | `launch_external_markdown_app` | 1. Pass non-existent `entity_id`.2. Invoke command. | 1. Directory existence check fails.2. Rejects prior to spawn with `Err(EntityDirectoryNotFound)`. |
| **TC-05-RUST-004** | `REQ-05-RULE-001``REQ-05-RULE-006``REQ-05-FUNC-105``REQ-05-FUNC-106` | Negative (Missing Binary) | `launch_external_markdown_app` | 1. Mock bin directory without the staged `binaries/hasm_markdown.exe`.2. Invoke command. | 1. Executable path check fails.2. Rejects with `Err(HasmMarkdownExecutableNotFound)`. |
| **TC-05-RUST-005** | `REQ-05-RULE-005``REQ-05-FUNC-109` | Performance (Timeout) | `launch_external_markdown_app` | 1. Inject mock process spawn block exceeding 5,000ms.2. Invoke command. | 1. Spawn operation aborts at 5,000ms.2. Rejects with `Err(LaunchTimeout { timeout_ms: 5000 })`. |
| **TC-05-RUST-006** | `REQ-05-RULE-004` | Isolation (DB Access) | `launch_external_markdown_app` | 1. Monitor SQLite database handle pool during `launch_external_markdown_app` execution. | 1. Zero database read/write queries or locks are executed against `hasm.db`. |
| **TC-05-RUST-007** | `REQ-05-RULE-001``REQ-05-RULE-006``REQ-05-FUNC-105``REQ-05-FUNC-106` | Positive (Staging Layout) | `external_editor_commands::tests::tc_05_rust_007_resolves_staged_markdown_executable_from_binaries_layout` (`cargo test external_editor_commands`) | 1. Stage a stub binary at `{resource_dir}/binaries/hasm_markdown.exe`.2. Call `executable_from_resource_dir`. | 1. Resolution succeeds with the staged path and no `HasmMarkdownExecutableNotFound`.2. The resolved file name is exactly the dedicated `hasm_markdown.exe` submodule executable. |
| **TC-05-RUST-008** | `REQ-05-RULE-003``REQ-05-FUNC-102``REQ-05-DATA-001` | Negative (Invalid Entity Type) | `external_editor_commands::tests::tc_05_rust_008_rejects_unsupported_entity_type_before_path_resolution` (`cargo test external_editor_commands`) | 1. Call `entity_directory` with `NOTE`, lowercase `fact`, and traversal-style types while a matching folder exists on disk. | 1. Every entity type outside the `LaunchExternalAppRequest` PERSON/EXPERIENCE/FACT/LINK contract rejects with `ERR_ENTITY_DIRECTORY_NOT_FOUND` before any target path is produced. |
| **TC-05-RUST-009** | `REQ-05-RULE-002``REQ-05-RULE-005``REQ-05-FUNC-109``REQ-05-FUNC-111` | Positive (Spawn Resolution Within 5,000ms Bound) | `external_editor_commands::tests::tc_05_rust_009_spawn_failure_maps_to_process_spawn_failed_within_bound` (`cargo test external_editor_commands`) | 1. Call `launch_detached` with a missing executable path and an existing target directory.2. Measure elapsed time. | 1. The call returns well inside the 5,000ms bound without blocking the caller.2. The error is `ERR_PROCESS_SPAWN_FAILED`, not the 5,000ms expiry error, proving the watchdog lets completed spawns through. |
| **TC-05-RUST-010** | `REQ-05-RULE-002``REQ-05-FUNC-108``REQ-05-FUNC-115` | Negative (Concurrency) | `external_editor_commands::tests::tc_05_rust_010_concurrent_launch_failures_resolve_independently` (`cargo test external_editor_commands`) | 1. Call `launch_detached` from four threads against identical and distinct target directories with a missing executable. | 1. All attempts resolve independently with `ERR_PROCESS_SPAWN_FAILED`.2. No lock, serialization, or hang occurs in the main process (total time < 5,000ms). |
| **TC-05-RUST-011** | `REQ-05-RULE-004` | Positive (DB Isolation) | `external_editor_commands::tests::tc_05_rust_011_target_resolution_leaves_database_untouched` (`cargo test external_editor_commands`) | 1. Place `hasm.db` with known bytes next to the entity folders.2. Resolve the launch target directory. | 1. `hasm.db` stays byte-identical.2. The file opens for writing and deletes immediately afterwards, so the launch path holds no handle or lock. |
| **TC-05-RUST-012** | `REQ-05-RULE-004` | Negative (Fault Isolation) | `external_editor_commands::tests::tc_05_rust_012_failed_spawn_leaves_database_unlocked_and_unmodified` (`cargo test external_editor_commands`) | 1. Place `hasm.db` with known bytes in the workspace.2. Run a launch attempt that fails on a missing executable. | 1. Even the failing spawn performs zero reads/writes/locks: `hasm.db` stays byte-identical, writable, and deletable. |
| **TC-05-RUST-013** | `REQ-05-DATA-003``REQ-05-FUNC-113` | Negative (Typed Error Code) | `external_editor_commands::tests::tc_05_rust_013_failure_paths_use_typed_error_codes_without_payload` (`cargo test external_editor_commands`) | 1. Drive the missing-directory, missing-executable, and spawn-failure paths. | 1. Every failure resolves no `LaunchExternalAppPayload` and carries exactly one documented `ExternalEditorError` code (`ERR_ENTITY_DIRECTORY_NOT_FOUND`, `ERR_MARKDOWN_EXECUTABLE_NOT_FOUND`, `ERR_LAUNCH_TIMEOUT`, or `ERR_PROCESS_SPAWN_FAILED`). |
| **TC-05-RUST-014** | `REQ-05-DATA-002` | Negative (Payload Shape) | `external_editor_commands::tests::tc_05_rust_014_rejects_malformed_launch_payload_shapes` (`cargo test external_editor_commands`) | 1. Deserialize `LaunchExternalAppPayload` from JSON missing `executablePath`, from snake_case keys, and from a non-object value. | 1. Every malformed shape fails deserialization, enforcing the camelCase response contract. |