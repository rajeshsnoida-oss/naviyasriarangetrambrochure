# Structure conventions

Defines what counts as a "module" in this repository and how visibility maps to `pub` / `internal` for the `regen-map` skill.

Populated during `project-init` from the tech-stack answer. Edit as conventions evolve.

## Module definition

Each logical feature area under `src/` is a module. A module's MODULE.md lives at `src/<module>/MODULE.md`. Modules correspond to interactive/dynamic features and major content groupings — not individual HTML sections or CSS rules.

Planned modules for this project:
- `src/brochure/` — all 12 static content sections (cover through gratitude)
- `src/feedback/` — feedback form, clickable name list, Google Apps Script integration
- `src/i18n/` — English/Tamil language toggle and content data structure
- `src/print/` — print-to-PDF CSS layer and trigger button

## Visibility mapping

**JavaScript**:
- `export` / `export default` → pub
- non-exported functions, classes, variables → internal

**CSS**:
- Classes referenced from HTML outside the module's own template → pub
- Helper/utility classes only used within the module's own CSS → internal

**HTML**:
- `<section>` elements and IDs consumed by the main page or peer modules → pub
- Template fragments only referenced within the module's own files → internal

## Description source

- `*.html`: `<!-- <description> -->` comment on the first content line (after `<!DOCTYPE>`)
- `*.js`: leading JSDoc block comment (`/** ... */`)
- `*.css`: leading block comment (`/* ... */`)
- Directories with `MODULE.md`: first sentence of the Purpose section
- Other files / directories: no automatic description (path-only row in MAP.md)

## Module doc schema

Each module has `src/<module>/MODULE.md` with these curated sections plus a regen-only Structure section:

- **Purpose** — 1-2 sentences; includes `(serves FR-N, NFR-N)` for requirements traceability.
- **Public surface** — exported JS functions/classes, CSS classes used outside the module, HTML section IDs consumed by peers.
- **Invariants** — what callers can count on (state lifecycle, rendering order, browser support floor).
- **Key choices** — each linked to `docs/compact/DECISIONS.md` by `[D-XXX]`.
- **Non-goals** — deliberate omissions.
- **Structure** — regen-only; bounded by `<!-- BEGIN:STRUCTURE -->` / `<!-- END:STRUCTURE -->`; never hand-edited.
- **Depends on** / **Depended on by** — links to peer MODULE.md files.
