# Frontend HASM Model Page Transfer Architecture

This document describes frontend page transfer flow for HASM model operations.
It focuses on how users navigate between bootstrap, model selection, model home visualization, and each entity detail page.

## Page Transfer Flow

```mermaid
flowchart TD
	A([Boot HASM]) --> B{Model folder selected?}
	B -- Yes --> C[Open Model Home Page]
	B -- No --> D[Open Model Selector Page]
	D --> E([Select HASM Model Folder])
	E --> C

	C --> C1([Visualize PERSON / EXPERIENCE / FACT / LINK])
	C1 --> P2[PERSON Detail Page]
	C1 --> E2[EXPERIENCE Detail Page]
	C1 --> F2[FACT Detail Page]
	C1 --> L2[LINK Detail Page]

	subgraph "PERSON Detail Page"
		P2 --> P3([Edit PERSON Form])
		P3 --> P4([Save PERSON])
		P4 --> P2
	end

	subgraph "EXPERIENCE Detail Page"
		E2 --> E3([Edit EXPERIENCE Form])
		E3 --> E4([Save EXPERIENCE])
		E4 --> E2
	end

	subgraph "FACT Detail Page"
		F2 --> F3([Edit FACT Form])
		F3 --> F4([Save FACT])
		F4 --> F2
	end

	subgraph "LINK Detail Page"
		L2 --> L3([Edit LINK Form])
		L3 --> L4([Save LINK])
		L4 --> L2
	end

	P2 --> P5([Back to Model Home])
	P5 --> C
	E2 --> E5([Back to Model Home])
	E5 --> C
	F2 --> F5([Back to Model Home])
	F5 --> C
	L2 --> L5([Back to Model Home])
	L5 --> C

```

## Notes

- This flow is focused on page navigation and transfer between frontend pages.
- Model Home includes visualization for PERSON, EXPERIENCE, FACT, and LINK, and users open details directly from that visualization.
- Entity detail pages provide see, edit, and save operations in-page, then users can navigate back to Model Home.
- The architecture can be mapped to router paths such as `/`, `/open`, `/entity/:type/:id`, and `/visualize` if visualization is later reintroduced.
