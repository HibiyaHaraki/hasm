# HASM Model Editor 🌟

HASM Model Editor is a desktop-focused model management tool for opening, browsing, and editing HASM model data. The app combines a React frontend and a Rust/Tauri backend so model entities can be handled through a workflow-driven UI while keeping local file-based operations reliable.

## Why this project exists ✨

Many model files are spread across multiple formats and locations, which makes it hard to inspect and update related entities consistently. HASM Model Editor focuses on structured navigation and detail editing for the four core entity types in one workspace.

- 📂 Open a HASM model root path
- 🧭 Visualize and switch across entity categories
- ✍️ Inspect and edit detail records
- 💾 Save changes back to local data files

## Current status 🚧

The current implementation includes core workspace operations:

- ✅ Model open flow and workspace initialization
- ✅ Entity list visualization grouped by type
- ✅ Detail editing pages for PERSON, EXPERIENCE, FACT, and LINK
- ✅ Save APIs for each detail type through Tauri commands

## How it works 🔄

```mermaid
flowchart LR
	A[Boot page] --> B[Open HASM model root]
	B --> C[Load workspace metadata and entity lists]
	C --> D[Select entity type and item]
	D --> E[Edit detail form]
	E --> F[Save detail to local files]
```

## Architecture details 📚

- [HASM model structure](docs/arch/00-hasm-model-structure.md)
- [System components](docs/arch/01-system-components.md)
- [Create HASM model flow](docs/arch/02-create-hasm-model.md)
- [Read HASM model flow](docs/arch/03-read-hasm-model.md)
- [Save HASM model flow](docs/arch/04-save-hasm-model.md)
- [Edit HASM model flow](docs/arch/05-edit-hasm-model.md)
- [Frontend HASM model flow](docs/arch/06-frontend-hasm-model.md)

## Feature overview 🧩

| Area | Status | Description |
|---|---|---|
| Boot and routing | ✅ | Start flow and route users to open or visualize stages |
| Model open | ✅ | Load HASM model workspace from selected path |
| Entity browsing | ✅ | Filter and list entities by type |
| Entity detail editing | ✅ | Edit PERSON, EXPERIENCE, FACT, and LINK fields |
| Visualization expansion | 🚧 | Additional visual model views are planned |

## Tech stack 🛠️

- Frontend: React + Vite
- Desktop shell: Tauri
- Backend logic: Rust
- Data access: Local file and SQLite-backed model resources

## Getting started ▶️

Install dependencies:

```bash
npm install
```

Run the app in development mode:

```bash
npm run tauri dev
```

Build for production:

```bash
npm run build
npm run tauri build
```

## Project structure 📁

```text
src/                # React frontend pages, components, hooks, and definitions
src-tauri/          # Tauri bootstrap and Rust backend command/service logic
docs/arch/          # Architecture notes and flow documentation
package.json        # Frontend scripts and dependencies
vite.config.js      # Vite configuration
```

## Roadmap 🗺️

Planned enhancements include:

- 🌐 Richer visualization of entity relationships
- 🧪 Additional model validation helpers
- 🧠 More guided editing and consistency checks
- 📦 Expanded import/export workflows

## License 📜

This project is currently shared without a formal license declaration.
If you plan to publish or reuse it publicly, add an appropriate open-source license such as MIT, Apache-2.0, or BSD-2-Clause.
