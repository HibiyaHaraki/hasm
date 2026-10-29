# EVAL-04: Entity MetaData Editing & Saving Test Specification

This document defines the comprehensive test matrix, acceptance criteria, and traceability mapping for validating the Entity MetaData Editing & Saving workflow, single-entity domain validations, SQLite persistence transactions with dynamic/fixed timeouts, window-focus `mtime` and file existence checks, manual Markdown refreshes, missing/deleted file exception routing, and route navigation guards (`SEQ-04` / `REQ-04`).

Tests are structured across three distinct test levels: **Desktop App Level (E2E / System Integration)**, **React Level (Frontend Component & Form State)**, and **Tauri Level (Rust Domain Engine & Database Contract)**.

Automated React and IPC coverage runs through `npm run test:eval-04`. Automated Rust coverage runs through `cargo test entity_editor_commands`; it loads, reloads, detects deletion, and persists metadata for PERSON, EXPERIENCE, FACT, and LINK using a populated workspace package.

## Automated Test Inventory

### Entity Titles and Related LINK Coverage

| Test ID | Requirement | Expected result |
| --- | --- | --- |
| `TC-04-REACT-REF-001` | `REQ-04-RULE-018` | EXPERIENCE owner/parents, FACT people/experiences and LINK endpoints display titles without UUIDs or forms. |
| `TC-04-REACT-REF-002` (PERSON, EXPERIENCE, FACT) | `REQ-04-RULE-019` | Incoming/outgoing endpoint references and explicit graph links are deduplicated, unrelated links excluded, title/type/endpoints visible alongside external URLs; editing disables navigation. |
| `TC-04-REACT-REF-003` | `REQ-04-RULE-018`, `REQ-04-RULE-019` | Missing references show unavailable labels without UUID fallbacks or broken navigation. |
| `TC-04-REACT-REF-004` | `REQ-04-RULE-019` | Empty list and unavailable model are distinguished explicitly. |
| `TC-04-REACT-REF-005` | `REQ-04-RULE-019` | Related LINK opens its detail and resolves endpoint titles with retained workspace/model context. |
| `TC-04-REACT-REF-006` | `REQ-04-RULE-019` | Saved summary immediately updates endpoint text; unverified workspace shows guidance and disables related navigation without reloading the model. |
| `TC-NAV-REF-001` | `REQ-04-RULE-018`, `REQ-04-RULE-019` | Actual ticket -> real JS wrapper -> mocked Tauri transport invokes `load_entity_detail` with exact LINK identity; destination retains titles with no whole-model reload. |

Run reference component cases with `npm run test:eval-04`, and the
component-to-invoke navigation case with `npm run test:robustness`.
No native command or serialized schema change is required.

### Reader-First Inline Editing

| Test ID | Requirement | Expected result |
| --- | --- | --- |
| `TC-04-REACT-INLINE-001` (all entity types) | `REQ-04-RULE-015` | Readable summary/links/Markdown appear with no mounted form/input/select/textarea or Save/Cancel controls. |
| `TC-04-REACT-INLINE-002` | `REQ-04-RULE-016` | Summary click focuses its only input; blur does not save, Escape discards, focus returns to content, and explicit Save preserves other fields. |
| `TC-04-REACT-INLINE-003` (all entity types) | `REQ-04-RULE-016`, `REQ-04-RULE-017` | Detail edits produce exact typed payloads, keep summary/Markdown/URLs unchanged, and restore reading mode. |
| `TC-04-REACT-INLINE-004` | `REQ-04-RULE-016`, `REQ-04-RULE-017` | Bad UUID input never invokes save; a pending save disables Cancel/Refresh and suppresses duplicate submits; failure retains input and Cancel discards it. |
| `TC-04-REACT-LINK-001` to `006` | `REQ-04-RULE-012`, `REQ-04-RULE-016` | Explicitly enter the link editor before mutating; successful saves/cancels close it, refresh retains drafts, and separate Open actions surface browser failures. |
| `TC-04-IPC-INLINE-001` in `src-tauri/tests/entity_editor_commands_ipc.rs` | `REQ-04-RULE-017` | All four native generated save handlers deserialize typed detail updates, persist them to SQLite and reload unchanged summary/Markdown. Included in `entity_editor_commands_external_links_round_trip_through_registered_tauri_invokes`. |

