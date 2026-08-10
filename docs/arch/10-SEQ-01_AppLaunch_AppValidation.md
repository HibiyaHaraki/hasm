# SEQ-01: App Launch & App Validation (Detailed Specification)

This document details the startup, initialization, and initial model path selection flow for the HASM Desktop Application.
It ensures that external editor dependencies, application versions, launch parameters (CLI arguments), and manual path selections are thoroughly validated before triggering the core model loading process (`SEQ-02`).

## Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as User / OS
    participant React as React (App.tsx / SelectPage)
    participant Router as React Router
    participant Bridge as Tauri IPC Bridge
    participant Rust as Rust Command (main.rs)
    participant FS as File System / OS

    User->>React: Launch Application (via exe OR Context Menu)
    React->>React: Set Initial Loading State<br/>{ isLoading: true, loadState: 0, error: null }

    %% ----------------------------------------------------
    %% Check 1: External Markdown App Validation
    %% ----------------------------------------------------
    rect rgb(30, 41, 59)
        Note over React,Rust: Check 1: Validate External HASM Markdown App
        React->>Bridge: invoke('validate_hasm_markdown_app')
        Bridge->>Rust: IPC: validate_hasm_markdown_app()
        
        Rust->>Rust: Execute test invocation / check executable path

        break On IPC Timeout (>5000ms) OR Validation Error (Result::Err)
            Rust-->>Bridge: Return Err(AppValidationError { code: "ERR_MARKDOWN_APP_INVALID" })
            Bridge-->>React: Reject Promise (AppValidationError)
            React->>React: Set State: { error: err.message, isLoading: false }
            React->>Router: navigate('/error-app')
            Note over React,Router: Display HASM App Error Page
        end

        Rust-->>Bridge: Return Ok(())
        Bridge-->>React: Resolve Promise
        React->>React: Set State: { loadState: 1 }
    end

    %% ----------------------------------------------------
    %% Check 2: App Version & Launch Arguments Inspection
    %% ----------------------------------------------------
    rect rgb(30, 41, 59)
        Note over React,Rust: Check 2: Inspect App Version & CLI Arguments
        React->>Bridge: invoke('validate_app_version')
        Bridge->>Rust: IPC: validate_app_version()
        
        Rust->>Rust: Read env!("CARGO_PKG_VERSION") & Parse std::env::args()
        
        break On Inspection Error (Result::Err)
            Rust-->>Bridge: Return Err(AppValidationError { code: "ERR_VERSION_CHECK_FAILED" })
            Bridge-->>React: Reject Promise (AppValidationError)
            React->>React: Set State: { error: err.message, isLoading: false }
            React->>Router: navigate('/error-app')
            Note over React,Router: Display HASM App Error Page
        end

        Rust-->>Bridge: Return Ok(AppVersionResponse { isModelSelected: boolean, path: Option<String> })
        Bridge-->>React: Resolve Promise (payload)
        React->>React: Set State: { loadState: 2, modelPath: payload.path }
    end

    %% ----------------------------------------------------
    %% Check 3: Path Existence Verification (If CLI Argument Provided)
    %% ----------------------------------------------------
    rect rgb(30, 41, 59)
        Note over React,FS: Check 3: Verify Folder Path Existence (Only if CLI Path Provided)
        
        opt isModelSelected == true
            React->>Bridge: invoke('validate_hasm_folder_path', { path: modelPath })
            Bridge->>Rust: IPC: validate_hasm_folder_path(path)
            
            Rust->>FS: std::path::Path::new(&path).exists()
            FS-->>Rust: boolean (Path Existence)
            
            break On Path Not Found OR FS Timeout (>3000ms)
                Rust-->>Bridge: Return Err(AppValidationError { code: "ERR_TARGET_PATH_NOT_FOUND" })
                Bridge-->>React: Reject Promise (AppValidationError)
                React->>React: Set State: { error: "Specified HASM path does not exist", isLoading: false }
                React->>Router: navigate('/error-app')
                Note over React,Router: Display HASM App Error Page (Invalid Path)
            end

            Rust-->>Bridge: Return Ok(())
            Bridge-->>React: Resolve Promise
        end

        React->>React: Set State: { loadState: 3 }
    end

    %% ----------------------------------------------------
    %% Check 4: Manual Path Input & Real-time Validation (If CLI Path NOT Provided)
    %% ----------------------------------------------------
    rect rgb(30, 41, 59)
        Note over React,FS: Check 4: Manual Selection & Real-time Path Validation
        
        alt Booted via Context Menu (Path exists & verified: isModelSelected == true)
            React->>React: Path verified -> Bypass Select Page
        else Booted directly via exe (No CLI Path: isModelSelected == false)
            React->>React: Set State: { isLoading: false }
            React->>Router: navigate('/select')
            Note over React,Router: Display Select Page
            
            loop Real-time Path Validation on Form Input / File Picker (Debounced)
				User->>React: Input / Select Folder Path in Form
				React->>Bridge: invoke('validate_hasm_folder_path', { path: inputPath })
				Bridge->>Rust: IPC: validate_hasm_folder_path(inputPath)
				Rust->>FS: std::path::Path::new(&inputPath).exists()
				FS-->>Rust: boolean
				
				alt Path Exists & Valid (Within 2000ms)
					Rust-->>Bridge: Return Ok(())
					Bridge-->>React: Resolve Promise
					React->>React: Enable 'Submit' Button & Clear Warnings
				else Path Invalid OR FS Timeout (>2000ms)
					Rust-->>Bridge: Return Err(AppValidationError)
					Bridge-->>React: Reject Promise
					React->>React: Disable 'Submit' Button & Show Timeout/Invalid Warning
				end
			end
            
            User->>React: Click 'Submit / Load' Button
            React->>React: Set State: { modelPath: inputPath, isLoading: true }
        end
    end

    %% ----------------------------------------------------
    %% Final Transition to SEQ-02
    %% ----------------------------------------------------
    React->>Router: navigate('/loading-model', { state: { path: modelPath } })
    Note over React,Router: Guaranteed Valid Model Path -> Proceed to SEQ-02

