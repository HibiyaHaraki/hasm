# EVL-08: Entity Creation & Link Graph Binding Evaluation Specification

This document defines the comprehensive test matrix, acceptance criteria, and traceability mapping for validating workspace scaffolding via native OS dialogs, entity creation (PERSON, EXPERIENCE, FACT, LINK), pre-persistence domain invariants (`entity.verify()`), atomic SQLite transactions with filesystem rollback, and automated 3D visualizer graph re-layout.

---

## 1. Desktop App Level Tests (E2E / System Integration)

| Test ID | Trace Requirement ID | Test Type | Test Scenario | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **`TC-EVL-08-E2E-001`** | `REQ-08-001` `REQ-08-002` | Positive (New Workspace Scaffolding) | Create New HASM Model from `/select` | 1. Navigate to `/select`. 2. Click "Create New HASM Model". 3. Select target directory via OS save dialog (e.g., `/path/to/NewLife.hasm`). 4. Submit form. | 1. Base directory `NewLife.hasm/` and subdirectories (`PERSON/`, `EXPERIENCE/`, `FACT/`, `LINK/`) are generated. 2. `hasm.db` is initialized with SQLite tables. 3. `.hasm/lock` is written. 4. App navigates to `/loading-model`. |
| **`TC-EVL-08-E2E-002`** | `REQ-08-010` `REQ-08-020` `REQ-08-021` | Positive (PERSON Entity Creation) | Create New PERSON with Root Experience | 1. In `/visualizer`, click "Create PERSON". 2. Fill name ("John Doe"), security level (`1`), and check "Create Root Stream". 3. Submit. | 1. UUID directory `PERSON/{UUID}/` and `assets/` are created. 2. `main.md` with YAML FrontMatter is generated. 3. Record inserted into `hasm.db`. 4. 3D visualizer re-layouts and displays new PERSON node. |
| **`TC-EVL-08-E2E-003`** | `REQ-08-013` `REQ-08-021` | Positive (Interactive LINK Binding) | Create Valid LINK Between Two Existing Nodes | 1. Select Node A (Fact) and Node B (Experience). 2. Click "Create LINK". 3. Select type ("references") and submit. | 1. `LINK/{UUID}/main.md` created. 2. Record inserted into `LINK` table in `hasm.db`. 3. 3D visualizer computes layout and renders 3D spline connecting Node A and Node B. |
| **`TC-EVL-08-E2E-004`** | `REQ-08-013` | Negative (Self-Loop LINK Prevention) | Attempt LINK Creation with Identical Origin and Target | 1. Open "Create LINK" modal. 2. Select Node A as Origin AND Target. 3. Submit form. | 1. Backend rejects creation (`SelfLoopLink`). 2. Form displays error ("Cannot create a link pointing to the same entity"). 3. No SQLite record or folder generated. |
| **`TC-EVL-08-E2E-005`** | `REQ-08-015` | Positive (Confirmed Life Bootstrap) | Load a newly created empty workspace | 1. Create a workspace and continue through `/loading-model`. 2. Enter a PERSON name and birth date on `/initialize-model`. 3. Review the confirmation dialog. 4. Confirm creation. | 1. No entity is created before confirmation. 2. PERSON birthday, owned Life EXPERIENCE, and birth date FACT are persisted atomically with Markdown/assets. 3. FACT references both PERSON and EXPERIENCE and retains the exact date. 4. Visualizer opens with the initialized model. |

---

## 2. Domain Validation & Component Level Tests (Frontend / Modal)

| Test ID | Trace Requirement ID | Test Type | Component / Target | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **`TC-EVL-08-COMP-001`** | `REQ-08-010` `REQ-08-011` | Negative (Empty Name Validation) | `CreateEntityModal.jsx` | 1. Open PERSON or EXPERIENCE creation modal. 2. Leave name field blank. 3. Submit form. | 1. Frontend or backend returns `EmptyName` error. 2. Form submission is blocked, preserving user input for correction. |
| **`TC-EVL-08-COMP-002`** | `REQ-08-012` | Negative (Fact Time Inversion Validation) | `CreateFactModal.jsx` | 1. Open FACT creation modal. 2. Input `start_time` = `2026-08-12` and `end_time` = `2020-01-01`. 3. Submit. | 1. Backend returns `TimeInversion` error. 2. Error popup displays ("Start time must be earlier than or equal to End time"). |
| **`TC-EVL-08-COMP-003`** | `REQ-08-013` `REQ-08-102` | Negative (Orphan Node LINK Validation) | `CreateLinkModal.jsx` | 1. Attempt `create_link` IPC with a non-existent Target UUID. | 1. IPC rejects with `OrphanLinkError` within 5 ms. 2. Toast error displays ("Origin or Target entity no longer exists"). |

