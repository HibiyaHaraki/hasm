# System Overview with Screen Flow

This document explains the screen flow design.

## Overview

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
        L_Page[Rectangle: Page]:::page
        L_Action([Rounded: Action]):::action
        L_Tauri[[Double Border: Tauri Invoke]]:::tauri
        L_Cond{Rhombus: Condition}:::cond
        L_Error[/Parallelogram: Error/]:::error
    end

    %% ----------------------------------------------------
    %% 1. App Boot & Model Loading
    %% ----------------------------------------------------
    subgraph BootPhase["1. App Boot & Model Loading"]
        BootAction([1. Boot HASM App]):::action --> ValidateHASMApp[[Tauri: Validate HASM App]]:::tauri
        ValidateHASMApp --> AppCheck{HASM App OK?}:::cond
        
        AppCheck -->|NG| ErrorHASMApp[/HASM App Error Page/]:::error
        AppCheck -->|OK| DataSelectIF{Model Selected?}:::cond
        
        DataSelectIF --> SelectPage[Select Page]:::page
        SelectPage --> SelectModelAction([2. Select HASM Model]):::action
        SelectModelAction --> LoadingHASMModelPage[Loading HASM Model Page]:::page
        
        DataSelectIF --> LoadingHASMModelPage
        
        LoadingHASMModelPage --> ValidateHASMModel[[Tauri: Validate HASM Model]]:::tauri
        ValidateHASMModel --> ModelCheck{HASM Model OK?}:::cond
        
        ModelCheck -->|NG| ErrorHASMModel[/HASM Model Error Page/]:::error
        ModelCheck -->|OK| VisualizePage[Visualize HASM Model Page]:::page
    end

    %% ----------------------------------------------------
    %% 2. Entity Selection & Markdown Loading
    %% ----------------------------------------------------
    subgraph RoutingPhase["2. Markdown Loading & Validation"]
        VisualizePage --> ClickPerson([Click PERSON]):::action
        VisualizePage --> ClickExperience([Click EXPERIENCE]):::action
        VisualizePage --> ClickFact([Click FACT]):::action
        VisualizePage --> ClickLink([Click LINK]):::action

        ClickPerson --> LoadingMarkdownPage[Loading HASM Markdown Page]:::page
        ClickExperience --> LoadingMarkdownPage
        ClickFact --> LoadingMarkdownPage
        ClickLink --> LoadingMarkdownPage

        LoadingMarkdownPage --> ValidateHASMMarkdown[[Tauri: Validate HASM Markdown]]:::tauri
        ValidateHASMMarkdown --> MarkdownCheck{Markdown OK?}:::cond
        
        MarkdownCheck -->|NG| ErrorHASMMarkdown[/HASM Markdown Error Page/]:::error
    end

    %% ----------------------------------------------------
    %% 3. Entity Detail Pages (Nested Subgraphs)
    %% ----------------------------------------------------
    subgraph DetailPages["3. Entity Detail Pages"]
        
        subgraph PersonDetail["3.1. PERSON Detail"]
            PD[PERSON Detail Page]:::page
            EditPersonMeta([Edit PERSON MetaData]):::action
            SavePersonMeta[[Tauri: Save PERSON MetaData]]:::tauri
            
            PD --> EditPersonMeta
            EditPersonMeta --> SavePersonMeta
            SavePersonMeta --> PD
        end

        subgraph ExpDetail["3.2. EXPERIENCE Detail"]
            ED[EXPERIENCE Detail Page]:::page
            EditExpMeta([Edit EXPERIENCE MetaData]):::action
            SaveExpMeta[[Tauri: Save EXPERIENCE MetaData]]:::tauri
            
            ED --> EditExpMeta
            EditExpMeta --> SaveExpMeta
            SaveExpMeta --> ED
        end

        subgraph FactDetail["3.3. FACT Detail"]
            FD[FACT Detail Page]:::page
            EditFactMeta([Edit FACT MetaData]):::action
            SaveFactMeta[[Tauri: Save FACT MetaData]]:::tauri
            
            FD --> EditFactMeta
            EditFactMeta --> SaveFactMeta
            SaveFactMeta --> FD
        end

        subgraph LinkDetail["3.4. LINK Detail"]
            LD[LINK Detail Page]:::page
            EditLinkMeta([Edit LINK MetaData]):::action
            SaveLinkMeta[[Tauri: Save LINK MetaData]]:::tauri
            
            LD --> EditLinkMeta
            EditLinkMeta --> SaveLinkMeta
            SaveLinkMeta --> LD
        end

        %% Direct connections from Markdown Check
        MarkdownCheck -->|OK PERSON| PD
        MarkdownCheck -->|OK EXPERIENCE| ED
        MarkdownCheck -->|OK FACT| FD
        MarkdownCheck -->|OK LINK| LD
    end

    %% ----------------------------------------------------
    %% 4. Common Actions
    %% ----------------------------------------------------
    subgraph CommonActions["4. Common Actions"]
        EditMarkdown([Start Editing HASM Markdown]):::action
        CallMarkdownApp[[Tauri: Call HASM Markdown App]]:::tauri
        BackToVisualize([Click Back to Visualize]):::action

        EditMarkdown --> CallMarkdownApp
    end

    %% Connect to Common Actions
    PD --> EditMarkdown
    ED --> EditMarkdown
    FD --> EditMarkdown
    LD --> EditMarkdown

    PD --> BackToVisualize
    ED --> BackToVisualize
    FD --> BackToVisualize
    LD --> BackToVisualize

    BackToVisualize --> VisualizePage

