# EVAL-04: Entity MetaData Editing & Saving Test Specification

This document defines the comprehensive test matrix, acceptance criteria, and traceability mapping for validating the Entity MetaData Editing & Saving workflow, single-entity domain validations, SQLite persistence transactions with dynamic/fixed timeouts, window-focus `mtime` and file existence checks, manual Markdown refreshes, missing/deleted file exception routing, and route navigation guards (`SEQ-04` / `REQ-04`).

Tests are structured across three distinct test levels: **Desktop App Level (E2E / System Integration)**, **React Level (Frontend Component & Form State)**, and **Tauri Level (Rust Domain Engine & Database Contract)**.

Automated React and IPC coverage runs through `npm run test:eval-04`. Automated Rust coverage runs through `cargo test entity_editor_commands`; it loads, reloads, detects deletion, and persists metadata for PERSON, EXPERIENCE, FACT, and LINK using a populated workspace package.

## Automated Test Inventory

### Confirmed entity deletion

| Test ID | Trace Requirement ID | Test Type | Test name / evidence |
| --- | --- | --- | --- |
| `TC-NAV-DELETE-001` | `REQ-04-RULE-028` `REQ-04-RULE-029` | Positive (Confirmed Deletion) | Actual ticket and JS IPC wrapper: required FACT reassignment, child parent, individual LINK choices, confirmation, pending state and post-delete reload/verification. |
| `TC-NAV-DELETE-002` | `REQ-04-RULE-028` | Negative (IPC Failure) | FACT and LINK confirmations surface IPC failure and retain the ticket. |
| `TC-NAV-DELETE-003` | `REQ-04-RULE-028` `REQ-04-RULE-029` | Positive (Optional Reassignment) | FACT reassignment is optional when another EXPERIENCE remains; FACT-related LINK selection reaches the invoke. |
| `TC-NAV-DELETE-004` | `REQ-04-RULE-028` | Negative (Restricted Deletion) | PERSON deletion is unavailable and read-only FACT deletion is disabled. |
| `TC-NAV-DELETE-005` | `REQ-04-RULE-028` `REQ-04-RULE-029` | Negative (No Replacement) | An EXPERIENCE with exclusively belonging FACTs cannot be deleted without an available replacement; the dialog explains why. |
| `TC-04-IPC-DELETE-001` | `REQ-04-RULE-028` `REQ-04-RULE-029` | Positive (Native Archive) | Generated native invoke: required reassignment, parent and LINK choices, archived Markdown/assets/metadata and verified reload. |
| `TC-04-IPC-DELETE-002` | `REQ-04-RULE-028` `REQ-04-RULE-029` | Positive (Reference Cleanup) | Generated native invokes: FACT and LINK deletion, retained endpoints and reference cleanup. |
| `TC-04-IPC-DELETE-003` | `REQ-04-RULE-028` `REQ-04-RULE-029` | Negative (Stale/Locked/Missing) | Stale choices, read-only lock, missing storage and PERSON deletion are rejected without committing. |
| `TC-04-IPC-DELETE-004` | `REQ-04-RULE-029` | Negative (Fault Recovery) | Pending pre-commit archive is restored and pending post-commit archive is finalized before synchronization. |
| `TC-04-IPC-DELETE-005` | `REQ-04-RULE-029` | Negative (Cycle Rejection) | Parent choices that create a cycle together are rejected. |
| `TC-04-IPC-DELETE-006` | `REQ-04-RULE-029` | Positive (Retained Placements) | Other FACT placements remain without an optional replacement. |

Run the frontend cases with `npm run test:robustness` and native cases with
`cargo test --test entity_deletion_ipc` from `src-tauri`. The React tests mock
the native transport; the native tests exercise registered Tauri dispatch and
real SQLite and filesystem fixtures. Installed-desktop accessibility, actual
mouse/keyboard interaction, and archive recovery after an OS/process crash
remain manual acceptance checks.

### Shared entity information preview

`test/entity-info-preview.test.jsx` runs under `npm run test:eval-04`, using the
real JavaScript IPC wrapper with only the native transport mocked:

| Test ID | Trace Requirement ID | Test Type | Test name / evidence |
| --- | --- | --- | --- |
| `TC-04-PREVIEW-001` (all four types) | `REQ-04-RULE-027` | Positive (Hover Card) | Hover shows a Bootstrap card with identity, typed metadata, readable relationship names and description; exact `load_entity_detail` invoke and payload asserted. |
| `TC-04-PREVIEW-002` | `REQ-04-RULE-027` | Positive (Keyboard Access) | Keyboard focus opens, Escape dismisses, existing `aria-describedby` restored. |
| `TC-04-PREVIEW-003` | `REQ-04-RULE-027` | Negative (Debounce Cancel) | Transient hover cancels before IPC; leaving dismisses the card. |
| `TC-04-PREVIEW-004` | `REQ-04-RULE-027` | Negative (Stale Response) | Late responses cannot replace another entity card; navigation dismisses. |
| `TC-04-PREVIEW-005` | `REQ-04-RULE-027` | Negative (Error/Timeout) | Backend errors and stalled reads show explicit errors. |
| `TC-04-PREVIEW-006` | `REQ-04-RULE-027` | Positive (Graph Bridge) | Host graph hover bridge opens card, coordinates fit viewport, leave dismisses, external URLs are ignored. |
| `TC-04-PREVIEW-007` | `REQ-04-RULE-027` | Negative (Inert Content Cap) | Markdown/HTML displayed as inert text and excerpt limited to 400 characters plus ellipsis. |
| `TC-04-PREVIEW-008` | `REQ-04-RULE-027` | Negative (Viewport/Unmount) | Outer scroll/resize dismiss and late unmounted responses are ignored. |
| `TC-04-PREVIEW-POS-001` | `REQ-04-RULE-027` | Positive (Viewport Fit) | Pointer-triggered cards stay inside large and narrow viewports and do not intercept pointer events. |
| `TC-04-PREVIEW-POS-002` | `REQ-04-RULE-027` | Positive (Stable Pointer) | The preview stays stable while the pointer moves and does not interrupt source clicks. |
| `TC-04-IPC-DATE-001` | `REQ-04-RULE-017` | Positive (Calendar IPC) | Birthday, death and FACT occurrence use calendar-only controls and update the real save invoke, retaining time/zone suffixes. |
| `TC-04-IPC-DATE-002` | `REQ-04-RULE-017` `REQ-04-RULE-021` | Negative (Invalid Stored Text) | Invalid stored date text is warned and preserved until replaced, with Japanese labels. |
| `TC-08-PREVIEW-001` (FACT and EXPERIENCE) | `REQ-04-RULE-027` | Positive (Creation Dropdowns) | Real creation dropdown choices show the shared card through exact typed detail invokes before selection; modifier-free toggling and Escape remain usable. |
| `TC-08-PREVIEW-002` (Origin and Target) | `REQ-04-RULE-027` | Positive (Search Results) | Real LINK search results show focus previews without selecting; replacing results dismisses the card; selecting a result closes the preview. |
| `TC-08-PREVIEW-003` | `REQ-04-RULE-027` | Negative (Dismissed Reads) | Retained LINK selections preview correctly; closing a menu dismisses a pending read and ignores its eventual response. |
| `TC-03-VIEW-PREVIEW-001` (`test/visualizer-view.test.jsx`) | `REQ-04-RULE-027` | Positive (Visualizer Badge) | Actual main visualizer EXPERIENCE badge opens the shared card through the real JS invoke wrapper; clicking still opens its typed ticket and dismisses the card, without submodule edits. |

