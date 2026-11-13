# EVAL-06: Error Fallback & Recovery Flow Test Specification

This document defines the comprehensive test matrix, acceptance criteria, and traceability mapping for validating error recovery navigation paths, error context rendering with appended verification cause lists, path-retaining app reboots, automatic missing folder repairs, retry re-verification loops, and safe fallback routing across all application failure states (`SEQ-06` / `REQ-06`).

Tests are structured across three distinct test levels: **Desktop App Level (E2E / System Integration)**, **React Level (Frontend Component & Router State)**, and **Tauri Level (Rust Domain Engine, Reboot & Repair Commands)**.

Automated regression coverage for this sequence lives in two suites (see section 4):

- React level: `test/seq06.test.jsx`, executed with `npm run test:eval-06`.
- Rust level: `src-tauri/tests/eval06_error_recovery_ipc.rs`, executed with `cargo test --test eval06_error_recovery_ipc` (from `src-tauri/`).

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

---

## 4. Automated Regression Test Cases

The automated cases below verify the error fallback and recovery behavior that is implemented today. Where the full specified behavior (for example a dedicated reboot command or an in-page folder repair button) is still delivered through the manual rows above, the automated case pins the currently implemented portion of the requirement: fallback routing, preserved error context, path retention through the retry/re-boot validation cycle, non-destructive folder scaffolding, re-verification gating, and clean lock release on exit.

### 4.1 React Level (automated, `test/seq06.test.jsx`, run with `npm run test:eval-06`)

Each test name in the suite starts with its Test ID.

