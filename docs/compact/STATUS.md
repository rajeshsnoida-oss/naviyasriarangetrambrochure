# Status

**Active phase**: architecture
**Last updated**: 2026-05-12
**Last drift-check**: 2026-05-12 — mode: design — 0 resolved, 2 skipped

## Done

- 2026-05-12 Project initialized via `/project-init`
- 2026-05-12 Requirements phase complete — FR-1–FR-13, NFR-1–NFR-4 confirmed; all Open questions resolved; D-001 logged
- 2026-05-12 Architecture phase complete — MODULE.md drafted for brochure, feedback, i18n, print; D-002–D-006 logged; MAP.md generated

## In progress

*(empty)*

## Next

- Resolve Flags before dev: DRIFT-1 (NFR-1 breakpoints → log D-007) and DRIFT-2 (NFR-2 WCAG → log D-008)
- `/switch-phase development feedback` — implement feedback module first (cross-system boundary; highest risk)

## Flags

- drift-check 2026-05-12: DRIFT-1 unresolved — NFR-1 responsive breakpoints (≤480px, 481–1024px, >1024px) not anchored in any MODULE.md or DECISIONS entry; brochure claims ownership but specifies no values
- drift-check 2026-05-12: DRIFT-2 unresolved — NFR-2 (WCAG 2.1 AA) has no owning module; no MODULE.md Purpose cites NFR-2; no DECISIONS entry for WCAG approach