Desktop acceptance: hover/focus typed links in ticket Details, related LINK
buttons, ticket graph lists/FACT titles/EXPERIENCE badges, and the main visualizer's
EXPERIENCE badges. Inspect metadata and excerpts, theme contrast, narrow-screen
bounds and keyboard dismissal. Confirm ordinary navigation and draft guards
remain intact. Also hover/focus creation-page EXPERIENCE choices and LINK search
results, including retained selections; test keyboard selection, clearing, and
preview dismissal when menus close or results change. The main canvas's existing
submodule tooltip remains outside this shared-card implementation.

### Entity Extended Commit Graph

Shared badge behavior and main-view return/re-verification are covered by
`TC-03-VIEW-002` to `TC-03-VIEW-005` in `test/visualizer-view.test.jsx`.
EVAL-04 continues to check current FACT title emphasis, navigation guards and
graph/table scrolling with the badges mounted.

`TC-04-GRAPH-SEQUENTIAL-004` checks that an EXPERIENCE badge loads its specific
EXPERIENCE through the real detail IPC wrapper. `TC-04-GRAPH-SEQUENTIAL-001`
also verifies that editing removes all table links, including badge links.

`TC-04-GRAPH-SEQUENTIAL-001` verifies `REQ-04-RULE-025`: the real IPC wrapper
requests SequentialIndex, deduplicated newest-first title rows align with shared
30px/37px renderer geometry, only the addressed FACT title is bold, table scroll
and clamped graph wheel input use one offset, and language changes/editing retain
bold identity. `TC-04-GRAPH-SEQUENTIAL-002` checks PERSON, EXPERIENCE and LINK
tickets do not falsely bold any FACT title. Browser acceptance measures title
row centers against SVG marker centers before/after scrolling at wide/narrow
widths and verifies the matching title's computed font weight.
`TC-04-GRAPH-SEQUENTIAL-003` verifies FACT title navigation through the real
detail invoke with workspace context and moves bold emphasis to the destination.
`TC-04-GRAPH-SEQUENTIAL-005` checks separate title/occurrence columns, compact
localized timestamps, full accessible/tooltip values, date-only, missing and
invalid occurrence values. `TC-04-GRAPH-SEQUENTIAL-006` checks that resizing
narrows all lanes without another layout invoke. Browser acceptance checks the
page and graph for horizontal overflow, single-line columns and visible timestamps, row alignment
before and after vertical scrolling, visible LINK geometry, and the absence of
shell ruling on the ticket while another route retains its original background.

`TC-04-GRAPH-EMPHASIS-001` (FACT, EXPERIENCE, LINK, PERSON) verifies
`REQ-04-RULE-024` with the real SVG renderer: current markers/timelines/LINK
segments use highlight colors on load, retain them while another entity is
hovered and after pointer leave, show a bold current caption and accessible
current list entry, and remain emphasized after language redraw and when editing
disables navigation. No additional layout invoke is permitted.

| Test ID | Trace Requirement ID | Test Type | Expected result |
| --- | --- | --- | --- |
| `TC-04-GRAPH-SEQUENTIAL-001` | `REQ-04-RULE-025` | Positive (Aligned Titles) | Real IPC wrapper requests SequentialIndex; deduplicated newest-first title rows share renderer geometry and one scroll offset with clamped wheel input; only the addressed FACT title is bold through language changes and editing. |
| `TC-04-GRAPH-SEQUENTIAL-002` (PERSON, EXPERIENCE, LINK) | `REQ-04-RULE-025` | Negative (No False Bold) | Tickets whose addressed entity is not a FACT never bold any FACT title and expose no `aria-current` row. |
| `TC-04-GRAPH-SEQUENTIAL-003` | `REQ-04-RULE-025` | Positive (Title Navigation) | FACT title navigation uses the real detail invoke with workspace context and moves bold emphasis to the destination, with no whole-model reload. |
| `TC-04-GRAPH-SEQUENTIAL-004` | `REQ-04-RULE-023` `REQ-04-RULE-025` | Positive (Badge Navigation) | The table EXPERIENCE badge opens its specific EXPERIENCE through the real detail IPC wrapper. |
| `TC-04-GRAPH-SEQUENTIAL-005` | `REQ-04-RULE-025` | Positive (Occurrence Values) | FACT rows have separate title and occurrence columns, compact localized date and time, full accessible/tooltip values, preserved date-only days, and missing or invalid values. |
| `TC-04-GRAPH-SEQUENTIAL-006` | `REQ-04-RULE-025` | Positive (Responsive Lanes) | Resizing narrows lanes to the available panel width without a new layout invoke. |
| `TC-04-GRAPH-EMPHASIS-001` (all four types) | `REQ-04-RULE-024` | Positive (Persistent Emphasis) | Current markers/timelines/LINK segments keep highlight colors on load, across hover/pointer-leave and language redraw, with a bold current caption, accessible current list entry, and no additional layout invoke while editing disables navigation. |
| `TC-04-GRAPH-EMPHASIS-002` | `REQ-04-RULE-024` | Negative (No Invented Emphasis) | A PERSON ticket never paints FACT markers with the current-entity highlight, hover enter/leave triggers no new layout invoke, and the bold caption plus `aria-current` entry still identify the addressed PERSON. |

Run `npm run test:eval-04` for extraction, rendered SVG and real JS-to-Tauri
wrapper tests in `test/entity-commit-graph.test.jsx`. Native layout geometry
continues to use the existing EVAL-03 command contract without a Rust change.

