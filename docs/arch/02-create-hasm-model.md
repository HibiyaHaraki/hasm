# Create New Local .hasm Model

This draft sequence diagram describes how HASM creates a new local model folder (for example, `my.hasm/`) using the structure defined in 00-hasm-model-structure.md.

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant FE as Frontend (React)
	participant TB as Tauri Bridge
	participant RC as Rust Command Layer
	participant FS as File System
	participant DB as hasm.db

	User->>FE: Click Create New HASM Model
	FE->>FE: Input model name and local directory
	FE->>TB: invoke(create_hasm_model, {base_path, model_name})
	TB->>RC: create_hasm_model(base_path, model_name)

	RC->>FS: Build root path (base_path/model_name.hasm)
	RC->>FS: Check path does not already exist

	alt path already exists
		FS-->>RC: already exists
		RC-->>TB: error (duplicate model path)
		TB-->>FE: show error
		FE-->>User: Ask for another name/path
	else path available
		FS-->>RC: path available
		RC->>FS: Create directories PERSON, EXPERIENCE, FACT, LINK
		RC->>FS: Create hasm.db file
		RC->>DB: Open hasm.db
		DB-->>RC: DB connection ready
		RC->>DB: Create tables and indexes
		RC->>DB: Insert initial metadata (model_id, created_at)
		DB-->>RC: initialization complete
		RC->>RC: Build empty in-memory model DTO
		RC-->>TB: Return created model DTO + root path
		TB-->>FE: success payload
		FE->>FE: Update app state to new empty model
		FE-->>User: Show created model workspace
	end
```

## Notes

- Output is a local folder ending with .hasm.
- Initial folder layout contains hasm.db and top-level entity folders: PERSON, EXPERIENCE, FACT, LINK.
- Entity UUID subfolders and main.md files are created later when each entity is added.
