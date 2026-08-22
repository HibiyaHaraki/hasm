# HASM Desktop Application - Directory Structure & Architecture Overview

This document outlines the complete directory layout, module responsibilities, file-to-function mapping, route guard architecture (Barrier 1), and test script locations for the HASM Desktop Application (Tauri v2 + React/JSX).

The overall application architecture, lifecycle, and sequence flows referenced below correspond to:
* [SEQ-01: App Launch & App Validation](./10-SEQ-01_AppLaunch_AppValidation.md)
* [SEQ-02: Model Loading & Storage Verification](./11-SEQ-02_HASM_Model_Load.md)
* [SEQ-03: HASM 3D Visualizer](./12-SEQ-03_Visualizer.md)
* [SEQ-04: Entity MetaData Editing & Saving](./13-SEQ-04_Entity_Editing.md)
* [SEQ-05: External Markdown App Invocation](./14-SEQ-05_Edit_on_HASM_Markdown.md)
* [SEQ-06: Error Fallback & Recovery Flow](./15-SEQ-06_Error_Fallback.md)
* [SEQ-07: Global Navigation & Environment Management](./16-SEQ-07_Others.md)

---

## Chapter 1: Directory Structure Overview


```

hasm-desktop/
├── src-tauri/                   # Rust Backend (Tauri Core Engine)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── tests/                   # Rust Integration Tests (Tauri Level)
│   │   ├── app_command_tests.rs
│   │   ├── model_command_tests.rs
│   │   ├── visualizer_tests.rs
│   │   └── entity_tests.rs
│   └── src/
│       ├── main.rs              # App entry point & Tauri builder
│       ├── lib.rs               # Library root & plugin setup
│       ├── commands/            # Tauri IPC Commands Facade Layer
│       │   ├── mod.rs
│       │   ├── app_commands.rs  # SEQ-01, SEQ-06
│       │   ├── model_commands.rs# SEQ-02, SEQ-07
│       │   ├── visualizer_commands.rs # SEQ-03
│       │   └── entity_commands.rs    # SEQ-04, SEQ-05, SEQ-06
│       ├── domain/              # Core Domain Models & Invariants
│       │   ├── mod.rs
│       │   ├── models.rs        # HasmModel, Person, Experience, Fact, Link
│       │   ├── validation.rs    # Verifiable trait & EntityValidationError
│       │   └── errors.rs        # Unified Error Enums & Payloads
│       ├── repository/          # Data Access & Persistence Layer
│       │   ├── mod.rs
│       │   ├── sqlite_repo.rs   # SqliteRepository (hasm.db transactions)
│       │   └── storage_service.rs# FileStorageService (Folder existence & mtime)
│       └── services/            # Infrastructure & Process Services
│           ├── mod.rs
│           ├── markdown_runner.rs# Submodule Runner (hasm_markdown.exe verify/spawn)
│           └── layout_engine.rs # VisualizerLayoutEngine (3D Coordinate math)
│
├── tests/                       # E2E / Desktop Integration Tests (App Level)
│   ├── e2e/
│   │   ├── 01_app_launch.spec.js
│   │   ├── 02_model_loading.spec.js
│   │   ├── 03_visualizer.spec.js
│   │   ├── 04_entity_editing.spec.js
│   │   ├── 05_external_app.spec.js
│   │   ├── 06_error_recovery.spec.js
│   │   └── 07_global_navigation.spec.js
│   └── mocks/                   # Test fixtures & mock workspaces
│
└── src/                         # Frontend (React + JavaScript / JSX)
├── index.html
├── main.jsx                 # React root element & provider setups
├── App.jsx                  # Root router gate & Tauri window event listeners
├── assets/                  # Static assets (images, icons, styles)
├── components/              # Shared / Atomic UI Components
│   ├── common/              # Toast, Modal, Button, LoadingOverlay, GlobalNavbar
│   ├── visualizer/          # Three.js Canvas, ControlPanel, Tooltip
│   └── entity/              # TicketForm, MetaFields, RefreshButton
├── pages/                   # Page Components mapped to React Router
│   ├── AppBootGatePage.jsx       # Route: / (SEQ-01)
│   ├── SelectModelPage.jsx       # Route: /select (SEQ-02)
│   ├── LoadingModelPage.jsx      # Route: /loading-model (SEQ-02)
│   ├── VisualizerPage.jsx        # Route: /visualizer (SEQ-03)
│   ├── EntityDetailPage.jsx      # Route: /entity-detail/:entity_type/:entity_id (SEQ-04)
│   ├── ErrorAppPage.jsx          # Route: /error-app (SEQ-06)
│   ├── ErrorModelPage.jsx        # Route: /error-model (SEQ-06)
│   └── ErrorMarkdownPage.jsx     # Route: /error-markdown (SEQ-06)
├── routes/                  # React Router Configuration & Protection (Barrier 1)
│   ├── index.jsx            # Declarative Route definitions
│   └── ProtectedRoute.jsx   # Route Guard Wrapper (Model & Verification Enforcement)
├── hooks/                   # Custom React Hooks & Component Tests
│   ├── useTauriInvoke.js
│   ├── useTauriListen.js
│   ├── useWindowFocus.js
│   ├── useWindowCloseListener.js
│   ├── useThreeCanvas.js
│   └── **tests**/           # React Level Unit/Component Tests
│       ├── LoadingModelPage.test.jsx
│       ├── VisualizerPage.test.jsx
│       ├── EntityDetailPage.test.jsx
│       ├── ErrorPages.test.jsx
│       └── ProtectedRoute.test.jsx
├── services/                # IPC Call Wrappers & Mapper Services
│   ├── ipcBridge.js         # Centralized invoke() & listen() API calls
│   └── errorMapper.js       # Backend error code to UI message formatter
└── store/                   # Global State Management (Zustand / Context)
├── useWorkspaceStore.js # Active model path, isVerified, isReadOnly
├── useThemeStore.js     # Color palette selection (SEQ-07)
└── useAppConfigStore.js # App version, binary paths, UI settings

```