| Test ID | Trace Requirement ID | Test Type | Automated Target | Test Scenario | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-06-REACT-008** | `REQ-06-RULE-001``REQ-06-RULE-002``REQ-06-FUNC-101` | Positive (App Context) | `test/seq06.test.jsx` — "TC-06-REACT-008 renders the preserved app error context from router state" | Render `/error-app` with an error message in router state. | Alert landmark, failure heading, the preserved error text, and an enabled Retry control are rendered. |
| **TC-06-REACT-009** | `REQ-06-RULE-001``REQ-06-RULE-002``REQ-06-DATA-001``REQ-06-FUNC-101` | Negative (Missing Context) | `test/seq06.test.jsx` — "TC-06-REACT-009 falls back to a defined default message when the error context payload is missing" | Render `/error-app` with no router state (absent error context payload). | Screen renders a defined default message without crashing; Retry stays available. |
| **TC-06-REACT-010** | `REQ-06-RULE-001``REQ-06-FUNC-102``REQ-06-FUNC-104` | Positive (Retry Success) | `test/seq06.test.jsx` — "TC-06-REACT-010 retry re-invokes app validation and navigates to /select on success" | Click Retry on `/error-app`; app validation now succeeds. | Validation commands are re-invoked exactly once and the router lands on `/select`. |
| **TC-06-REACT-011** | `REQ-06-RULE-003``REQ-06-FUNC-102``REQ-06-FUNC-105` | Positive (Path Retention) | `test/seq06.test.jsx` — "TC-06-REACT-011 retry retains the CLI workspace path and reboots into /loading-model" | Retry while the launch inspection reports a retained workspace path. | The retained path is re-validated and forwarded in router state to `/loading-model`. |
| **TC-06-REACT-012** | `REQ-06-RULE-003``REQ-06-FUNC-105` | Negative (Stale Retained Path) | `test/seq06.test.jsx` — "TC-06-REACT-012 an invalid retained workspace path is not reused blindly and falls back to /select" | Retry while the retained workspace path no longer validates. | The stale path is rejected and the router falls back to `/select` instead of `/loading-model`. |
| **TC-06-REACT-013** | `REQ-06-RULE-002``REQ-06-FUNC-103` | Positive (Retry Failure Display) | `test/seq06.test.jsx` — "TC-06-REACT-013 a failed retry updates the error display with the new failure cause" | Retry while validation still fails with a new cause. | `/error-app` is re-entered with the updated failure message displayed and Retry re-enabled. |
| **TC-06-REACT-014** | `REQ-06-RULE-001``REQ-06-FUNC-102``REQ-06-FUNC-104` | Negative (Repeated Retry Fault) | `test/seq06.test.jsx` — "TC-06-REACT-014 repeated retry failures never reach /select and keep the error screen operable" | Click Retry twice while validation keeps failing. | Validation is re-invoked per attempt, navigation to `/select` never happens, and the error screen stays in a defined operable state. |
| **TC-06-REACT-015** | `REQ-06-RULE-002``REQ-06-FUNC-201` | Positive (Model Context) | `test/seq06.test.jsx` — "TC-06-REACT-015 renders the preserved workspace failure cause from router state" | Render `/error-model` with a storage failure cause in router state. | Failure heading, preserved cause text (including the missing storage path), and the workspace reselect control are rendered. |
| **TC-06-REACT-016** | `REQ-06-RULE-001``REQ-06-RULE-002``REQ-06-FUNC-201``REQ-06-FUNC-202``REQ-06-FUNC-206` | Negative (Missing Model Context) | `test/seq06.test.jsx` — "TC-06-REACT-016 missing model error context renders the default message, offers no repair action, and still exits safely" | Render `/error-model` with no router state. | Default message is shown without crashing, no folder-repair control is offered without appended missing-entity context, and the reselect action still navigates to `/select`. |
| **TC-06-REACT-017** | `REQ-06-RULE-005``REQ-06-FUNC-205``REQ-06-FUNC-206` | Positive (Reselect Retry) | `test/seq06.test.jsx` — "TC-06-REACT-017 reselecting a workspace re-validates the path and retries loading through /loading-model" | From `/error-model`, choose a workspace, enter a path that validates, and open it. | Path validation runs before the retry and the router re-enters `/loading-model` to re-trigger the model load. |
| **TC-06-REACT-018** | `REQ-06-RULE-005``REQ-06-FUNC-205` | Negative (Blocked Retry) | `test/seq06.test.jsx` — "TC-06-REACT-018 a workspace that fails re-validation blocks the model load retry" | From `/error-model`, choose a workspace and enter a path that fails validation. | The invalid-folder warning is shown, Open stays disabled, and the model load retry cannot start. |
| **TC-06-REACT-019** | `REQ-06-RULE-001``REQ-06-RULE-002``REQ-06-DATA-004``REQ-06-FUNC-301` | Negative (Markdown Fault Routing) | `test/seq06.test.jsx` — "TC-06-REACT-019 a Markdown verification fault routes to /error-markdown carrying the parser error context" | Entity ticket load rejects with a Markdown verification error code. | The router navigates to `/error-markdown` with the full error code and cause preserved in router state. |
| **TC-06-REACT-020** | `REQ-06-FUNC-302``REQ-06-FUNC-303` | Positive (External Repair) | `test/seq06.test.jsx` — "TC-06-REACT-020 Fix in HASM Markdown App launches the external editor and shows retry guidance" | Click the external Markdown edit action on the ticket. | The external editor command is invoked for the entity directory and the edit/save/refresh guidance toast is displayed. |
| **TC-06-REACT-021** | `REQ-06-FUNC-302``REQ-06-FUNC-303` | Negative (Launch Fault) | `test/seq06.test.jsx` — "TC-06-REACT-021 a failed external editor launch shows the failure cause instead of repair guidance" | The external editor launch rejects with a spawn failure code. | The documented launch failure message is shown and no repair guidance toast appears. |
| **TC-06-REACT-022** | `REQ-06-RULE-005``REQ-06-FUNC-204``REQ-06-FUNC-304``REQ-06-FUNC-306` | Positive (Re-verification Success) | `test/seq06.test.jsx` — "TC-06-REACT-022 a successful re-verification refreshes the ticket and confirms the repair" | Click Refresh Markdown; the reload command resolves with repaired content. | Re-verification runs first, the refreshed Markdown is rendered, the completion feedback message appears, and the user stays on the operational ticket view. |
| **TC-06-REACT-023** | `REQ-06-FUNC-305` | Positive (Failure Feedback) | `test/seq06.test.jsx` — "TC-06-REACT-023 a persistent non-fatal refresh failure resets the retry control and reports the cause" | Refresh fails again with a non-fatal cause. | The retrying flag resets (Refresh is enabled again) and the persisting failure cause is displayed on the ticket. |
| **TC-06-REACT-024** | `REQ-06-RULE-005``REQ-06-FUNC-204``REQ-06-FUNC-304``REQ-06-FUNC-306` | Negative (Fatal Refresh Fault) | `test/seq06.test.jsx` — "TC-06-REACT-024 a fatal Markdown refresh fault routes to /error-markdown and never fakes a repaired state" | Refresh fails with a fatal Markdown file error code. | The router leaves the ticket for `/error-markdown` with the cause preserved; no success/completion feedback is ever shown. |
| **TC-06-REACT-025** | `REQ-06-FUNC-307` | Positive (Visualizer Return) | `test/seq06.test.jsx` — "TC-06-REACT-025 Back to Visualizer returns a verified workspace to /visualizer" | Click Back to Visualizer with a verified workspace in router state. | The router navigates safely to `/visualizer`. |
| **TC-06-REACT-026** | `REQ-06-RULE-005``REQ-06-FUNC-307` | Negative (Unverified Guard) | `test/seq06.test.jsx` — "TC-06-REACT-026 Back to Visualizer with an unverified workspace is gated through /loading-model re-verification" | Click Back to Visualizer while the workspace is marked unverified. | The protected route withholds `/visualizer` and redirects through `/loading-model` re-verification with the workspace path retained. |

### 4.2 Tauri Level (automated, `src-tauri/tests/eval06_error_recovery_ipc.rs`, run with `cargo test --test eval06_error_recovery_ipc`)

