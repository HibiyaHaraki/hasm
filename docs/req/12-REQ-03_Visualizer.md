# REQ-03: HASM 3D Visualizer & Graph Rendering (Formal Specification)

This specification defines the functional, data, time constraint, progress streaming, and error handling requirements for calculating and rendering the 3D Git-like timeline graph under `SEQ-03`.

---

## 1. System Invariants & Core Rules

* **[REQ-03-RULE-021] Demo Product Tour:** After a temporary tutorial workspace has passed verification and its initial graph layout succeeds, the visualizer MUST show a four-step, dismissible, theme-aware Joyride product tour. It MUST explain creating a workspace, creating an entity, opening an entity detail page, and finding the detail page's Extended commit graph, spotlighting the relevant visible controls and graph. It MUST warn that switching deletes the demo and its edits. Back, Next, Finish and Skip MUST be keyboard-accessible, Escape MUST dismiss the tour, and the tour MUST be replayable from the demo visualizer. The tour MUST NOT appear for other workspaces or unsuccessful layouts, and MUST NOT automatically reopen on returning to the same demo graph.

* **[REQ-03-RULE-020] Accessible 2D EXPERIENCE Navigation:** Each 2D EXPERIENCE lane label, including an empty timeline without a trunk, MUST be keyboard- and pointer-activatable and select that EXPERIENCE through the existing renderer callback. The host MUST open its typed detail ticket with workspace and view context intact. Detail graphs MUST disable these controls whenever graph navigation is disabled. A standalone renderer without a selection callback MUST render a noninteractive label.

* **[REQ-03-RULE-001] State Guard Interception:** Access to `/visualizer` MUST be guarded by the Rust in-memory state. If no model is loaded (`ERR_NO_ACTIVE_MODEL`), the system MUST navigate to `/select`. If the loaded model is unverified (`is_verified == false`), the system MUST navigate to `/loading-model`.
* **[REQ-03-RULE-002] Multi-Mode Z-Axis Mapping:** The spatial mapping of entity Z-coordinates MUST support three discrete user-selectable modes (`TimeScaleMode`), with `SequentialIndex` as the default:
1. `Linear`: $Z \propto \Delta t$.
2. `Logarithmic`: $Z \propto \log_{10}(\Delta t + 1)$.
3. `SequentialIndex`: $Z = \text{index} \times \text{step\_distance}$.