Run the React rows via `npm run test:eval-04`. Run native rows with
`cargo test --manifest-path src-tauri/Cargo.toml --test entity_editor_commands_ipc`.
`TC-NAV-002` asserts reading mode during repeated visits; `TC-NAV-008` clicks
the summary before saving through the actual JS IPC wrapper and route flow.
`TC-NAV-INLINE-001` clicks Details and verifies the exact `save_fact_detail`
invoke through that same real JS wrapper.

### Rendered Markdown Coverage

`npm run test:eval-04` includes the following component tests:

| Test ID | Requirement | Expected result |
| --- | --- | --- |
| `TC-04-REACT-PREVIEW-001` (all four entity types) | `REQ-04-RULE-014` | Semantic headings, strong/emphasis, lists, quotes, fenced code, and tables render; Edit is inside the preview panel. |
| `TC-04-REACT-PREVIEW-002` | `REQ-04-RULE-014` | Raw script/image HTML stays text and JavaScript destinations never become links. |
| `TC-04-REACT-PREVIEW-003` | `REQ-04-RULE-014` | HTTP(S) links reach the OS opener; browser failures and relative-link rejection are visible. |
| `TC-04-REACT-LINK-005` | `REQ-04-RULE-012`, `REQ-04-RULE-014` | Refresh replaces the rendered heading while preserving unsaved URL edits. |

Theme/mobile appearance remains a visual acceptance check. The preview does
not add native filesystem/asset loading or change the editor's supported
input formats; see [SEQ-05](../arch/14-SEQ-05_Edit_on_HASM_Markdown.md).

### Navigation Lifetime Regression

`npm run test:robustness` runs actual graph, ticket, loader, and protected-route
components through the real JS IPC wrappers with only the native transport
mocked. `TC-NAV-002` covers twelve read-only inspection/return cycles;
`TC-NAV-003`/`012` cover late load/refresh errors after leaving a ticket;
`TC-NAV-008` covers save/return/re-verification. These trace
`REQ-04-RULE-013`. See [EVAL-03](./12-EVL-03_Visualizer.md) for all race cases,
three-minute CI limits, and native dispatch coverage (`TC-NAV-IPC-001`).

### External-Link Coverage

| Test ID / target | Requirement | Expected result |
| --- | --- | --- |
| `TC-04-REACT-LINK-001` in `test/seq04.test.jsx` | `REQ-04-RULE-010`, `REQ-04-RULE-012` | Every entity loads icons, adds URLs, saves ordered arrays, cancels to last save, and clears to `[]`. |
| `TC-04-REACT-LINK-002` | `REQ-04-RULE-011`, `REQ-04-RULE-012` | Database errors retain input; unsafe URLs never reach save IPC and have no clickable preview. |
| `TC-04-REACT-LINK-003` | `REQ-04-RULE-012` | Reference click calls OS opener with the stored URL; opener rejection is visible. |
| `TC-04-REACT-LINK-004` | `REQ-04-RULE-011`, `REQ-04-RULE-012` | Scheme validation and exact/subdomain classification reject spoofed site names. |
| `TC-04-REACT-LINK-005` | `REQ-04-RULE-012` | Markdown refresh retains unsaved URL edits. |
| `TC-04-REACT-LINK-006` | `REQ-04-RULE-009`, `REQ-04-RULE-010` | Save patches route-model URLs and invalidates verification without a package reload. |
| `TC-04-IPC-LINK-002` in `test/eval-04-ipc.test.js` | `REQ-04-RULE-010` | All four JS invoke names/arguments retain the URL array; production save command registration is present. |
| `TC-04-IPC-LINK-001`: `entity_editor_commands_external_links_round_trip_through_registered_tauri_invokes` in `src-tauri/tests/entity_editor_commands_ipc.rs` | `REQ-04-RULE-010`, `REQ-04-RULE-011`, `REQ-08-016` | Tauri mock-runtime dispatch uses actual generated command handlers and serde: all four saves round-trip multiple URLs, reject unsafe/malformed payloads without replacing saved data, clear arrays, and accept legacy omitted fields. All four creation invokes persist valid arrays and reject unsafe URLs. Markdown body remains unchanged. |
| `service::external_link_tests::external_links_survive_full_model_read_and_save` | `REQ-04-RULE-010` | Whole-model persistence and metadata-only loading retain every entity's URLs. |
| `service::external_link_tests::rejects_corrupt_external_link_storage_instead_of_returning_empty_arrays` | `REQ-04-RULE-011` | Corrupt/non-array/non-string/unsafe stored values fail explicitly. |
| `definitions::tests::validates_external_url_arrays_without_logging_contents` | `REQ-04-RULE-011` | Empty arrays and HTTP(S) URLs pass; relative, credential-bearing, unsafe-scheme and whitespace URLs fail. |

