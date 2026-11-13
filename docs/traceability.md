# Requirement / Test / Code Traceability Policy

This document defines how HASM links every requirement, every automated test
case, and every exported code item together, and how that link is enforced.

## Goals

1. **Code → Spec**: every exported function, class, React component, Rust
   `pub` item, and Tauri command carries at least one requirement tag in the
   comment block directly above its declaration.
2. **Spec → Tests**: every requirement ID defined in [docs/req/](./req/) is
   verified by at least one **positive** and at least one **negative** test
   case (therefore at least two test cases) documented in
   [docs/eval/](./eval/).
3. **Visualization**: the generated [traceability matrix](./traceability-matrix.md)
   shows, per requirement, the implementing code locations and the verifying
   test cases.

## Requirement IDs

Requirement IDs are defined in `docs/req/*.md` using the bracketed form:

```
[REQ-<seq>-<kind>-<number>]   e.g. [REQ-01-FUNC-503], [REQ-04-RULE-002]
```

Recognized kinds: `RULE`, `FUNC`, `DATA`, `NFR`, `UI`, `SEC`. The entity
creation spec ([17-REQ-08_EntityCreation.md](./req/17-REQ-08_EntityCreation.md))
predates the typed scheme and keeps its legacy untyped IDs (e.g.
`REQ-08-016`); the checker accepts both forms.

## Code tags

A code tag is a requirement ID in square brackets inside the contiguous
comment block immediately above a declaration (no blank line in between;
Rust attributes such as `#[tauri::command]` or `#[derive(...)]` may sit
between the comment and the item). Multiple tags per item are encouraged.

```jsx
// [REQ-01-FUNC-503][REQ-01-FUNC-504] Debounced real-time path validation.
export function useDebouncedPathValidation(path) { ... }
```

```rust
/// [REQ-01-FUNC-202][REQ-01-FUNC-207] Verifies the HASM Markdown executable.
#[tauri::command]
pub fn validate_hasm_markdown_app() -> Result<(), AppValidationError> { ... }
```

For components declared as `function Name() {...}` followed by a trailing
`export default Name;`, the tag goes above the `function Name()` declaration.

Tagged item kinds:

| Language | Items that must carry a tag |
| --- | --- |
| JS / JSX (`src/`, submodules excluded) | `export function/class/const`, `export default`, and declarations referenced by `export default Name;` |
| Rust (`src-tauri/src/`, submodules and `#[cfg(test)]` modules excluded) | `pub fn`, `pub(crate) fn`, `pub struct`, `pub enum`, and every `#[tauri::command]` fn |

Private helpers are covered by the tag of their exported parent item.

## Test cases

Test cases live in `docs/eval/*.md` as markdown table rows. A row must keep
the test ID (`TC-...`), every traced requirement ID, and the test type
(`Positive (...)` or `Negative (...)`) on the same table line. Rows whose
type contains `Stress`, `Concurrency`, `Fault`, `Robustness`, `Timeout`, or
`Reject` also count as negative coverage. Every test case must name its
automated target (a Vitest test in `test/` or a `cargo test` target in
`src-tauri`).

## Enforcement

```
npm run test:traceability    # CI gate: fails on any traceability gap
npm run build:traceability   # regenerates docs/traceability-matrix.md
```

The checker ([scripts/check-traceability.mjs](../scripts/check-traceability.mjs))
fails when:

- a requirement has no test case, no positive test case, no negative test
  case, or fewer than two test cases (`NO-TC`, `NO-POSITIVE`, `NO-NEGATIVE`,
  `SINGLE-TC`);
- an exported code item has no requirement tag (`UNTAGGED`);
- a code tag or a test case references a requirement ID that does not exist
  (`UNKNOWN-REQ`).

It warns (without failing) when a requirement is not referenced from code
(`NO-CODE-REF`), which is acceptable for process-level or purely manual
rules.

When behavior changes, update the requirement doc, the eval doc, the code
tags, and regenerate the matrix in the same change.