---

## Chapter 2: Rust Backend Mapping (`src-tauri/src/`)

### Chapter 2.1: Entry Point & Application Lifecycle (`main.rs`, `lib.rs`)

* **`main.rs`**
  * `main()`: Desktop entry point. Invokes `lib::run()`.
* **`lib.rs`**
  * `run()`: Initializes Tauri builder, configures plugins, attaches setup hooks, registers commands, and boots application.
  * `setup_app_environment(app: &mut App)`: Sets up thread-safe global state containers (`HasmModelHandle`, `WorkspaceLockState`).
  * `register_window_events(window: &Window)`: Attaches listener for `tauri://close-requested` event to run `release_workspace_lock` before exit ([SEQ-02](./11-SEQ-02_HASM_Model_Load.md)).

---

### Chapter 2.2: App Commands (`src-tauri/src/commands/app_commands.rs`)

* `validate_hasm_markdown_app() -> Result<(), AppValidationError>`: Checks packaged `hasm_markdown.exe` existence ([SEQ-01](./10-SEQ-01_AppLaunch_AppValidation.md)).
* `validate_app_version() -> Result<AppVersionResponse, AppValidationError>`: Inspects package version and parses CLI arguments for `--path` ([SEQ-01](./10-SEQ-01_AppLaunch_AppValidation.md)).
* `validate_hasm_folder_path(path: String) -> Result<(), AppValidationError>`: Validates folder path existence on disk ([SEQ-01](./10-SEQ-01_AppLaunch_AppValidation.md)).
* `reboot_app(retain_path: Option<String>) -> Result<(), AppLaunchError>`: Spawns a new app instance carrying `--path {retain_path}` argument and terminates current process ([SEQ-06](./15-SEQ-06_Error_Fallback.md)).
* `exit_app() -> Result<(), AppLaunchError>`: Terminates current desktop process cleanly ([SEQ-06](./15-SEQ-06_Error_Fallback.md)).