| Test ID | Requirement | Test Type | Expected result |
| --- | --- | --- | --- |
| `TC-04-GRAPH-001` | `REQ-04-RULE-023` | Positive (Extraction) | FACT retains all placements/ancestors, solid/hollow markers, nearest neighbors and both LINK directions, excluding unrelated events/LINKs without input mutation. |
| `TC-04-GRAPH-002` | `REQ-04-RULE-023` | Positive (Extraction) | EXPERIENCE retains direct facts, immediate parents/children, linked endpoints and supporting timeline FACTs. |
| `TC-04-GRAPH-003` | `REQ-04-RULE-023` | Positive (Extraction) | LINK retains endpoints and all related FACT placements without following other LINKs. |
| `TC-04-GRAPH-004` | `REQ-04-RULE-023` | Positive (Extraction) | PERSON retains owned branches and descendants with different owners, with their FACTs. |
| `TC-04-GRAPH-005` | `REQ-04-RULE-023` | Negative (Cycle/Missing) | Cyclic/missing references terminate safely; absent model is distinct. |
| `TC-04-GRAPH-006` | `REQ-04-RULE-023` | Positive (Determinism) | Simultaneous FACT neighbors use deterministic UUID order; current detail overlays metadata without losing other fields. |
| `TC-04-GRAPH-IPC-001` (all types) | `REQ-04-RULE-023` | Positive (Render IPC) | Page-bottom graph renders SVG after the real API wrapper sends the exact extracted model and filter to mocked Tauri transport, without workspace reload. |
| `TC-04-GRAPH-IPC-002` | `REQ-04-RULE-023` | Positive (Selection) | Actual rendered FACT selection opens its ticket through `load_entity_detail`; editing blocks selection and accessible list navigation. |
| `TC-04-GRAPH-IPC-003` (LINK, EXPERIENCE) | `REQ-04-RULE-023` | Positive (Typed Routes) | Rendered LINK and EXPERIENCE selection invokes the exact typed detail route; hover identifies the entity. |
| `TC-04-GRAPH-007` | `REQ-04-RULE-023` | Negative (Missing Model/Layout) | Missing-model and native-layout failures remain explicit without losing Markdown. |
| `TC-04-GRAPH-008` | `REQ-04-RULE-023` | Positive (Language/Save) | Japanese graph chrome changes without another invoke; saved metadata appears and unverified navigation stays disabled. |
| `TC-04-GRAPH-009` | `REQ-04-RULE-023` | Negative (Abandoned Ticket) | Abandoned layout failures cannot update the page. |
| `TC-04-GRAPH-010` | `REQ-04-RULE-023` | Negative (Renderer Failure) | Renderer failures remain explicit without losing Markdown. |
| `TC-04-GRAPH-011` | `REQ-04-RULE-023` | Negative (Layout Timeout) | A stalled layout times out at exactly ten seconds, with no alert before the threshold; later success cannot replace the error. |

Desktop acceptance: on every entity type at wide and narrow widths, the graph
follows all ticket content, the scene measures 300px high, overflow stays inside
the panel, labels and markers use the active theme, and long names remain
discoverable through Graph entities. Check reflected markers, dashed LINK
selection, keyboard list navigation, and viewport-dependent EXPERIENCE LINK
attachments while scrolling. Native transport and visual acceptance are distinct
from isolated Rust geometry tests.

### Ticket Display Preferences

| Test ID | Requirement | Test Type | Expected result |
| --- | --- | --- | --- |
| `TC-04-REACT-DISPLAY-001` (all entity types) | `REQ-04-RULE-021` | Positive (Language Switch) | English/Japanese labels and accessible controls switch immediately; names, URLs and rendered Markdown stay unchanged, with no save or reload. |
| `TC-04-REACT-DISPLAY-002` | `REQ-04-RULE-017`, `REQ-04-RULE-021` | Negative (Malformed Dates) | Japanese date-only and timestamp formatting preserves calendar day/local time; malformed/impossible dates remain verbatim, and changing language preserves the raw active date draft. |
| `TC-04-REACT-DISPLAY-003` | `REQ-04-RULE-022` | Positive (Text Presets) | All three text presets apply without discarding a draft; remount resets language and size to English/Medium. |
| `TC-04-REACT-DISPLAY-004` | `REQ-04-RULE-021` | Positive (Translated Feedback) | Reference fallbacks, external-link editor labels and validation translate; an existing field validation message switches back to English correctly. |
| `TC-04-REACT-DISPLAY-005` | `REQ-04-RULE-022`, `REQ-04-RULE-026` | Negative (No Persistence) | Language and size changes perform no save/reload IPC, write nothing to browser storage, and never restyle or alter the rendered Markdown body (`test/seq04.test.jsx`). |
| `TC-NAV-DISPLAY-001` | `REQ-04-RULE-021`, `REQ-04-RULE-022` | Positive (Real Wrapper) | Japanese GUI controls save unchanged ISO timestamp payloads through the real typed wrapper/native transport mock, retain Markdown, and return through re-verification to the graph. |

Run component cases with `npm run test:eval-04`, and the real-wrapper case
with `npm run test:robustness`. Native commands and persisted schemas do not change.
Browser acceptance checks all presets at desktop/mobile widths, measuring
14/16/18px body text and proportionally scaled headings/controls, with no
horizontal page overflow. English/Japanese controls and date labels must remain
readable under the active theme; Markdown words and source remain unchanged.

### Entity Titles and Related LINK Coverage

| Test ID | Requirement | Test Type | Expected result |
| --- | --- | --- | --- |
| `TC-04-REACT-REF-009` (PERSON, EXPERIENCE, FACT, LINK) | `REQ-04-RULE-018` | Positive (Identity Header) | Each entity ticket header displays `{TYPE}/{UUID}` above its human-readable title. |
| `TC-04-REACT-TIME-001` | `REQ-04-RULE-017` | Positive (Readable Dates) | FACT date-only occurrences render as a readable localized date; timestamps render as a readable local date/time with time-zone abbreviation; invalid values remain visible and stored values are unchanged. |
| `TC-04-REACT-REF-001` | `REQ-04-RULE-018` | Positive (Readable Titles) | EXPERIENCE owner/parents, FACT people/experiences and LINK endpoints display titles without UUIDs or forms; graph LINK references render as wrapping title bullets. |
| `TC-04-OWNER-001` | `REQ-04-RULE-018` | Positive (Inherited Owners) | `test/seq04.test.jsx` shows all distinct recursive parent owners as navigable PERSON references without reloading. |
| `TC-04-OWNER-002` | `REQ-04-RULE-018` | Negative (Missing and Cyclic Parents) | `test/seq04.test.jsx` terminates on cycles and missing parents without displaying a nil owner. |
| `TC-04-PREVIEW-OWNER-001` | `REQ-04-RULE-018` `REQ-04-RULE-027` | Positive (Inherited Preview Owner) | `test/entity-info-preview.test.jsx` resolves an inherited owner after the real detail invoke. |
| `TC-04-REACT-REF-010` | `REQ-04-RULE-018`, `REQ-04-RULE-020` | Positive (Grouped Endpoints) | LINK related entities group nested linked titles under one bullet per type, including interleaved repeated types. Types follow first appearance and titles retain within-type order; unavailable endpoints have readable non-interactive labels. |
| `TC-04-REACT-REF-002` (PERSON, EXPERIENCE, FACT) | `REQ-04-RULE-019` | Positive (Deduplicated LINKs) | Incoming/outgoing endpoint references and explicit graph links are deduplicated, unrelated links excluded, and each title has a collapsed accessible disclosure for type and endpoint sub-bullets; long values wrap and editing disables navigation. |
| `TC-04-REACT-REF-003` | `REQ-04-RULE-018`, `REQ-04-RULE-019` | Negative (Missing References) | Missing references show unavailable labels without UUID fallbacks or broken navigation. |
| `TC-04-REACT-REF-004` | `REQ-04-RULE-019` | Negative (Empty vs Unavailable) | Empty list and unavailable model are distinguished explicitly. |
| `TC-04-REACT-REF-005` | `REQ-04-RULE-019` | Positive (Related Navigation) | Related LINK opens its detail and resolves endpoint titles with retained workspace/model context. |
| `TC-04-REACT-REF-006` | `REQ-04-RULE-005`, `REQ-04-RULE-019`, `REQ-04-FUNC-212` | Negative (Unverified Guard) | Saved summary immediately updates endpoint text; unverified workspace shows guidance and disables related navigation without reloading the model. |
| `TC-04-REACT-REF-007` (11 reference cases) | `REQ-04-RULE-020` | Positive (Typed Navigation) | Details links open exact typed tickets for owner, parent, people, experiences, graph links and every LINK endpoint type without starting editing or reloading the workspace. |
| `TC-04-REACT-REF-008` | `REQ-04-RULE-020` | Negative (Draft/Save Guards) | Drafts disable Details navigation; cancel restores it, while save leaves readable disabled labels and re-verification guidance. |
| `TC-NAV-REF-002` (all destination types) | `REQ-04-RULE-020` | Positive (Real Invoke) | Details link -> real JS wrapper -> mocked Tauri transport invokes `load_entity_detail` with exact destination type, ID and workspace path, with no whole-model reload. |
| `TC-NAV-REF-001` | `REQ-04-RULE-018`, `REQ-04-RULE-019` | Positive (Related LINK Invoke) | Actual ticket -> real JS wrapper -> mocked Tauri transport invokes `load_entity_detail` with exact LINK identity; destination retains titles with no whole-model reload. |