---

## 3. Rust Backend Level Tests (Engine, SQLite & File Rollback)

| Test ID | Trace Requirement ID | Test Type | Rust Module / Function | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **`TC-EVL-08-RUST-001`** | `REQ-08-010` `REQ-08-013` | Positive (Domain Invariant Verification) | `domain::validation::Verifiable` | 1. Execute `.verify()` unit tests on `Person`, `Experience`, `Fact`, and `Link` structs. | 1. Returns `Ok(())` for valid inputs. 2. Returns appropriate `EntityValidationError` variants for invalid inputs. |
| **`TC-EVL-08-RUST-002`** | `REQ-08-002` `REQ-08-100` | Positive & Negative (Scaffolding Rollback SLA) | `commands::model_commands::create_hasm_workspace` | 1. Trigger workspace creation on read-only directory. 2. Measure execution duration and check disk cleanup. | 1. Creation fails within 3,000 ms. 2. Partially created `.hasm` directory is purged automatically. 3. Returns `WorkspaceCreationError`. |
| **`TC-EVL-08-RUST-003`** | `REQ-08-020` `REQ-08-101` | Positive & Negative (Transaction Rollback on I/O Error) | `commands::entity_commands::create_fact` | 1. Simulate file system write failure during `{UUID}/main.md` creation. | 1. SQLite transaction executes `ROLLBACK`. 2. Created `{UUID}/` directory is removed. 3. Returns `EntityCreationError` within 5,000 ms. |

---

## 4. Automated Coverage Inventory (Implemented)