```

## Technical Specifications & Data Structures

### Data Contracts (Rust <-> React IPC)

```rust
// Error Payload returned by all validation commands
#[derive(Serialize, Deserialize, Debug)]
pub struct AppValidationError {
    pub code: String,    // e.g., "ERR_MARKDOWN_APP_INVALID", "ERR_TARGET_PATH_NOT_FOUND"
    pub message: String, // Human-readable error description
}

// Response structure for Check 2
#[derive(Serialize, Deserialize, Debug)]
pub struct AppVersionResponse {
    pub is_model_selected: bool,
    pub path: Option<String>,
    pub version: String,
}

```

## Detailed Step-by-Step Explanation

### Step 1: Initial Application Boot

* **Execution:** `React (App.tsx)`
* **Description:** When the application mounts, React sets its local/global initialization state to `{ isLoading: true, loadState: 0, error: null }`.

### Step 2: Check 1 - Validate External HASM Markdown App

* **Command:** `invoke('validate_hasm_markdown_app')`
* **Description:**
  * React verifies that the external HASM Markdown Application executable is present and callable on the host OS.
  * **Timeout Constraint:** Managed within a 5,000ms threshold.
  * **Error Handling:** On error, execution breaks immediately to `/error-app`.
  * **Success:** React updates state to `loadState: 1`.

### Step 3: Check 2 - Inspect App Version & CLI Arguments

* **Command:** `invoke('validate_app_version')`
* **Description:**
  * Rust checks `CARGO_PKG_VERSION` and `std::env::args()`.
  * If launched via Explorer Context Menu with a folder path, `isModelSelected = true` and `path = Some("...")`.
  * If launched directly via executable, `isModelSelected = false`.
  * **Success:** React updates state to `loadState: 2` and stores `modelPath`.

### Step 4: Check 3 - Verify Folder Path Existence (CLI Argument Case)

* **Command:** `invoke('validate_hasm_folder_path', { path: modelPath })`
* **Condition:** Executed **ONLY** when `isModelSelected == true`.
* **Description:**
  * Checks if the CLI-supplied path exists on disk (`Path::exists()`).
  * **Timeout Constraint:** Managed within a 3,000ms threshold.
  * **Error Handling:** If non-existent, breaks immediately to `/error-app`.
  * **Success:** React updates state to `loadState: 3`.

### Step 5: Check 4 - Manual Path Input & Real-time Validation (Manual Select Case)

* **Execution:** `Select Page Component`
* **Condition:** Executed **ONLY** when `isModelSelected == false`.
* **Description:**
  * React navigates to `/select` and renders the path selection form/file picker.
  * As the user types or chooses a path, React calls `validate_hasm_folder_path` in real-time (debounced by 300ms).
  * **Timeout Constraint:** Enforced with a 2,000ms threshold. If checking a remote/unresponsive path exceeds 2 seconds, it treats the path as unverified and shows a timeout warning.
  * **Validation Logic:**
    * **Path Valid:** Form button is enabled, inline warning is hidden.
    * **Path Invalid:** Form button remains disabled, preventing submission of invalid paths.
  * When the user clicks Submit, React captures the validated `modelPath` and re-enables `isLoading: true`.

### Step 6: Transition to SEQ-02

* **Execution:** `React Router`
* **Description:** With a 100% verified disk path guaranteed (`modelPath`), React routes to `/loading-model` to initiate `SEQ-02: Model Loading` (schema parsing and data structure loading).