Run reference component cases with `npm run test:eval-04`, and the
component-to-invoke navigation case with `npm run test:robustness`.
No native command or serialized schema change is required.

### Reader-First Inline Editing

| Test ID | Requirement | Test Type | Expected result |
| --- | --- | --- | --- |
| `TC-04-REACT-INLINE-001` (all entity types) | `REQ-04-RULE-015` | Positive (Reader First) | Readable summary/links/Markdown appear with no mounted metadata form/input/textarea or Save/Cancel controls; only the two display preference selects are mounted. |
| `TC-04-REACT-INLINE-002` | `REQ-04-RULE-016`, `REQ-04-FUNC-301`, `REQ-04-FUNC-304` | Positive (Section Editing) | Summary click focuses its only input; blur does not save, Escape discards, focus returns to content, and explicit Save preserves other fields. |
| `TC-04-REACT-INLINE-003` (all entity types) | `REQ-04-RULE-016`, `REQ-04-RULE-017` | Positive (Typed Payloads) | Detail edits produce exact typed payloads, keep summary/Markdown/URLs unchanged, and restore reading mode. |
| `TC-04-REACT-INLINE-004` | `REQ-04-RULE-004`, `REQ-04-RULE-016`, `REQ-04-RULE-017`, `REQ-04-FUNC-301`, `REQ-04-FUNC-302`, `REQ-04-FUNC-303`, `REQ-04-FUNC-304` | Negative (Validation/Failure) | Bad UUID input never invokes save; a pending save disables Cancel/Refresh and suppresses duplicate submits; failure retains input for continued editing and Cancel discards it back to reading mode. |
| `TC-04-IPC-PICKER-001` | `REQ-04-RULE-017` | Positive (Relationship Picker) | Real ticket controls select and remove EXPERIENCE titles and send UUID arrays through invoke. |
| `TC-04-IPC-PICKER-002` | `REQ-04-RULE-017` | Negative (Unresolved Retention) | Unavailable selections survive saving without displaying UUIDs. |
| `TC-04-REACT-INLINE-005` (all entity types) | `REQ-04-RULE-015`, `REQ-04-RULE-016`, `REQ-04-FUNC-301`, `REQ-04-FUNC-304` | Positive (Explicit Edit) | Explicit Edit details button reveals the typed form, Save and Cancel; Cancel discards input, removes the form and restores button focus without IPC. |
| `TC-04-REACT-INLINE-006` | `REQ-04-RULE-015`, `REQ-04-RULE-016` | Negative (Pending Guard) | While a Markdown refresh is pending, content triggers stay disabled, no editor or Save/Cancel controls mount, and reading mode keeps zero form controls (`test/seq04.test.jsx`). |
| `TC-04-REACT-LINK-001` to `006` | `REQ-04-RULE-012`, `REQ-04-RULE-016` | Positive (Link Editor Lifecycle) | Explicitly enter the link editor before mutating; successful saves/cancels close it, refresh retains drafts, and separate Open actions surface browser failures. |
| `TC-04-IPC-INLINE-001` in `src-tauri/tests/entity_editor_commands_ipc.rs` | `REQ-04-RULE-017`, `REQ-04-DATA-003` | Positive (Native Typed Saves) | All four native generated save handlers deserialize typed detail updates, persist them to SQLite and reload unchanged summary/Markdown. Included in `entity_editor_commands_external_links_round_trip_through_registered_tauri_invokes`. |

Run the React rows via `npm run test:eval-04`. Run native rows with
`cargo test --manifest-path src-tauri/Cargo.toml --test entity_editor_commands_ipc`.
`TC-NAV-002` asserts reading mode during repeated visits; `TC-NAV-008` clicks
the summary before saving through the actual JS IPC wrapper and route flow.
`TC-NAV-INLINE-001` clicks Edit details and verifies the exact `save_fact_detail`
invoke through that same real JS wrapper.

### Rendered Markdown Coverage

`npm run test:eval-04` includes the following component tests:

| Test ID | Requirement | Test Type | Expected result |
| --- | --- | --- | --- |
| `TC-04-REACT-PREVIEW-001` (all four entity types) | `REQ-04-RULE-014` | Positive (Formatted Rendering) | Semantic headings, strong/emphasis, lists, quotes, fenced code, and tables render; Edit is inside the preview panel. |
| `TC-04-REACT-PREVIEW-002` | `REQ-04-RULE-014` | Negative (Escaped HTML) | Raw script/image HTML stays text and JavaScript destinations never become links. |
| `TC-04-REACT-PREVIEW-003` | `REQ-04-RULE-014` | Negative (Opener Failures) | HTTP(S) links reach the OS opener; browser failures and relative-link rejection are visible. |
| `TC-04-REACT-LINK-005` | `REQ-04-RULE-012`, `REQ-04-RULE-014` | Positive (Draft-Preserving Refresh) | Refresh replaces the rendered heading while preserving unsaved URL edits. |

Theme/mobile appearance remains a visual acceptance check. The preview does
not add native filesystem/asset loading or change the editor's supported
input formats; see [SEQ-05](../arch/14-SEQ-05_Edit_on_HASM_Markdown.md).