* **[REQ-03-RULE-003] Non-Blocking Background Computation:** Layout calculation for large datasets MUST be executed on a background Rust worker thread (`tokio::task::spawn_blocking`) without freezing the main application or Tauri UI thread.
* **[REQ-03-RULE-004] Watchdog Progress Protection:** Long-running layout calculations MUST emit `visualizer-layout-progress` events at least once every **10,000ms**. Failure to receive events within this threshold MUST trigger a Watchdog Timeout.
* **[REQ-03-RULE-005] Non-Destructive Filter Reversion:** If a filter or time scale update times out or fails, the 3D Canvas MUST retain or revert to the last successfully rendered 3D scene state and inform the user via a toast notification.
* **[REQ-03-RULE-006] Chronological Commit Placement:** FACT nodes MUST be sorted by persisted `occurred_at` before Z-coordinate calculation. A FACT with an earlier valid ISO8601 timestamp MUST not receive a greater Z coordinate than a later FACT under the same filter.
* **[REQ-03-RULE-007] Branch Topology:** Each EXPERIENCE MUST occupy a stable `(x, y)` position and render a straight Z-parallel trunk. EXPERIENCE coordinates MUST use relationship depth $d$ for $x=6d$. Parent/child edges MUST have weight 4, each EXPERIENCE-to-EXPERIENCE LINK pair MUST add weight 3, and each shared direct FACT or FACT-to-FACT LINK owner pair MUST add weight 1. At each depth, the layout MUST initialize EXPERIENCE order from parent centroids and perform six deterministic weighted-barycenter sweeps over positioned relationship neighbors. Each positioned parent MUST contribute a weight-4 center anchor; the same parent edge MUST NOT be counted twice, while additional LINKs between that parent and child MUST remain additive. The layer center MUST be the mean parent centroid (or 0 for a parentless layer), and final Y coordinates MUST preserve that mean. For adjacent EXPERIENCEs in the resulting order, with accumulated relationship weight $w_i$, the lane gap MUST be $g_i=2+\frac{2}{1+\ln(1+w_i)}$, yielding 4 units for unrelated neighbors and approaching a 2-unit minimum as intimacy grows. UUID order MUST break equal-barycenter ties. An EXPERIENCE trunk MUST begin at its first FACT Z coordinate and end at its final FACT Z coordinate, and MUST not render without a FACT. PERSON MUST NOT render its own node, mesh, or line; each EXPERIENCE node carries its owning PERSON's name instead. Parent-to-child relationships MUST be derived from `parent_experience_ids`, rendered as smooth curved branch-out connectors at the child’s first FACT Z coordinate and smooth curved merge connectors at its final FACT Z coordinate. A FACT on a child EXPERIENCE MUST also appear on every recursive parent EXPERIENCE trunk.
* **[REQ-03-RULE-008] Z-Axis Timeline Instead of XY Grid:** The 3D canvas MUST NOT render an xy-plane grid/border. Instead, React MUST render a single Z-axis timeline with a tick at every distinct FACT Z coordinate, labeled with that FACT's date (or its sequence number as a fallback). Tick placement MUST be derived from the FACT Z coordinates already produced by the active `TimeScaleMode`, so the timeline adapts automatically when the mode changes.
* **[REQ-03-RULE-009] Lineage- and Intimacy-Based EXPERIENCE Coloring:** Every graph renderer MUST derive EXPERIENCE colors from the active rendered payload and the already scoped/budgeted model. Only EXPERIENCE and FACT IDs present in that payload may contribute to color calculations; off-scope and withheld entities MUST NOT affect colors. For each visible EXPERIENCE $E_i$, $d_i$ MUST count each unique visible parent/child edge, each visible EXPERIENCE-to-EXPERIENCE LINK pair, each direct visible EXPERIENCE-to-FACT membership, and each visible FACT-to-FACT LINK pair once for every visible EXPERIENCE directly associated with either FACT endpoint. Multi-endpoint LINKs MUST contribute each distinct rendered pair; duplicate IDs, missing endpoints, self-relationships, and off-scope entities MUST NOT inflate the count. Separate relationships MUST count independently, even when they connect the same entities. With $d_{\max}=\max_i d_i$, relationship density MUST be $c_i=\frac{\ln(1+d_i)}{\ln(1+d_{\max})}$, or 0 when $d_{\max}=0$. Visible parent/child edges MUST define lineage components ordered by their lexicographically smallest UUID. Within each component, a deterministic breadth-first traversal MUST start at that UUID and visit visible relationship neighbors by descending accumulated relationship weight, then UUID; any unvisited IDs MUST be appended in UUID order. For $N$ visible EXPERIENCEs and palette rank $r_i$ in that ordering, the base hue MUST be $H_i=360°(r_i+\frac{1}{2})/N$. This MUST distribute hues across the full color wheel while giving relationship neighbors nearby palette positions. Let $t_i$ be the EXPERIENCE's visible hierarchy depth divided by maximum visible depth, or 0 when that maximum is 0. Saturation MUST be $55\%+30\%c_i$ and lightness MUST be $70\%-16\%c_i-8\%t_i$. The implementation MUST convert the HSL value to HEX and adjust it to WCAG AA contrast (ratio ≥ 4.5) against the active background. FACT markers MUST use their EXPERIENCE's HSL color blended 40% toward the theme's text color, then receive the same contrast adjustment. Within the same graph, every occurrence of an entity MUST use the same color.
* **[REQ-03-RULE-010] EXPERIENCE Hover Identifies Owning PERSON:** Hovering or clicking an EXPERIENCE trunk MUST expose that EXPERIENCE's owning PERSON name in addition to the EXPERIENCE's own metadata, since PERSON has no dedicated line or mesh of its own.
  The existing `personName` layout field MUST contain all distinct direct and recursively inherited owners, joined in parent traversal order, or null when no owner resolves. Cycles and missing parents MUST terminate safely. Scoped layouts MUST retain the PERSON context needed for displayed ancestor owners without adding unrelated graph entities.
