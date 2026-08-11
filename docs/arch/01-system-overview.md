# System Overview with Screen Flow & React Architecture

This document explains the screen flow design, sequence mapping, React routing, and state architecture across the application lifecycle.

## 1. System Overview Flowchart

```mermaid
%%{
  init: {
    'theme': 'base',
    'themeVariables': {
      'fontFamily': 'inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'fontSize': '14px',
      'primaryColor': '#1e293b',
      'primaryTextColor': '#f8fafc',
      'primaryBorderColor': '#475569',
      'lineColor': '#64748b',
      'secondaryColor': '#334155',
      'tertiaryColor': '#0f172a',
      'clusterBkg': '#0f172a',
      'clusterBorder': '#334155',
      'edgeLabelBackground': '#1e293b'
    }
  }
}%%
flowchart TB
    %% Node Style Definitions
    classDef page fill:#1e40af,stroke:#60a5fa,stroke-width:1.5px,color:#ffffff;
    classDef error fill:#991b1b,stroke:#f87171,stroke-width:1.5px,color:#ffffff;
    classDef action fill:#065f46,stroke:#34d399,stroke-width:1.5px,color:#ffffff;
    classDef tauri fill:#581c87,stroke:#c084fc,stroke-width:1.5px,color:#ffffff;
    classDef cond fill:#854d0e,stroke:#facc15,stroke-width:1.5px,color:#ffffff;

    %% ----------------------------------------------------
    %% 0. Legend
    %% ----------------------------------------------------
    subgraph Legend["Legend"]
        direction LR
        L_Page["Rectangle: Page"]:::page
        L_Action(["Rounded: Action"]):::action
        L_Tauri[["Double Border: Tauri Invoke"]]:::tauri
        L_Cond{"Rhombus: Condition"}:::cond
        L_Error[/"Parallelogram: Error"/]:::error
    end

    %% ----------------------------------------------------
    %% 1. App Boot & Model Loading (SEQ-01 & SEQ-02)
    %% ----------------------------------------------------
    subgraph BootPhase["1. App Boot & Model Loading"]
        BootAction(["Boot HASM App"]):::action --> ValidateHASMApp[["Tauri: validate_hasm_app"]]:::tauri
        ValidateHASMApp --> AppCheck{"HASM App OK?"}:::cond
        
        AppCheck -->|NG| ErrorHASMApp[/"HASM App Error Page (/error-app)"/]:::error
        AppCheck -->|OK| DataSelectIF{"Model Selected?"}:::cond
        
        DataSelectIF -->|No| SelectPage["Select Model Page (/select)"]:::page
        SelectPage --> SelectModelAction(["Select Model Workspace"]):::action
        SelectModelAction --> LoadingHASMModelPage["Loading Model Page (/loading-model)"]:::page
        
        DataSelectIF -->|Yes| LoadingHASMModelPage
        
        LoadingHASMModelPage --> ValidateHASMModel[["Tauri: verify_hasm_storage & load_hasm_model_db"]]:::tauri
        ValidateHASMModel --> ModelCheck{"Model & DB OK?"}:::cond
        
        ModelCheck -->|NG| ErrorHASMModel[/"HASM Model Error Page (/error-model)"/]:::error
        ModelCheck -->|OK| VisualizePage["3D Visualizer Page (/visualizer)"]:::page
    end

    %% ----------------------------------------------------
    %% 2. Entity Selection & Markdown Loading (SEQ-03 & SEQ-04)
    %% ----------------------------------------------------
    subgraph RoutingPhase["2. Markdown Loading & Validation"]
        VisualizePage --> ClickEntity(["Click PERSON / EXP / FACT / LINK"]):::action
        ClickEntity --> LoadEntityDetail[["Tauri: load_entity_detail & verify markdown"]]:::tauri
        
        LoadEntityDetail --> MarkdownCheck{"Markdown & Model OK?"}:::cond
        MarkdownCheck -->|NG Syntax/Missing| ErrorHASMMarkdown[/"HASM Markdown Error Page (/error-markdown)"/]:::error
        MarkdownCheck -->|NG Model Corrupt| ErrorHASMModel
    end

    %% ----------------------------------------------------
    %% 3. Entity Detail Pages (SEQ-04)
    %% ----------------------------------------------------
    subgraph DetailPages["3. Entity Detail Pages"]
        
        subgraph PersonDetail["3.1. PERSON Detail (/entity-detail/PERSON/:id)"]
            PD["PERSON Ticket View"]:::page
        end

        subgraph ExpDetail["3.2. EXPERIENCE Detail (/entity-detail/EXPERIENCE/:id)"]
            ED["EXPERIENCE Ticket View"]:::page
        end

        subgraph FactDetail["3.3. FACT Detail (/entity-detail/FACT/:id)"]
            FD["FACT Ticket View"]:::page
        end

        subgraph LinkDetail["3.4. LINK Detail (/entity-detail/LINK/:id)"]
            LD["LINK Ticket View"]:::page
        end

        MarkdownCheck -->|OK PERSON| PD
        MarkdownCheck -->|OK EXPERIENCE| ED
        MarkdownCheck -->|OK FACT| FD
        MarkdownCheck -->|OK LINK| LD

        %% MetaData Save Action (DB Only)
        SaveMetaAction(["Edit & Save MetaData"]):::action --> SaveMetadata[["Tauri: save_entity_metadata (hasm.db)"]]:::tauri
        SaveMetadata -->|Set is_verified = false| PD
        SaveMetadata -->|Set is_verified = false| ED
        SaveMetadata -->|Set is_verified = false| FD
        SaveMetadata -->|Set is_verified = false| LD
    end

    %% ----------------------------------------------------
    %% 4. Common Actions (SEQ-04 Ch.5 & SEQ-05)
    %% ----------------------------------------------------
    subgraph CommonActions["4. Common Actions"]
        LaunchHasmApp(["Edit Markdown in HASM App"]):::action --> LaunchAppCmd[["Tauri: launch_external_markdown_app"]]:::tauri
        LaunchAppCmd -->|Fire-and-Forget Spawn| ExternalAppWindow["hasm_markdown.exe App Window"]:::page

        WindowFocus(["Window Focus Event"]):::action --> CheckMtime[["Tauri: check_entity_mtime"]]:::tauri
        CheckMtime -->|is_modified / is_deleted| HighlightRefresh(["Highlight Refresh Button Style"]):::action
        
        HighlightRefresh --> ClickRefresh(["Click Refresh Markdown"]):::action
        ClickRefresh --> ReloadMarkdown[["Tauri: reload_entity_markdown"]]:::tauri
        ReloadMarkdown -->|OK| PD
        ReloadMarkdown -->|OK| ED
        ReloadMarkdown -->|OK| FD
        ReloadMarkdown -->|OK| LD
        ReloadMarkdown -->|NG| ErrorHASMMarkdown

        BackToVisualize(["Click Back to Visualizer"]):::action --> VisualizePage
    end

    PD --> LaunchHasmApp
    ED --> LaunchHasmApp
    FD --> LaunchHasmApp
    LD --> LaunchHasmApp

    PD --> BackToVisualize
    ED --> BackToVisualize
    FD --> BackToVisualize
    LD --> BackToVisualize

```