### Navigation Lifetime Regression

`npm run test:robustness` runs actual graph, ticket, loader, and protected-route
components through the real JS IPC wrappers with only the native transport
mocked. `TC-NAV-002` covers twelve read-only inspection/return cycles;
`TC-NAV-003`/`012` cover late load/refresh errors after leaving a ticket;
`TC-NAV-008` covers save/return/re-verification and the explicit Go to
visualization action on the completion screen. These trace
`REQ-04-RULE-013`. `TC-NAV-EDIT-001` covers summary saves for PERSON,
EXPERIENCE, FACT, and LINK through the real typed invoke wrappers, reloads the
saved model, checks the pending and completed notices and read-only notice,
and verifies the updated model reaches visualization without a second load.
`TC-NAV-EDIT-002` covers a failed post-save storage verification and confirms
the error is propagated without offering visualization. These tests mock the
native transport rather than exercising Rust handlers or a desktop window.
See [EVAL-03](./12-EVL-03_Visualizer.md) for all race cases,
three-minute CI limits, and native dispatch coverage (`TC-NAV-IPC-001`).

| Test ID | Trace Requirement ID | Test Type | Automated evidence (`test/navigation-robustness.test.jsx`) |
| --- | --- | --- | --- |
| `TC-NAV-002` | `REQ-04-RULE-013`, `REQ-04-RULE-015`, `REQ-04-FUNC-101` | Positive (Repeated Visits) | Twelve read-only inspection/return cycles through the real JS wrappers keep reading mode, release every subscription under StrictMode, and remount the ticket route cleanly. |
| `TC-NAV-003` | `REQ-04-RULE-013` | Negative (Late Load Rejection) | A late ticket rejection cannot replace the graph with an error after leaving the ticket. |
| `TC-NAV-012` | `REQ-04-RULE-013` | Negative (Late Refresh Rejection) | Late Markdown refresh failures cannot redirect the returned graph. |
| `TC-NAV-008` | `REQ-04-RULE-013`, `REQ-04-FUNC-401`, `REQ-04-FUNC-402`, `REQ-04-FUNC-403` | Positive (Save-Return Cascade) | Saving, returning, and re-verifying run through real routes and API wrappers without listener leaks, ending at the visualization action. |
| `TC-NAV-EDIT-001` (all four types) | `REQ-04-RULE-009`, `REQ-04-FUNC-201`, `REQ-04-FUNC-207`, `REQ-04-FUNC-210`, `REQ-04-FUNC-212`, `REQ-04-FUNC-213` | Positive (Typed Save Cascade) | Summary saves run through the real typed invoke wrappers with pending/completed notices and no error popup, reload the saved model, and reach visualization without a second load. |
| `TC-NAV-EDIT-002` | `REQ-04-RULE-005`, `REQ-04-FUNC-212`, `REQ-04-FUNC-401`, `REQ-04-FUNC-402`, `REQ-04-FUNC-403` | Negative (Failed Re-verification) | A failed post-save storage verification propagates its error and never offers visualization while the workspace stays invalidated. |
| `TC-NAV-INLINE-001` | `REQ-04-RULE-016` | Positive (Real Typed Invoke) | Clicked detail content saves through the real `save_fact_detail` invoke wrapper. |

### External-Link Coverage

| Test ID / target | Requirement | Test Type | Expected result |
| --- | --- | --- | --- |
| `TC-04-REACT-LINK-001` in `test/seq04.test.jsx` | `REQ-04-RULE-010`, `REQ-04-RULE-012` | Positive (Round Trip) | Every entity loads icons, adds URLs, saves ordered arrays, cancels to last save, and clears to `[]`. |
| `TC-04-REACT-LINK-002` | `REQ-04-RULE-011`, `REQ-04-RULE-012` | Negative (Unsafe Input) | Database errors retain input; unsafe URLs never reach save IPC and have no clickable preview. |
| `TC-04-REACT-LINK-003` | `REQ-04-RULE-012` | Negative (Opener Rejection) | Reference click calls OS opener with the stored URL; opener rejection is visible. |
| `TC-04-REACT-LINK-004` | `REQ-04-RULE-011`, `REQ-04-RULE-012` | Negative (Spoofed Hosts) | Scheme validation and exact/subdomain classification reject spoofed site names. |
| `TC-04-REACT-LINK-005` | `REQ-04-RULE-012` | Positive (Draft Retention) | Markdown refresh retains unsaved URL edits. |
| `TC-04-REACT-LINK-006` | `REQ-04-RULE-005`, `REQ-04-RULE-009`, `REQ-04-RULE-010`, `REQ-04-FUNC-212` | Negative (No Package Reload) | Save patches route-model URLs and invalidates verification without a package reload (`load_hasm_model_db` is never invoked). |
| `TC-04-IPC-LINK-002` in `test/eval-04-ipc.test.js` | `REQ-04-RULE-010` | Positive (Invoke Contract) | All four JS invoke names/arguments retain the URL array; production save command registration is present. |
| `TC-04-IPC-LINK-001`: `entity_editor_commands_external_links_round_trip_through_registered_tauri_invokes` in `src-tauri/tests/entity_editor_commands_ipc.rs` | `REQ-04-RULE-001`, `REQ-04-RULE-010`, `REQ-04-RULE-011`, `REQ-04-DATA-003`, `REQ-08-016` | Negative (Malformed Payloads) | Tauri mock-runtime dispatch uses actual generated command handlers and serde: all four saves round-trip multiple URLs, reject unsafe/malformed payloads without replacing saved data, clear arrays, and accept legacy omitted fields. All four creation invokes persist valid arrays and reject unsafe URLs. Markdown body remains unchanged by metadata saves. |
| `TC-04-RUST-LINK-001`: `service::external_link_tests::external_links_survive_full_model_read_and_save` | `REQ-04-RULE-010` | Positive (Whole-Model Round Trip) | Whole-model persistence and metadata-only loading retain every entity's URLs. |
| `TC-04-RUST-LINK-002`: `service::external_link_tests::rejects_corrupt_external_link_storage_instead_of_returning_empty_arrays` | `REQ-04-RULE-011` | Negative (Corrupt Storage) | Corrupt/non-array/non-string/unsafe stored values fail explicitly. |
| `TC-04-RUST-LINK-003`: `definitions::tests::validates_external_url_arrays_without_logging_contents` | `REQ-04-RULE-011` | Positive (Safe URLs Accepted) | Empty arrays and HTTP(S) URLs pass validation; relative, credential-bearing, unsafe-scheme and whitespace URLs fail. |

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
| **TC-04-REACT-PERF-002** | `REQ-04-RULE-007``REQ-04-FUNC-501` | Positive (Cheap Poll) | `EntityDetailPage.tsx` | 1. Render a ticket.<br/>2. Dispatch a window `focus` event with an unmodified file. | 1. `check_entity_mtime` is invoked exactly once.<br/>2. Neither `load_hasm_model_db` nor `reload_entity_markdown` is invoked. |
| **TC-04-RUST-PERF-001** | `REQ-04-RULE-008` | Positive (Constant Time Edit) | `service::get_person_detail` / `service::save_person_detail` | 1. Create a demo workspace.<br/>2. Add 1,000 unrelated folder-only FACT entities.<br/>3. Load and save the PERSON ticket. | 1. The saved name round-trips.<br/>2. No row is created for any of the 1,000 unrelated folders, proving no whole-package folder sync ran. |
| **TC-04-RUST-PERF-002** | `REQ-04-RULE-007``REQ-04-FUNC-502` | Positive (Database-Free Poll) | `check_entity_mtime` | 1. Load a FACT ticket.<br/>2. Delete `main.db` from the workspace.<br/>3. Invoke `check_entity_mtime`. | 1. The call succeeds without the database.<br/>2. `is_deleted` is false and `current_mtime_ms` is non-zero. |

