# Save HASM Model

This document describes save behavior split by edited part.

## Save Decision (Overview)

- EXPERIENCE
  - DB fields only: save to hasm.db (main.db) only.
  - HASM Markdown changed: open HASM Markdown App, edit, and save.
- FACT
  - DB fields only: save to hasm.db (main.db) only.
  - HASM Markdown changed: open HASM Markdown App, edit, and save.
- LINK
  - DB fields only: save to hasm.db (main.db) only.
  - HASM Markdown changed: open HASM Markdown App, edit, and save.

## EXPERIENCE Save

### EXPERIENCE: DB Fields Only

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant FE as Frontend (React)
	participant TB as Tauri Bridge
	participant RC as Rust Command Layer
	participant DB as hasm.db (main.db)

	User->>FE: Edit EXPERIENCE DB fields and click Save
	FE->>TB: invoke(save_experience, change_set)
	TB->>RC: save_experience(change_set)
	RC->>DB: Update EXPERIENCE row only
	DB-->>RC: committed
	RC-->>TB: save success
	TB-->>FE: save result
	FE-->>User: Show save complete message
```

### EXPERIENCE: HASM Markdown Changed

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant FE as Frontend (React)
	participant TB as Tauri Bridge
	participant RC as Rust Command Layer
	participant MA as HASM Markdown App
	participant DB as hasm.db (main.db)

	User->>FE: Edit EXPERIENCE markdown and click Save
	FE->>TB: invoke(save_experience, change_set)
	TB->>RC: save_experience(change_set)
	RC->>MA: Open EXPERIENCE markdown editor
	MA-->>User: Edit and save markdown
	MA-->>RC: markdown saved notification
	RC->>DB: Update EXPERIENCE metadata in DB
	DB-->>RC: committed
	RC-->>TB: save success
	TB-->>FE: save result
	FE-->>User: Show save complete message
```

## FACT Save

### FACT: DB Fields Only

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant FE as Frontend (React)
	participant TB as Tauri Bridge
	participant RC as Rust Command Layer
	participant DB as hasm.db (main.db)

	User->>FE: Edit FACT DB fields and click Save
	FE->>TB: invoke(save_fact, change_set)
	TB->>RC: save_fact(change_set)
	RC->>DB: Update FACT row only
	DB-->>RC: committed
	RC-->>TB: save success
	TB-->>FE: save result
	FE-->>User: Show save complete message
```

### FACT: HASM Markdown Changed

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant FE as Frontend (React)
	participant TB as Tauri Bridge
	participant RC as Rust Command Layer
	participant MA as HASM Markdown App
	participant DB as hasm.db (main.db)

	User->>FE: Edit FACT markdown and click Save
	FE->>TB: invoke(save_fact, change_set)
	TB->>RC: save_fact(change_set)
	RC->>MA: Open FACT markdown editor
	MA-->>User: Edit and save markdown
	MA-->>RC: markdown saved notification
	RC->>DB: Update FACT metadata in DB
	DB-->>RC: committed
	RC-->>TB: save success
	TB-->>FE: save result
	FE-->>User: Show save complete message
```

## LINK Save

### LINK: DB Fields Only

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant FE as Frontend (React)
	participant TB as Tauri Bridge
	participant RC as Rust Command Layer
	participant DB as hasm.db (main.db)

	User->>FE: Edit LINK DB fields and click Save
	FE->>TB: invoke(save_link, change_set)
	TB->>RC: save_link(change_set)
	RC->>DB: Update LINK row only
	DB-->>RC: committed
	RC-->>TB: save success
	TB-->>FE: save result
	FE-->>User: Show save complete message
```

### LINK: HASM Markdown Changed

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant FE as Frontend (React)
	participant TB as Tauri Bridge
	participant RC as Rust Command Layer
	participant MA as HASM Markdown App
	participant DB as hasm.db (main.db)

	User->>FE: Edit LINK markdown and click Save
	FE->>TB: invoke(save_link, change_set)
	TB->>RC: save_link(change_set)
	RC->>MA: Open LINK markdown editor
	MA-->>User: Edit and save markdown
	MA-->>RC: markdown saved notification
	RC->>DB: Update LINK metadata in DB
	DB-->>RC: committed
	RC-->>TB: save success
	TB-->>FE: save result
	FE-->>User: Show save complete message
```

## Notes

- This flow is scoped to EXPERIENCE, FACT, and LINK.
- DB-only changes do not open HASM Markdown App.
- Markdown changes always open HASM Markdown App before DB metadata update.
