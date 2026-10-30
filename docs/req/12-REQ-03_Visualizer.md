# REQ-03: HASM 3D Visualizer & Graph Rendering (Formal Specification)

This specification defines the functional, data, time constraint, progress streaming, and error handling requirements for calculating and rendering the 3D Git-like timeline graph under `SEQ-03`.

---

## 1. System Invariants & Core Rules

* **[REQ-03-RULE-001] State Guard Interception:** Access to `/visualizer` MUST be guarded by the Rust in-memory state. If no model is loaded (`ERR_NO_ACTIVE_MODEL`), the system MUST navigate to `/select`. If the loaded model is unverified (`is_verified == false`), the system MUST navigate to `/loading-model`.
* **[REQ-03-RULE-002] Multi-Mode Z-Axis Mapping:** The spatial mapping of entity Z-coordinates MUST support three discrete user-selectable modes (`TimeScaleMode`), with `SequentialIndex` as the default:
1. `Linear`: $Z \propto \Delta t$.
2. `Logarithmic`: $Z \propto \log_{10}(\Delta t + 1)$.
3. `SequentialIndex`: $Z = \text{index} \times \text{step\_distance}$.


* **[REQ-03-RULE-003] Non-Blocking Background Computation:** Layout calculation for large datasets MUST be executed on a background Rust worker thread (`tokio::task::spawn_blocking`) without freezing the main application or Tauri UI thread.
* **[REQ-03-RULE-004] Watchdog Progress Protection:** Long-running layout calculations MUST emit `visualizer-layout-progress` events at least once every **10,000ms**. Failure to receive events within this threshold MUST trigger a Watchdog Timeout.
* **[REQ-03-RULE-005] Non-Destructive Filter Reversion:** If a filter or time scale update times out or fails, the 3D Canvas MUST retain or revert to the last successfully rendered 3D scene state and inform the user via a toast notification.
* **[REQ-03-RULE-006] Chronological Commit Placement:** FACT nodes MUST be sorted by persisted `occurred_at` before Z-coordinate calculation. A FACT with an earlier valid ISO8601 timestamp MUST not receive a greater Z coordinate than a later FACT under the same filter.
* **[REQ-03-RULE-007] Branch Topology:** Each EXPERIENCE MUST occupy a stable `(x, y)` position and render a straight Z-parallel trunk. EXPERIENCE coordinates MUST use relationship depth $d$ for $x = 6d$ and a centered sibling lane around the mean parent lane for $y$, with deterministic collision avoidance. An EXPERIENCE trunk MUST begin at its first FACT Z coordinate and end at its final FACT Z coordinate, and MUST not render without a FACT. PERSON MUST NOT render its own node, mesh, or line; each EXPERIENCE node carries its owning PERSON's name instead. Parent-to-child relationships MUST be derived from `parent_experience_ids`, rendered as smooth curved branch-out connectors at the child’s first FACT Z coordinate and smooth curved merge connectors at its final FACT Z coordinate. A FACT on a child EXPERIENCE MUST also appear on every recursive parent EXPERIENCE trunk.
* **[REQ-03-RULE-008] Z-Axis Timeline Instead of XY Grid:** The 3D canvas MUST NOT render an xy-plane grid/border. Instead, React MUST render a single Z-axis timeline with a tick at every distinct FACT Z coordinate, labeled with that FACT's date (or its sequence number as a fallback). Tick placement MUST be derived from the FACT Z coordinates already produced by the active `TimeScaleMode`, so the timeline adapts automatically when the mode changes.
* **[REQ-03-RULE-009] Distinguishable Per-EXPERIENCE Coloring:** React MUST assign each EXPERIENCE trunk a hue via $\text{hue}_i = (i \times 137.508°) \bmod 360°$ so adjacent EXPERIENCEs remain visually distinguishable at any count. A FACT commit sphere MUST use a color derived from its EXPERIENCE's hue that is visibly different from that EXPERIENCE's trunk color while remaining recognizably related (same hue family). All derived colors MUST be adjusted toward WCAG AA contrast (ratio ≥ 4.5) against the active background.
* **[REQ-03-RULE-010] EXPERIENCE Hover Identifies Owning PERSON:** Hovering or clicking an EXPERIENCE trunk MUST expose that EXPERIENCE's owning PERSON name in addition to the EXPERIENCE's own metadata, since PERSON has no dedicated line or mesh of its own.
* **[REQ-03-RULE-011] FACT Projection Emphasis:** A FACT projection directly registered on its rendered EXPERIENCE MUST be opaque. A recursively reflected FACT projection MUST render as a translucent cube with $\alpha = 0.32$, so direct commits remain visually emphasized.
* **[REQ-03-RULE-012] Multi-Entity Link Rendering:** For each LINK, the layout MUST emit every unordered pair of distinct renderable FACT/EXPERIENCE IDs in `related_ids`, in first-appearance order, supporting FACT-FACT, FACT-EXPERIENCE, and EXPERIENCE-EXPERIENCE in both 2D and 3D. PERSON, missing IDs, and EXPERIENCEs without a timeline MUST be excluded while retaining remaining valid pairs. Duplicate IDs MUST NOT produce self or duplicate segments. With N eligible IDs, N(N-1)/2 segments MUST be emitted. Each segment MUST carry the original LINK ID and endpoint `fromId`/`toId`; clicking any segment MUST open that LINK ticket. FACT endpoints MUST use direct projections; EXPERIENCE endpoints MUST attach to their visible timelines using the shared viewport-aware geometry resolver. FACT-EXPERIENCE attaches nearest the FACT; EXPERIENCE-EXPERIENCE starts nearest the viewport center and ends nearest that source point. Hovering either endpoint MUST emphasize its incident segments. Coincident endpoints remain zero-length; no artificial offsets or membranes are introduced.
* **[REQ-03-RULE-013] Hover Relationship Highlighting:** Hovering a FACT or EXPERIENCE MUST apply a visible highlight color to that entity, its linked rendered FACT entities, and its parent EXPERIENCE trunks. EXPERIENCE trunks and branch curves MUST render with bold tube geometry; FACT-to-FACT links MUST remain normal thin lines.
* **[REQ-03-RULE-014] Shared Visualizer Ownership:** The visualizer surface MUST be provided by the reusable `src/hasm_visualizer` package. `VisualizerPage` MUST act only as a host, supplying the model, the layout callback, node-click routing, and page chrome. A duplicate Three.js or layout implementation MUST NOT be maintained elsewhere in the application.
* **[REQ-03-RULE-015] Scope-Before-Layout Invariant:** For packages above the configured scope threshold, the model MUST be narrowed by the PERSON / EXPERIENCE scope selection **before** layout is requested. An unscoped large package MUST NOT trigger `compute_visualizer_layout`.
* **[REQ-03-RULE-016] Bounded Scene Invariant:** The number of nodes handed to the Three.js scene, the number of Z-axis tick labels, and the number of GPU geometries MUST each be bounded by a constant that is independent of package size.
* **[REQ-03-RULE-017] Scope Is Not a Layout Filter:** The PERSON / EXPERIENCE scope MUST remain a frontend model-narrowing concern. It MUST NOT be added to `LayoutFilterRequest`, so the SEQ-03 IPC contract is unchanged.
* **[REQ-03-RULE-018] Active Layout Ownership:** Only the current pending layout may consume progress and reset its watchdog. Completed, timed-out, superseded, and unmounted requests MUST NOT restart timers, mutate the current page, or navigate on late failure. Late listener registration MUST be disposed, including StrictMode replay. Genuine current-request errors and 10-second stalls MUST retain the existing error routes/filter-reversion behavior.
* **[REQ-03-RULE-019] Bounded Navigation CI:** CI MUST exercise repeat graph-ticket-return navigation, delayed/out-of-order IPC, subscription cleanup, and save/re-verification with real routes and frontend IPC wrappers. The dedicated frontend robustness step MUST have a three-minute hard limit, use fake time instead of wall-clock sleeps, and require no network/GPU/browser installation. Native command-chain regression MUST exercise actual Tauri load/verify/layout dispatch and SQLite using an isolated temporary workspace.

