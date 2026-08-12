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