---

### Chapter 2.3: Model Commands (`src-tauri/src/commands/model_commands.rs`)

* `check_workspace_lock(path: String) -> Result<LockStatus, ModelLoadingError>`: Inspects `.hasm/lock`, checks OS process table for `holder_pid`, performs stale lock recovery if dead, and returns lock/read-only status ([SEQ-02](./11-SEQ-02_HASM_Model_Load.md)).
* `release_workspace_lock(path: String) -> Result<(), ModelLoadingError>`: Deletes `.hasm/lock` file for current workspace ([SEQ-02](./11-SEQ-02_HASM_Model_Load.md)).
* `load_hasm_model_db(app_handle: AppHandle, path: String) -> Result<HasmModel, ModelLoadingError>`: Opens `hasm.db`, queries entity records, builds in-memory `HasmModel`, and streams progress via `model-load-progress` ([SEQ-02](./11-SEQ-02_HASM_Model_Load.md)).
* `verify_hasm_storage(app_handle: AppHandle, model: HasmModel) -> Result<VerificationResult, ModelLoadingError>`: Executes `model.verify_storage()`, streams progress via `model-verify-progress`, sets `is_verified = true` on success, or rejects with missing entity details ([SEQ-02](./11-SEQ-02_HASM_Model_Load.md)).
* `switch_workspace_cleanly(current_model_path: String) -> Result<(), ModelLoadingError>`: Releases active workspace lock, flushes SQLite pools, and resets in-memory `HasmModel` to `None` before returning to `/select` ([SEQ-07](./16-SEQ-07_Others.md)).

---

### Chapter 2.4: Visualizer Commands (`src-tauri/src/commands/visualizer_commands.rs`)

* `compute_visualizer_layout(app_handle: AppHandle, filter: LayoutFilterRequest) -> Result<RenderPayload, VisualizerError>`: Spawns background worker thread (`tokio::task::spawn_blocking`), validates `is_verified == true`, calculates 3D coordinates based on `TimeScaleMode`, streams progress via `visualizer-layout-progress`, and returns render payload ([SEQ-03](./12-SEQ-03_Visualizer.md)).

---

### Chapter 2.5: Entity Commands (`src-tauri/src/commands/entity_commands.rs`)

* `load_entity_detail(entity_type: String, entity_id: Uuid) -> Result<EntityDetailPayload, EntityEditorError>`: Fetches entity metadata from Rust memory, computes dynamic timeout based on `main.md` file size, and runs `hasm_markdown.exe verify` ([SEQ-04](./13-SEQ-04_Entity_Editing.md)).
* `save_entity_metadata(entity_type: String, entity_id: Uuid, payload: SaveEntityMetadataRequest) -> Result<SaveResult, EntityEditorError>`: Instantiates domain entity, executes `entity.verify()`, persists to SQLite within a 5,000ms transaction timeout (`ROLLBACK` on error), and invalidates `is_verified = false` ([SEQ-04](./13-SEQ-04_Entity_Editing.md)).
* `check_entity_mtime(entity_type: String, entity_id: Uuid, last_loaded_mtime_ms: u64) -> Result<CheckMtimePayload, EntityEditorError>`: Fast file metadata inspection (<10ms) returning `is_modified` and `is_deleted` booleans ([SEQ-04](./13-SEQ-04_Entity_Editing.md)).
* `reload_entity_markdown(entity_type: String, entity_id: Uuid) -> Result<ReloadMarkdownPayload, EntityEditorError>`: Re-verifies syntax with `hasm_markdown.exe` using dynamic timeouts and reloads raw markdown body ([SEQ-04](./13-SEQ-04_Entity_Editing.md)).
* `launch_external_markdown_app(entity_type: String, entity_id: Uuid) -> Result<LaunchExternalAppPayload, ExternalEditorError>`: Verifies directory and binary existence, then spawns detached `hasm_markdown.exe` child process ([SEQ-05](./14-SEQ-05_Edit_on_HASM_Markdown.md)).
* `repair_missing_entity_folders(workspace_path: String, missing_entities: Vec<(EntityType, Uuid)>) -> Result<RepairResult, ModelLoadingError>`: Re-creates missing UUID directories, writes default `main.md` templates, and creates `assets/` subdirectories ([SEQ-06](./15-SEQ-06_Error_Fallback.md)).