Run `npm run test:eval-04`, `cargo test entity_editor_commands`, and
`cargo test external_link` (Cargo commands from `src-tauri`).
`cargo test --tests` runs the complete Rust unit and native integration coverage.
These cover component -> JS invoke, native Tauri dispatch -> serde -> SQLite,
and command registration separately. A packaged desktop/browser launch and
visual inspection of every theme/mobile breakpoint remain manual checks.

| Test IDs covered | Executable test file / command | CI job |
| --- | --- | --- |
| `TC-04-REACT-001`, `TC-04-REACT-007`, `TC-04-REACT-009`, `TC-04-REACT-PERF-001`, `TC-04-REACT-PERF-002`, `TC-04-E2E-004` route return | `test/seq04.test.jsx` via `npm run test:eval-04` | Frontend: EVAL-04 React and IPC tests |
| All four typed save invokes plus load/mtime/reload invoke contracts | `test/eval-04-ipc.test.js` via `npm run test:eval-04` | Frontend: EVAL-04 React and IPC tests |
| `TC-04-RUST-005`, `TC-04-RUST-009`, all-entity load/reload/persist coverage | `src-tauri/src/hasm/entity_editor_commands.rs` via `cargo test entity_editor_commands` | Rust: EVAL-04 Rust entity editor tests |
| `TC-04-RUST-PERF-001`, `TC-04-RUST-PERF-002` | `src-tauri/src/hasm/entity_editor_commands.rs` via `cargo test entity_editor_commands` | Rust: EVAL-04 Rust entity editor tests |

### Large Package Performance Cases

| Test ID | Trace Requirement ID | Test Type | Component / Target | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-04-REACT-PERF-001** | `REQ-04-RULE-009` | Positive (No Reload) | `EntityDetailPage.tsx` | 1. Render a ticket with a model in route state.<br/>2. Edit the name and click Save. | 1. `save_entity_detail` is invoked exactly once.<br/>2. `load_hasm_model_db` is never invoked.<br/>3. `load_entity_detail` is not repeated after the save. |
| **TC-04-REACT-PERF-002** | `REQ-04-RULE-007` | Positive (Cheap Poll) | `EntityDetailPage.tsx` | 1. Render a ticket.<br/>2. Dispatch a window `focus` event with an unmodified file. | 1. `check_entity_mtime` is invoked exactly once.<br/>2. Neither `load_hasm_model_db` nor `reload_entity_markdown` is invoked. |
| **TC-04-RUST-PERF-001** | `REQ-04-RULE-008` | Positive (Constant Time Edit) | `service::get_person_detail` / `service::save_person_detail` | 1. Create a demo workspace.<br/>2. Add 1,000 unrelated folder-only FACT entities.<br/>3. Load and save the PERSON ticket. | 1. The saved name round-trips.<br/>2. No row is created for any of the 1,000 unrelated folders, proving no whole-package folder sync ran. |
| **TC-04-RUST-PERF-002** | `REQ-04-RULE-007` | Positive (Database-Free Poll) | `check_entity_mtime` | 1. Load a FACT ticket.<br/>2. Delete `main.db` from the workspace.<br/>3. Invoke `check_entity_mtime`. | 1. The call succeeds without the database.<br/>2. `is_deleted` is false and `current_mtime_ms` is non-zero. |

Rows for domain validation, transaction rollback, and full desktop interactions remain acceptance scenarios pending their dedicated implementation.

