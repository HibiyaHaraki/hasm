# SEQ-02: Model Loading & Storage Verification (Architecture Sequence)

This document details the complete sequence for checking workspace locks, loading metadata from `hasm.db` into the `HasmModel` Rust domain class with granular progress streaming (`current`, `total`, `percentage`), Watchdog Timeout handling (Pattern B), and executing encapsulated storage verification via `model.verify_storage()`.

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
    React->>React: Mount Component & Set Initial State<br/>{ isModelLoading: true, modelProgress: 0, current: 0, total: 0, loadingMessage: "Initializing...", modelError: null }

    %% ----------------------------------------------------
    %% Step 1: Workspace Lock Check (Fixed 3,000ms Timeout)
    %% ----------------------------------------------------
    rect rgb(30, 41, 59)
        Note over React,FS: Step 1: Check Workspace Lock File (Fixed 3,000ms Hard Timeout)
        React->>Bridge: invoke('check_workspace_lock', { path: modelPath })
        Bridge->>Rust: IPC: check_workspace_lock(path)
        
        Rust->>FS: Check existence of .hasm/lock
        
        break On Frontend Hard Timeout (>3,000ms without response)
            React->>React: Set State: { modelError: "Lock check timed out", isModelLoading: false }
            React->>Router: navigate('/error-model')
        end

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
    %% Step 2: Load Database into HasmModel (Watchdog Timer Pattern B)
    %% ----------------------------------------------------
    rect rgb(30, 41, 59)
        Note over React,FS: Step 2: Load hasm.db into HasmModel (Granular Progress & 10,000ms Watchdog Timer)
        React->>React: Start Watchdog Timer (Threshold: 10,000ms without progress event)
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

        %% Loading PERSON Progress Stream
        Rust-->>Bridge: emit('model-load-progress', { step: "DB_LOAD", current: N, total: Total, percentage: P1, message: "Loading PERSON..." })
        Bridge-->>React: Listener Callback Fires: ProgressPayload
        React->>React: Reset Watchdog Timer to 0ms & Update Smooth UI State:<br/>{ current, total, modelProgress: percentage, loadingMessage }
        Rust->>FS: Query PERSON records
        loop For each PERSON row
            Rust->>Rust: Call Person::new(name, desc, life_exp_id, sec_level)
            Rust->>Model: Call model.add_person(person)
        end
        
        %% Loading EXPERIENCE Progress Stream
        Rust-->>Bridge: emit('model-load-progress', { step: "DB_LOAD", current: N, total: Total, percentage: P2, message: "Loading EXPERIENCE..." })
        Bridge-->>React: Listener Callback Fires: ProgressPayload
        React->>React: Reset Watchdog Timer to 0ms & Update Smooth UI State:<br/>{ current, total, modelProgress: percentage, loadingMessage }
        Rust->>FS: Query EXPERIENCE & EXPERIENCE_TREE records
        loop For each EXPERIENCE row
            Rust->>Rust: Call Experience::new(name, desc, sec_level) & populate parent/child IDs
            Rust->>Model: Call model.add_experience(experience)
        end
        
        %% Loading FACT Progress Stream
        Rust-->>Bridge: emit('model-load-progress', { step: "DB_LOAD", current: N, total: Total, percentage: P3, message: "Loading FACT..." })
        Bridge-->>React: Listener Callback Fires: ProgressPayload
        React->>React: Reset Watchdog Timer to 0ms & Update Smooth UI State:<br/>{ current, total, modelProgress: percentage, loadingMessage }
        Rust->>FS: Query FACT & FACT_EXPERIENCE records
        loop For each FACT row
            Rust->>Rust: Call Fact::new(name, desc, start, end, sec_level) & populate exp IDs
            Rust->>Model: Call model.add_fact(fact)
        end
        
        %% Loading LINK Progress Stream
        Rust-->>Bridge: emit('model-load-progress', { step: "DB_LOAD", current: N, total: Total, percentage: P4, message: "Loading LINK..." })
        Bridge-->>React: Listener Callback Fires: ProgressPayload
        React->>React: Reset Watchdog Timer to 0ms & Update Smooth UI State:<br/>{ current, total, modelProgress: percentage, loadingMessage }
        Rust->>FS: Query LINK & LINK_RELATION records
        loop For each LINK row
            Rust->>Rust: Call Link::new(type, desc, origin_type, origin_id, target_type, target_id, sec_level)
            Rust->>Model: Call model.add_link(link)
        end

        break On Watchdog Timeout (>10,000ms elapsed since LAST progress event)
            React->>React: Set State: { modelError: "DB loading stalled (Watchdog timeout)", isModelLoading: false }
            React->>Router: navigate('/error-model')
        end

        Rust-->>Bridge: emit('model-load-progress', { step: "DB_LOAD", current: Total, total: Total, percentage: 30.0, message: "DB metadata loaded" })
        Bridge-->>React: Listener Callback Fires: ProgressPayload
        React->>React: Reset Watchdog Timer to 0ms & Update State: { modelProgress: 30.0, loadingMessage }

        Rust-->>Bridge: Return Ok(HasmModel)
        Bridge-->>React: Resolve Promise (hasmModelInstance)
        React->>React: Clear Step 2 Watchdog Timer & Store: { modelData: hasmModelInstance }
    end

    %% ----------------------------------------------------
    %% Step 3: Storage Verification Method (Watchdog Timer Pattern B)
    %% ----------------------------------------------------
    rect rgb(30, 41, 59)
        Note over React,FS: Step 3: Execute model.verify_storage() (10,000ms Watchdog Timer)
        React->>React: Start Watchdog Timer (Threshold: 10,000ms without progress event)
        React->>Bridge: invoke('verify_hasm_storage', { model: hasmModelInstance })
        Bridge->>Rust: IPC: verify_hasm_storage(model)

        loop Chunked Verification Progress Stream (e.g., Every 50 Verified Folders)
            Rust-->>Bridge: emit('model-verify-progress', { step: "STORAGE_VERIFY", current: V, total: VTotal, percentage: P, message: "Verifying storage..." })
            Bridge-->>React: Listener Callback Fires: ProgressPayload
            React->>React: Reset Watchdog Timer to 0ms & Update Smooth UI State:<br/>{ current: V, total: VTotal, modelProgress: P, loadingMessage }
        end

        Rust->>Model: Call model.verify_storage()
        Model->>FS: Check folder existence for all UUIDs & scan unreferenced directories
        Model-->>Rust: Return VerificationResult { missing_entities, unreferenced_entities }

        break On Watchdog Timeout (>10,000ms elapsed since LAST progress event)
            React->>React: Set State: { modelError: "Storage verification stalled (Watchdog timeout)", isModelLoading: false }
            React->>Router: navigate('/error-model')
        end

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
        React->>React: Clear Step 3 Watchdog Timer & Update State: { modelProgress: 100.0, loadingMessage: "Complete", isModelLoading: false }
    end

    %% ----------------------------------------------------
    %% Final Transition to Main Application Workspace
    %% ----------------------------------------------------
    React->>Router: navigate('/workspace', { state: { modelData: hasmModelInstance, isReadOnly, modelWarnings: result.unreferenced_entities } })
    Note over React,Router: Transition to Main Dashboard / Graph Viewer (`SEQ-03`)