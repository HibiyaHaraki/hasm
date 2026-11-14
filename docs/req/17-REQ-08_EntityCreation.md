# REQ-08: Entity Creation & Link Graph Binding Requirements

## 1. Functional Requirements

### 1.1 HASM Workspace Scaffolding

* **`REQ-08-001` (Native Save Directory Picker):** The application shall open an OS native save directory dialog when initiating a new HASM model creation from `/select`, allowing the user to choose an absolute destination directory (e.g., `/path/to/MyLife.hasm`).
* **`REQ-08-002` (Atomic Workspace Scaffolding):**
* Invoking `create_hasm_workspace` shall atomically generate the base `.hasm` directory, required entity subdirectories (`PERSON/`, `EXPERIENCE/`, `FACT/`, `LINK/`), initialize `hasm.db` with SQLite schemas/junction tables, and write the `.hasm/lock` process tracking file.
* If scaffolding fails or times out, the backend shall roll back by removing newly generated workspace content/artifacts and return `ERR_WORKSPACE_CREATION_FAILED`.



---

### 1.2 Entity Creation & Pre-Persistence Validation

* **`REQ-08-010` (PERSON Creation & Root Stream Scaffold):**
* `create_person` shall generate a new UUID (v4) and validate that `person_name` is non-empty and `security_level` falls within $0 \le \text{level} \le 5$.
* Option to auto-generate a mandatory root `EXPERIENCE` stream (`life_experience_id`) upon person creation shall be supported.


* **`REQ-08-011` (EXPERIENCE Creation & Tree Hierarchy):** `create_experience` shall generate a new UUID, validate non-empty `experience_name`, insert SQLite records, and bind parent branch IDs into `EXPERIENCE_TREE`.
* **`REQ-08-012` (FACT Creation & Time Constraint):** `create_fact` shall validate that `fact_name` is non-empty and enforce chronological order ($t_{\text{start}} \le t_{\text{end}}$) if both timestamps are provided. It shall bind associated experience timelines into `FACT_EXPERIENCE`.
* **`REQ-08-013` (Interactive LINK Graph Binding & Invariant Guards):**
* `create_link` shall validate that `link_type` is non-empty and reject creation if `origin_entity_id == target_entity_id` (self-loop forbidden).
* It shall verify that both source and target entities physically exist in `HasmModel` memory before executing SQLite insertions into `LINK`.
* **`REQ-08-014` (Dedicated Entity Creation Route):** The Visualizer page shall provide a "Create New Entity" action that navigates to a dedicated `/entity-create` route. Frontend forms for PERSON / EXPERIENCE / FACT / LINK shall be split by component so each entity creation design can evolve independently. The build-time `VITE_ENABLE_SECURITY_LEVEL=false` flag shall hide the security-level control on all four forms; when unset or set to `true`, it remains visible. Hiding the control shall retain the default `securityLevel=1` in the creation invoke and shall not disable backend validation or alter existing data.
* **`REQ-08-015` (Confirmed Life Bootstrap Before First Visualizer Load):** When a newly created workspace contains zero entities, the frontend shall route to `/initialize-model` and require a PERSON name and birth date. A confirmation dialog shall show the trimmed name, date, Life EXPERIENCE name, and birth date FACT name before any entity-creation invoke. Returning to edit shall preserve inputs without persisting entities. Confirmation shall call `create_person` with `birthDate`, `security_level=1`, and `create_life_experience=true`. In one transaction, Rust shall create the PERSON (`birthday=YYYY-MM-DD`), its owned Life EXPERIENCE, and a birth date FACT (`occurred_at=YYYY-MM-DD`) associated with both entities. All three shall receive Markdown/assets scaffolds. Invalid calendar dates (including invalid leap days and year zero) shall fail before persistence. Errors shall be visible and logged; failure shall roll back all bootstrap entities and clean generated folders. Pending confirmation shall block duplicate submissions and editing. A model-reload retry after successful creation shall not create duplicate entities. Existing callers omitting `birthDate` shall retain their previous behavior.