---

## 2. Technical Specifications & Data Contracts

### 2.1 IPC Payload Data Contracts

```rust
// [REQ-03-DATA-001] Layout Filter Request Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutFilterRequest {
    pub time_range: (Option<String>, Option<String>), // ISO8601 Strings
    pub security_level: Option<i32>,
    pub time_scale_mode: TimeScaleMode, // "Linear" | "Logarithmic" | "SequentialIndex"
    pub z_scale_factor: f32,
}

// [REQ-03-DATA-002] Layout Progress Event Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutProgressPayload {
    pub current: usize,
    pub total: usize,
    pub percentage: f32,
    pub message: String,
}

// [REQ-03-DATA-003] Final 3D Render Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderPayload {
    pub nodes_3d: Vec<Node3DGeometry>,
    pub lines_3d: Vec<Line3DGeometry>,
    pub warnings: Vec<String>,
}

// LINK entries in lines_3d include the endpoint entity IDs used by the renderers.
pub struct Line3DGeometry {
    pub id: String,
    pub line_type: String,
    pub from: [f32; 3],
    pub to: [f32; 3],
    pub from_id: Option<String>,
    pub to_id: Option<String>,
    pub control_points: Option<Vec<[f32; 3]>>,
}

// FACT metadata used by chronological commit placement
pub struct Fact {
    pub occurred_at: String, // ISO8601 timestamp
}

// [REQ-03-DATA-004] Visualizer Error Payload Enum
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VisualizerError {
    NoActiveModel,
    ModelNotVerified,
    LayoutStalledTimeout { threshold_ms: u64 },
    CalculationFailed { message: String },
}

```