```

## Detail Architectures

Below is the list of sequence diagrams detailing the interactions between the React frontend, Tauri API, and Rust backend.

* [SEQ-01: App Launch & App Validation](./10-SEQ-01_AppLaunch_AppValidation.md)
* **Diagram Location:** `1. App Boot & Model Loading` (`BootPhase`)
* **Key Tauri Function:** `Tauri: Validate HASM App`
* **Description:** Covers initial application boot, system environment check, and version validation.


* [SEQ-02: Model Loading](./11-SEQ-02_HASM_Model_Load.md)
* **Diagram Location:** `1. App Boot & Model Loading` (`BootPhase`)
* **Key Tauri Function:** `Tauri: Validate HASM Model`
* **Description:** Details selecting a HASM model file from `Select Page`, validating data structure in Rust, and navigating to `Visualize Page`.


* [SEQ-03: HASM 3D Visualizer & Experience-Fact Graph Rendering](./12-SEQ-03_Visualizer.md)
* **Diagram Location:** `1. App Boot & Model Loading` (`BootPhase`) & `2. Markdown Loading & Validation` (`RoutingPhase`)
* **Key Tauri Function:** `Tauri: compute_visualizer_layout`
* **Description:** Details event-driven 3D layout calculation on Rust backend using `TimeScaleMode` (Linear/Logarithmic/SequentialIndex), state validation guards (`ERR_NO_ACTIVE_MODEL` -> `Select Page`, `ERR_MODEL_NOT_VERIFIED` -> `Loading HASM Model Page`), Three.js rendering, raycasting interactivity, and navigating to Entity Detail pages.


* [SEQ-04: Entity MetaData Editing & Saving](./13-SEQ-04_Entity_Editing.md)
* **Diagram Location:** `3. Entity Detail Pages` (`DetailPages` / `PersonDetail`, `ExpDetail`, `FactDetail`, `LinkDetail`)
* **Key Tauri Functions:** `Tauri: Save PERSON MetaData`, `Save EXPERIENCE MetaData`, `Save FACT MetaData`, `Save LINK MetaData`
* **Description:** Demonstrates how entity metadata is modified within React forms on each detail page and saved persistently via Tauri commands.


* [SEQ-05: External Markdown App Invocation & Refresh]()
* **Diagram Location:** `4. Common Actions` (`CommonActions`)
* **Key Tauri Function:** `Tauri: Call HASM Markdown App`
* **Description:** Triggers an external Markdown editor process from Rust and refreshes the React UI state upon closing the editor.


* [SEQ-06: Navigation Back to Visualize]()
* **Diagram Location:** `4. Common Actions` (`CommonActions`)
* **Key Tauri Function:** N/A (Frontend Router & State Management)
* **Description:** Handles returning to `Visualize Page` via `Click Back to Visualize` using cached model state without re-triggering unnecessary backend validation.


* [SEQ-07: Error Fallback & Recovery Flow]()
* **Diagram Location:** Across all subgraphs (`ErrorHASMApp`, `ErrorHASMModel`, `ErrorHASMMarkdown`)
* **Key Tauri Function:** Re-invoking respective validation functions upon retry
* **Description:** Outlines user retry actions and routing fallback strategies when validation or process errors occur at any stage.