---

## Chapter 3: Rust Domain & Infrastructure Layer (`src-tauri/src/`)

### Chapter 3.1: Domain Models (`src-tauri/src/domain/models.rs`)

* `HasmModel::new(local_path: PathBuf) -> Self`: Constructor.
* `HasmModel::add_person(&mut self, person: Person)`: Appends Person entity.
* `HasmModel::add_experience(&mut self, experience: Experience)`: Appends Experience entity.
* `HasmModel::add_fact(&mut self, fact: Fact)`: Appends Fact entity.
* `HasmModel::add_link(&mut self, link: Link)`: Appends Link entity.
* `HasmModel::verify_storage(&self) -> VerificationResult`: Scans filesystem to confirm existence of `{UUID}/main.md` directories and identifies unreferenced folders.
* `HasmModel::verify_domain_rules(&self) -> Vec<(EntityType, Uuid, EntityValidationError)>`: Runs `.verify()` on all loaded domain instances.
* `HasmModel::set_verified(&mut self, status: bool)`: Updates internal `is_verified` flag.

---

### Chapter 3.2: Domain Validation (`src-tauri/src/domain/validation.rs`)

* `Verifiable::verify(&self) -> Result<(), EntityValidationError>`: Trait definition.
* `Person::verify(&self)`: Validates non-empty name and security level ($0 \le \text{level} \le 5$).
* `Experience::verify(&self)`: Validates non-empty name and security level.
* `Fact::verify(&self)`: Validates non-empty name, security level, and time constraint ($t_{\text{start}} \le t_{\text{end}}$).
* `Link::verify(&self)`: Validates non-empty link type, security level, and self-loop prohibition (`source_id != target_id`).

---

### Chapter 3.3: Error Definitions (`src-tauri/src/domain/errors.rs`)

* `EntityValidationError`: Enum representing domain rule violations (`EmptyName`, `TimeInversion`, `SelfLoopLink`, `InvalidSecurityLevel`).
* `AppValidationError`, `ModelLoadingError`, `VisualizerError`, `EntityEditorError`, `ExternalEditorError`: IPC error response structures with JSON serialization support.

---

### Chapter 3.4: Database Repository (`src-tauri/src/repository/sqlite_repo.rs`)

* `SqliteRepository::open_db(path: &Path) -> Result<SqlitePool, DbError>`: Establishes SQLite pool and runs schema integrity checks.
* `SqliteRepository::load_all_records(pool: &SqlitePool) -> Result<RawDbRecords, DbError>`: Fetches records from `PERSON`, `EXPERIENCE`, `FACT`, `LINK`, and junction tables (`EXPERIENCE_TREE`, `FACT_EXPERIENCE`, `LINK_RELATION`).
* `SqliteRepository::save_entity_metadata_transaction(pool: &SqlitePool, entity_type: &str, entity_id: Uuid, payload: &SaveEntityMetadataRequest) -> Result<(), DbError>`: Executes explicit `BEGIN`, UPDATE query, and `COMMIT` within a 5,000ms timeout with `ROLLBACK` fallback.

---

### Chapter 3.5: Storage Service (`src-tauri/src/repository/storage_service.rs`)

* `FileStorageService::get_mtime(path: &Path) -> Result<u64, FsError>`: Returns UNIX epoch timestamp in milliseconds.
* `FileStorageService::check_directory_exists(path: &Path) -> bool`: Directory verification.
* `FileStorageService::create_entity_folder_structure(base_path: &Path, entity_type: EntityType, id: Uuid) -> Result<(), FsError>`: Creates `{UUID}/` folder, default `main.md`, and `assets/` subdirectory.

---

