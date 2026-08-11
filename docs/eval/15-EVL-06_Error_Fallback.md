# EVAL-06: Error Fallback & Recovery Flow Test Specification

This document defines the comprehensive test matrix, acceptance criteria, and traceability mapping for validating error recovery navigation paths, error context rendering with appended verification cause lists, path-retaining app reboots, automatic missing folder repairs, retry re-verification loops, and safe fallback routing across all application failure states (`SEQ-06` / `REQ-06`).

Tests are structured across three distinct test levels: **Desktop App Level (E2E / System Integration)**, **React Level (Frontend Component & Router State)**, and **Tauri Level (Rust Domain Engine, Reboot & Repair Commands)**.

---

## 1. Desktop App Level Tests (E2E / System Integration)

These integration tests verify end-to-end user recovery flows when navigating to error screens (`/error-app`, `/error-model`, `/error-markdown`), invoking path-retaining app reboots, auto-repairing missing directory structures, retrying validations, and safely returning to operational views.

| Test ID | Trace Requirement ID | Test Type | Test Scenario | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-06-E2E-001** | `REQ-06-RULE-001``REQ-06-FUNC-101``REQ-06-FUNC-102``REQ-06-FUNC-104` | Positive (App Recovery) | Retry App Validation from `/error-app` Screen | 1. Trigger `SEQ-01` failure to enter `/error-app`.2. Fix system environment (e.g., place binary).3. Click "Retry Validation" button. | 1. React sets `isRetrying = true` and re-invokes `validate_hasm_app`.2. Upon validation success, React Router navigates safely to `/select`. |
| **TC-06-E2E-002** | `REQ-06-RULE-003``REQ-06-FUNC-105` | Positive (App Reboot) | Reboot App with Retained Model Path | 1. Navigate to `/error-app` with `retained_model_path = "/path/to/my.hasm"`.2. Click "Reboot Application" button. | 1. Current app instance terminates cleanly.2. New desktop process launches with `--path /path/to/my.hasm` CLI argument. |
| **TC-06-E2E-003** | `REQ-06-RULE-002``REQ-06-RULE-004``REQ-06-FUNC-201``REQ-06-FUNC-203``REQ-06-FUNC-204` | Positive (Folder Repair) | Display Appended Error Details & Auto-Create Missing Folders | 1. Enter `/error-model` due to missing `FACT/{UUID}` directory.2. Verify error list displays missing UUID.3. Click "Create Missing Folders" button.4. Click "Retry Loading Model". | 1. `ErrorModelPage.tsx` displays appended missing folder list.2. `repair_missing_entity_folders` creates target UUID directory, `main.md`, and `assets/`.3. Info toast displays ("Missing folders created successfully").4. Clicking "Retry Loading Model" successfully loads the workspace (`SEQ-02`). |
| **TC-06-E2E-004** | `REQ-06-FUNC-301``REQ-06-FUNC-302``REQ-06-FUNC-304``REQ-06-FUNC-306` | Positive (Markdown Repair) | Fix in HASM Markdown App & Retry from `/error-markdown` | 1. Enter `/error-markdown` due to syntax error.2. Click "Fix in HASM Markdown App".3. Edit and save file in spawned `hasm_markdown.exe`.4. Click "Retry Validation". | 1. `hasm_markdown.exe` spawns targeted at entity folder (`SEQ-05`).2. Clicking "Retry Validation" invokes `reload_entity_markdown`.3. Upon success, React Router navigates back to `/entity-detail/:entity_type/:entity_id`. |
| **TC-06-E2E-005** | `REQ-06-FUNC-307` | Positive (Safe Exit) | Fallback Navigation to Visualizer | 1. Enter `/error-markdown`.2. Click "Back to Visualizer" button. | 1. React Router navigates safely to `/visualizer` without throwing component or routing exceptions. |

---

## 2. React Level Tests (Frontend Component & Form State)

These unit and component tests focus on `ErrorAppPage.tsx`, `ErrorModelPage.tsx`, `ErrorMarkdownPage.tsx`, rendering appended error arrays (`missing_entities`, `domain_validation_errors`, `stderr_output`), button loading flags (`isRetrying`, `isRepairing`), and toast notifications.