External URLs (`REQ-08-016`) are covered by `TC-08-REACT-LINK-001` in
`test/seq08.test.jsx` (all four creation payloads include the editor's array) and
`creates_person_experience_fact_and_link_in_real_workspace` (all four arrays
round-trip through SQLite; the auto-created root stream remains empty).
`scaffolds_workspace_and_entity_directories` checks all four URL-array defaults
in both scaffolded databases. Domain validation tests reject unsafe URL arrays.
`TC-08-IPC-LINK-001` checks the four JS creation invokes with URL arrays;
`entity_editor_commands_external_links_round_trip_through_registered_tauri_invokes`
in `src-tauri/tests/entity_editor_commands_ipc.rs` exercises actual
native Tauri creation dispatch, serde, unsafe-URL rejection, and persistence.

The following test cases are now mapped to runnable suites and verified through real HASM workspace fixtures.

Bootstrap coverage for `REQ-08-015`:

| Test ID | Test name / target | Required evidence |
| --- | --- | --- |
| `TC-08-REACT-004` | Confirmation before initialization (`test/seq08.test.jsx`) | Both fields required; dialog shows all generated names/date; no creation before confirmation; correct payload and visualizer navigation. |
| `TC-08-REACT-005` | Return to edit | Inputs preserved; revised input appears in review; no persistence. |
| `TC-08-REACT-006` | Creation failure and duplicate submission | Single invoke while pending; editing blocked; explicit backend error displayed. |
| `TC-08-REACT-007` | Reload retry | Reload failure displayed; retry opens visualizer without another create invoke. |
| `TC-08-IPC-BIRTH-001` | JS birth-date invoke (`test/eval-08-ipc.test.js`) | `birthDate` and life-creation defaults reach the native command name unchanged. |
| `TC-08-IPC-BOOTSTRAP-001` | `initializes_birth_entities_through_registered_invokes` (`src-tauri/tests/model_initialization_ipc.rs`) | Real registered Tauri dispatch, invalid dates/leap years, Life requirement, injected birth-insert failure with full rollback, SQLite reload, PERSON/EXPERIENCE/FACT associations, Markdown/assets, storage verification, visualizer layout, and legacy callers omitting birthDate. |
| `TC-08-IPC-BOOTSTRAP-002` | `new_model_loads_exactly_one_person_experience_and_fact` (`src-tauri/tests/model_initialization_ipc.rs`) | Create a fresh workspace through registered invokes; bootstrap one PERSON, one Life EXPERIENCE, and one birth FACT; assert exact counts, ownership/date associations, storage verification, and unchanged full-model reload. |
| `TC-05-CLI-BOOTSTRAP-001` | `hasm_markdown_loads_every_new_model_description` (`src-tauri/tests/model_initialization_ipc.rs`) | For all three descriptions from a newly created model, invoke real `load_entity_detail`, run the staged HASM Markdown executable's `verify <entity-folder> --json` and `preview <entity-folder>`, assert valid JSON/empty diagnostics and complete unchanged Markdown output, then verify the model still reloads unchanged. No mock executable, fabricated manifest, or silent skip is allowed. |

Entity creation coverage for `REQ-08-017` / `REQ-08-018`:

| Test ID | Automated target | Required evidence |
| --- | --- | --- |
| `TC-08-REACT-REL-001` (FACT and EXPERIENCE) | `test/seq08.test.jsx` | All loaded EXPERIENCE entries appear, including duplicate/empty names; title search and keyboard navigation work; badges remove selections without displaying UUIDs; selections survive tab switches and serialize as UUID arrays. |
| `TC-08-IPC-PICKER-001` (FACT and EXPERIENCE) | `test/experience-picker-ipc.test.jsx` | Real creation controls filter and select multiple titles and invoke the existing creation commands with UUID arrays. |
| `TC-08-IPC-DATE-001` | `test/date-input-ipc.test.jsx` | Calendar-only FACT start/end controls send selected dates through the real creation invoke. |
| `TC-08-REACT-REL-002` (FACT and EXPERIENCE) | `test/seq08.test.jsx` | Clearing selection sends `[]`; failures remain visible; no EXPERIENCE records produce a disabled explicit empty state. |
| `TC-08-REACT-LINK-001` | `test/seq08.test.jsx` | All four creation forms omit Description controls and submit empty description fields alongside external URLs. |
| `TC-08-IPC-REL-001` / `TC-05-CLI-CREATE-001` | `entity_creation_persists_selected_experiences_and_default_markdown` in `src-tauri/tests/model_initialization_ipc.rs` | Real registered commands create all four entity types; reloaded EXPERIENCE parent and FACT membership arrays each retain both selected UUIDs; every generated Markdown has identity FrontMatter and the default body, matches detail IPC output, and loads through the actual editor binary's verify/preview commands. |

LINK search coverage for `REQ-08-019` in `test/seq08.test.jsx`:

| Test ID | Required evidence |
| --- | --- |
| `TC-08-REACT-SEARCH-001` | Independent Origin/Target filtering, whitespace trimming and case-insensitive name/type search; selecting results submits exact typed UUIDs without UI search state. |
| `TC-08-REACT-SEARCH-002` | No-result notice, no automatic creation/selection, clearing a query restores all options, selected endpoints remain explicitly visible outside results, form switching preserves search/selection, placeholder clears endpoint. |
| `TC-08-REACT-SEARCH-003` | Duplicate names distinguished by UUID and unnamed entities searchable/selectable by UUID. |

Creation choice previews in `test/entity-info-preview.test.jsx` run under
`npm run test:eval-04`, mounting the real creation page and shared preview layer
with only native transport mocked:

| Test ID | Required evidence |
| --- | --- |
| `TC-08-PREVIEW-001` (FACT and EXPERIENCE) | Hovering EXPERIENCE choices invokes `load_entity_detail` with exact workspace/type/UUID before selection; the shared card shows metadata without intercepting clicks; clicking choices toggles selection while the list remains open; Escape dismisses the card. |
| `TC-08-PREVIEW-002` (Origin and Target) | Editing a LINK query opens results; focusing a result previews its entity without selection; removing results dismisses the card; choosing a result selects it and dismisses the card. |
| `TC-08-PREVIEW-003` | A retained current-selection choice previews the correct FACT; closing the menu during an EXPERIENCE read removes the card and ignores its late response without changing the selected endpoint. |

Browser acceptance: check both multi-pickers, modifier-free multiple selection,
Clear, arrow-key navigation, Enter/Space and Escape; check searched and retained
LINK results, click-through previews, light/dark themes, and narrow
viewport wrapping without horizontal overflow.

The Markdown CLI case requires `src-tauri/binaries/hasm_markdown.exe`; if absent,
run `npm run build:markdown` first. Each subprocess has a 10-second watchdog and
reports stdout/stderr on failure. Paths include spaces to cover native argument
passing. These checks exercise the actual editor binary's headless verification
and description-loading commands, not interactive GUI rendering or
`open_folder_workspace` mounting. Interactive editor-window acceptance remains
covered by the manual desktop scenarios in
[EVAL-05](./14-EVL-05_Edit_on_HASM_Markdown.md).

| EVL Test ID | Automated Test Target | Status |
| --- | --- | --- |
| `TC-EVL-08-E2E-001` | `test/seq01.test.jsx` (`TC-08-E2E-001`) | Automated |
| `TC-EVL-08-E2E-002` | `src-tauri/src/hasm/entity_creation_commands.rs` (`creates_person_experience_fact_and_link_in_real_workspace`) + `test/seq08.test.jsx` (`TC-08-REACT-001`) | Automated |
| `TC-EVL-08-E2E-003` | `src-tauri/src/hasm/entity_creation_commands.rs` (`creates_person_experience_fact_and_link_in_real_workspace`) + `test/seq08.test.jsx` (`TC-08-REACT-003`) | Automated |
| `TC-EVL-08-E2E-004` | `src-tauri/src/hasm/entity_creation_commands.rs` (`rejects_invalid_inputs_and_rolls_back_fact_creation`) | Automated |
| `TC-EVL-08-COMP-001` | `src-tauri/src/hasm/entity_creation_commands.rs` (`rejects_invalid_inputs_and_rolls_back_fact_creation`) | Automated |
| `TC-EVL-08-COMP-002` | `test/seq08.test.jsx` (`TC-08-REACT-002`) + `src-tauri/src/hasm/entity_creation_commands.rs` (`rejects_invalid_inputs_and_rolls_back_fact_creation`) | Automated |
| `TC-EVL-08-COMP-003` | `src-tauri/src/hasm/entity_creation_commands.rs` (`rejects_invalid_inputs_and_rolls_back_fact_creation`) | Automated |
| `TC-EVL-08-RUST-001` | `src-tauri/src/hasm/entity_creation_commands.rs` (`verifies_domain_invariants_for_all_entity_types`) | Automated |
| `TC-EVL-08-RUST-002` | `src-tauri/src/hasm/entity_creation_commands.rs` (`rolls_back_workspace_on_creation_failure`) | Automated |
| `TC-EVL-08-RUST-003` | `src-tauri/src/hasm/entity_creation_commands.rs` (`rejects_invalid_inputs_and_rolls_back_fact_creation`) | Automated |
| `TC-EVL-08-E2E-005` | `test/seq02.test.jsx` (`TC-08-E2E-INIT-001`) + `test/seq08.test.jsx` (`TC-08-REACT-004`) | Automated |

---

## 5. Requirement Traceability Rows (Automated)

Each row below traces one automated test (vitest test name or `cargo test` name)
to the requirements it verifies, with its Positive/Negative classification.

| Test ID | Trace Requirement ID | Test Type | Automated Target | Expected Result |
| --- | --- | --- | --- | --- |
| **`TC-08-E2E-001`** | `REQ-08-001` `REQ-08-002` | Positive (Workspace Creation Flow) | `test/seq01.test.jsx` — `TC-08-E2E-001 creates a workspace and routes to loading-model` | Native save dialog result feeds `create_hasm_workspace` and the app routes to `/loading-model`. |
| **`TC-08-REACT-008`** | `REQ-08-001` | Negative (Cancelled Dialog / Scaffolding Failure) | `test/seq08.test.jsx` — `TC-08-REACT-008 cancels or fails the native save dialog without scaffolding a workspace` | Cancelling the OS save dialog performs no scaffolding and no navigation; a scaffolding failure shows `ERR_WORKSPACE_CREATION_FAILED` and stays on `/select`. |
| **`TC-08-RUST-100`** | `REQ-08-002` `REQ-08-100` | Negative (Rollback within Scaffolding SLA) | `cargo test rolls_back_workspace_on_creation_failure` (`src-tauri/src/hasm/entity_creation_commands.rs`) | Occupied target path fails with `ERR_WORKSPACE_CREATION_FAILED` within the 3,000 ms SLA and leaves no workspace artifacts. |
| **`TC-08-RUST-101`** | `REQ-08-002` `REQ-08-016` `REQ-08-100` | Positive (Workspace Scaffolding) | `cargo test scaffolds_workspace_and_entity_directories` (`src-tauri/src/hasm/entity_creation_commands.rs`) | Entity directories, SQLite schema with `'[]'` URL-array defaults, `main.db`, and `.hasm/lock` are generated. |
| **`TC-08-RUST-102`** | `REQ-08-010` `REQ-08-011` `REQ-08-012` `REQ-08-013` `REQ-08-016` `REQ-08-020` `REQ-08-101` | Positive (Full Entity Creation Round-Trip) | `cargo test creates_person_experience_fact_and_link_in_real_workspace` (`src-tauri/src/hasm/entity_creation_commands.rs`) | All four entity types persist with URL arrays, parent-tree and timeline bindings, scaffolded `{UUID}/main.md`, each call measured under the 5,000 ms SLA. |
| **`TC-08-RUST-103`** | `REQ-08-010` `REQ-08-011` `REQ-08-012` `REQ-08-013` `REQ-08-018` `REQ-08-020` `REQ-08-101` | Negative (Validation and Rollback) | `cargo test rejects_invalid_inputs_and_rolls_back_fact_creation` (`src-tauri/src/hasm/entity_creation_commands.rs`) | `EmptyName`, `TimeInversion`, `SelfLoopLink`, and `OrphanLinkError` are refused; a scaffold write failure rolls back SQLite and purges the entity folder so no partial default Markdown remains. |
| **`TC-08-RUST-104`** | `REQ-08-013` `REQ-08-102` | Positive (In-Memory Invariant SLA) | `cargo test link_graph_invariant_checks_complete_within_sla` (`src-tauri/src/hasm/entity_creation_commands.rs`) | A valid LINK passes `verify()` and a self-loop candidate is detected as `SelfLoopLink`, both within the measured 5 ms SLA. |
| **`TC-08-REACT-001`** | `REQ-08-014` | Positive (Dedicated Creation Route) | `test/seq08.test.jsx` — `TC-08-REACT-001 shows Create New Entity button on Visualizer and moves to creation page` | The Visualizer "Create New Entity" action navigates to `/entity-create`. |
| **`TC-08-REACT-002`** | `REQ-08-014` `REQ-08-021` | Positive (Creation Reload and Sync) | `test/seq08.test.jsx` — `TC-08-REACT-002 creates PERSON on dedicated page and returns to visualizer` | Successful creation on the dedicated page reloads the model and returns to `/visualizer` for re-layout. |
| **`TC-08-REACT-003`** | `REQ-08-014` `REQ-08-021` | Negative (Backend Error on Dedicated Page) | `test/seq08.test.jsx` — `TC-08-REACT-003 shows backend link validation errors on dedicated page` | `SelfLoopLink` stays visible on `/entity-create`; no model reload and no `compute_visualizer_layout` call happen after the failure. |
| `TC-08-IPC-SEC-001` | `REQ-08-014` | Negative (Disabled Controls) | `test/experience-picker-ipc.test.jsx` — all four entity types | With `VITE_ENABLE_SECURITY_LEVEL=false` no level input is present and the real JS invoke sends level 1. |
| `TC-08-IPC-SEC-002` | `REQ-08-014` | Positive (Enabled Controls) | `test/experience-picker-ipc.test.jsx` — all four entity types | With the flag true each visible input sends the edited level through the real JS invoke. |
| `TC-08-IPC-SEC-003` | `REQ-08-014` | Positive (Default Controls) | `test/experience-picker-ipc.test.jsx` — unset flag | The default build exposes the existing level input at 1. |
| **`TC-08-REACT-006`** | `REQ-08-015` | Negative (Bootstrap Failure and Duplicate Submission) | `test/seq08.test.jsx` — `TC-08-REACT-006 reports creation errors and blocks duplicate submissions` | Pending confirmation sends exactly one invoke, blocks editing, surfaces the backend error, and performs no model reload. |
| **`TC-08-REACT-LINK-001`** | `REQ-08-016` `REQ-08-018` | Positive (URL Arrays and Default Description) | `test/seq08.test.jsx` — `TC-08-REACT-LINK-001 includes URL arrays in all four creation payloads` | All four payloads carry the entered `link` array and an empty description field; no Description control is rendered. |
| **`TC-08-REACT-REL-001`** | `REQ-08-011` `REQ-08-017` | Positive (EXPERIENCE Multi-Select) | `test/seq08.test.jsx` — `TC-08-REACT-REL-001 ... lists all experiences and submits multiple selected UUIDs` (FACT and EXPERIENCE) | All EXPERIENCE records listed with search and keyboard toggling; selections survive type switches and serialize as UUID arrays into `experienceIds` / `parentExperienceIds`. |
| **`TC-08-IPC-PICKER-001`** | `REQ-08-017` | Positive (Picker Through Real Invoke) | `test/experience-picker-ipc.test.jsx` — `TC-08-IPC-PICKER-001 ... sends selected UUIDs from the actual form` | The actual creation form filters, multi-selects, and passes UUID arrays through the real creation invoke. |
| **`TC-08-REACT-REL-002`** | `REQ-08-017` | Negative (Empty List, Cleared Selection, Creation Failure) | `test/seq08.test.jsx` — `TC-08-REACT-REL-002 ... supports clearing a selection and empty experience lists` | Clear sends `[]`, the creation failure alert stays visible, and an empty EXPERIENCE list shows a disabled explicit empty state. |
| **`TC-08-IPC-DATE-001`** | `REQ-08-012` `REQ-08-022` | Positive (Calendar-Only FACT Dates) | `test/date-input-ipc.test.jsx` — `TC-08-IPC-DATE-001 selects FACT dates with calendar-only controls through the create invoke` | Start/end fields are native `type="date"` calendars and selected dates reach the unchanged `create_fact` payload. |
| **`TC-08-REACT-009`** | `REQ-08-022` | Negative (Inverted Calendar Dates) | `test/seq08.test.jsx` — `TC-08-REACT-009 surfaces backend TimeInversion from calendar-only FACT dates` | Calendar controls keep the existing payload shape; an inverted range surfaces the backend `TimeInversion` error with no model reload. |
| **`TC-08-REACT-SEARCH-001`** | `REQ-08-019` | Positive (Endpoint Search and Selection) | `test/seq08.test.jsx` — `TC-08-REACT-SEARCH-001 independently searches LINK endpoints and submits selected entities` | Origin/Target filter independently with trimmed case-insensitive matching; only selected typed UUIDs are serialized. |
| **`TC-08-REACT-SEARCH-002`** | `REQ-08-019` | Negative (No Results and Retained Selection) | `test/seq08.test.jsx` — `TC-08-REACT-SEARCH-002 handles no results, retained selections, clearing, and form switching` | Zero matches show an accessible notice without auto-selection; hidden current selections stay visible; placeholder clears the endpoint. |
| **`TC-08-REACT-SEARCH-003`** | `REQ-08-019` | Positive (Duplicate Names and UUID Search) | `test/seq08.test.jsx` — `TC-08-REACT-SEARCH-003 distinguishes duplicate names and searches unnamed entities by UUID` | Duplicate names are distinguished by type and UUID; unnamed entities are searchable and selectable by UUID. |

Run commands:

- `npm run test:eval-08`
- `cargo test entity_creation_commands` (from `src-tauri`)
- `cargo test --manifest-path src-tauri/Cargo.toml --test model_initialization_ipc --test entity_editor_commands_ipc` (from the repository root; exercises registered native invokes, not only direct Rust calls)