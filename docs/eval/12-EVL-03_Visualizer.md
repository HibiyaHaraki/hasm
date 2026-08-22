# EVAL-03: HASM 3D Visualizer & Graph Rendering Test Specification

This document defines the comprehensive test matrix, acceptance criteria, and traceability mapping for validating state guard interceptions, 3D Git-like timeline layout calculations across multiple time-scale modes, background worker progress streaming via Watchdog protection, pointer raycasting tooltips, and entity detail navigation (`SEQ-03` / `REQ-03`).

Tests are structured across three distinct test levels: **Desktop App Level (E2E / System Integration)**, **React Level (Frontend Three.js Canvas & Progress State)**, and **Tauri Level (Rust Domain Engine & Worker Thread Layout)**.

Automated React and IPC coverage for this specification runs through `npm run test:eval-03`; Rust layout coverage runs through `cargo test visualizer_commands` from `src-tauri`. The browser geometry smoke test is skipped by default and runs only when `HASM_RUN_VISUALIZER_GEOMETRY=1` is set.

---

## 1. Desktop App Level Tests (E2E / System Integration)

These integration tests verify end-to-end user flows for entering `/visualizer`, state guard interceptions (`ERR_NO_ACTIVE_MODEL` / `ERR_MODEL_NOT_VERIFIED`), background layout calculation progress streaming, Three.js 3D graph rendering, interactive raycasting, and clicking nodes to enter entity detail ticket views.

| Test ID | Trace Requirement ID | Test Type | Test Scenario | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-03-E2E-001** | `REQ-03-RULE-001``REQ-03-RULE-002``REQ-03-RULE-003``REQ-03-FUNC-101``REQ-03-FUNC-108` | Positive (Normal Render) | Full Visualizer Load with Progress Streaming & Render | 1. Ensure verified model is loaded.2. Navigate to `/visualizer`. | 1. Background worker thread calculates 3D layout without UI lock.2. Smooth progress bar updates via progress events.3. Three.js canvas renders 3D Git-like timeline nodes/splines upon completion. |
| **TC-03-E2E-002** | `REQ-03-RULE-001``REQ-03-FUNC-102` | Negative (Missing Model) | Visualizer Access Without Active Model | 1. Clear active model in Rust memory.2. Navigate directly to `/visualizer`. | 1. Rust intercepts with `ERR_NO_ACTIVE_MODEL`.2. React Router automatically falls back to `/select`. |
| **TC-03-E2E-003** | `REQ-03-RULE-001``REQ-03-FUNC-103` | Negative (Unverified) | Visualizer Access With Unverified Model | 1. Set in-memory model flag `is_verified = false`.2. Navigate to `/visualizer`. | 1. Rust intercepts with `ERR_MODEL_NOT_VERIFIED`.2. React Router redirects to `/loading-model` passing `{ returnTo: '/visualizer' }`. |
| **TC-03-E2E-004** | `REQ-03-FUNC-201``REQ-03-FUNC-202` | Positive (Filter Update) | Switch Time Scale Mode to `SequentialIndex` | 1. Render 3D view.2. Switch `TimeScaleMode` dropdown to `SequentialIndex`. | 1. Triggers `compute_visualizer_layout`.2. Lightweight progress overlay displays.3. Z-coordinates re-render with equal chronological commit spacing. |
| **TC-03-E2E-005** | `REQ-03-FUNC-301``REQ-03-FUNC-302` | Positive (Interactivity) | Hover and Click 3D Node Mesh | 1. Hover mouse pointer over a FACT commit node.2. Click the node. | 1. Floating 2D tooltip displays node metadata.2. Clicking navigates to `/entity-detail/FACT/:fact_id`. |
| **TC-03-E2E-006** | `REQ-03-FUNC-110` | Positive (Development) | Open Workspace Development Graph Action | 1. Open `/select`.<br/>2. Click **Test 3D commit graph**.<br/>3. Observe resulting workspace and route. | 1. A populated temporary package has `hasm.db`, all entity folders, non-empty Markdown, and assets.<br/>2. Routes directly to `/visualizer`. |
| **TC-03-E2E-007** | `REQ-03-FUNC-304` | Positive (Navigation) | Canvas Orbit, Pan, and Zoom | 1. Open the visualizer.<br/>2. Use wheel, left-drag, and right-drag over the canvas. | 1. Wheel zooms the camera.<br/>2. Left-drag orbits and right-drag pans without page scrolling or canvas failure. |

---

## 2. React Level Tests (Frontend Three.js Canvas & Progress State)

These unit and component tests focus on `VisualizerPage.tsx`, Watchdog Timer protection during layout calculation, progress event listener updates (`visualizer-layout-progress`), Three.js scene instantiation, and filter timeout fallback handling.