---

## 2. React Routing Architecture (React Router v6)

The React application uses declarative routing mapped directly to the sequence diagrams and lifecycle phases.

| Route Path | Page Component | Sequence Ref | Purpose & Description |
| --- | --- | --- | --- |
| `/` | `AppBootGate.tsx` | `SEQ-01` | Initial entry gate. Triggers `validate_hasm_app` and redirects to `/select` or `/loading-model`. |
| `/select` | `SelectModelPage.tsx` | `SEQ-02` | Workspace selector interface when no active model is selected or when changing models. |
| `/loading-model` | `LoadingModelPage.tsx` | `SEQ-02` | Progress & verification view. Executes `verify_hasm_storage` & `load_hasm_model_db`. |
| `/visualizer` | `VisualizerPage.tsx` | `SEQ-03` | Three.js 3D graph view. Intercepted by Guards if `HasmModel` is missing or `is_verified == false`. |
| `/entity-detail/:entity_type/:entity_id` | `EntityDetailPage.tsx` | `SEQ-04` | JIRA-style detail ticket view for PERSON, EXPERIENCE, FACT, and LINK entities. |
| `/error-app` | `ErrorAppPage.tsx` | `SEQ-06` | Fallback screen for binary/OS dependency initialization errors. |
| `/error-model` | `ErrorModelPage.tsx` | `SEQ-06` | Fallback screen for `hasm.db` corruption or workspace directory read errors. |
| `/error-markdown` | `ErrorMarkdownPage.tsx` | `SEQ-06` | Fallback screen for `main.md` syntax errors, timeouts, or file missing exceptions. |

