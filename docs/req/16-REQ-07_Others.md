# REQ-07: Global Navigation, Environment Management & Route Protection (Formal Specification)

This specification defines the functional, data, route protection evaluation matrix, theme customization, and clean workspace switching requirements for global navigation, environment state monitoring, barrier 1 route protection, and UI/3D color customization under `SEQ-07`.

---

## 1. System Invariants & Core Rules

* **[REQ-07-RULE-001] Barrier 1 Route Protection (`ProtectedRoute`):** Access to operational pages (`/visualizer`, `/entity-detail/:entity_type/:entity_id`) MUST be protected at the React Router layer by `<ProtectedRoute>`. Direct URL access, DevTools route manipulation, or invalid state transitions MUST be intercepted prior to component mounting or IPC execution according to the **Route Protection Evaluation Matrix**.
* **[REQ-07-RULE-002] Redirection Reason Notification:** When `<ProtectedRoute>` intercepts an unauthorized access attempt, it MUST pass redirection context metadata (`redirectReason`, `redirectType`) via React Router `location.state`. Destination pages MUST render a Toast notification explaining the reason for redirection and invoke `navigate(location.pathname, { replace: true, state: {} })` immediately after rendering to prevent duplicate toasts on refresh.
* **[REQ-07-RULE-003] Atomic Workspace Switching:** Triggering a model switch (`switch_workspace_cleanly`) MUST cleanly release the active workspace lock (`release_workspace_lock`), flush SQLite connection pools, and reset the in-memory Rust `HasmModel` instance to `None` before clearing frontend global stores and navigating to `/select`.
* **[REQ-07-RULE-004] Zero-IPC Status Inspection:** Global workspace status, active model path, lock status, and storage warnings displayed in `GlobalNavbar.jsx` MUST be rendered synchronously (0ms IPC latency) by referencing the React global state (`useWorkspaceStore.js`).
* **[REQ-07-RULE-005] Dynamic Theme Synchronization:** Selecting a preset 3-color palette MUST simultaneously update document root CSS custom properties (`--color-primary`, `--color-secondary`, `--color-accent`) and emit theme updates to the Three.js viewport (`useThreeCanvas.js`) to dynamically update 3D material colors without triggering scene re-renders.

---

## 2. Technical Specifications & Route Protection Matrix

### 2.1 IPC Payload Data Contracts

```rust
// [REQ-07-DATA-001] Switch Workspace Cleanly Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwitchWorkspaceRequest {
    pub current_model_path: String,
}

// [REQ-07-DATA-002] Preset Color Palette Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColorPalette {
    pub id: String,         // e.g., "cyberpunk_dark" | "nordic_frost" | "slate_emerald"
    pub primary: String,    // Hex Code
    pub secondary: String,  // Hex Code
    pub accent: String,     // Hex Code
}

```

---

### 2.2 Route Protection Evaluation Matrix (Barrier 1)

This matrix defines the strict evaluation rules executed by `<ProtectedRoute>` when any route transition occurs.

| Target Route Request | Evaluated State Variables (`useWorkspaceStore`) | Protection Action | Destination Route | Passed Router State (`location.state`) | Toast Notification Behavior |
| --- | --- | --- | --- | --- | --- |
| **Protected Route**(`/visualizer` or `/entity-detail/...`) | `activeModelPath == null`OR `isModelLoaded == false` | **REDIRECT** | **`/select`** | `from: requestedPath``redirectReason: "HASMモデルが選択されていません。先にワークスペースを選択してください。"``redirectType: "warning"` | Displays Amber Warning Toast on `SelectModelPage`. Router state is immediately cleared after toast triggers. |
| **Protected Route**(`/visualizer` or `/entity-detail/...`) | `activeModelPath != null``isModelLoaded == true``isVerified == false` | **REDIRECT** | **`/loading-model`** | `returnTo: requestedPath``redirectReason: "モデルの検証が完了していません。再ロード・検証を実行します。"``redirectType: "info"` | Displays Info Toast on `LoadingModelPage`. Triggers storage re-verification (`SEQ-02`). |
| **Protected Route**(`/visualizer` or `/entity-detail/...`) | `activeModelPath != null``isModelLoaded == true``isVerified == true` | **ALLOW** | Target Route | None | Renders target page component smoothly. |
| **Unknown Route**(Catch-all `*`) | Any State Combination | **REDIRECT** | **`/select`** | `redirectReason: "指定されたページが存在しません。"``redirectType: "warning"` | Displays Amber Warning Toast on `SelectModelPage`. |
| **Public Route**(`/select`, `/loading-model`, `/error-*`) | Any State Combination | **ALLOW** | Target Route | Preserved if provided | Renders public/system recovery view directly. |