* **`REQ-08-022` (FACT Date Calendars):** FACT start and end fields shall use accessible native calendars without ISO text inputs. Selecting a date shall preserve an existing time and timezone suffix and retain the existing creation IPC payload.
* **`REQ-08-023` (Existing FACT Selection During EXPERIENCE Creation):** EXPERIENCE creation shall offer an optional Belonging FACT multi-select using every FACT in the loaded model, independent of graph filters. It shall reuse the EXPERIENCE picker design: one field containing removable Bootstrap-style badges; clicking the field opens a dropdown with focused search in the first row and filtered choices below. Search shall not be a separate page field. Like LINK endpoint search, a trimmed case-insensitive query shall match name, type, or UUID without selecting automatically and distinguish duplicate/unnamed records by UUID. Selected choices shall expose selected state and support modifier-free toggling; selections outside results shall remain visible as removable field badges, with a labeled Clear action. Escape shall close the dropdown and preview and restore field-trigger focus. Enter in search shall toggle the first match, never submit the form; no matches shall show an explicit notice and leave selections unchanged. Search and selections shall survive entity-type switches. Empty FACT lists shall display a disabled explicit empty state and still allow creation. Only selected UUIDs shall be sent in `factIds`; omitted or empty arrays shall preserve legacy creation without memberships. The backend shall atomically append the new EXPERIENCE UUID to each selected FACT's existing `experienceIds`, preserving other associations and avoiding duplicate bindings. Missing FACTs, malformed stored memberships, SQL errors, or scaffold failures shall reject creation and roll back both the new EXPERIENCE and FACT updates. Errors shall remain visible without reloading the model.
* **`REQ-08-016` (External URL Arrays):** All four creation requests and forms shall support `link: string[]` under `REQ-04-RULE-010` through `REQ-04-RULE-012`. Missing fields shall default to `[]` for older callers. Invalid URLs shall fail before inserting a row or scaffolding entity files. The generated root EXPERIENCE shall keep an independent empty array.
* **`REQ-08-017` (Existing EXPERIENCE Selectors):** FACT creation shall provide a multi-select Belonging EXPERIENCE list and EXPERIENCE creation a multi-select Parent EXPERIENCE list, using all EXPERIENCE records in the loaded model, independent of graph filters. Each shall present one field with removable Bootstrap-style badges; clicking it shall open a dropdown with focused search in its first row, followed by filtered choices. Search shall not be a separate page field. The field shall filter titles using a trimmed case-insensitive query and show all choices for an empty query. Choices and removable selection badges shall show titles only, with an explicit unnamed fallback; the model has no separate human-readable EXPERIENCE ID. All selected UUIDs shall be sent in the existing `experienceIds` / `parentExperienceIds` arrays. No selection shall send an empty array, preserving optional relationships; empty lists shall show a disabled, explicit empty state. Choices shall expose selected state, allow modifier-free click or Enter/Space toggling, support arrow-key navigation, and provide a labeled Clear button. Enter in search shall toggle the first match without submitting; no matches shall leave selections unchanged. Hover/focus shall show the shared entity information card without selecting or navigating; Escape or closing the dropdown shall dismiss it and retain badges. Escape shall restore field-trigger focus. Switching entity types shall preserve selections. Existing children shall not be selectable during EXPERIENCE creation.
* **`REQ-08-018` (Default Description Only During Creation):** All four entity creation forms shall omit description inputs and send an empty description field, allowing the backend to generate its default Markdown body and identity FrontMatter with an assets directory. Each generated entity folder shall be loadable by HASM Markdown without a fabricated asset manifest. Users shall edit descriptions through HASM Markdown after creation. Existing IPC request fields and non-UI callers shall remain compatible.
* **`REQ-08-019` (Searchable LINK Endpoints):** LINK creation shall provide independently labeled Origin and Target search fields and selection dropdowns. Searches shall filter all loaded PERSON, EXPERIENCE, and FACT options by trimmed, case-insensitive substring matching on name, type, or UUID, without IPC or automatic endpoint selection. Editing a query shall open its Bootstrap dropdown. Hover/focus on each result shall show the shared information card using the single-entity read invoke, without selecting or navigating. Closing the dropdown or replacing results shall dismiss previews and ignore late reads. Empty queries shall show all options and zero matches shall have an accessible explicit notice. Labels shall distinguish duplicate names using entity type and UUID. Existing selections hidden by a query shall remain visible as a clearly prefixed current-selection choice with a notice and the same preview behavior; the placeholder shall allow clearing a selection. Search drafts and selected endpoints shall survive entity-type switches. Only the selected typed UUIDs, never search text, shall be serialized into the existing LINK creation request.



---

### 1.3 Physical Storage Scaffolding & Memory Sync

* **`REQ-08-020` (Entity Directory & Template Scaffolding):** Upon successful entity validation, the backend shall create `{workspace}/{ENTITY_TYPE}/{UUID}/`, an `assets/` subdirectory, and scaffold a default `main.md` file pre-populated with YAML FrontMatter metadata.
* **`REQ-08-021` (State Invalidation & 3D Visualizer Sync):**
* Successfully created entities shall be appended to the in-memory `HasmModel`, and the backend shall set `is_verified = false`.
* The frontend shall automatically invoke `compute_visualizer_layout` (`SEQ-03`) to re-calculate coordinates and render new 3D nodes/splines smoothly on the canvas.



---

## 2. Non-Functional Requirements

### 2.1 Performance & Reliability SLA

* **`REQ-08-100` (Workspace Scaffolding SLA):** Native folder structure creation, SQLite DDL execution, and process lock acquisition shall complete within **3,000 ms**.
* **`REQ-08-101` (Entity Creation Transaction SLA):** Domain validation, SQLite transaction commit, and physical `main.md` file scaffolding shall complete within **5,000 ms**. SQLite transactions shall be rolled back and generated folders purged if the execution exceeds this threshold.
* **`REQ-08-102` (In-Memory Link Graph Validation SLA):** Graph invariant checks (self-loop prevention and orphan node verification) shall complete within **5 ms**.