---

## 3. Detailed Functional Requirements

### Chapter 1: Initial View Load, State Guards & Progress Streaming

* **[REQ-03-FUNC-101] Visualizer Route Mounting:** Upon mounting `VisualizerPage.tsx`, React MUST initialize the default filter state, set the default view mode to `2d`, and subscribe to `visualizer-layout-progress` events.
* **[REQ-03-FUNC-102] Missing Model Guard:** If Rust returns `ERR_NO_ACTIVE_MODEL`, React Router MUST navigate to `/select`.
* **[REQ-03-FUNC-103] Unverified Model Guard:** If Rust returns `ERR_MODEL_NOT_VERIFIED`, React Router MUST navigate to `/loading-model` passing `{ returnTo: '/visualizer' }`.
* **[REQ-03-FUNC-104] Layout Watchdog Timer Initialization:** React MUST start a **10,000ms** Watchdog Timer upon invoking `compute_visualizer_layout`.
* **[REQ-03-FUNC-105] Chunked Progress Emission:** During layout computation, Rust MUST emit `visualizer-layout-progress` events periodically during entity filtering, branch positioning, Z-coordinate calculation, and spline generation.
* **[REQ-03-FUNC-106] Progress Event UI Reset:** Receiving a `visualizer-layout-progress` event MUST reset the Watchdog Timer to 0ms and update the progress overlay UI (`layoutProgress`, `loadingMessage`).
* **[REQ-03-FUNC-107] Watchdog Timeout Trigger:** If 10,000ms elapses without receiving a progress event, React MUST abort waiting, set `renderError = "Layout calculation stalled"`, and navigate to `/error-model`.
* **[REQ-03-FUNC-108] Three.js Scene Initialization:** Upon resolving `RenderPayload`, React MUST hide the loading progress overlay and instantiate Three.js geometries, lights, and camera positioning.
* **[REQ-03-FUNC-109] Model Warning Rendering:** If `RenderPayload.warnings` is non-empty (e.g., unreferenced storage folders), React MUST render a warning toast/banner.
* **[REQ-03-FUNC-110] Development Graph Action:** The Open Workspace page (`/select`) MUST offer a development action that creates a populated temporary HASM package and routes to `/visualizer` with a verified model payload.

### Chapter 2: Filter & TimeScale Control Interactions

* **[REQ-03-FUNC-201] Dynamic Filter Re-calculation:** Changing time sliders, `time_scale_mode`, or `z_scale_factor` MUST trigger `compute_visualizer_layout` with updated parameters.
* **[REQ-03-FUNC-202] Filter Progress Overlay Display:** Filter updates MUST display a lightweight non-modal progress bar overlay driven by `visualizer-layout-progress` events.
* **[REQ-03-FUNC-203] Filter Timeout Handling:** If a filter update exceeds the 10,000ms Watchdog threshold, React MUST display an error toast ("Filter update timed out. Reverting view.") and preserve the previous 3D scene state.
* **[REQ-03-FUNC-204] Chronological Filter Re-layout:** Changing a time-scale mode MUST retain FACT chronological ordering while recalculating Z coordinates.

### Chapter 3 & 4: Interactivity & Entity Detail Navigation

