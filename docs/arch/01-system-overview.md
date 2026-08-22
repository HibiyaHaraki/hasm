# System Overview with Screen Flow & React Architecture

This document explains the screen flow design, sequence mapping, React routing, state architecture, and complete CRUD / graph-binding lifecycle across the HASM Desktop Application (`hasm-desktop`).

---

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
    classDef modal fill:#334155,stroke:#94a3b8,stroke-width:1.5px,color:#ffffff;

    %% ----------------------------------------------------
    %% 0. Legend
    %% ----------------------------------------------------
    subgraph Legend["Legend"]
        direction LR
        L_Page["Rectangle: Page"]:::page
        L_Modal["Dark Rectangle: Modal"]:::modal
        L_Action(["Rounded: Action"]):::action
        L_Tauri[["Double Border: Tauri Invoke"]]:::tauri
        L_Cond{"Rhombus: Condition"}:::cond
        L_Error[/"Parallelogram: Error"/]:::error
    end

    %% ----------------------------------------------------
    %% 1. App Boot, Model Loading & Workspace Scaffolding (SEQ-01, SEQ-02, SEQ-08)
    %% ----------------------------------------------------
    subgraph BootPhase["1. App Boot, Workspace Selection & Scaffolding"]
        BootAction(["Boot HASM App"]):::action --> ValidateHASMApp[["Tauri: validate_hasm_markdown_app"]]:::tauri
        ValidateHASMApp --> AppCheck{"HASM App OK?"}:::cond
        
        AppCheck -->|NG| ErrorHASMApp[/"HASM App Error Page (/error-app)"/]:::error
        AppCheck -->|OK| DataSelectIF{"Model Selected via CLI?"}:::cond
        
        DataSelectIF -->|No| SelectPage["Select Model Page (/select)"]:::page
        SelectPage --> SelectMode{"Select Mode"}:::cond
        
        SelectMode -->|Open Existing| OpenModelAction(["Browse Folder / Native Dialog"]):::action
        SelectMode -->|Create New HASM| CreateModelAction(["Click Create New HASM"]):::action
        
        CreateModelAction --> OSDialog["OS Native Save Directory Dialog"]:::modal
        OSDialog --> ScaffoldWorkspace[["Tauri: create_hasm_workspace (SEQ-08)"]]:::tauri
        ScaffoldWorkspace --> LoadingHASMModelPage
        
        OpenModelAction --> LoadingHASMModelPage["Loading Model Page (/loading-model)"]:::page
        DataSelectIF -->|Yes| LoadingHASMModelPage
        
        LoadingHASMModelPage --> ValidateHASMModel[["Tauri: verify_hasm_storage & load_hasm_model_db"]]:::tauri
        ValidateHASMModel --> ModelCheck{"Model & DB OK?"}:::cond
        
        ModelCheck -->|NG| ErrorHASMModel[/"HASM Model Error Page (/error-model)"/]:::error
        ModelCheck -->|OK| VisualizePage["3D Visualizer Page (/visualizer)"]:::page
    end

    %% ----------------------------------------------------
    %% 2. Entity Creation & Graph Binding (SEQ-08 & SEQ-03)
    %% ----------------------------------------------------
    subgraph CreationPhase["2. Interactive Entity & Link Creation"]
        VisualizePage --> ClickCreate(["Click Create PERSON / EXP / FACT / LINK"]):::action
        ClickCreate --> CreateModal["Entity / Link Creation Modal"]:::modal
        
        CreateModal --> SubmitCreate(["Submit Form"]):::action
        SubmitCreate --> ExecCreate[["Tauri: create_person / experience / fact / link (SEQ-08)"]]:::tauri
        
        ExecCreate --> CreateCheck{"Validation & SQLite Transaction OK?"}:::cond
        CreateCheck -->|NG| CreateModal
        CreateCheck -->|OK| RelayoutGraph[["Tauri: compute_visualizer_layout (SEQ-03)"]]:::tauri
        RelayoutGraph --> VisualizePage
    end

    %% ----------------------------------------------------
    %% 3. Entity Selection & Markdown Loading (SEQ-03 & SEQ-04)
    %% ----------------------------------------------------
    subgraph RoutingPhase["3. Markdown Loading & Detail Ticket Navigation"]
        VisualizePage --> ClickEntity(["Click Node / Mesh in 3D Canvas"]):::action
        ClickEntity --> LoadEntityDetail[["Tauri: load_entity_detail & verify markdown"]]:::tauri
        
        LoadEntityDetail --> MarkdownCheck{"Markdown & Model OK?"}:::cond
        MarkdownCheck -->|NG Syntax/Missing| ErrorHASMMarkdown[/"HASM Markdown Error Page (/error-markdown)"/]:::error
        MarkdownCheck -->|NG Model Corrupt| ErrorHASMModel
    end

    %% ----------------------------------------------------
    %% 4. Entity Detail Pages & Metadata Editing (SEQ-04)
    %% ----------------------------------------------------
    subgraph DetailPages["4. Entity Detail Pages"]
        
        subgraph PersonDetail["4.1. PERSON Detail (/entity-detail/PERSON/:id)"]
            PD["PERSON Ticket View"]:::page
        end

        subgraph ExpDetail["4.2. EXPERIENCE Detail (/entity-detail/EXPERIENCE/:id)"]
            ED["EXPERIENCE Ticket View"]:::page
        end

        subgraph FactDetail["4.3. FACT Detail (/entity-detail/FACT/:id)"]
            FD["FACT Ticket View"]:::page
        end

        subgraph LinkDetail["4.4. LINK Detail (/entity-detail/LINK/:id)"]
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
    %% 5. Common Actions (SEQ-04 Ch.5 & SEQ-05)
    %% ----------------------------------------------------
    subgraph CommonActions["5. Common Actions"]
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

