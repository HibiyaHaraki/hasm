# Visualize HASM Model (3D Git-like Graph)

This draft describes a visualization concept similar to a 3D Git commit graph.
In this view, `EXPERIENCE` behaves like branches, `FACT` behaves like commits, and `LINK` behaves like cross-entity relationship edges.

## Visualization Pipeline

```mermaid
flowchart TD
	A([Boot HASM]) --> B{HASM model folder is selected or not?}
	B --Yes--> C[Visualize HASM Model]
	B --NO--> D[Open HASM Model]
	D --> E([Select HASM Model])
	E --> C

	C --> P1([Select PERSON])
	P1 --> P2[PERSON detail]
	C --> E1([Select EXPERIENCE])
	E1 --> E2[EXPERIENCE detail]
	C --> F1([Select FACT])
	F1 --> F2[FACT detail]
	C --> L1([Select LINK])
	L1 --> L2[LINK detail]

	subgraph "PERSON Detail"
		P2 --> P3([Edit PERSON Information])
		P3 --> P4([Save PERSON Information])
		P4 --> P2
	end

	subgraph "EXPERIENCE Detail"
		E2 --> E3([Edit EXPERIENCE Information])
		E3 --> E4([Save EXPERIENCE Information])
		E4 --> E2
	end

	subgraph "FACFT Detail"
		F2 --> F3([Edit FACT Information])
		F3 --> F4([Save FACT Information])
		F4 --> F2
	end

	subgraph "LINK Detail"
		L2 --> L3([Edit LINK Information])
		L3 --> L4([Save LINK Information])
		L4 --> L2
	end

	P2 --> P5([Back])
	P5 --> C
	E2 --> E5([Back])
	E5 --> C
	F2 --> F5([Back])
	F5 --> C
	L2 --> L5([Back])
	L5 --> C

```

## Notes

- Mermaid is 2D, so this is a conceptual draft for a future 3D implementation.
- Suggested 3D mapping:
  - X-axis: timeline/order of FACTs
  - Y-axis: EXPERIENCE branch separation
  - Z-axis: entity type layers (PERSON, EXPERIENCE, FACT, LINK)
- Dashed edges represent non-branch references (PERSON/LINK relations).