| Test ID | Trace Requirement ID | Test Type | Component / Target | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-06-REACT-001** | `REQ-06-RULE-002``REQ-06-FUNC-101` | Positive (Context UI) | `ErrorAppPage.tsx` | 1. Render component with `AppErrorContext` props containing `retained_model_path`. | 1. Displays error code, failure message, failed component name, and retained model path accurately. |
| **TC-06-REACT-002** | `REQ-06-FUNC-103` | Negative (Retry Fail) | `ErrorAppPage.tsx` | 1. Click "Retry Validation".2. Mock `validate_hasm_app` reject. | 1. `isRetrying` resets to `false`.2. Error toast displays informing user that system validation failed again. |
| **TC-06-REACT-003** | `REQ-06-RULE-002``REQ-06-FUNC-201``REQ-06-FUNC-202` | Positive (Appended Details) | `ErrorModelPage.tsx` | 1. Render page with `ModelErrorContext` containing non-empty `missing_entities` and `domain_validation_errors`. | 1. Renders formatted list of missing UUID folders and domain rule violation messages.2. "Create Missing Folders" button is visible. |
| **TC-06-REACT-004** | `REQ-06-FUNC-204` | Positive (Repair Toast) | `ErrorModelPage.tsx` | 1. Click "Create Missing Folders".2. Mock `repair_missing_entity_folders` resolve. | 1. `isRepairing` resets to `false`.2. Info toast displays: "Missing folders created successfully. Click 'Retry Loading'." |
| **TC-06-REACT-005** | `REQ-06-FUNC-206` | Positive (Select Fallback) | `ErrorModelPage.tsx` | 1. Click "Select Another Model". | 1. React Router navigates directly to `/select`. |
| **TC-06-REACT-006** | `REQ-06-RULE-002``REQ-06-FUNC-301` | Positive (Parser Stderr) | `ErrorMarkdownPage.tsx` | 1. Render component with `MarkdownErrorContext` including `stderr_output`. | 1. Renders syntax error code and formatted parser `stderr_output` in code block view. |
| **TC-06-REACT-007** | `REQ-06-FUNC-305` | Negative (Retry Fail) | `ErrorMarkdownPage.tsx` | 1. Click "Retry Validation".2. Mock `reload_entity_markdown` reject. | 1. `isRetrying` resets to `false`.2. Error toast displays: "Syntax error persists in main.md." |

---

## 3. Tauri Level Tests (Rust Domain Engine, Reboot & Repair Commands)

These unit and integration tests verify IPC error context payloads, process reboot execution (`reboot_app` with `--path`), folder structure repair (`repair_missing_entity_folders`), re-verification command behaviors (`validate_hasm_app`, `reload_entity_markdown`), and desktop termination triggers (`exit_app`) using `cargo test`.

| Test ID | Trace Requirement ID | Test Type | Rust Module / Function | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-06-RUST-001** | `REQ-06-DATA-001``REQ-06-DATA-002``REQ-06-DATA-003` | Positive (Contract) | `models::error_context` | 1. Instantiate `AppErrorContext`, `ModelErrorContext`, and `RepairMissingFoldersRequest`.2. Serialize and deserialize JSON. | 1. All error context fields and appended detail arrays serialize/deserialize with 100% type safety. |
| **TC-06-RUST-002** | `REQ-06-RULE-003``REQ-06-FUNC-105` | Positive (App Reboot) | `reboot_app` | 1. Invoke `reboot_app` passing `retainPath = Some("/path/to/my.hasm")`. | 1. Command spawns new executable process with `--path /path/to/my.hasm` argument.2. Terminates current process cleanly. |
| **TC-06-RUST-003** | `REQ-06-RULE-004``REQ-06-FUNC-203` | Positive (Folder Repair) | `repair_missing_entity_folders` | 1. Provide temporary workspace path with missing `FACT/{UUID}` folder.2. Invoke `repair_missing_entity_folders`. | 1. Creates directory `FACT/{UUID}/`.2. Writes default `main.md` template and creates `assets/` directory.3. Returns `Ok(RepairResult { created_count: 1 })`. |
| **TC-06-RUST-004** | `REQ-06-FUNC-102``REQ-06-RULE-005` | Positive (Re-validation) | `validate_hasm_app` | 1. Invoke `validate_hasm_app` in retry state. | 1. Re-executes system binary and dependency checks cleanly without state side-effects. |
| **TC-06-RUST-005** | `REQ-06-FUNC-304``REQ-06-RULE-005` | Positive (Markdown Re-check) | `reload_entity_markdown` | 1. Fix syntax in `main.md`.2. Invoke `reload_entity_markdown` from error state. | 1. Re-runs `hasm_markdown.exe` verification.2. Returns `Ok(ReloadMarkdownPayload)` with fresh content and new `mtime`. |
| **TC-06-RUST-006** | `REQ-06-FUNC-106` | Positive (App Exit) | `exit_app` | 1. Invoke `exit_app` command. | 1. Desktop process terminates cleanly with exit code `0`. |