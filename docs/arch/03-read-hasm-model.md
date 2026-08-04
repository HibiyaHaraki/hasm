# Open Existing HASM Model

This draft sequence diagram describes how HASM opens an existing model folder (for example, `my.hasm/`) based on the storage and DB structure in `00-hasm-model-structure.md`.

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant FE as Frontend (React)
	participant TB as Tauri Bridge
	participant RC as Rust Command Layer
	participant FS as File System
	participant DB as hasm.db

	User->>FE: Click Open HASM Model
	FE->>TB: invoke(open_hasm_model)
	TB->>RC: open_hasm_model(path)

	RC->>FS: Validate selected path exists
	FS-->>RC: path is directory (my.hasm)

	RC->>FS: Check required entries
	FS-->>RC: hasm.db, PERSON, EXPERIENCE, FACT, LINK

	RC->>DB: Open hasm.db
	DB-->>RC: DB connection ready

	RC->>RC: Build in-memory entities by UUID
	RC->>RC: Resolve list references\n(parent_experience_ids, branch_experience_ids, person_ids, link_ids, related_ids)
	RC->>RC: Validate cross-reference integrity

	RC-->>TB: Return HASM model DTO
	TB-->>FE: Model payload
	FE->>FE: Update app state and graph view
	FE-->>User: Show loaded HASM model
```

## Notes

- Input path is expected to be a HASM model root directory, such as `my.hasm/`.
- `hasm.db` is opened first for model metadata/session integrity, then entity markdown is loaded from each category folder.
- IDs in list fields are resolved after all entities are loaded, to support forward references.