---

## 3. Detailed Functional Requirements

### Chapter 1: Route Protection Execution (`ProtectedRoute.jsx`)

* **[REQ-07-FUNC-101] Unloaded Model Guard Interception:** If a user requests a protected route when `activeModelPath` is `null` or `isModelLoaded` is `false`, `<ProtectedRoute>` MUST navigate to `/select` replacing current history.
* **[REQ-07-FUNC-102] Unloaded Model Redirection Payload:** Upon interception under `REQ-07-FUNC-101`, `<ProtectedRoute>` MUST supply `redirectReason = "HASMモデルが選択されていません。先にワークスペースを選択してください。"` and `redirectType = "warning"` in `location.state`.
* **[REQ-07-FUNC-103] Unverified Model Guard Interception:** If a user requests a protected route requiring verification when `isVerified` is `false`, `<ProtectedRoute>` MUST navigate to `/loading-model` with `state = { returnTo: location.pathname }`.
* **[REQ-07-FUNC-104] Unverified Model Redirection Payload:** Upon interception under `REQ-07-FUNC-103`, `<ProtectedRoute>` MUST supply `redirectReason = "モデルの検証が完了していません。再ロード・検証を実行します。"` and `redirectType = "info"` in `location.state`.
* **[REQ-07-FUNC-105] Toast Rendering & State Clearance:** Destination pages (`SelectModelPage.jsx`, `LoadingModelPage.jsx`) receiving `redirectReason` MUST render a Toast notification and invoke `navigate(location.pathname, { replace: true, state: {} })` to clear state.

### Chapter 2: Global Navigation & Clean Workspace Switching

* **[REQ-07-FUNC-201] Global Navigation Bar Display:** `GlobalNavbar.jsx` MUST be persistently rendered across all application pages, displaying the active workspace path badge, lock status badge (Read-Write / Read-Only), theme selector dropdown, and "Switch Model" action.
* **[REQ-07-FUNC-202] Unsaved Edit Switch Confirmation:** Clicking "Switch Model" while editing an Entity Detail ticket with unsaved changes (`isDirty == true`) MUST display a confirmation modal ("Discard unsaved changes before switching workspace?").
* **[REQ-07-FUNC-203] Clean Switch Execution:** Confirming workspace switch MUST invoke `switch_workspace_cleanly`. Rust MUST release `.hasm/lock`, flush SQLite connection pools, and reset `HASM_MODEL` to `None`.
* **[REQ-07-FUNC-204] Store Reset & Switch Navigation:** Upon successful resolution of `switch_workspace_cleanly`, React MUST reset `useWorkspaceStore` (`activeModelPath = null`, `isVerified = false`, `isReadOnly = false`) and navigate to `/select`.

### Chapter 3: Dynamic Theme Customization

* **[REQ-07-FUNC-301] Preset Theme Selection:** Selecting a preset 3-color palette in `GlobalNavbar.jsx` MUST update `useThemeStore.js` and set document CSS variables (`--color-primary`, `--color-secondary`, `--color-accent`).
* **[REQ-07-FUNC-302] 3D Visualizer Material Update:** Upon changing the active color palette while on `/visualizer`, `useThreeCanvas.js` MUST dynamically re-assign mesh material color properties for branches, nodes, and background scene elements without scene re-creation.

### Chapter 4: Synchronous Status Monitoring & Reactivity

* **[REQ-07-FUNC-401] Synchronous Status Display:** Renders for active path, read-only status, verification state, and warning lists in `GlobalNavbar.jsx` MUST read directly from `useWorkspaceStore.js` without issuing Tauri IPC requests (0ms latency).
* **[REQ-07-FUNC-402] Metadata Save Status Invalidation:** Successful execution of `save_entity_metadata` (`SEQ-04`) MUST automatically update `useWorkspaceStore` setting `isVerified = false`, immediately updating the status badge in `GlobalNavbar.jsx` to reflect that re-verification is required.
* **[REQ-07-FUNC-403] Storage Repair Warning Clearance:** Successful execution of `repair_missing_entity_folders` (`SEQ-06`) MUST update `useWorkspaceStore` removing repaired UUIDs from the active `warnings` list.