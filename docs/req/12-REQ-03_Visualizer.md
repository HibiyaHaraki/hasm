# REQ-03: HASM 3D Visualizer (Formal Specification)

This specification defines the functional, data, and performance requirements for the HASM 3D Visualizer (`/visualizer`) under `SEQ-03`.

---

## 1. System Invariants & Core Rules

* **[REQ-03-RULE-001] Event-Driven Architecture:** The 3D Visualizer MUST operate as an event-driven view with separate handling for initial mount, filter updates, hover raycasting, and node click navigation.
* **[REQ-03-RULE-002] Read-Only View:** The Visualizer page MUST NOT contain any content editing features. All entity modifications MUST be restricted to dedicated detail/editor routes.
* **[REQ-03-RULE-003] Delegation of Spatial Layout:** All 3D spatial coordinate calculations and filtering operations MUST be performed on the Rust backend (`visualizer.rs`), returning a lightweight `RenderPayload` to React via Tauri IPC.
* **[REQ-03-RULE-004] Hard Timeout Enforcement:** Any IPC call to `compute_visualizer_layout` MUST enforce a strict **5,000ms** hard timeout on the frontend.
* **[REQ-03-RULE-005] Raycasting Throttling:** Pointer interaction (hover detection) on the 3D canvas MUST be throttled to a maximum execution rate of once every **100ms** to preserve 60 FPS rendering performance.
* **[REQ-03-RULE-006] Active Model Validation Guard:** IPC command `compute_visualizer_layout` MUST fail if no active `HasmModel` instance exists in Rust backend memory.
* **[REQ-03-RULE-007] Verification State Enforcement:** System MUST NOT generate 3D layouts if the active `HasmModel`'s internal `is_verified` flag is `false`.

---

## 2. Technical Specifications & Data Contracts

### 2.1 IPC Payload Data Contracts

```rust
// [REQ-03-DATA-001] Time Scale Mapping Mode Enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TimeScaleMode {
    Linear,           // Z = (timestamp - base_time) * scale_factor
    Logarithmic,      // Z = log10(timestamp - base_time + 1) * scale_factor
    SequentialIndex,  // Z = index * step_distance * scale_factor
}

// [REQ-03-DATA-002] Visualizer Filter Request Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualizerFilter {
    pub time_range: (Option<i64>, Option<i64>),
    pub security_level: Option<i32>,
    pub time_scale_mode: TimeScaleMode,
    pub z_scale_factor: f32,
}

// [REQ-03-DATA-003] 3D Node Representation Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node3D {
    pub id: Uuid,
    pub entity_type: String, // "PERSON" | "EXPERIENCE" | "FACT" | "LINK"
    pub name: String,
    pub description: String,
    pub position: [f32; 3],  // [x, y, z]
    pub security_level: i32,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
}

// [REQ-03-DATA-004] 3D Line Representation Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Line3D {
    pub id: Uuid,
    pub start_pos: [f32; 3],
    pub end_pos: [f32; 3],
    pub line_type: String,   // "BRANCH" | "FACT_LINK"
}

// [REQ-03-DATA-005] Complete Render Payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderPayload {
    pub nodes: Vec<Node3D>,
    pub lines: Vec<Line3D>,
    pub total_count: usize,
    pub filtered_count: usize,
    pub warnings: Vec<String>,
}

```

## 3. Detailed Functional Requirements

### Chapter 1: Initial View Load Event & State Validation Guards