---

## 1. Desktop App Level Tests (E2E / System Integration)

These integration tests verify end-to-end user flows on the JIRA-style ticket page, including loading, saving metadata with auto-invalidation, canceling edits, detecting external file modifications/deletions via `mtime`, refreshing Markdown manually, and handling deleted file route transitions.

| Test ID | Trace Requirement ID | Test Type | Test Scenario | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-04-E2E-001** | `REQ-04-RULE-001``REQ-04-FUNC-101``REQ-04-FUNC-114``REQ-04-FUNC-115` | Positive (Normal) | Load Entity Detail Ticket View | 1. Click a 3D node in `SEQ-03`.2. Observe route transition to `/entity-detail/:entity_type/:entity_id`. | 1. Page mounts and fetches metadata from Rust memory.2. `hasm_markdown.exe` verifies `main.md` and renders JIRA-style ticket view successfully.3. Initial `loaded_mtime_ms` stored in React state. |
| **TC-04-E2E-002** | `REQ-04-RULE-003``REQ-04-RULE-005``REQ-04-FUNC-212``REQ-04-FUNC-213` | Positive (Persistence) | Save Valid Metadata In-Place | 1. Modify `security_level` and `description` on the detail ticket.2. Click "Save". | 1. MetaData persists to `hasm.db`.2. Rust sets `is_verified = false`.3. Success toast displays; user remains on current detail page. |
| **TC-04-E2E-003** | `REQ-04-FUNC-301``REQ-04-FUNC-302``REQ-04-FUNC-304` | Positive (Interaction) | Cancel Edits with Unsaved Changes | 1. Modify `name` field (`isDirty == true`).2. Click "Cancel".3. Select "Discard Changes" in modal. | 1. Confirmation modal renders.2. Selecting "Discard Changes" reverts form fields to original values. |
| **TC-04-E2E-004** | `REQ-04-FUNC-401``REQ-04-FUNC-402``REQ-04-FUNC-403` | Positive (Cascade) | Return to Visualizer After Saving (Trigger SEQ-02 Re-verification) | 1. Save metadata modifications (`is_verified = false`).2. Click "Back to Visualizer". | 1. Navigates to `/visualizer`.2. `SEQ-03` Guard 2 intercepts unverified state and redirects to `/loading-model` for re-verification. |
| **TC-04-E2E-005** | `REQ-04-RULE-007``REQ-04-FUNC-501``REQ-04-FUNC-503``REQ-04-FUNC-505``REQ-04-FUNC-511` | Positive (External Edit) | Detect External Markdown Modification & Manual Refresh | 1. Open external editor and modify `main.md`.2. Focus back onto HASM window.3. Observe "Refresh Markdown" button style.4. Click "Refresh Markdown" button. | 1. Window focus triggers non-blocking `check_entity_mtime`.2. Disk `current_mtime_ms > last_loaded_mtime_ms` detected; button highlights with Amber alert style + pulsing badge.3. Clicking Refresh re-verifies via `hasm_markdown.exe`, updates body text, resets button style, and displays success toast. |
| **TC-04-E2E-006** | `REQ-04-FUNC-504``REQ-04-FUNC-506``REQ-04-FUNC-508` | Negative (External Deletion) | Detect External File Deletion & Error Route Navigation | 1. Open target directory externally and delete `main.md`.2. Focus back onto HASM window.3. Observe Warning Toast & "Refresh Markdown" button style.4. Click "Refresh Markdown" button. | 1. Window focus detects file missing (`is_deleted == true`).2. Warning toast displays ("Markdown file deleted on disk"); button highlights with Red danger style.3. Clicking Refresh triggers `reload_entity_markdown`, which rejects with `MarkdownFileNotFound` and routes to `/error-markdown`. |

---

## 2. React Level Tests (Frontend Component & Form State)

These unit and component tests focus on `EntityDetailPage.tsx`, state variable isolation (`isEntityLoading`, `isMarkdownVerifying`, `isEntitySaving`, `hasExternalChanges`, `isMarkdownDeleted`), form dirty checking, modal dialogs, window focus event listeners, and error toast/popup/route rendering.

