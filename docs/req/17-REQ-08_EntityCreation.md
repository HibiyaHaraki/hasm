# REQ-08: Entity Creation & Link Graph Binding Requirements

## 1. Functional Requirements

### 1.1 HASM Workspace Scaffolding

* **`REQ-08-001` (Native Save Directory Picker):** The application shall open an OS native save directory dialog when initiating a new HASM model creation from `/select`, allowing the user to choose an absolute destination directory (e.g., `/path/to/MyLife.hasm`).
* **`REQ-08-002` (Atomic Workspace Scaffolding):**
* Invoking `create_hasm_workspace` shall atomically generate the base `.hasm` directory, required entity subdirectories (`PERSON/`, `EXPERIENCE/`, `FACT/`, `LINK/`), initialize `hasm.db` with SQLite schemas/junction tables, and write the `.hasm/lock` process tracking file.
* If scaffolding fails or times out, the backend shall roll back by deleting the partially generated directory and return `ERR_WORKSPACE_CREATION_FAILED`.



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