* **[REQ-03-RULE-011] FACT Projection Emphasis:** A FACT projection directly registered on its rendered EXPERIENCE MUST be opaque. A recursively reflected FACT projection MUST render as a translucent cube with $\alpha = 0.32$, so direct commits remain visually emphasized.
* **[REQ-03-RULE-012] Multi-Entity Link Rendering:** For each LINK, the layout MUST emit every unordered pair of distinct renderable FACT/EXPERIENCE IDs in `related_ids`, in first-appearance order, supporting FACT-FACT, FACT-EXPERIENCE, and EXPERIENCE-EXPERIENCE in both 2D and 3D. PERSON, missing IDs, and EXPERIENCEs without a timeline MUST be excluded while retaining remaining valid pairs. Duplicate IDs MUST NOT produce self or duplicate segments. With N eligible IDs, N(N-1)/2 segments MUST be emitted. Each segment MUST carry the original LINK ID and endpoint `fromId`/`toId`; clicking any segment MUST open that LINK ticket. FACT endpoints MUST use direct projections; EXPERIENCE endpoints MUST attach to their visible timelines using the shared viewport-aware geometry resolver. FACT-EXPERIENCE attaches nearest the FACT; EXPERIENCE-EXPERIENCE starts nearest the viewport center and ends nearest that source point. Hovering either endpoint MUST emphasize its incident segments. Coincident endpoints remain zero-length; no artificial offsets or membranes are introduced.
* **[REQ-03-RULE-013] Hover Relationship Highlighting:** Hovering a FACT or EXPERIENCE MUST apply a visible highlight color to that entity, its linked rendered FACT entities, and its parent EXPERIENCE trunks. EXPERIENCE trunks and branch curves MUST render with bold tube geometry; FACT-to-FACT links MUST remain normal thin lines.
* **[REQ-03-RULE-014] Shared Visualizer Ownership:** The visualizer surface MUST be provided by the reusable `src/hasm_visualizer` package. `VisualizerPage` MUST act only as a host, supplying the model, the layout callback, node-click routing, and page chrome. A duplicate Three.js or layout implementation MUST NOT be maintained elsewhere in the application.
* **[REQ-03-RULE-015] Scope-Before-Layout Invariant:** An unscoped package above the configured threshold MUST request a PERSON / EXPERIENCE scope and MUST NOT trigger `compute_visualizer_layout`. A selected scope retaining more than the threshold number of PERSON, EXPERIENCE, and LINK records MUST request a narrower scope rather than calculate that oversized graph. For every accepted scope, the model MUST be narrowed and render-budgeted before layout in both 2D and 3D; layout and color calculations MUST use only that retained model and entities present in the rendered payload.
* **[REQ-03-RULE-016] Bounded Render Invariant:** The number of FACT records passed to layout MUST be capped by `maxRenderedNodes` (default 1,200), independent of package size. When the pre-layout FACT budget is exceeded, only the retained FACTs, their EXPERIENCE ancestors, the required owner PERSONs, and fully contained LINKs MAY be sent to layout. After layout, `limitRenderedNodes` MUST cap the total render-payload node count to `max(maxRenderedNodes, scopePromptThreshold)`, retaining EXPERIENCE/PERSON nodes and trimming FACT projections to fit; the scope gate bounds the retained non-FACT model set. The number of Z-axis tick labels and GPU geometries MUST also be bounded by constants independent of package size.
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

### Chapter 2: Filter & TimeScale Control Interactions

* **[REQ-03-FUNC-201] Dynamic Filter Re-calculation:** Changing time sliders, `time_scale_mode`, or `z_scale_factor` MUST trigger `compute_visualizer_layout` with updated parameters.
* **[REQ-03-FUNC-202] Filter Progress Overlay Display:** Filter updates MUST display a lightweight non-modal progress bar overlay driven by `visualizer-layout-progress` events.
* **[REQ-03-FUNC-203] Filter Timeout Handling:** If a filter update exceeds the 10,000ms Watchdog threshold, React MUST display an error toast ("Filter update timed out. Reverting view.") and preserve the previous 3D scene state.
* **[REQ-03-FUNC-204] Chronological Filter Re-layout:** Changing a time-scale mode MUST retain FACT chronological ordering while recalculating Z coordinates.

### Chapter 3 & 4: Interactivity & Entity Detail Navigation

