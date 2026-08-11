# SEQ-02: Model Loading & Storage Verification (Architecture Sequence)

This document details the sequence for checking workspace locks, loading metadata from `hasm.db` into the `HasmModel` Rust domain class (storing `local_path`), and executing encapsulated storage verification via `model.verify_storage()`.

---

## Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant React as React (LoadingPage.tsx)
    participant Router as React Router
    participant Bridge as Tauri IPC Bridge / listen()
    participant Rust as Rust Command (model_loader.rs)
    participant Model as HasmModel (Domain Instance)
    participant FS as File System / Workspace

    Note over React,FS: Pre-condition: Navigation from SEQ-01 completed. React receives modelPath via route state.

    React->>Bridge: Setup Event Listeners:<br/>listen('model-load-progress') & listen('model-verify-progress')
    React->>React: Mount Component & Set State<br/>{ isModelLoading: true, modelProgress: 0, loadingMessage: "Initializing...", modelError: null }

    %% ----------------------------------------------------
    %% Step 1: Workspace Lock Check (Exclusive Access Control)
    %% ----------------------------------------------------
    rect rgb(30, 41, 59)
        Note over React,FS: Step 1: Check Workspace Lock File (Multi-Process Safety)
        React->>Bridge: invoke('check_workspace_lock', { path: modelPath })
        Bridge->>Rust: IPC: check_workspace_lock(path)
        
        Rust->>FS: Check existence of .hasm/lock
        
        alt Lock exists (Already opened by another HASM process)
            FS-->>Rust: Lock File Present
            Rust-->>Bridge: Return Ok(LockStatus { isLocked: true, holderPid: 1234 })
            Bridge-->>React: Resolve Promise (isLocked = true)
            React->>React: Set State: { isReadOnly: true, warning: "Opened in Read-Only Mode" }
        else Lock absent (First process)
            FS-->>Rust: Lock File Absent
            Rust->>FS: Create .hasm/lock with current PID
            Rust-->>Bridge: Return Ok(LockStatus { isLocked: false })
            Bridge-->>React: Resolve Promise (isLocked = false)
            React->>React: Set State: { isReadOnly: false }
        end
    end

    %% ----------------------------------------------------
    %% Step 2: Load Database into HasmModel Instance via Methods
    %% ----------------------------------------------------
    rect rgb(30, 41, 59)
        Note over React,FS: Step 2: Load hasm.db using HasmModel & Entity Methods
        React->>Bridge: invoke('load_hasm_model_db', { path: modelPath })
        Bridge->>Rust: IPC: load_hasm_model_db(path)
        
        Rust->>FS: Open path/hasm.db
        
        break On Corrupted DB OR Schema Execution Failure
            Rust-->>Bridge: Return Err(ModelLoadingError { code: "ERR_DB_CORRUPTED" })
            Bridge-->>React: Reject Promise (ModelLoadingError)
            React->>React: Set State: { modelError: err.message, isModelLoading: false }
            React->>Router: navigate('/error-model')
            Note over React,Router: Display Model Load Error Page
        end

        Rust->>Model: Call HasmModel::new(modelPath)
        Model-->>Rust: Return HasmModel instance with local_path bound

        %% Loading PERSON
        Rust-->>Bridge: emit('model-load-progress', { progress: 5, message: "Loading PERSON metadata..." })
        Bridge-->>React: Listener Callback Fires: payload { progress: 5, message }
        React->>React: Set State: { modelProgress: 5, loadingMessage: "Loading PERSON metadata..." }
        Rust->>FS: Query PERSON records
        loop For each PERSON row
            Rust->>Rust: Call Person::new(name, desc, life_exp_id, sec_level)
            Rust->>Model: Call model.add_person(person)
        end
        
        %% Loading EXPERIENCE
        Rust-->>Bridge: emit('model-load-progress', { progress: 12, message: "Loading EXPERIENCE metadata..." })
        Bridge-->>React: Listener Callback Fires: payload { progress: 12, message }
        React->>React: Set State: { modelProgress: 12, loadingMessage: "Loading EXPERIENCE metadata..." }
        Rust->>FS: Query EXPERIENCE & EXPERIENCE_TREE records
        loop For each EXPERIENCE row
            Rust->>Rust: Call Experience::new(name, desc, sec_level) & populate parent/child IDs
            Rust->>Model: Call model.add_experience(experience)
        end
        
        %% Loading FACT
        Rust-->>Bridge: emit('model-load-progress', { progress: 20, message: "Loading FACT metadata..." })
        Bridge-->>React: Listener Callback Fires: payload { progress: 20, message }
        React->>React: Set State: { modelProgress: 20, loadingMessage: "Loading FACT metadata..." }
        Rust->>FS: Query FACT & FACT_EXPERIENCE records
        loop For each FACT row
            Rust->>Rust: Call Fact::new(name, desc, start, end, sec_level) & populate exp IDs
            Rust->>Model: Call model.add_fact(fact)
        end
        
        %% Loading LINK
        Rust-->>Bridge: emit('model-load-progress', { progress: 28, message: "Loading LINK metadata..." })
        Bridge-->>React: Listener Callback Fires: payload { progress: 28, message }
        React->>React: Set State: { modelProgress: 28, loadingMessage: "Loading LINK metadata..." }
        Rust->>FS: Query LINK & LINK_RELATION records
        loop For each LINK row
            Rust->>Rust: Call Link::new(type, desc, origin_type, origin_id, target_type, target_id, sec_level)
            Rust->>Model: Call model.add_link(link)
        end

        Rust-->>Bridge: emit('model-load-progress', { progress: 30, message: "DB metadata loaded" })
        Bridge-->>React: Listener Callback Fires: payload { progress: 30, message }
        React->>React: Set State: { modelProgress: 30, loadingMessage: "DB metadata loaded" }

        Rust-->>Bridge: Return Ok(HasmModel)
        Bridge-->>React: Resolve Promise (hasmModelInstance)
        React->>React: Store in React State: { modelData: hasmModelInstance }
    end

    %% ----------------------------------------------------
    %% Step 3: Encapsulated Model Storage Verification Method
    %% ----------------------------------------------------
    rect rgb(30, 41, 59)
        Note over React,FS: Step 3: Execute model.verify_storage() Method
        React->>Bridge: invoke('verify_hasm_storage', { model: hasmModelInstance })
        Bridge->>Rust: IPC: verify_hasm_storage(model)

        Rust-->>Bridge: emit('model-verify-progress', { progress: 50, message: "Verifying storage folder structure..." })
        Bridge-->>React: Listener Callback Fires: payload { progress: 50, message }
        React->>React: Set State: { modelProgress: 50, loadingMessage: "Verifying storage folder structure..." }

        Rust->>Model: Call model.verify_storage()
        Model->>FS: Check folder existence for all UUIDs & scan unreferenced directories
        Model-->>Rust: Return VerificationResult { missing_entities, unreferenced_entities }

        %% Evaluate Verification Results
        break On Fatal Error (result.has_fatal_error() == true)
            Rust-->>Bridge: Return Err(ModelLoadingError { code: "ERR_MISSING_STORAGE_FOLDER", missing: result.missing_entities })
            Bridge-->>React: Reject Promise (ModelLoadingError)
            React->>React: Set State: { modelError: err.message, isModelLoading: false }
            React->>Router: navigate('/error-model')
            Note over React,Router: Display Model Load Error Page
        end

        Rust-->>Bridge: Return Ok(VerificationResult)
        Bridge-->>React: Resolve Promise (result)
        React->>React: Set State: { modelProgress: 100, loadingMessage: "Model verification complete", isModelLoading: false }
    end

    %% ----------------------------------------------------
    %% Final Transition to Main Application Workspace
    %% ----------------------------------------------------
    React->>Router: navigate('/workspace', { state: { modelData: hasmModelInstance, isReadOnly, modelWarnings: result.unreferenced_entities } })
    Note over React,Router: Transition to Main Dashboard / Graph Viewer (`SEQ-03`)