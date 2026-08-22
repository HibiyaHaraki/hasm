# EVAL-02: Model Loading & Storage Verification Test Specification

This document defines the comprehensive test matrix, acceptance criteria, and traceability mapping for validating workspace lock checking, stale lock auto-recovery, window-close lock release, database metadata ingestion, progress streaming via Watchdog Protection, and storage structure verification (`SEQ-02` / `REQ-02`).

Tests are structured across three distinct test levels: **Desktop App Level (E2E / System Integration)**, **React Level (Frontend Component & Window Event State)**, and **Tauri Level (Rust Domain Engine & Lock File I/O)**.

Automated React and IPC coverage for this specification runs through `npm run test:eval-02`; the Rust command coverage runs through `cargo test model_commands` from `src-tauri`.

## Automated Test Inventory

| Test IDs covered | Executable test file / command | CI job |
| --- | --- | --- |
| `TC-02-REACT-001` to `TC-02-REACT-005`, active-lock and missing-storage route cases | `test/seq02.test.jsx` via `npm run test:eval-02` | Frontend: EVAL-02 React and IPC tests |
| SEQ-02 IPC contracts | `test/eval-02-ipc.test.js` via `npm run test:eval-02` | Frontend: EVAL-02 React and IPC tests |
| `TC-02-RUST-001` to `TC-02-RUST-006` | `src-tauri/src/hasm/model_commands.rs` via `cargo test model_commands` | Rust: EVAL-02 Rust model loading tests |

Desktop rows are acceptance scenarios; they are not yet automated with a packaged Tauri E2E driver.

---

## 1. Desktop App Level Tests (E2E / System Integration)

These integration tests verify end-to-end user flows for model workspace loading, stale lock cleanup after simulated crashes, graceful lock file deletion on window close, Watchdog timeout triggering, and fatal storage error navigation.

| Test ID | Trace Requirement ID | Test Type | Test Scenario | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-02-E2E-001** | `REQ-02-RULE-001``REQ-02-FUNC-101``REQ-02-FUNC-107``REQ-02-FUNC-306` | Positive (Normal Boot) | Normal Workspace Load & Lock Creation | 1. Navigate to `/loading-model` with valid workspace path.2. Allow load and verification to complete. | 1. `.hasm/lock` is created with current PID.2. Granular progress UI updates smoothly.3. Navigates to `/visualizer` upon completion. |
| **TC-02-E2E-002** | `REQ-02-RULE-002``REQ-02-FUNC-105``REQ-02-FUNC-106` | Positive (Stale Recovery) | Auto-Recover Stale Lock from Crashed Process | 1. Manually write `.hasm/lock` containing a dead PID (e.g., `999999`).2. Navigate to `/loading-model` with target workspace path. | 1. Rust detects dead PID, deletes stale `.hasm/lock`, and writes new lock with current PID.2. Info toast displays ("Recovered stale lock file").3. App proceeds in Read-Write mode (`isReadOnly = false`). |
| **TC-02-E2E-003** | `REQ-02-RULE-003``REQ-02-FUNC-108``REQ-02-FUNC-109` | Positive (Window Close) | Release Lock on Window Close (`tauri://close-requested`) | 1. Launch app and load workspace in Read-Write mode.2. Click top-right window "X" button. | 1. `tauri://close-requested` fires.2. `release_workspace_lock` executes within 1,000ms.3. `.hasm/lock` file is deleted from disk prior to process termination. |
| **TC-02-E2E-004** | `REQ-02-RULE-001``REQ-02-FUNC-103``REQ-02-FUNC-104` | Negative (Read-Only) | Attempt Load Active Locked Workspace | 1. Launch HASM Instance A on `Workspace X`.2. Launch HASM Instance B and attempt to load `Workspace X`. | 1. Instance B detects active PID in `.hasm/lock`.2. Instance B displays warning banner ("Opened in Read-Only Mode"). |
| **TC-02-E2E-005** | `REQ-02-RULE-006``REQ-02-FUNC-304` | Negative (Fatal Error) | Storage Verification Detects Missing Directory | 1. Delete a required `PERSON/{UUID}/main.md` folder from workspace.2. Load workspace. | 1. `verify_storage()` flags missing entity.2. Rejects with `MissingStorageFolder`.3. React Router navigates to `/error-model`. |

---

## 2. React Level Tests (Frontend Component & Window Event State)

These unit and component tests focus on `LoadingModelPage.tsx`, Watchdog Timer protection, progress event listener updates, toast notifications, and Tauri window event interceptors.