| Test ID | Trace Requirement ID | Test Type | Automated Target | Test Scenario | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-06-RUST-101** | `REQ-06-RULE-005``REQ-06-DATA-004``REQ-06-FUNC-304` | Positive (Markdown Re-check) | `tc_06_rust_101_reload_entity_markdown_returns_repaired_payload` | Fix `main.md` on disk in a fixture workspace, then invoke `reload_entity_markdown`. | Returns `Ok` with the repaired Markdown body, correct entity identity, and a fresh non-zero mtime. |
| **TC-06-RUST-102** | `REQ-06-RULE-001``REQ-06-RULE-005``REQ-06-DATA-004``REQ-06-FUNC-304` | Negative (Missing File Fault) | `tc_06_rust_102_reload_entity_markdown_rejects_missing_file_with_typed_error` | Delete `main.md`, then invoke `reload_entity_markdown`; also request an unsupported entity type. | Rejects with `ERR_MARKDOWN_FILE_NOT_FOUND` including the failing target path, and `ERR_ENTITY_NOT_FOUND` for the unsupported type — no panic. |
| **TC-06-RUST-103** | `REQ-06-RULE-002``REQ-06-RULE-003``REQ-06-DATA-001``REQ-06-DATA-002` | Positive (Context Contract) | `tc_06_rust_103_error_context_payloads_round_trip_with_camel_case` | Serialize and deserialize the app validation error payload, the retained-launch-path response, and the storage verification result with appended entity lists. | All error/recovery context payloads round-trip losslessly through the camelCase IPC contract. |
| **TC-06-RUST-104** | `REQ-06-RULE-001``REQ-06-RULE-002``REQ-06-DATA-002` | Negative (Appended Cause Fault) | `tc_06_rust_104_verify_hasm_storage_appends_missing_entity_paths` | Verify an intact fixture workspace, then delete one entity `main.md` and verify again. | Intact workspace verifies cleanly; the broken workspace rejects with `ERR_MISSING_STORAGE_FOLDER` appending the exact missing entity path for the error screen. |
| **TC-06-RUST-105** | `REQ-06-RULE-004``REQ-06-DATA-003``REQ-06-FUNC-203` | Positive (Folder Repair) | `tc_06_rust_105_workspace_repair_scaffolds_entity_folders` | Scaffold a workspace into a fresh temporary directory, then create an entity. | All entity-type directories and the database exist, and the entity's `{UUID}` directory contains a default `main.md` template and an `assets/` subdirectory. |
| **TC-06-RUST-106** | `REQ-06-RULE-004``REQ-06-DATA-003``REQ-06-FUNC-203` | Negative (Non-Destructive Guard) | `tc_06_rust_106_workspace_repair_refuses_non_empty_target` | Scaffold a workspace into a directory that already contains user data. | Rejects with `ERR_WORKSPACE_CREATION_FAILED`; the pre-existing file is untouched and no directories or database are created. |
| **TC-06-RUST-107** | `REQ-06-FUNC-106` | Positive (Clean Exit) | `tc_06_rust_107_clean_exit_releases_workspace_lock` | Invoke `release_workspace_lock` on a workspace holding this process's lock, then again after release. | The lock file is removed on the clean exit path and the second release stays an idempotent no-op. |
| **TC-06-RUST-108** | `REQ-06-RULE-001``REQ-06-FUNC-106` | Negative (Exit Fault) | `tc_06_rust_108_clean_exit_rejects_missing_workspace_without_panic` | Invoke lock release and clean workspace switching against a missing workspace path. | Both report a typed "Workspace directory does not exist" error without panicking; a read-only switch skips lock release and succeeds. |

### 4.3 Reused Fallback-Routing Coverage from Other Suites

The following existing automated tests (owned by other evaluation documents) additionally exercise the safe fallback navigation invariant of this sequence and are traced here without modification.

| Test ID | Trace Requirement ID | Test Type | Automated Target | Covered Behavior |
| --- | --- | --- | --- | --- |
| **TC-01-REACT-007** | `REQ-06-RULE-001` | Negative (Fault Routing) | `test/seq01.test.jsx` — "TC-01-REACT-007 routes an application validation failure to the error page" | A fatal startup validation failure routes to `/error-app` instead of crashing or entering an undefined state. |
| **TC-01-REACT-006** | `REQ-06-RULE-001` | Negative (Timeout Routing) | `test/seq01.test.jsx` — "TC-01-REACT-006 routes a Markdown validation timeout to the error page" | A validation IPC timeout routes to `/error-app`. |
| **TC-02-REACT-003** | `REQ-06-RULE-001` | Negative (Lock Fault Routing) | `test/seq02.test.jsx` — "TC-02-REACT-003 routes a lock failure to the model error page" | A workspace lock failure routes to `/error-model`. |
| **TC-02-E2E-005** | `REQ-06-RULE-001` | Negative (Storage Fault Routing) | `test/seq02.test.jsx` — "TC-02-E2E-005 routes missing populated workspace storage to the model error page" | A missing-storage verification failure routes to `/error-model`. |