* **[REQ-03-FUNC-301] Pointer Raycasting:** Hovering over 3D meshes MUST perform raycasting at throttled intervals (100ms) to display 2D floating tooltips with entity metadata.
* **[REQ-03-FUNC-302] Entity Click Navigation:** Clicking any 3D node or line mesh MUST trigger React Router navigation to `/entity-detail/:entity_type/:entity_id`.
* **[REQ-03-FUNC-303] Curved Line Connectors:** Rust MUST return a curved branch-out plus branch-merge geometry for every `parent_experience_ids` entry. A child with multiple parents MUST produce both curved connectors for every parent.
* **[REQ-03-FUNC-304] Scene Navigation:** The Three.js canvas MUST provide orbit, pan, and zoom controls without disabling stationary node hover or click navigation.
* **[REQ-03-FUNC-305] Adaptive Z-Axis Timeline:** React MUST render the Z-axis timeline ticks and labels from the currently rendered `RenderPayload`'s FACT Z coordinates, so switching `TimeScaleMode` or `zScaleFactor` re-renders the timeline consistently with the new layout without a separate xy-plane grid.
* **[REQ-03-FUNC-306] Direct and Linked Geometry Metadata:** Rust MUST return direct-versus-inherited FACT projection metadata, parent EXPERIENCE IDs, and linked entity IDs with node geometry so React can render opacity and hover highlighting without reimplementing graph traversal.

### Chapter 5: PERSON / EXPERIENCE Scope Selection (`HasmVisualizerComponent`)

* **[REQ-03-FUNC-501] Scope Controls:** The visualizer toolbar MUST offer an initially collapsed Scope panel containing a multi-select EXPERIENCE scope control and, when the package has at least two PERSONs, a multi-select PERSON scope control, each labeled and keyboard reachable, plus a control that clears the scope. The PERSON selection and its All/None actions MUST be hidden for a single-PERSON or empty-PERSON package. The Scope trigger MUST expose expanded state and panel association. Done, Escape, trigger activation, and outside pointer interaction MUST dismiss the panel without losing selections; Done and Escape MUST restore trigger focus. Opening or closing the panel MUST NOT request layout or displace the graph.
* **[REQ-03-FUNC-502] Composed Option Lists:** When one or more PERSONs are selected, the EXPERIENCE option list MUST show only EXPERIENCEs owned by those PERSONs, and any previously selected EXPERIENCE outside the new PERSON set MUST be dropped.
* **[REQ-03-FUNC-503] Scope Narrowing Semantics:** Applying a scope MUST retain the selected EXPERIENCEs and their descendants, then add ancestors for connectivity without expanding those ancestors into sibling branches. FACTs registered on retained branches MUST be included. Additional FACTs belonging to selected PERSONs MUST be included only when no explicit EXPERIENCE selection is applied. Only LINKs whose `related_ids` are all inside the scope MUST be retained.
* **[REQ-03-FUNC-504] Empty Scope Passthrough:** An empty scope MUST return the model unchanged so behavior for small packages is identical to the unscoped path.
* **[REQ-03-FUNC-505] Scope Summary:** The toolbar MUST display how many entities the active scope selects out of the package total.
* **[REQ-03-FUNC-506] Large Package Scope Prompt:** When an unscoped package exceeds the scope threshold, the graph stage MUST display a prompt requesting a PERSON or EXPERIENCE selection instead of rendering (see `[REQ-03-RULE-015]`).
* **[REQ-03-FUNC-507] Render Budget Disclosure:** When the layout exceeds the render budget, the visualizer MUST render the budgeted subset and display a warning naming how many FACT nodes were withheld and how to narrow the scope.
* **[REQ-03-FUNC-508] Dual Model Shape Support:** Scope accessors MUST read both the camelCase entity shape returned by the Tauri backend and the snake_case shape used by the bundled sample packages.
* **[REQ-03-FUNC-509] Lane-Adaptive 2D Table Position:** The FACT/Time table MUST begin immediately after the rightmost rendered lane's label area using shared pixel lane geometry, not a viewport percentage. The table MUST move when the visible lane count changes. Narrow viewports MUST allow horizontal scrolling without clipping lanes.
* **[REQ-03-FUNC-510] Visible 2D Z Scale:** Z scale MUST multiply the 2D row height (30 CSS pixels at 1x), keeping FACT dots, branch endpoints, and table rows aligned, including at 0.5x and 2x and while scrolling. Failed layout updates MUST preserve both the previous geometry and its row scale. In 3D the scale MUST continue to reach `compute_visualizer_layout` and scale Z coordinates in all three time modes.
* **[REQ-03-FUNC-511] Compact Graph Controls:** The toolbar MUST separate optional sample selection, Scope, View, Time scale, Z scale, and host actions in that order. Scope lists MUST NOT determine the closed toolbar height. View buttons MUST expose pressed state. Controls MUST wrap without page-level horizontal overflow, use theme colors and visible keyboard focus, and remain within the viewport at desktop and mobile widths. Scope-panel scrolling MUST be local to its bounded overlay, not require scrolling the page to reach toolbar controls.