### Chapter 3.6: Markdown Process Runner (`src-tauri/src/services/markdown_runner.rs`)

* `MarkdownSubmoduleRunner::calculate_dynamic_timeout(file_size_kb: u64) -> u64`: Calculates $\min(3000 + \lfloor \text{SizeKB} / 100 \rfloor \times 1000, 15000)\text{ ms}$.
* `MarkdownSubmoduleRunner::verify_markdown_syntax(target_dir: &Path, timeout_ms: u64) -> Result<String, MarkdownError>`: Spawns `hasm_markdown.exe verify` child process with hard timeout and captures stdout/stderr.
* `MarkdownSubmoduleRunner::spawn_external_app(target_dir: &Path) -> Result<u32, ExternalEditorError>`: Spawns detached `hasm_markdown.exe` process ([SEQ-05](./14-SEQ-05_Edit_on_HASM_Markdown.md)).

---

### Chapter 3.7: Visualizer Layout Engine (`src-tauri/src/services/layout_engine.rs`)

* `VisualizerLayoutEngine::compute_3d_coordinates(model: &HasmModel, filter: &LayoutFilterRequest, progress_callback: impl Fn(usize, usize, f32, &str)) -> RenderPayload`:
  * `filter_entities()`: Filters entities by time range and security level.
  * `calculate_branch_xy_positions()`: Positions `EXPERIENCE` parallel lines on XY plane.
  * `calculate_fact_z_positions()`: Calculates Z-coordinates based on `Linear`, `Logarithmic`, or `SequentialIndex` formulas.
  * `generate_relationship_splines()`: Generates 3D connecting splines for `LINK` entities.

---

## Chapter 4: React Layer & Route Protection (`src/`)

### Chapter 4.1: Route Protection Guard - Barrier 1 (`src/routes/ProtectedRoute.jsx`)

* **`ProtectedRoute.jsx` (First Line of Defense / Route Guard Wrapper)**
  * **Role & Responsibility:** Wraps protected application pages (`/visualizer`, `/entity-detail/...`) inside `src/routes/index.jsx`. Intercepts direct URL navigation attempts, DevTools route manipulations, or improper state transitions prior to mounting page components or firing IPC calls to Rust ([SEQ-07](./16-SEQ-07_Others.md)).
  * `ProtectedRoute({ children, requireVerified = true })`:
    1. **Unloaded Model Interception:** Checks `activeModelPath` and `isModelLoaded` from `useWorkspaceStore`. If no HASM workspace is selected or loaded, it immediately redirects to `/select` using `<Navigate replace to="/select"/>` and passes `redirectReason` / `redirectType` in `location.state`.
    2. **Unverified Model Interception:** If `requireVerified === true` and `isVerified === false`, it redirects to `/loading-model` passing `{ returnTo: location.pathname, redirectReason, redirectType }` in router state to trigger re-verification ([SEQ-02](./11-SEQ-02_HASM_Model_Load.md)).
    3. **Authorized Render:** Renders `children` page component only when all prerequisite workspace states are satisfied.

---

### Chapter 4.2: Route Configuration (`src/routes/index.jsx`)

* **`index.jsx`**
  * Defines declarative React Router mappings. Wraps operational views (`VisualizerPage`, `EntityDetailPage`) with `<ProtectedRoute>`, ensuring unauthenticated/unloaded requests are bounced back to `/select`. Catch-all fallback (`path="*"`) redirects unknown routes directly to `/select` passing a notification message ([SEQ-07](./16-SEQ-07_Others.md)).

---

### Chapter 4.3: IPC Bridge & Mappers (`src/services/`)

