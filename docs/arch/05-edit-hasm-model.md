# Edit HASM Model (React Page Transfer)

This draft describes edit flow split by changed HASM part.
Each section shows React page transfer and save behavior.

## React Pages Required

- Model Home Page: `/hasm/:modelId`
- EXPERIENCE List Page: `/hasm/:modelId/EXPERIENCE`
- FACT List Page: `/hasm/:modelId/FACT`
- LINK List Page: `/hasm/:modelId/LINK`
- EXPERIENCE Detail Page: `/hasm/:modelId/EXPERIENCE/:entityId`
- FACT Detail Page: `/hasm/:modelId/FACT/:entityId`
- LINK Detail Page: `/hasm/:modelId/LINK/:entityId`

## EXPERIENCE Edit Flow

```mermaid
flowchart LR
	A[Home Page /hasm/:modelId] --> B[EXPERIENCE List Page /hasm/:modelId/EXPERIENCE]
	B --> C[EXPERIENCE Detail Page /hasm/:modelId/EXPERIENCE/:entityId]
	C --> D[Edit DB fields]
	C --> E[Edit Markdown]
	D --> F[Save EXPERIENCE row to hasm.db only]
	E --> G[Open HASM Markdown App]
	G --> H[User edits and saves main.md]
	H --> I[Update EXPERIENCE metadata in hasm.db]
	F --> J[Return to EXPERIENCE Detail Page]
	I --> J
```

### EXPERIENCE Sequence

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant RH as React Home Page
	participant RL as React EXPERIENCE List Page
	participant RD as React EXPERIENCE Detail Page
	participant TB as Tauri Bridge
	participant RC as Rust Command Layer
	participant DB as hasm.db
	participant MA as HASM Markdown App

	User->>RH: Open model
	RH-->>RL: Navigate to EXPERIENCE list
	User->>RL: Select EXPERIENCE entity
	RL-->>RD: Navigate to EXPERIENCE detail

	alt DB fields changed
		User->>RD: Edit DB fields and click Save
		RD->>TB: invoke(save_experience, db_change_set)
		TB->>RC: save_experience(db_change_set)
		RC->>DB: Update EXPERIENCE row only
		DB-->>RC: committed
		RC-->>TB: success
		TB-->>RD: save result
	else Markdown changed
		User->>RD: Click Edit Markdown
		RD->>TB: invoke(open_markdown_editor, experience_ref)
		TB->>RC: open_markdown_editor(experience_ref)
		RC->>MA: Open EXPERIENCE main.md
		MA-->>User: Edit and save markdown
		MA-->>RC: markdown saved notification
		RC->>DB: Update EXPERIENCE metadata
		DB-->>RC: committed
		RC-->>TB: success
		TB-->>RD: save result
	end

	RD-->>User: Show save complete
```

## FACT Edit Flow

```mermaid
flowchart LR
	A[Home Page /hasm/:modelId] --> B[FACT List Page /hasm/:modelId/FACT]
	B --> C[FACT Detail Page /hasm/:modelId/FACT/:entityId]
	C --> D[Edit DB fields]
	C --> E[Edit Markdown]
	D --> F[Save FACT row to hasm.db only]
	E --> G[Open HASM Markdown App]
	G --> H[User edits and saves main.md]
	H --> I[Update FACT metadata in hasm.db]
	F --> J[Return to FACT Detail Page]
	I --> J
```

### FACT Sequence

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant RH as React Home Page
	participant RL as React FACT List Page
	participant RD as React FACT Detail Page
	participant TB as Tauri Bridge
	participant RC as Rust Command Layer
	participant DB as hasm.db
	participant MA as HASM Markdown App

	User->>RH: Open model
	RH-->>RL: Navigate to FACT list
	User->>RL: Select FACT entity
	RL-->>RD: Navigate to FACT detail

	alt DB fields changed
		User->>RD: Edit DB fields and click Save
		RD->>TB: invoke(save_fact, db_change_set)
		TB->>RC: save_fact(db_change_set)
		RC->>DB: Update FACT row only
		DB-->>RC: committed
		RC-->>TB: success
		TB-->>RD: save result
	else Markdown changed
		User->>RD: Click Edit Markdown
		RD->>TB: invoke(open_markdown_editor, fact_ref)
		TB->>RC: open_markdown_editor(fact_ref)
		RC->>MA: Open FACT main.md
		MA-->>User: Edit and save markdown
		MA-->>RC: markdown saved notification
		RC->>DB: Update FACT metadata
		DB-->>RC: committed
		RC-->>TB: success
		TB-->>RD: save result
	end

	RD-->>User: Show save complete
```

## LINK Edit Flow

```mermaid
flowchart LR
	A[Home Page /hasm/:modelId] --> B[LINK List Page /hasm/:modelId/LINK]
	B --> C[LINK Detail Page /hasm/:modelId/LINK/:entityId]
	C --> D[Edit DB fields]
	C --> E[Edit Markdown]
	D --> F[Save LINK row to hasm.db only]
	E --> G[Open HASM Markdown App]
	G --> H[User edits and saves main.md]
	H --> I[Update LINK metadata in hasm.db]
	F --> J[Return to LINK Detail Page]
	I --> J
```

### LINK Sequence

```mermaid
sequenceDiagram
	autonumber
	actor User
	participant RH as React Home Page
	participant RL as React LINK List Page
	participant RD as React LINK Detail Page
	participant TB as Tauri Bridge
	participant RC as Rust Command Layer
	participant DB as hasm.db
	participant MA as HASM Markdown App

	User->>RH: Open model
	RH-->>RL: Navigate to LINK list
	User->>RL: Select LINK entity
	RL-->>RD: Navigate to LINK detail

	alt DB fields changed
		User->>RD: Edit DB fields and click Save
		RD->>TB: invoke(save_link, db_change_set)
		TB->>RC: save_link(db_change_set)
		RC->>DB: Update LINK row only
		DB-->>RC: committed
		RC-->>TB: success
		TB-->>RD: save result
	else Markdown changed
		User->>RD: Click Edit Markdown
		RD->>TB: invoke(open_markdown_editor, link_ref)
		TB->>RC: open_markdown_editor(link_ref)
		RC->>MA: Open LINK main.md
		MA-->>User: Edit and save markdown
		MA-->>RC: markdown saved notification
		RC->>DB: Update LINK metadata
		DB-->>RC: committed
		RC-->>TB: success
		TB-->>RD: save result
	end

	RD-->>User: Show save complete
```

## Notes

- This page is split by changed part: EXPERIENCE, FACT, and LINK.
- Each flow includes React page transfer: Home -> List -> Detail.
- DB-only edit saves to hasm.db only.
- Markdown edit opens HASM Markdown App, then updates metadata in hasm.db.