### Entity Editor Backend Coverage (automated)

Positive rows below follow the success-path convention: the healthy flow of an
error-handling requirement proves its guard is not triggered spuriously, while
the paired Negative row exercises the documented failure itself. Rust unit rows
run with `cargo test entity_editor_commands` (plus the two domain-invariant
tests under `cargo test entity_creation_commands`); `TC-04-IPC-DATA` rows run
the registered Tauri mock-runtime dispatch with
`cargo test --test eval04_data_contracts` from `src-tauri`.

| Test ID | Trace Requirement ID | Test Type | Automated target | Expected result |
| --- | --- | --- | --- | --- |
| **TC-04-RUST-010** | `REQ-04-FUNC-103``REQ-04-FUNC-104``REQ-04-FUNC-106``REQ-04-FUNC-108``REQ-04-FUNC-110``REQ-04-FUNC-114``REQ-04-DATA-002` | Positive (Load Contract) | `entity_editor_commands::tests::loads_and_reloads_every_entity_from_a_populated_workspace` | Every entity type loads its stored metadata, non-empty Markdown body and `loaded_mtime_ms`, and reloads the same ticket, with verification completing well inside the timeout budget and no spurious not-found or timeout errors. |
| **TC-04-RUST-011** | `REQ-04-RULE-008``REQ-04-FUNC-103``REQ-04-FUNC-104``REQ-04-FUNC-106``REQ-04-FUNC-114``REQ-04-DATA-008` | Negative (Load Rejection) | `entity_editor_commands::tests::rejects_unknown_entities_and_missing_markdown_without_touching_rows` | Unknown ids, unsupported entity types, malformed UUIDs and a deleted `main.md` reject with explicit `not found` / `ERR_ENTITY_NOT_FOUND` / `ERR_MARKDOWN_FILE_NOT_FOUND` errors; no payload is resolved and no database row is created by the rejected lookups. |
| **TC-04-RUST-012** | `REQ-04-RULE-007``REQ-04-FUNC-502``REQ-04-FUNC-503` | Positive (Modification Detection) | `entity_editor_commands::tests::detects_external_modification_on_the_focus_poll` | An unchanged file reports `is_modified = false`; a strictly newer on-disk mtime reports `is_modified = true` with `is_deleted = false` and a larger `current_mtime_ms`, without parsing content. |
| **TC-04-RUST-013** | `REQ-04-RULE-004``REQ-04-RULE-006``REQ-04-FUNC-209``REQ-04-FUNC-211` | Positive (Rollback Recovery) | `entity_editor_commands::tests::recovers_after_rejected_saves_without_corrupting_rows` | A save that fails validation leaves the stored row byte-identical (nothing was committed), and the user's corrected input persists successfully on the next attempt. |
| **TC-04-RUST-014** | `REQ-04-RULE-006``REQ-04-FUNC-202``REQ-04-FUNC-203``REQ-04-FUNC-204``REQ-04-FUNC-205``REQ-04-FUNC-206` | Negative (Domain Validation) | `entity_editor_commands::tests::rejects_invalid_domain_updates_through_entity_verify` | `verify()` rejects `start_time > end_time` (`TimeInversion`), self-loop LINK endpoints (`SelfLoopLink`) and whitespace-only names (`EmptyName`) on entities loaded from storage, while well-formed values pass. |
| **TC-04-RUST-015** | `REQ-04-FUNC-202``REQ-04-FUNC-203``REQ-04-FUNC-204``REQ-04-FUNC-205``REQ-04-FUNC-206` | Positive (Domain Acceptance) | `entity_creation_commands::tests::verifies_domain_invariants_for_all_entity_types` and `entity_creation_commands::tests::link_graph_invariant_checks_complete_within_sla` | `entity.verify()` executes for every entity type and accepts valid names, chronological time ranges, security levels and distinct LINK endpoints without raising `EntityVerificationFailed`. |
| **TC-04-RUST-016** | `REQ-04-RULE-003``REQ-04-FUNC-208` | Positive (Transactional Persistence) | `entity_editor_commands::tests::persists_metadata_for_every_entity_type` | All four typed saves commit and round-trip through SQLite immediately, far inside the 5,000ms transaction budget, without a `SaveTimeout`. |
| **TC-04-RUST-017** | `REQ-04-FUNC-502``REQ-04-FUNC-504``REQ-04-FUNC-508``REQ-04-DATA-005` | Positive (Deletion Detection) | `entity_editor_commands::tests::reports_deleted_markdown_without_database_access` | Deleting `main.md` makes the focus poll resolve `is_deleted = true` and makes the manual reload reject with `ERR_MARKDOWN_FILE_NOT_FOUND`, exactly as the payload contract specifies. |
| **TC-04-IPC-DATA-001** | `REQ-04-DATA-001``REQ-04-DATA-002``REQ-04-DATA-003``REQ-04-DATA-004``REQ-04-DATA-005``REQ-04-DATA-006``REQ-04-DATA-007` | Positive (Payload Contracts) | `eval04_payload_contracts_round_trip_through_registered_invokes` in `src-tauri/tests/eval04_data_contracts.rs` | Registered `load_entity_detail`, `check_entity_mtime`, `reload_entity_markdown` and `save_fact_detail` invokes serialize the exact camelCase request/response fields (`entityType`, `entityId`, `markdownBody`, `loadedMtimeMs`, `isModified`, `isDeleted`, `currentMtimeMs`, `message`) and round-trip a typed save through real serde and SQLite. |
| **TC-04-IPC-DATA-002** | `REQ-04-RULE-007``REQ-04-DATA-001``REQ-04-DATA-002``REQ-04-DATA-003``REQ-04-DATA-004``REQ-04-DATA-005``REQ-04-DATA-006``REQ-04-DATA-007``REQ-04-DATA-008``REQ-04-FUNC-104``REQ-04-FUNC-106``REQ-04-FUNC-502``REQ-04-FUNC-503``REQ-04-FUNC-504``REQ-04-FUNC-508` | Negative (Malformed Payloads) | `eval04_rejects_malformed_requests_with_explicit_editor_errors` in `src-tauri/tests/eval04_data_contracts.rs` | Unknown ids, unsupported types, missing required fields and untyped save payloads reject through registered dispatch with explicit editor errors; an unchanged file never reports `is_modified`, and a deleted `main.md` resolves `is_deleted = true` then rejects the reload with the `ERR_MARKDOWN_FILE_NOT_FOUND` marker that drives `/error-markdown` routing. |