* **`src/services/ipcBridge.js`**
  * `validateHasmApp()`: Invokes `validate_hasm_app`.
  * `validateAppVersion()`: Invokes `validate_app_version`.
  * `validateHasmFolderPath(path)`: Invokes `validate_hasm_folder_path`.
  * `checkWorkspaceLock(path)`: Invokes `check_workspace_lock`.
  * `releaseWorkspaceLock(path)`: Invokes `release_workspace_lock`.
  * `loadHasmModelDb(path)`: Invokes `load_hasm_model_db`.
  * `verifyHasmStorage(model)`: Invokes `verify_hasm_storage`.
  * `switchWorkspaceCleanly(currentModelPath)`: Invokes `switch_workspace_cleanly` ([SEQ-07](./16-SEQ-07_Others.md)).
  * `computeVisualizerLayout(filter)`: Invokes `compute_visualizer_layout`.
  * `loadEntityDetail(entityType, entityId)`: Invokes `load_entity_detail`.
  * `saveEntityMetadata(entityType, entityId, payload)`: Invokes `save_entity_metadata`.
  * `checkEntityMtime(entityType, entityId, lastMtimeMs)`: Invokes `check_entity_mtime`.
  * `reloadEntityMarkdown(entityType, entityId)`: Invokes `reload_entity_markdown`.
  * `launchExternalMarkdownApp(entityType, entityId)`: Invokes `launch_external_markdown_app`.
  * `repairMissingEntityFolders(workspacePath, missingEntities)`: Invokes `repair_missing_entity_folders`.
  * `rebootApp(retainPath)`: Invokes `reboot_app`.
  * `exitApp()`: Invokes `exit_app`.
* **`src/services/errorMapper.js`**
  * `mapBackendErrorToUserMessage(errorCode, rawMessage)`: Converts backend error codes (`ERR_TIME_INVERSION`, `ERR_MARKDOWN_TIMEOUT`, etc.) into localized UI messages.

---

### Chapter 4.4: Custom React Hooks (`src/hooks/`)

* **`useTauriInvoke.js`**
  * `useTauriInvoke(commandName, hardTimeoutMs)`: Custom hook encapsulating IPC execution with frontend timeout protection.
* **`useTauriListen.js`**
  * `useTauriListen(eventName, onEvent, watchdogThresholdMs, onTimeout)`: Listens to Tauri `emit` streams (`model-load-progress`, `model-verify-progress`, `visualizer-layout-progress`), updates progress UI, and triggers Watchdog timeouts if streaming stalls.
* **`useWindowFocus.js`**
  * `useWindowFocus(onFocusCallback)`: Attaches window `focus` event listener to run non-blocking `check_entity_mtime` checks ([SEQ-04](./13-SEQ-04_Entity_Editing.md) Ch. 5).
* **`useWindowCloseListener.js`**
  * `useWindowCloseListener(activeModelPath, isReadOnly)`: Intercepts `tauri://close-requested` and invokes `releaseWorkspaceLock` before window termination ([SEQ-02](./11-SEQ-02_HASM_Model_Load.md) Ch. 2).
* **`useThreeCanvas.js`**
  * `useThreeCanvas(containerRef, renderPayload, onNodeClick, onNodeHover, selectedPalette)`: Instantiates Three.js WebGLRenderer, PerspectiveCamera, Scene, OrbitControls, lighting, mesh geometries, raycasting, and dynamic material color updates ([SEQ-07](./16-SEQ-07_Others.md)).

---

### Chapter 4.5: State Stores (`src/store/`)

* **`useWorkspaceStore.js`**
  * State container managing `activeModelPath`, `isModelLoaded`, `isVerified` (synced with Rust backend), and `isReadOnly`.
* **`useThemeStore.js`**
  * State container managing active color palette (`primary`, `secondary`, `accent`) and applying root CSS variables ([SEQ-07](./16-SEQ-07_Others.md)).
* **`useAppConfigStore.js`**
  * State container managing `appConfig` (`version`, `hasmMarkdownBinPath`, etc.).

---

## Chapter 5: React Pages & UI Components (`src/pages/`, `src/components/`)

### Chapter 5.1: Router Pages (`src/pages/`)