---

## 3. React State Architecture

To maintain performance, non-blocking UI interactions, and single-source-of-truth across IPC calls, React state is divided into **Global Application State** (Context/Zustand) and **Local Component State**.

### 3.1 Global State (Workspace & Navigation Scope)

```typescript
interface GlobalHasmState {
  // Active Workspace Model Info
  activeModelPath: string | null;
  isModelLoaded: boolean;
  isVerified: boolean; // Corresponds to Rust In-Memory HasmModel.is_verified

  // System Configuration (SEQ-01)
  appConfig: {
    hasmMarkdownBinPath: string;
    version: string;
  } | null;

  // Actions
  setActiveModelPath: (path: string) => void;
  invalidateVerification: () => void; // Sets isVerified = false
}

```

### 3.2 Local Form & Ticket State (`EntityDetailPage.tsx`)

```typescript
interface EntityDetailLocalState {
  // Entity Data
  metadata: EntityMeta | null;
  markdownBody: string;
  lastLoadedMtimeMs: number; // Used for window focus mtime comparison

  // Operation Loading Flags (Isolated UI Lock)
  isEntityLoading: boolean;     // Initial detail page load
  isEntitySaving: boolean;      // Save metadata to SQLite
  isMarkdownVerifying: boolean; // Reload/Refresh markdown verification

  // Form State Checking
  isDirty: boolean;             // True if user edited ticket input fields
  
  // External Modification Alerts (SEQ-04 Chapter 5)
  hasExternalChanges: boolean;  // True if mtime > lastLoadedMtimeMs (Amber style)
  isMarkdownDeleted: boolean;   // True if main.md missing on disk (Red style)
}

```

---

## 4. Sequence Diagram Reference Index

Below is the complete index of architectural sequence specifications governing the React frontend, Tauri IPC, and Rust domain engine:

* [SEQ-01: App Launch & App Validation](./10-SEQ-01_AppLaunch_AppValidation.md)
* **Location:** `1. BootPhase` | **Tauri:** `validate_hasm_app`
* **Summary:** Application initialization, runtime binary existence checks, and environment setup.


* [SEQ-02: Model Loading](./11-SEQ-02_HASM_Model_Load.md)
* **Location:** `1. BootPhase` | **Tauri:** `verify_hasm_storage`, `load_hasm_model_db`
* **Summary:** Workspace selection, directory structure validation, SQLite `hasm.db` loading, and model verification (`is_verified = true`).


* [SEQ-03: HASM 3D Visualizer & Graph Rendering](./12-SEQ-03_Visualizer.md)
* **Location:** `1. BootPhase` & `2. RoutingPhase` | **Tauri:** `compute_visualizer_layout`
* **Summary:** Rust-driven 3D layout calculation (`TimeScaleMode`), Three.js graph rendering, raycasting navigation, and state verification guards.


* [SEQ-04: Entity MetaData Editing & Saving](./13-SEQ-04_Entity_Editing.md)
* **Location:** `3. DetailPages` | **Tauri:** `load_entity_detail`, `save_entity_metadata`, `check_entity_mtime`, `reload_entity_markdown`
* **Summary:** Ticket view rendering, single-entity domain validation (`entity.verify()`), SQLite metadata persistence (5,000ms hard timeout with `ROLLBACK`), `is_verified = false` invalidation, non-blocking window focus `mtime`/deletion checks, and manual Markdown refresh.


* [SEQ-05: External Markdown App Invocation](./14-SEQ-05_Edit_on_HASM_Markdown.md)
* **Location:** `4. CommonActions` | **Tauri:** `launch_external_markdown_app`
* **Summary:** Non-blocking, Fire-and-Forget process spawning of `hasm_markdown.exe` targeting the entity UUID directory without locking main app state.


* [SEQ-06: Error Fallback & Recovery Flow](./15-SEQ-06_Error_Fallback.md)
* **Location:** Across all subgraphs | **Tauri:** Recovery re-verifications (`validate_hasm_app`, `reload_entity_markdown`, `exit_app`)
* **Summary:** Unified error screen handling (`/error-app`, `/error-model`, `/error-markdown`), user retry actions, repair triggers, and safe fallback routing.