| Test ID | Trace Requirement ID | Test Type | Component / Target | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-04-REACT-001** | `REQ-04-FUNC-102``REQ-04-FUNC-115` | Positive (State) | `EntityDetailPage.tsx` | 1. Mount component with target params.2. Check state flags during and after load. | 1. Initializes with `isEntityLoading = true`, `isMarkdownVerifying = true`, `hasExternalChanges = false`, and `isMarkdownDeleted = false`.2. Upon payload resolve, loading flags set to `false`. |
| **TC-04-REACT-002** | `REQ-04-FUNC-105` | Negative (Routing) | `EntityDetailPage.tsx` | 1. Mock `load_entity_detail` to return `EntityNotFound`. | 1. React Router navigates immediately to `/error-model`. |
| **TC-04-REACT-003** | `REQ-04-FUNC-107``REQ-04-FUNC-111``REQ-04-FUNC-113` | Negative (Routing) | `EntityDetailPage.tsx` | 1. Mock `load_entity_detail` to return `MarkdownFileNotFound`, `MarkdownTimeout`, or `MarkdownVerificationFailed`. | 1. React Router navigates immediately to `/error-markdown`. |
| **TC-04-REACT-004** | `REQ-04-FUNC-201``REQ-04-FUNC-207` | Negative (Validation) | `EntityDetailPage.tsx` | 1. Submit edit payload with `start_time > end_time`.2. Mock IPC reject with `EntityVerificationFailed`. | 1. `isEntitySaving` resets to `false`.2. Error popup displays validation message; form state preserved for user correction. |
| **TC-04-REACT-005** | `REQ-04-FUNC-210``REQ-04-FUNC-211` | Negative (Error UI) | `EntityDetailPage.tsx` | 1. Click "Save".2. Mock IPC reject with `SaveTimeout` or `DatabaseSaveFailed`. | 1. `isEntitySaving` resets to `false`.2. Error popup/toast renders informing user that DB changes were rolled back. |
| **TC-04-REACT-006** | `REQ-04-FUNC-302``REQ-04-FUNC-303` | Positive (Modal) | `DiscardModal.tsx` | 1. Edit a field.2. Click "Cancel".3. Click "Keep Editing" in modal. | 1. Modal closes; modified form inputs remain intact. |
| **TC-04-REACT-007** | `REQ-04-FUNC-501``REQ-04-FUNC-505` | Positive (Focus UI) | `EntityDetailPage.tsx` | 1. Dispatch `window.dispatchEvent(new Event('focus'))`.2. Mock `check_entity_mtime` response `{ is_modified: true, is_deleted: false }`. | 1. State `hasExternalChanges` updates to `true`.2. "Refresh Markdown" button applies Amber alert style and pulsing badge element. |
| **TC-04-REACT-008** | `REQ-04-FUNC-504``REQ-04-FUNC-506` | Negative (Focus Danger UI) | `EntityDetailPage.tsx` | 1. Dispatch `window.dispatchEvent(new Event('focus'))`.2. Mock `check_entity_mtime` response `{ is_modified: false, is_deleted: true }`. | 1. State `isMarkdownDeleted` & `hasExternalChanges` update to `true`.2. Warning toast displays.3. "Refresh Markdown" button applies Red danger style. |
| **TC-04-REACT-009** | `REQ-04-FUNC-508` | Negative (Reload Missing File) | `EntityDetailPage.tsx` | 1. Click Red highlighted "Refresh Markdown".2. Mock `reload_entity_markdown` reject with `MarkdownFileNotFound`. | 1. `isMarkdownVerifying` resets to `false`.2. React Router navigates immediately to `/error-markdown`. |
| **TC-04-REACT-010** | `REQ-04-FUNC-510` | Negative (Refresh Syntax Error) | `EntityDetailPage.tsx` | 1. Click Amber highlighted "Refresh Markdown".2. Mock `reload_entity_markdown` reject with `MarkdownVerificationFailed`. | 1. `isMarkdownVerifying` resets to `false`.2. Error toast displays syntax error warning; UI body text remains uncorrupted. |

---

## 3. Tauri Level Tests (Rust Domain Engine & Database Contract)