Rows for the dedicated `hasm_markdown.exe` dynamic-timeout kill path
(`TC-04-RUST-006`) and the forced 5,000ms SQLite lock timeout
(`TC-04-RUST-007`) remain desktop acceptance scenarios pending their dedicated
implementation; their healthy counterparts are automated above.

---

## 1. Desktop App Level Tests (E2E / System Integration)

These integration tests verify end-to-end user flows on the JIRA-style ticket page, including loading, saving metadata with auto-invalidation, canceling edits, detecting external file modifications/deletions via `mtime`, refreshing Markdown manually, and handling deleted file route transitions.

| Test ID | Trace Requirement ID | Test Type | Test Scenario | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-04-E2E-001** | `REQ-04-RULE-001``REQ-04-FUNC-101``REQ-04-FUNC-109``REQ-04-FUNC-112``REQ-04-FUNC-114``REQ-04-FUNC-115` | Positive (Normal) | Load Entity Detail Ticket View | 1. Click a 3D node in `SEQ-03`.2. Observe route transition to `/entity-detail/:entity_type/:entity_id`. | 1. Page mounts and fetches metadata from Rust memory.2. `hasm_markdown.exe` verifies `main.md` with exit code `0` and renders JIRA-style ticket view successfully.3. Initial `loaded_mtime_ms` stored in React state. |
| **TC-04-E2E-002** | `REQ-04-RULE-003``REQ-04-RULE-005``REQ-04-FUNC-212``REQ-04-FUNC-213` | Positive (Persistence) | Save Valid Metadata In-Place | 1. Modify `security_level` and `description` on the detail ticket.2. Click "Save". | 1. MetaData persists to `hasm.db`.2. Rust sets `is_verified = false`.3. Success toast displays; user remains on current detail page. |
| **TC-04-E2E-003** | `REQ-04-FUNC-301``REQ-04-FUNC-302``REQ-04-FUNC-304` | Positive (Interaction) | Cancel Edits with Unsaved Changes | 1. Modify `name` field (`isDirty == true`).2. Click "Cancel".3. Select "Discard Changes" in modal. | 1. Confirmation modal renders.2. Selecting "Discard Changes" reverts form fields to original values. |
| **TC-04-E2E-004** | `REQ-04-FUNC-401``REQ-04-FUNC-402``REQ-04-FUNC-403` | Positive (Cascade) | Return to Visualizer After Saving (Trigger SEQ-02 Re-verification) | 1. Save metadata modifications (`is_verified = false`).2. Click "Back to Visualizer". | 1. Navigates to `/visualizer`.2. `SEQ-03` Guard 2 intercepts unverified state and redirects to `/loading-model` for re-verification. |
| **TC-04-E2E-005** | `REQ-04-RULE-002``REQ-04-RULE-007``REQ-04-FUNC-501``REQ-04-FUNC-503``REQ-04-FUNC-505``REQ-04-FUNC-507``REQ-04-FUNC-509``REQ-04-FUNC-511` | Positive (External Edit) | Detect External Markdown Modification & Manual Refresh | 1. Open external editor and modify `main.md`.2. Focus back onto HASM window.3. Observe "Refresh Markdown" button style.4. Click "Refresh Markdown" button. | 1. Window focus triggers non-blocking `check_entity_mtime`.2. Disk `current_mtime_ms > last_loaded_mtime_ms` detected; button highlights with Amber alert style + pulsing badge.3. Clicking Refresh re-verifies via `hasm_markdown.exe` within the dynamic size-based timeout, updates body text, resets button style, and displays success toast. |
| **TC-04-E2E-006** | `REQ-04-FUNC-504``REQ-04-FUNC-506``REQ-04-FUNC-508` | Negative (External Deletion) | Detect External File Deletion & Error Route Navigation | 1. Open target directory externally and delete `main.md`.2. Focus back onto HASM window.3. Observe Warning Toast & "Refresh Markdown" button style.4. Click "Refresh Markdown" button. | 1. Window focus detects file missing (`is_deleted == true`).2. Warning toast displays ("Markdown file deleted on disk"); button highlights with Red danger style.3. Clicking Refresh triggers `reload_entity_markdown`, which rejects with `MarkdownFileNotFound` and routes to `/error-markdown`. |

---

## 2. React Level Tests (Frontend Component & Form State)

These unit and component tests focus on `EntityDetailPage.tsx`, state variable isolation (`isEntityLoading`, `isMarkdownVerifying`, `isEntitySaving`, `hasExternalChanges`, `isMarkdownDeleted`), form dirty checking, modal dialogs, window focus event listeners, and error toast/popup/route rendering.