| Test ID | Trace Requirement ID | Test Type | Component / Target | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-03-REACT-001** | `REQ-03-RULE-004``REQ-03-FUNC-104``REQ-03-FUNC-106` | Positive (Progress UI) | `VisualizerPage.tsx` | 1. Render page.2. Emit mock `visualizer-layout-progress` event `{ current: 40, total: 100, percentage: 40.0, message: "Positioning EXPERIENCE..." }`. | 1. React Watchdog Timer resets to 0ms.2. UI progress overlay smoothly renders 40% state with message text. |
| **TC-03-REACT-002** | `REQ-03-RULE-004``REQ-03-FUNC-107` | Negative (Watchdog) | `VisualizerPage.tsx` | 1. Invoke `compute_visualizer_layout`.2. Simulate zero progress events for >10,000ms. | 1. Watchdog Timer fires.2. Sets `renderError = "Layout calculation stalled"`.3. React Router navigates to `/error-model`. |
| **TC-03-REACT-003** | `REQ-03-RULE-005``REQ-03-FUNC-203` | Negative (Filter Timeout) | `VisualizerPage.tsx` | 1. Change time scale filter.2. Simulate Watchdog timeout (>10,000ms). | 1. Displays error toast ("Filter update timed out. Reverting view.").2. Retains previous 3D scene state without canvas crash. |
| **TC-03-REACT-004** | `REQ-03-FUNC-109` | Positive (Warning Toast) | `VisualizerPage.tsx` | 1. Resolve `compute_visualizer_layout` returning `RenderPayload` with `warnings = ["Unreferenced folder detected"]`. | 1. Renders warning toast/banner displaying unreferenced storage folder message. |
| **TC-03-REACT-005** | `REQ-03-FUNC-110` | Positive (Development) | `SelectModelPage.tsx` | 1. Click **Test 3D commit graph**.<br/>2. Mock the populated demo payload. | 1. Calls `create_visualizer_demo_workspace` exactly once.<br/>2. Navigates to `/visualizer`. |

---

## 3. Tauri Level Tests (Rust Domain Engine & Worker Thread Layout)

These unit and integration tests verify Rust background worker thread execution (`tokio::task::spawn_blocking`), chunked progress event emissions, state guard checks against in-memory `HasmModel`, and 3D geometry coordinate calculation using `cargo test`.

| Test ID | Trace Requirement ID | Test Type | Rust Module / Function | Test Steps | Expected Result |
| --- | --- | --- | --- | --- | --- |
| **TC-03-RUST-001** | `REQ-03-DATA-001``REQ-03-DATA-002``REQ-03-DATA-003` | Positive (Contract) | `models::visualizer_payload` | 1. Instantiate `LayoutFilterRequest`, `LayoutProgressPayload`, and `RenderPayload`.2. Serialize and deserialize JSON. | 1. All fields serialize/deserialize with 100% type safety. |
| **TC-03-RUST-002** | `REQ-03-RULE-003``REQ-03-FUNC-105` | Positive (Worker & Emit) | `compute_visualizer_layout` | 1. Populate mock model with 1,000 FACTs.2. Invoke `compute_visualizer_layout`. | 1. Executes calculation on background thread (`tokio::task::spawn_blocking`).2. Emits `visualizer-layout-progress` events periodically during processing chunks. |
| **TC-03-RUST-003** | `REQ-03-RULE-001``REQ-03-FUNC-102` | Negative (No Model) | `compute_visualizer_layout` | 1. Ensure `HASM_MODEL` mutex is `None`.2. Invoke `compute_visualizer_layout`. | 1. Rejects with `Err(VisualizerError::NoActiveModel)`. |
| **TC-03-RUST-004** | `REQ-03-RULE-001``REQ-03-FUNC-103` | Negative (Unverified) | `compute_visualizer_layout` | 1. Set `HASM_MODEL.is_verified = false`.2. Invoke `compute_visualizer_layout`. | 1. Rejects with `Err(VisualizerError::ModelNotVerified)`. |
| **TC-03-RUST-005** | `REQ-03-RULE-002` | Positive (Z-Axis Math) | `compute_visualizer_layout` | 1. Run layout calculation testing `Linear`, `Logarithmic`, and `SequentialIndex` modes. | 1. Correctly calculates Z-coordinates according to selected mathematical mode formulas. |
| **TC-03-RUST-006** | `REQ-03-RULE-006``REQ-03-RULE-007``REQ-03-FUNC-303` | Positive (Topology) | `compute_visualizer_layout` | 1. Seed parent and child EXPERIENCE records plus FACTs with ordered `occurred_at` timestamps.<br/>2. Compute `SequentialIndex` layout. | 1. Earlier FACT receives lower Z than later FACT.<br/>2. Each EXPERIENCE trunk is straight.<br/>3. A `BRANCH_JOIN` connector exists for the declared parent-child relationship. |
| **TC-03-RUST-007** | `REQ-03-FUNC-110` | Positive (Development) | `create_visualizer_demo_workspace` | 1. Invoke the development demo command.<br/>2. Inspect generated workspace. | 1. Returns a non-empty model with 3 EXPERIENCE records and 5 dated FACT records.<br/>2. `hasm.db`, Markdown files, and assets exist. |