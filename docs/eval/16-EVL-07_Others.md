# EVAL-07: Global Navigation, Environment Management & Route Protection Test Specification

This document defines the comprehensive test matrix, acceptance criteria, and traceability mapping for validating Route Protection (Barrier 1) evaluation rules, redirection reason toast notifications, atomic workspace switching (`switch_workspace_cleanly`), dynamic color theme customization, and synchronous status monitoring across the HASM Desktop Application (`SEQ-07` / `REQ-07`).

Tests are structured across three distinct test levels: **Desktop App Level (E2E / System Integration)**, **React Level (Frontend Route Guards & Component States)**, and **Tauri Level (Rust Domain Engine & Clean Switch Commands)**.

---

## 1. Desktop App Level Tests (E2E / System Integration)

These integration tests verify end-to-end user flows for accessing protected routes directly, receiving redirection toast popups, performing clean workspace switches from `GlobalNavbar.jsx`, and dynamically changing UI/3D color palettes.

| Test ID | Trace Requirement ID | Test Type | Test Scenario | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-07-E2E-001** | `REQ-07-RULE-001``REQ-07-RULE-002``REQ-07-FUNC-101``REQ-07-FUNC-102``REQ-07-FUNC-105` | Positive (Route Protection - No Workspace) | Direct Navigation to `/visualizer` Without Active Workspace | 1. Clear active workspace state (`activeModelPath = null`).2. Directly navigate to `/visualizer` via DevTools or URL input. | 1. `<ProtectedRoute>` intercepts access prior to component mount.2. Redirects to `/select`.3. Displays Amber Warning Toast: *"HASMモデルが選択されていません。先にワークスペースを選択してください。"*<br/>4. Router state is cleared after toast renders. |
| **TC-07-E2E-002** | `REQ-07-RULE-001``REQ-07-RULE-002``REQ-07-FUNC-103``REQ-07-FUNC-104``REQ-07-FUNC-105` | Positive (Route Protection - Unverified) | Access Protected Route When Model Unverified | 1. Load HASM workspace but set `isVerified = false`.2. Request navigation to `/entity-detail/FACT/{UUID}`. | 1. `<ProtectedRoute>` intercepts access.2. Redirects to `/loading-model` with `returnTo = /entity-detail/FACT/{UUID}`.3. Displays Info Toast: *"モデルの検証が完了していません。再ロード・検証を実行します。"* |
| **TC-07-E2E-003** | `REQ-07-RULE-001` | Positive (Route Protection - All Clear) | Authorized Access to `/visualizer` | 1. Ensure `activeModelPath != null`, `isModelLoaded == true`, and `isVerified == true`.2. Navigate to `/visualizer`. | 1. `<ProtectedRoute>` allows access.2. Mounts `VisualizerPage.jsx` smoothly without redirects or toasts. |
| **TC-07-E2E-004** | `REQ-07-RULE-001` | Negative (Unknown Route) | Direct Access to Non-existent Route | 1. Directly navigate to `/unknown-route-path`. | 1. Catch-all router rule intercepts access.2. Redirects to `/select`.3. Displays Amber Warning Toast: *"指定されたページが存在しません。"*" |
| **TC-07-E2E-005** | `REQ-07-RULE-003``REQ-07-FUNC-201``REQ-07-FUNC-202``REQ-07-FUNC-203``REQ-07-FUNC-204` | Positive (Clean Switch) | Clean Workspace Switch from Global Menu with Unsaved Edits | 1. Navigate to `/entity-detail/...` and edit a field (`isDirty = true`).2. Click "Switch Model" in `GlobalNavbar.jsx`.3. Click "Discard & Switch" in modal. | 1. Displays unsaved changes warning modal.2. Invokes `switch_workspace_cleanly`.3. Lock file `.hasm/lock` is deleted.4. React store resets and navigates cleanly to `/select`. |
| **TC-07-E2E-006** | `REQ-07-RULE-005``REQ-07-FUNC-301``REQ-07-FUNC-302` | Positive (Theme Switch) | Dynamic Preset Theme Change in 3D Visualizer | 1. Render `/visualizer`.2. Select "Nordic Frost" theme from `GlobalNavbar.jsx` dropdown. | 1. Document root CSS variables (`--color-primary`, etc.) update instantly.2. Three.js canvas material colors update dynamically without scene re-creation. |