* **[REQ-03-FUNC-301] Pointer Raycasting:** Hovering over 3D meshes MUST perform raycasting at throttled intervals (100ms) to display 2D floating tooltips with entity metadata.
* **[REQ-03-FUNC-302] Entity Click Navigation:** Clicking any 3D node or line mesh MUST trigger React Router navigation to `/entity-detail/:entity_type/:entity_id`.
* **[REQ-03-FUNC-303] Curved Line Connectors:** Rust MUST return a curved branch-out plus branch-merge geometry for every `parent_experience_ids` entry. A child with multiple parents MUST produce both curved connectors for every parent.
* **[REQ-03-FUNC-304] Scene Navigation:** The Three.js canvas MUST provide orbit, pan, and zoom controls without disabling stationary node hover or click navigation. A new 3D view MUST fit the rendered graph, including curve controls and timeline labels, within the viewport with clipping and distance limits scaled to its extent. It MUST look horizontally across XY with increasing Z (later time) vertically upward and fit projected bounds to the available viewport. A 3D-only XY top view button MUST fit the rendered graph looking from positive Z with positive Y upward, and MUST be disabled until the renderer is ready. Automatic views MUST refit on resize until manual camera navigation; restored camera states MUST remain intact. Scope and render budgets continue to limit the displayed graph.
* **[REQ-03-FUNC-305] Adaptive Z-Axis Timeline:** React MUST render the Z-axis timeline ticks and labels from the currently rendered `RenderPayload`'s FACT Z coordinates, so switching `TimeScaleMode` or `zScaleFactor` re-renders the timeline consistently with the new layout without a separate xy-plane grid.
* **[REQ-03-FUNC-306] Direct and Linked Geometry Metadata:** Rust MUST return direct-versus-inherited FACT projection metadata, parent EXPERIENCE IDs, and linked entity IDs with node geometry so React can render opacity and hover highlighting without reimplementing graph traversal.

### Chapter 5: PERSON / EXPERIENCE Scope Selection (`HasmVisualizerComponent`)