* **[REQ-03-FUNC-101] Component Mounting:** React MUST mount `VisualizerPage` when navigating to `/visualizer`.
* **[REQ-03-FUNC-102] Default Filter State:** React MUST initialize the filter state with default values: `timeScaleMode = Linear`, `zScaleFactor = 1.0`, `securityLevel = All`, `timeRange = Full`.
* **[REQ-03-FUNC-103] Initial Layout Invocation:** React MUST invoke `compute_visualizer_layout` with the default `VisualizerFilter`.
* **[REQ-03-FUNC-104] Initial Layout Timeout:** React MUST enforce a **5,000ms** hard timeout for the initial layout invocation.
* **[REQ-03-FUNC-105] Initial Layout Timeout Routing:** If the initial layout IPC call exceeds 5,000ms, React MUST set `renderError` and navigate to `/error-model`.
* **[REQ-03-FUNC-106] Missing Model Detection:** If no `HasmModel` is loaded in Rust memory, Rust MUST reject `compute_visualizer_layout` with error code `"ERR_NO_ACTIVE_MODEL"`.
* **[REQ-03-FUNC-107] Missing Model Redirect:** Upon receiving `"ERR_NO_ACTIVE_MODEL"`, React Router MUST navigate directly to `/select`.
* **[REQ-03-FUNC-108] Unverified Model Detection:** If `HasmModel` is present but `is_verified` is `false`, Rust MUST reject `compute_visualizer_layout` with error code `"ERR_MODEL_NOT_VERIFIED"`.
* **[REQ-03-FUNC-109] Unverified Model Redirect:** Upon receiving `"ERR_MODEL_NOT_VERIFIED"`, React Router MUST navigate to `/loading-model` passing `{ returnTo: '/visualizer' }` in route state to execute `SEQ-02` re-verification.
* **[REQ-03-FUNC-110] Experience Branch XY Calculation:** Rust MUST compute distinct XY plane coordinates for each `EXPERIENCE` entity line.
* **[REQ-03-FUNC-111] Fact Z-Axis Placement:** Rust MUST place `FACT` nodes on their parent `EXPERIENCE` branch along the Z-axis based on the selected `TimeScaleMode`.
* **[REQ-03-FUNC-112] Link Mesh Generation:** Rust MUST compute 3D lines/curves for relationship links between entities.
* **[REQ-03-FUNC-113] Three.js Canvas Setup:** React MUST initialize the Three.js Scene, Camera, Ambient/Directional Lights, and OrbitControls upon receiving `RenderPayload`.
* **[REQ-03-FUNC-114] Warning Banner Display:** If `RenderPayload.warnings` contains unreferenced folders, React MUST display a floating toast/banner.

### Chapter 2: Filter & Scale Update Event (Control Interaction)

* **[REQ-03-FUNC-201] Filter State Update:** React MUST update internal filter state when the user modifies any UI control (Time Slider, Security Selector, TimeScaleMode, Z-Factor).
* **[REQ-03-FUNC-202] Layout Re-computation IPC:** React MUST invoke `compute_visualizer_layout` with the updated `VisualizerFilter`.
* **[REQ-03-FUNC-203] Filter Update Hard Timeout:** React MUST enforce a **5,000ms** hard timeout for layout re-computation.
* **[REQ-03-FUNC-204] Filter Timeout Rollback:** If layout re-computation exceeds 5,000ms, React MUST display a toast error ("Filter update timed out") and revert to the previous filter state.
* **[REQ-03-FUNC-205] Linear Mapping Mode:** When `timeScaleMode` is `Linear`, Rust MUST calculate Z-coordinates linearly proportional to elapsed timestamp values ($\Delta t$).
* **[REQ-03-FUNC-206] Logarithmic Mapping Mode:** When `timeScaleMode` is `Logarithmic`, Rust MUST calculate Z-coordinates using logarithmic scaling ($\log_{10}(\Delta t + 1)$).
* **[REQ-03-FUNC-207] Sequential Index Mapping Mode:** When `timeScaleMode` is `SequentialIndex`, Rust MUST sort `FACT` items chronologically and space them evenly along the Z-axis based on chronological order.
* **[REQ-03-FUNC-208] Geometry Mesh Update:** Upon receiving updated `RenderPayload`, React MUST update Three.js mesh positions without destroying the canvas context.

### Chapter 3: Node Hover Event (Pointer Raycasting)

* **[REQ-03-FUNC-301] Pointer Movement Listener:** React MUST attach pointer movement listeners to the 3D Canvas element.
* **[REQ-03-FUNC-302] Throttled Raycasting:** React MUST execute Three.js Raycaster operations at a maximum frequency of once every **100ms**.
* **[REQ-03-FUNC-303] Intersection Detection:** Raycaster MUST identify the closest intersected 3D mesh node under the pointer.
* **[REQ-03-FUNC-304] Tooltip Display:** When intersecting an entity mesh, React MUST display a floating 2D panel showing `Name`, `Description`, `Security Level`, and `Start/End Time`.
* **[REQ-03-FUNC-305] Tooltip Dismissal:** When the pointer leaves all entity meshes, React MUST immediately hide the floating 2D panel.

### Chapter 4: Node Click Event (Entity Navigation)

* **[REQ-03-FUNC-401] Canvas Click Listener:** React MUST attach click event listeners to the 3D Canvas element.
* **[REQ-03-FUNC-402] Target Entity Resolution:** Upon click, Raycaster MUST extract the target entity's `entity_type` and `entity_id`.
* **[REQ-03-FUNC-403] Route Transition:** React Router MUST navigate to `/entity-detail/:entity_type/:entity_id`.
* **[REQ-03-FUNC-404] Detail View Data Transfer:** React Router MUST transfer `modelPath` and `isReadOnly` state to the target detail route.