* **`AppBootGatePage.jsx` (`/`)**
  * Runs `validateHasmApp()` and `validateAppVersion()`.
  * Directs flow to `/select` if no CLI path provided, or `/loading-model` if valid path present ([SEQ-01](./10-SEQ-01_AppLaunch_AppValidation.md)).
  * Navigates to `/error-app` on boot failure ([SEQ-06](./15-SEQ-06_Error_Fallback.md)).
* **`SelectModelPage.jsx` (`/select`)**
  * Form input & native folder picker for selecting workspace directory.
  * Runs debounced `validateHasmFolderPath(inputPath)`.
  * Displays Toast popup if navigated via `location.state.redirectReason` and clears state ([SEQ-07](./16-SEQ-07_Others.md)).
  * Submits path to navigate to `/loading-model` ([SEQ-01](./10-SEQ-01_AppLaunch_AppValidation.md)).
* **`LoadingModelPage.jsx` (`/loading-model`)**
  * Displays Info Toast popup if navigated via `location.state.redirectReason` and clears state ([SEQ-07](./16-SEQ-07_Others.md)).
  * Executes `checkWorkspaceLock(path)`. Renders toast on stale lock auto-recovery.
  * Executes `loadHasmModelDb(path)` monitored by 10,000ms Watchdog Timer.
  * Executes `verifyHasmStorage(model)` monitored by 10,000ms Watchdog Timer.
  * Navigates to `/visualizer` on completion, or `/error-model` on failure ([SEQ-02](./11-SEQ-02_HASM_Model_Load.md)).
* **`VisualizerPage.jsx` (`/visualizer`)**
  * Wrapped in `<ProtectedRoute requireVerified={true}>`.
  * Calls `computeVisualizerLayout(filter)` using `useTauriListen` for progress overlay.
  * Renders Three.js canvas via `useThreeCanvas`.
  * Provides filter controls (`Linear`, `Logarithmic`, `SequentialIndex`) and handles node click navigation ([SEQ-03](./12-SEQ-03_Visualizer.md)).
* **`EntityDetailPage.jsx` (`/entity-detail/:entity_type/:entity_id`)**
  * Wrapped in `<ProtectedRoute requireVerified={true}>`.
  * Loads ticket metadata and markdown via `loadEntityDetail`.
  * Handles metadata field changes, "Save" (`saveEntityMetadata`), and "Cancel" modals ([SEQ-04](./13-SEQ-04_Entity_Editing.md)).
  * Invokes `launchExternalMarkdownApp` on "Edit Markdown in HASM App" click ([SEQ-05](./14-SEQ-05_Edit_on_HASM_Markdown.md)).
  * Uses `useWindowFocus` to highlight "Refresh Markdown" button in Amber (modified) or Red (deleted) ([SEQ-04](./13-SEQ-04_Entity_Editing.md) Ch. 5).
  * Handles manual refresh via `reloadEntityMarkdown`.
* **`ErrorAppPage.jsx` (`/error-app`)**
  * Displays system error context.
  * Provides "Retry Validation", "Reboot Application" (`rebootApp` with path retention), and "Exit Application" (`exitApp`) buttons ([SEQ-06](./15-SEQ-06_Error_Fallback.md)).
* **`ErrorModelPage.jsx` (`/error-model`)**
  * Displays workspace error context and formatted list of appended error reasons (`missing_entities`, `domain_validation_errors`).
  * Provides "Create Missing Folders" button calling `repairMissingEntityFolders`, "Retry Loading Model", and "Select Another Model" buttons ([SEQ-06](./15-SEQ-06_Error_Fallback.md)).
* **`ErrorMarkdownPage.jsx` (`/error-markdown`)**
  * Displays markdown syntax error context and parser `stderr` output.
  * Provides "Fix in HASM Markdown App" (`launchExternalMarkdownApp`), "Retry Validation" (`reloadEntityMarkdown`), and "Back to Visualizer" buttons ([SEQ-06](./15-SEQ-06_Error_Fallback.md)).

---

### Chapter 5.2: UI Components (`src/components/`)