These unit and integration tests verify IPC data contracts, Rust entity-level domain validations (`entity.verify()`), fast `mtime` and file existence queries, dynamic markdown timeouts, missing file error generation, and SQLite transaction rollback guarantees (`hasm.db`) using `cargo test`.

| Test ID | Trace Requirement ID | Test Type | Rust Module / Function | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-04-RUST-001** | `REQ-04-DATA-001``REQ-04-DATA-005``REQ-04-DATA-007``REQ-04-DATA-008` | Positive (Contract) | `models::entity_editor` | 1. Instantiate `LoadEntityRequest`, `CheckMtimeRequest`, `CheckMtimePayload`, `ReloadMarkdownPayload`, and `EntityEditorError` (including `MarkdownFileNotFound`).2. Serialize and deserialize JSON. | 1. All struct fields serialize and deserialize with 100% type safety. |
| **TC-04-RUST-002** | `REQ-04-RULE-006``REQ-04-FUNC-202``REQ-04-FUNC-203` | Negative (Domain Rule) | `Fact::verify()` / `Experience::verify()` | 1. Create `Fact` struct with `start_time = "2026-08-01"` and `end_time = "2026-05-01"`.2. Execute `verify()`. | 1. Returns `Err(EntityValidationError)` due to time inversion ($t_{\text{start}} > t_{\text{end}}$). |
| **TC-04-RUST-003** | `REQ-04-FUNC-204` | Negative (Domain Rule) | `Link::verify()` | 1. Create `Link` struct with `source_id == target_id`.2. Execute `verify()`. | 1. Returns `Err(EntityValidationError)` (self-loop forbidden). |
| **TC-04-RUST-004** | `REQ-04-FUNC-205``REQ-04-FUNC-206` | Negative (Domain Rule) | `save_entity_metadata` | 1. Pass request with `name = "   "`.2. Invoke `save_entity_metadata`. | 1. Rejects prior to DB write with `EntityVerificationFailed`. |
| **TC-04-RUST-005** | `REQ-04-FUNC-106``REQ-04-FUNC-508` | Negative (Missing File) | `load_entity_detail` / `reload_entity_markdown` | 1. Pass valid `entity_id` whose target `main.md` is missing on disk.2. Invoke command. | 1. Detects file missing prior to parser invocation.2. Returns `Err(MarkdownFileNotFound { path })`. |
| **TC-04-RUST-006** | `REQ-04-RULE-002``REQ-04-FUNC-108``REQ-04-FUNC-110` | Performance (Timeout) | `load_entity_detail` | 1. Mock `main.md` file size = 500 KB (Calculated timeout = 8,000ms).2. Mock `hasm_markdown.exe` process hang exceeding 8,000ms. | 1. Kills child process at exactly 8,000ms.2. Returns `Err(MarkdownTimeout { timeout_ms: 8000 })`. |
| **TC-04-RUST-007** | `REQ-04-RULE-003``REQ-04-RULE-004``REQ-04-FUNC-208``REQ-04-FUNC-209` | Negative (Timeout Rollback) | `save_entity_metadata` | 1. Lock SQLite database to force transaction delay.2. Execute `save_entity_metadata`.3. Advance timer past 5,000ms. | 1. Executes SQLite `ROLLBACK`.2. Rejects with `SaveTimeout`.3. `hasm.db` remains unchanged. |
| **TC-04-RUST-008** | `REQ-04-RULE-005``REQ-04-FUNC-212` | Positive (State Invalidation) | `save_entity_metadata` | 1. Execute valid `save_entity_metadata`.2. Check in-memory `HasmModel` flag. | 1. SQLite transaction `COMMIT` succeeds.2. In-memory `HasmModel.is_verified` is updated to `false`. |
| **TC-04-RUST-009** | `REQ-04-RULE-007``REQ-04-FUNC-502``REQ-04-FUNC-503``REQ-04-FUNC-504` | Performance (mtime Check) | `check_entity_mtime` | 1. Delete target `main.md` on disk.2. Invoke `check_entity_mtime`. | 1. Returns `Ok(CheckMtimePayload { is_modified: false, is_deleted: true, current_mtime_ms: 0 })`.2. Execution completes in < 10ms without DB or parser calls. |