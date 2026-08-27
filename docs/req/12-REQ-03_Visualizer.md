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

* **[REQ-03-FUNC-101] Visualizer Route Mounting:** Upon mounting `VisualizerPage.tsx`, React MUST initialize the default filter state and subscribe to `visualizer-layout-progress` events.
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