* **[REQ-03-FUNC-501] Scope Controls:** The visualizer toolbar MUST offer an initially collapsed Scope panel containing a searchable multi-select EXPERIENCE scope control and, when the package has at least two PERSONs, a multi-select PERSON scope control, each labeled and keyboard reachable, plus a control that clears the scope. The EXPERIENCE field MUST show all eligible options for an empty query, filter titles case-insensitively otherwise, and display selected titles as individually removable badges without UUIDs. It MUST reuse the single badge field with dropdown-first focused search used by entity relationship selectors, without a separate search field outside the dropdown. The PERSON selection and its All/None actions MUST be hidden for a single-PERSON or empty-PERSON package. The Scope trigger MUST expose expanded state and panel association. Done, Escape, trigger activation, and outside pointer interaction MUST dismiss the panel without losing selections; Escape first closes an open EXPERIENCE list. Done and panel-level Escape MUST restore trigger focus. Opening or closing the panel MUST NOT request layout or displace the graph.
* **[REQ-03-FUNC-502] Composed Option Lists:** When one or more PERSONs are selected, the EXPERIENCE option list MUST show only EXPERIENCEs owned by those PERSONs, and any previously selected EXPERIENCE outside the new PERSON set MUST be dropped.
* **[REQ-03-FUNC-503] Scope Narrowing Semantics:** Applying a scope MUST retain the selected EXPERIENCEs and their descendants, then add ancestors for connectivity without expanding those ancestors into sibling branches. FACTs registered on retained branches MUST be included. Additional FACTs belonging to selected PERSONs MUST be included only when no explicit EXPERIENCE selection is applied. Only LINKs whose `related_ids` are all inside the scope MUST be retained.
* **[REQ-03-FUNC-504] Empty Scope Passthrough:** An empty scope MUST return the model unchanged so behavior for small packages is identical to the unscoped path.
* **[REQ-03-FUNC-505] Scope Summary:** The toolbar MUST display how many entities the active scope selects out of the package total.
* **[REQ-03-FUNC-506] Large Package Scope Prompt:** When an unscoped package exceeds the scope threshold, or an explicit scope retains more than the threshold number of PERSON, EXPERIENCE, and LINK records, the graph stage MUST display a prompt requesting a narrower scope instead of rendering (see `[REQ-03-RULE-015]`).
* **[REQ-03-FUNC-507] Render Budget Disclosure:** When the pre-layout FACT budget or rendered FACT-projection budget withholds entities, the visualizer MUST render the budgeted subset and display a warning naming how many FACT nodes were withheld and how to narrow the scope.
* **[REQ-03-FUNC-508] Dual Model Shape Support:** Scope accessors MUST read both the camelCase entity shape returned by the Tauri backend and the snake_case shape used by the bundled sample packages.
* **[REQ-03-FUNC-509] Lane-Adaptive 2D Table Position:** In SequentialIndex, the FACT/Time table MUST begin immediately after the rightmost rendered lane's label area using shared pixel lane geometry, not a viewport percentage. The table MUST move when the visible lane count changes. Narrow viewports MUST allow horizontal scrolling without clipping lanes.
* **[REQ-03-FUNC-510] Visible 2D Z Scale:** In SequentialIndex, Z scale MUST multiply the 2D row height (30 CSS pixels at 1x), keeping FACT dots, branch endpoints, and table rows aligned, including at 0.5x and 2x and while scrolling. In Linear/Logarithmic it MUST multiply the projected timeline extent while preserving time-distance ratios. Failed layout updates MUST preserve the previous geometry, time mode, and scale. In 3D the scale MUST continue to reach `compute_visualizer_layout` and scale Z coordinates in all three time modes.
* **[REQ-03-FUNC-511] Compact Graph Controls:** The toolbar MUST separate optional sample selection, Scope, View, Time scale, Z scale, and host actions in that order. Scope lists MUST NOT determine the closed toolbar height. View buttons MUST expose pressed state. Controls MUST wrap without page-level horizontal overflow, use theme colors and visible keyboard focus, and remain within the viewport at desktop and mobile widths. Scope-panel scrolling MUST be local to its bounded overlay, not require scrolling the page to reach toolbar controls.
* **[REQ-03-FUNC-512] Time-Scaled 2D Axis:** Linear/Logarithmic MUST hide the FACT title/time table and show FACT names/dates on marker hover. They MUST project layout time coordinates onto a labeled Y-axis, newest first, preserving the selected scale's distance ratios. Simultaneous FACTs and reflected copies MUST share Y. Branch and LINK geometry MUST use that same projection. Distinct time coordinates MUST retain ticks even when dense labels are omitted. The graph MUST own vertical scrolling with a fixed header in these modes. SequentialIndex behavior and node-click navigation MUST remain unchanged.
* **[REQ-03-FUNC-513] XY EXPERIENCE Distribution:** A separate keyboard-accessible XY view MUST display all scoped EXPERIENCEs at their layout XY coordinates, including those without FACTs, and solid parent/child relationships. It MUST NOT display FACT markers or a FACT table. Each distinct pair of LINK endpoints MUST project EXPERIENCEs to themselves and FACTs to every directly associated visible EXPERIENCE, drawing selectable dashed segments or same-EXPERIENCE loops. Duplicate projected pairs within a LINK MUST be collapsed; different LINKs MUST remain separately selectable. Missing, PERSON, and FACT endpoints without visible direct EXPERIENCEs MUST NOT produce segments. Selecting an EXPERIENCE or LINK MUST open its ticket with scope and view state intact. The existing 2D timeline and 3D views MUST remain available.
## View identity, return state and EXPERIENCE badge requirements

* SequentialIndex MUST suppress repeated FACT UUID/XY projections on the same
  EXPERIENCE line, preferring a direct projection, while preserving separate
  placements and ancestor reflections and unique FACT title rows.
* Graph-ticket-return MUST preserve filter, scope, 2D/3D mode and per-mode
  scroll/camera state in workspace route context, including re-verification after
  a save. It MUST NOT modify persisted entity/model shapes or use shared global
  browser settings.
* FACT hover MUST show exactly one EXPERIENCE badge for the hovered line,
  including reflected markers. SequentialIndex title rows MUST show a
  representative direct EXPERIENCE badge before the FACT title on the same line,
  separated by a space, falling back to
  a reflection only when needed. Badge colors MUST match the EXPERIENCE line and
  use contrast-safe text; badges MUST preserve graph/table row alignment. The
  name badge MUST replace the table's color-only dot, not the graph FACT markers.
* EXPERIENCE table badges MUST open their specific EXPERIENCE ticket, not the
  containing FACT, and preserve workspace context and visualizer view state.