| Test ID | Trace Requirement ID | Test Type | Component / Target | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-02-REACT-001** | `REQ-02-FUNC-106` | Positive (Toast UI) | `LoadingModelPage.tsx` | 1. Render page.2. Mock IPC `check_workspace_lock` resolve with `is_stale_recovered = true`. | 1. Sets `isReadOnly = false`.2. Displays info toast: "Recovered stale lock file from previous process crash." |
| **TC-02-REACT-002** | `REQ-02-FUNC-108``REQ-02-FUNC-109` | Positive (Close Event) | `App.tsx` (Global Listener) | 1. Trigger `tauri://close-requested` event on window.2. Mock `isReadOnly = false`. | 1. Invokes IPC `release_workspace_lock` passing `activeModelPath`. |
| **TC-02-REACT-003** | `REQ-02-FUNC-102` | Negative (Timeout) | `LoadingModelPage.tsx` | 1. Mock `check_workspace_lock` to stall exceeding 3,000ms. | 1. React cancels operation.2. React Router navigates to `/error-model`. |
| **TC-02-REACT-004** | `REQ-02-RULE-005``REQ-02-FUNC-203``REQ-02-FUNC-205` | Negative (Watchdog) | `LoadingModelPage.tsx` | 1. Invoke `load_hasm_model_db`.2. Simulate zero progress events for >10,000ms. | 1. Watchdog Timer fires.2. Sets `modelError = "DB loading stalled"`.3. Navigates to `/error-model`. |
| **TC-02-REACT-005** | `REQ-02-FUNC-204``REQ-02-FUNC-303` | Positive (Progress UI) | `LoadingModelPage.tsx` | 1. Emit mock `model-load-progress` event `{ current: 50, total: 100, percentage: 50.0 }`. | 1. Watchdog Timer resets to 0ms.2. Progress bar UI renders 50% state smoothly. |

---

## 3. Tauri Level Tests (Rust Domain Engine & Lock File I/O)

These unit and integration tests verify Rust command interfaces, OS process table inspection (`sysinfo` / OS PID check), `.hasm/lock` file creation/deletion, and `HasmModel::verify_storage()` execution using `cargo test`.

| Test ID | Trace Requirement ID | Test Type | Rust Module / Function | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-02-RUST-001** | `REQ-02-DATA-001``REQ-02-DATA-002``REQ-02-DATA-003` | Positive (Contract) | `models::lock_payload` | 1. Instantiate `LockStatus` and `CheckWorkspaceLockRequest`.2. Serialize and deserialize JSON. | 1. `is_stale_recovered` and `is_read_only` serialize/deserialize with 100% type safety. |
| **TC-02-RUST-002** | `REQ-02-RULE-002``REQ-02-FUNC-105` | Positive (Stale Cleanup) | `check_workspace_lock` | 1. Create `.hasm/lock` with non-existent PID `999999`.2. Invoke `check_workspace_lock`. | 1. Identifies PID `999999` as dead.2. Deletes stale lock file.3. Writes new `.hasm/lock` with current PID.4. Returns `Ok(LockStatus { is_stale_recovered: true, is_locked: false })`. |
| **TC-02-RUST-003** | `REQ-02-RULE-003``REQ-02-FUNC-109` | Positive (Lock Release) | `release_workspace_lock` | 1. Create `.hasm/lock` with current PID.2. Invoke `release_workspace_lock`. | 1. Deletes `.hasm/lock` file from workspace.2. Returns `Ok(())`. |
| **TC-02-RUST-004** | `REQ-02-FUNC-103` | Positive (Active Lock) | `check_workspace_lock` | 1. Write current process PID to `.hasm/lock`.2. Invoke `check_workspace_lock` from separate test thread simulating another instance. | 1. Detects PID as active in OS process table.2. Returns `Ok(LockStatus { is_locked: true, is_read_only: true })`. |
| **TC-02-RUST-005** | `REQ-02-RULE-006``REQ-02-FUNC-301``REQ-02-FUNC-305` | Positive (Storage Check) | `verify_hasm_storage` | 1. Load a populated fixture `hasm.db` with PERSON, EXPERIENCE, FACT, and LINK records.<br/>2. Create matching non-empty `main.md` and `assets/` directories.<br/>3. Invoke storage verification. | 1. Every persisted entity has a matching Markdown file.<br/>2. Verification reports no missing or unreferenced entities. |
| **TC-02-RUST-006** | `REQ-02-RULE-006``REQ-02-FUNC-304` | Negative (Storage Check) | Populated workspace fixture | 1. Seed `hasm.db` with PERSON, EXPERIENCE, FACT, and LINK records.<br/>2. Create each matching `main.md` and `assets/` folder.<br/>3. Delete the FACT Markdown file. | 1. Fixture contains non-empty database records and storage before deletion.<br/>2. Verification reports `FACT/{UUID}/main.md` as missing. |