| Test ID | Trace Requirement ID | Test Type | Component / Target | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-04-REACT-001** | `REQ-04-FUNC-101``REQ-04-FUNC-102``REQ-04-FUNC-105``REQ-04-FUNC-107``REQ-04-FUNC-111``REQ-04-FUNC-113``REQ-04-FUNC-115` | Positive (State) | `EntityDetailPage.tsx` (`test/seq04.test.jsx`) | 1. Mount component with target params.2. Check state flags during and after load.3. Save every entity type. | 1. Initializes with `isEntityLoading = true`, `isMarkdownVerifying = true`, `hasExternalChanges = false`, and `isMarkdownDeleted = false`.2. Upon payload resolve, loading flags set to `false` and the ticket renders with no error-route navigation (healthy counterpart of the routing rows below). |
| **TC-04-REACT-002** | `REQ-04-FUNC-102``REQ-04-FUNC-105``REQ-04-FUNC-115` | Negative (Routing) | `EntityDetailPage.tsx` (`test/seq04.test.jsx`) | 1. Mock `load_entity_detail` to reject with `ERR_ENTITY_NOT_FOUND`. | 1. The loading state renders until rejection.2. React Router navigates immediately to `/error-model`; no ticket view is rendered. |
| **TC-04-REACT-003** | `REQ-04-FUNC-107``REQ-04-FUNC-111``REQ-04-FUNC-112``REQ-04-FUNC-113``REQ-04-FUNC-115` | Negative (Routing) | `EntityDetailPage.tsx` (`test/seq04.test.jsx`) | 1. Mock `load_entity_detail` to reject with `ERR_MARKDOWN_FILE_NOT_FOUND`, `ERR_MARKDOWN_TIMEOUT`, or `ERR_MARKDOWN_VERIFICATION_FAILED`. | 1. React Router navigates immediately to `/error-markdown` for every Markdown load failure; no ticket view is rendered. |
| **TC-04-REACT-DISPLAY-004** | `REQ-04-RULE-026` | Positive (Presentation) | Entity detail responsive layout | 1. Render a loaded ticket.<br/>2. Inspect the Markdown and entity-information regions. | 1. Markdown and entity information render in distinct main/sidebar columns on desktop.<br/>2. Both sections remain available in the stacked narrow-screen layout.<br/>3. Markdown body content remains unchanged. |
| **TC-04-REACT-004** | `REQ-04-FUNC-201``REQ-04-FUNC-206``REQ-04-FUNC-207` | Negative (Validation) | `EntityDetailPage.tsx` (`test/seq04.test.jsx`) | 1. Edit the summary and click Save.2. Mock IPC reject with `ERR_ENTITY_VERIFICATION_FAILED`. | 1. `isEntitySaving` resets to `false` and Save re-enables.2. Error status displays validation message; form state preserved for user correction. |
| **TC-04-REACT-005** | `REQ-04-RULE-004``REQ-04-FUNC-209``REQ-04-FUNC-210``REQ-04-FUNC-211``REQ-04-FUNC-213` | Negative (Error UI) | `EntityDetailPage.tsx` (`test/seq04.test.jsx`) | 1. Click "Save".2. Mock IPC reject with `ERR_SAVE_TIMEOUT` or `ERR_DATABASE_SAVE_FAILED`. | 1. `isEntitySaving` resets to `false`.2. Error status renders the rolled-back failure.3. The unpersisted draft value stays in the form for correction. |
| **TC-04-REACT-006** | `REQ-04-FUNC-302``REQ-04-FUNC-303` | Positive (Modal) | `DiscardModal.tsx` (desktop acceptance) | 1. Edit a field.2. Click "Cancel".3. Click "Keep Editing" in modal. | 1. Modal closes; modified form inputs remain intact. |
| **TC-04-REACT-007** | `REQ-04-FUNC-501``REQ-04-FUNC-505` | Positive (Focus UI) | `EntityDetailPage.tsx` | 1. Dispatch `window.dispatchEvent(new Event('focus'))`.2. Mock `check_entity_mtime` response `{ is_modified: true, is_deleted: false }`. | 1. State `hasExternalChanges` updates to `true`.2. "Refresh Markdown" button applies Amber alert style and pulsing badge element. |
| **TC-04-REACT-008** | `REQ-04-FUNC-501``REQ-04-FUNC-504``REQ-04-FUNC-506` | Negative (Focus Danger UI) | `EntityDetailPage.tsx` (`test/seq04.test.jsx`) | 1. Dispatch `window.dispatchEvent(new Event('focus'))`.2. Mock `check_entity_mtime` response `{ is_modified: false, is_deleted: true }`. | 1. State `isMarkdownDeleted` & `hasExternalChanges` update to `true`.2. Warning status "Markdown file deleted on disk" displays.3. "Refresh Markdown" button applies Red danger style without invoking a reload. |
| **TC-04-REACT-009** | `REQ-04-FUNC-507``REQ-04-FUNC-508` | Negative (Reload Missing File) | `EntityDetailPage.tsx` | 1. Click Red highlighted "Refresh Markdown".2. Mock `reload_entity_markdown` reject with `MarkdownFileNotFound`. | 1. `isMarkdownVerifying` resets to `false`.2. React Router navigates immediately to `/error-markdown`. |
| **TC-04-REACT-010** | `REQ-04-FUNC-505``REQ-04-FUNC-507``REQ-04-FUNC-509``REQ-04-FUNC-510``REQ-04-FUNC-511` | Negative (Refresh Syntax Error) | `EntityDetailPage.tsx` (`test/seq04.test.jsx`) | 1. Click Amber highlighted "Refresh Markdown".2. Mock `reload_entity_markdown` reject with a verification failure. | 1. `isMarkdownVerifying` resets to `false`.2. Error status displays the syntax error warning; the rendered body stays uncorrupted, the Amber alert style is retained, and no error route is taken. |
| **TC-04-REACT-011** | `REQ-04-FUNC-503``REQ-04-FUNC-505``REQ-04-FUNC-506``REQ-04-FUNC-507``REQ-04-FUNC-510``REQ-04-FUNC-511` | Positive (Manual Refresh) | `EntityDetailPage.tsx` (`test/seq04.test.jsx`) | 1. Dispatch focus with `{ is_modified: true }`.2. Click the Amber highlighted "Refresh Markdown".3. Mock `reload_entity_markdown` success with a new body and mtime. | 1. The alert style appears, Refresh invokes `reload_entity_markdown` once, the rendered body and `last_loaded_mtime_ms` update, the button returns to the normal (non-danger) style, a success toast displays, and no whole-model reload occurs. |
| **TC-04-REACT-012** | `REQ-04-FUNC-101` | Negative (Mount Guard) | `EntityDetailPage.tsx` (`test/seq04.test.jsx`) | 1. Mount the entity detail route without any workspace state. | 1. React Router redirects to `/select` and `load_entity_detail` is never invoked. |

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
| **TC-04-RUST-006** | `REQ-04-RULE-002``REQ-04-FUNC-108``REQ-04-FUNC-109``REQ-04-FUNC-110` | Negative (Timeout Kill) | `load_entity_detail` | 1. Mock `main.md` file size = 500 KB (Calculated timeout = 8,000ms).2. Mock the spawned `hasm_markdown.exe` verification process hanging beyond 8,000ms. | 1. Kills child process at exactly 8,000ms.2. Returns `Err(MarkdownTimeout { timeout_ms: 8000 })`. |
| **TC-04-RUST-007** | `REQ-04-RULE-003``REQ-04-RULE-004``REQ-04-FUNC-208``REQ-04-FUNC-209` | Negative (Timeout Rollback) | `save_entity_metadata` | 1. Lock SQLite database to force transaction delay.2. Execute `save_entity_metadata`.3. Advance timer past 5,000ms. | 1. Executes SQLite `ROLLBACK`.2. Rejects with `SaveTimeout`.3. `hasm.db` remains unchanged. |
| **TC-04-RUST-008** | `REQ-04-RULE-005``REQ-04-FUNC-212` | Positive (State Invalidation) | `save_entity_metadata` | 1. Execute valid `save_entity_metadata`.2. Check in-memory `HasmModel` flag. | 1. SQLite transaction `COMMIT` succeeds.2. In-memory `HasmModel.is_verified` is updated to `false`. |
| **TC-04-RUST-009** | `REQ-04-RULE-007``REQ-04-FUNC-502``REQ-04-FUNC-503``REQ-04-FUNC-504` | Performance (mtime Check) | `check_entity_mtime` | 1. Delete target `main.md` on disk.2. Invoke `check_entity_mtime`. | 1. Returns `Ok(CheckMtimePayload { is_modified: false, is_deleted: true, current_mtime_ms: 0 })`.2. Execution completes in < 10ms without DB or parser calls. |