* **`common/GlobalNavbar.jsx`**: Persistent top navigation bar displaying active HASM path, lock badge, theme selector dropdown, and "Switch Model" button calling `switchWorkspaceCleanly` ([SEQ-07](./16-SEQ-07_Others.md)).
* **`common/Toast.jsx`**: Renders temporary notifications (Info, Success, Amber Warning, Red Error).
* **`common/Modal.jsx`**: Modal dialog for edit cancellations, workspace switching confirmations, or repair confirmations.
* **`common/ProgressBar.jsx`**: Animated progress bar driven by `ProgressPayload`.
* **`visualizer/ThreeCanvas.jsx`**: WebGL canvas container element for Three.js viewport.
* **`visualizer/Tooltip.jsx`**: Floating 2D tooltip component displaying entity metadata on mesh hover.
* **`visualizer/ControlPanel.jsx`**: Filter control panel for `TimeScaleMode`, security level, and time sliders.
* **`entity/TicketForm.jsx`**: Form component for ticket metadata editing (name, dates, description, security level).
* **`entity/RefreshButton.jsx`**: Dynamic refresh button component supporting normal, Amber pulsing, and Red danger visual states.

---

## Chapter 6: Test Script Architecture

### Chapter 6.1: Desktop Integration Tests (`tests/e2e/`)

* **`01_app_launch.spec.js`**: Validates `SEQ-01` boot checks and path selection flows.
* **`02_model_loading.spec.js`**: Validates `SEQ-02` lock creation, stale lock auto-recovery, window close lock release, and DB load progress streaming.
* **`03_visualizer.spec.js`**: Validates `SEQ-03` state guards, 3D timeline rendering across `TimeScaleMode` options, raycasting tooltips, and node clicks.
* **`04_entity_editing.spec.js`**: Validates `SEQ-04` ticket loading, domain validations, SQLite 5,000ms transactions, and window focus `mtime` detection.
* **`05_external_app.spec.js`**: Validates `SEQ-05` detached child process spawning of `hasm_markdown.exe` with 5,000ms spawn timeouts.
* **`06_error_recovery.spec.js`**: Validates `SEQ-06` path-retaining reboots and `repair_missing_entity_folders` directory auto-repairs.
* **`07_global_navigation.spec.js`**: Validates `SEQ-07` clean workspace switching via `switch_workspace_cleanly`, theme color changes, and status navbar updates.

---

### Chapter 6.2: React Unit Tests (`src/**/__tests__/`)

* **`src/routes/__tests__/ProtectedRoute.test.jsx`**: Validates route guard behavior (Barrier 1). Tests that accessing protected routes directly without an active model redirects to `/select` carrying redirection reasons, and accessing while unverified redirects to `/loading-model`.
* **`src/pages/__tests__/LoadingModelPage.test.jsx`**: Tests progress event handling, Watchdog timeouts, and stale lock toast displays.
* **`src/pages/__tests__/VisualizerPage.test.jsx`**: Tests filter mode changes, layout progress overlays, and fallback timeouts.
* **`src/pages/__tests__/EntityDetailPage.test.jsx`**: Tests form dirty checking, unsaved changes modals, and Amber/Red refresh button visual transitions.
* **`src/pages/__tests__/ErrorPages.test.jsx`**: Tests error context rendering, appended cause list formatting, and repair button state triggers.

---

### Chapter 6.3: Rust Cargo Integration Tests (`src-tauri/tests/`)

* **`src-tauri/tests/app_command_tests.rs`**: Tests `reboot_app` `--path` CLI argument passing and app validation commands.
* **`src-tauri/tests/model_command_tests.rs`**: Tests `check_workspace_lock`, dead PID detection, stale lock cleanup, `release_workspace_lock`, and `switch_workspace_cleanly`.
* **`src-tauri/tests/visualizer_tests.rs`**: Tests background worker thread execution, chunked progress event emissions, and Z-axis coordinate math.
* **`src-tauri/tests/entity_tests.rs`**: Tests `entity.verify()` domain invariants, SQLite transaction rollbacks, and `repair_missing_entity_folders` directory creations.