The React application uses declarative routing mapped directly to sequence specifications and lifecycle phases.

| Route Path | Page Component / Modal | Sequence Ref | Purpose & Description |
| --- | --- | --- | --- |
| `/` | `AppBootGate.tsx` | `SEQ-01` | Initial entry gate. Triggers `validate_hasm_app` and redirects to `/select` or `/loading-model`. |
| `/select` | `SelectModelPage.tsx` | `SEQ-01`, `SEQ-08` | Workspace selector interface. Supports opening existing HASM models or scaffolding new workspaces via native OS Save Dialog. |
| `/loading-model` | `LoadingModelPage.tsx` | `SEQ-02` | Progress & verification view. Executes `verify_hasm_storage` & `load_hasm_model_db`. |
| `/visualizer` | `VisualizerPage.tsx` | `SEQ-03`, `SEQ-08` | Three.js 3D graph view. Includes Creation Toolbar (`Create PERSON`, `EXPERIENCE`, `FACT`, `LINK`) and handles graph re-layout. |
| `/entity-detail/:entity_type/:entity_id` | `EntityDetailPage.tsx` | `SEQ-04` | JIRA-style detail ticket view for PERSON, EXPERIENCE, FACT, and LINK entities. |
| `/error-app` | `ErrorAppPage.tsx` | `SEQ-06` | Fallback screen for binary/OS dependency initialization errors. |
| `/error-model` | `ErrorModelPage.tsx` | `SEQ-06` | Fallback screen for `hasm.db` corruption or workspace directory read errors. |
| `/error-markdown` | `ErrorMarkdownPage.tsx` | `SEQ-06` | Fallback screen for `main.md` syntax errors, timeouts, or file missing exceptions. |

---

## 3. Sequence Diagram Reference Index

Below is the complete index of architectural sequence specifications governing the React frontend, Tauri IPC, and Rust domain engine:

* [SEQ-01: App Launch & App Validation](https://www.google.com/search?q=./10-SEQ-01_AppLaunch_AppValidation.md)
* **Tauri:** `validate_hasm_markdown_app`, `validate_app_version`, `validate_hasm_folder_path`
* **Summary:** App launch, binary checks, CLI path resolution, and native OS folder/save dialog integration.


* [SEQ-02: Model Loading](https://www.google.com/search?q=./11-SEQ-02_HASM_Model_Load.md)
* **Tauri:** `check_workspace_lock`, `release_workspace_lock`, `verify_hasm_storage`, `load_hasm_model_db`
* **Summary:** Lock file verification, stale lock auto-recovery, `hasm.db` metadata loading, and storage verification.


* [SEQ-03: HASM 3D Visualizer & Dynamic Creation Controls](https://www.google.com/search?q=./12-SEQ-03_Visualizer.md)
* **Tauri:** `compute_visualizer_layout`
* **Summary:** 3D timeline layout computation (`TimeScaleMode`), Three.js graph rendering, creation toolbar triggers, and automatic 3D scene re-rendering.


* [SEQ-04: Entity MetaData Editing & Saving](https://www.google.com/search?q=./13-SEQ-04_Entity_Editing.md)
* **Tauri:** `load_entity_detail`, `save_entity_metadata`, `check_entity_mtime`, `reload_entity_markdown`
* **Summary:** Ticket view rendering, domain invariants (`entity.verify()`), SQLite metadata persistence, and window focus `mtime` detection.


* [SEQ-05: External Markdown App Invocation](https://www.google.com/search?q=./14-SEQ-05_Edit_on_HASM_Markdown.md)
* **Tauri:** `launch_external_markdown_app`
* **Summary:** Fire-and-Forget process spawning of `hasm_markdown.exe` targeting the entity UUID directory.


* [SEQ-06: Error Fallback & Recovery Flow](https://www.google.com/search?q=./15-SEQ-06_Error_Fallback.md)
* **Tauri:** Recovery re-verifications (`validate_hasm_app`, `reload_entity_markdown`, `repair_missing_entity_folders`)
* **Summary:** Unified error screens (`/error-app`, `/error-model`, `/error-markdown`), auto-repair folder creation, and recovery navigation.


* [SEQ-07: Global Navigation & Environment Management](https://www.google.com/search?q=./16-SEQ-07_Others.md)
* **Tauri:** `switch_workspace_cleanly`
* **Summary:** Global Navbar, clean workspace switching, 3-color palette customization, and route protection (Barrier 1).


* **[SEQ-08: Entity Creation & Link Graph Binding Sequence](https://www.google.com/search?q=./17-SEQ-08_Entity_Creation.md)**
* **Tauri:** `create_hasm_workspace`, `create_person`, `create_experience`, `create_fact`, `create_link`
* **Summary:** New workspace directory scaffolding, entity creation with UUID auto-generation, domain invariant checks (`entity.verify()`), atomic SQLite transactions, template `main.md` creation, and 3D graph binding.