---

## 2. React Level Tests (Frontend Component & Route Protection Guards)

These unit and component tests focus on `<ProtectedRoute>`, `GlobalNavbar.jsx`, Toast state clearance after redirection, `useThemeStore.js`, and synchronous `useWorkspaceStore.js` renders.

| Test ID | Trace Requirement ID | Test Type | Component / Target | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-07-REACT-001** | `REQ-07-RULE-001``REQ-07-FUNC-101``REQ-07-FUNC-102` | Positive (Guard Test) | `ProtectedRoute.jsx` | 1. Mount `ProtectedRoute` with `activeModelPath = null`. | 1. Returns `<Navigate to="/select"/>` carrying `redirectReason` and `redirectType = "warning"` in `location.state`. |
| **TC-07-REACT-002** | `REQ-07-RULE-001``REQ-07-FUNC-103``REQ-07-FUNC-104` | Positive (Guard Test) | `ProtectedRoute.jsx` | 1. Mount `ProtectedRoute` with `isVerified = false` and `requireVerified = true`. | 1. Returns `<Navigate to="/loading-model"/>` carrying `returnTo` and `redirectReason` in `location.state`. |
| **TC-07-REACT-003** | `REQ-07-RULE-002``REQ-07-FUNC-105` | Positive (Toast & Clear) | `SelectModelPage.jsx` | 1. Render `SelectModelPage` with `location.state = { redirectReason: "Test reason" }`. | 1. Triggers Toast popup with "Test reason".2. Invokes `navigate('/select', { replace: true, state: {} })` to clear state. |
| **TC-07-REACT-004** | `REQ-07-RULE-002` | Negative (Refresh Check) | `SelectModelPage.jsx` | 1. Simulate page refresh after toast clearance. | 1. `location.state` is empty.2. No duplicate Toast renders. |
| **TC-07-REACT-005** | `REQ-07-RULE-004``REQ-07-FUNC-401` | Positive (Sync Status) | `GlobalNavbar.jsx` | 1. Update `useWorkspaceStore` state.2. Inspect `GlobalNavbar.jsx` render output. | 1. Displays active model path, lock badge, and warning counts synchronously (0ms IPC latency). |
| **TC-07-REACT-006** | `REQ-07-FUNC-402``REQ-07-FUNC-403` | Positive (Reactivity) | `useWorkspaceStore.js` | 1. Execute `saveEntityMetadata` -> verify `isVerified` becomes `false`.2. Execute `repairMissingEntityFolders` -> verify repaired UUIDs removed from `warnings`. | 1. Store updates reactively and updates `GlobalNavbar.jsx` badges immediately. |

---

## 3. Tauri Level Tests (Rust Domain Engine & Clean Switch Commands)

These unit and integration tests verify IPC command execution for clean workspace unloads (`switch_workspace_cleanly`), lock file releases, SQLite handle flushes, and in-memory `HasmModel` resets using `cargo test`.

| Test ID | Trace Requirement ID | Test Type | Rust Module / Function | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-07-RUST-001** | `REQ-07-DATA-001``REQ-07-DATA-002` | Positive (Contract) | `models::navigation_payload` | 1. Instantiate `SwitchWorkspaceRequest` and `ColorPalette`.2. Serialize and deserialize JSON. | 1. All struct fields serialize/deserialize with 100% type safety. |
| **TC-07-RUST-002** | `REQ-07-RULE-003``REQ-07-FUNC-203` | Positive (Clean Switch) | `switch_workspace_cleanly` | 1. Setup active model in memory with read-write `.hasm/lock` file.2. Invoke `switch_workspace_cleanly(current_model_path)`. | 1. Deletes `.hasm/lock` file.2. Flushes and closes SQLite connection handles.3. Resets `HASM_MODEL` mutex to `None`.4. Returns `Ok(())`. |
| **TC-07-RUST-003** | `REQ-07-RULE-003``REQ-07-FUNC-203` | Positive (Read-Only Switch) | `switch_workspace_cleanly` | 1. Setup active model in read-only mode (no lock file owned).2. Invoke `switch_workspace_cleanly`. | 1. Does not attempt lock file deletion.2. Resets `HASM_MODEL` to `None` cleanly without throwing filesystem errors. |