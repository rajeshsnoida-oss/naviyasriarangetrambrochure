# Decisions

## D-010: GrapesJS as editor framework
**Status**: Active
**Date**: 2026-05-12
**Context**: FR-14–FR-19 require a local visual editor supporting WYSIWYG text editing, image swapping, section reordering, card addition, and design token controls. A framework was needed to avoid building drag-reorder and DOM serialisation from scratch.
**Decision**: GrapesJS — open-source drag-and-drop page builder that serialises to clean HTML/CSS; natively supports component blocks (sections), drag reorder, style manager (CSS custom properties), and image swapping. MIT licence, no bundler required.
**Why**: Covers all editor FRs natively with minimal custom code; clean HTML output preserves the static-site deployment model; active community; zero permanent install (served via `npx`).
**Consequences**: Brochure HTML sections must be mapped to GrapesJS component types — a one-time config step per section type. GrapesJS serialisation must be tuned to preserve `data-i18n` attributes and existing class/ID conventions. Startup requires a lightweight local static server.
**Alternatives considered**:
- Custom `contenteditable` + DOM manipulation — rejected; fragile for rich editing (image swap, section reorder) without significant custom code.
- Quill / Tiptap — rejected; document-centric editors with no section-layout or design-token controls.

## D-009: Editor serialises to static HTML (Option A)
**Status**: Active
**Date**: 2026-05-12
**Context**: ARCH-FLAG-1 required choosing how the visual editor persists changes. Option A: serialise editor DOM directly to `index.html` + `css/style.css`. Option B: content data layer (`data/content.js`) + runtime JS rendering in the deployed page.
**Decision**: Option A — GrapesJS serialises editor state directly to `index.html` and `css/style.css`; no content data layer; deployed brochure remains pure static HTML.
**Why**: Satisfies FR-20 without a build step. Keeps deployed brochure as pure static HTML (no runtime JS needed to populate content). Preserves brochure Non-goal "No dynamic content loading". Simpler for a solo developer managing a one-time event.
**Consequences**: Editor is coupled to brochure HTML structure; structural changes made outside the editor may confuse GrapesJS component parsing. Tamil `data-i18n` attributes must be explicitly configured as pass-through in GrapesJS serialisation config.
**Alternatives considered**:
- Option B (content data layer + runtime JS) — rejected; changes brochure's static nature, requires runtime JS to populate content, adds a data model with no benefit for a one-time event.

## D-008: WCAG 2.1 AA ownership (distributed)
**Status**: Active
**Date**: 2026-05-12
**Context**: NFR-2 (WCAG 2.1 AA) had no owning module; multiple modules have WCAG-relevant surface (colour contrast, toggle behaviour, form accessibility). DRIFT-2 flagged this gap.
**Decision**: Distributed ownership — brochure owns base colour contrast and structural semantics; i18n owns accessible toggle behaviour; feedback owns form accessibility (labels, focus indicators, ARIA).
**Why**: Ownership follows where the relevant code lives; no single module owns all of WCAG, and a single-owner model would create a catch-all module with no real accountability.
**Consequences**: Each module with interactive elements must cite NFR-2 in its Purpose line. Drift-check will flag any module that adds interactive elements without a documented WCAG note in its MODULE.md.

## D-007: Responsive breakpoints
**Status**: Active
**Date**: 2026-05-12
**Context**: NFR-1 required responsive layout at three breakpoints but no specific pixel values were anchored in any MODULE.md or DECISIONS entry. DRIFT-1 flagged this gap.
**Decision**: mobile ≤480px, tablet 481–1024px, desktop >1024px — matching the values already implemented in `css/style.css` `@media` blocks.
**Why**: Standard mobile-first breakpoints for a public event brochure; covers the expected viewport distribution for an Indian event audience with heavy mobile use.
**Consequences**: All responsive CSS is written against these three ranges. Any new component must be tested at ≤480px, 481–1024px, and >1024px before being marked done. Changing a breakpoint value requires updating all `@media` blocks in `css/style.css` and the MODULE.md of any module that documents breakpoint-specific behaviour.

## D-006: @media print + window.print() for PDF export
**Status**: Active
**Date**: 2026-05-12
**Context**: FR-12 requires a print-to-PDF capability triggered by an on-page button. Options ranged from browser-native print to server-side PDF generation.
**Decision**: A dedicated `css/print.css` loaded with `<link media="print">` handles all layout adjustments; a single `window.print()` call in `js/print.js` triggers the browser's native print/save dialog.
**Why**: Zero dependencies, zero infrastructure, zero cost. The browser's print-to-PDF covers all modern devices. Server-side tools (Puppeteer, wkhtmltopdf) add deployment complexity with no benefit for a static event brochure.
**Consequences**: PDF filename and page headers/footers are controlled by the browser — not customisable without server-side rendering. Print output fidelity depends on the browser's CSS support for `@page`, `page-break-before`, and `page-break-inside` — well-supported in all modern browsers.

## D-005: html[lang] attribute + CSS selector for font switching
**Status**: Active
**Date**: 2026-05-12
**Context**: Switching from English to Tamil requires activating Noto Sans Tamil across all translatable elements. Options: (a) JS sets `font-family` on every element, (b) a single attribute on `<html>` triggers a CSS rule.
**Decision**: `setLang()` sets `lang="ta"` on `<html>`; a CSS rule `html[lang="ta"] .i18n-text { font-family: 'Noto Sans Tamil', sans-serif; }` handles font switching for all elements at once.
**Why**: A single DOM write (`<html lang>`) is cheaper than iterating every translatable element in JS. The CSS rule is also easier to audit and override for edge cases. This is the standard pattern for multilingual web pages.
**Consequences**: All translatable elements must carry the `i18n-text` class (or a suitable ancestor selector). If a translatable element is added without the class, it won't receive the Tamil font — a silent miss, not an error.

## D-004: Stable section IDs as cross-module contract
**Status**: Active
**Date**: 2026-05-12
**Context**: Three modules (i18n, print, feedback) need to target specific brochure sections. A shared contract is needed so these modules don't embed fragile assumptions about the HTML structure.
**Decision**: Brochure section IDs (e.g. `#cover`, `#dance-item-1`) are the single published contract. i18n uses them to scope `data-i18n` key prefixes; print CSS uses them as selectors for page-break and visibility rules; feedback mounts into `#feedback-mount`.
**Why**: IDs are the most stable HTML surface — they survive CSS refactors, class renames, and DOM restructuring. Defining them as the contract means peer modules only break when sections are fundamentally renamed or removed, not on routine styling changes.
**Consequences**: Renaming any published section ID requires coordinated changes in brochure HTML, i18n key table, and print CSS — treated as a hard-flag change. New sections must be added to this contract before peer modules can reference them.

## D-002: Google Apps Script as feedback backend
**Status**: Active
**Date**: 2026-05-12
**Context**: The feedback feature requires writing submitted name + text to a shared Google Sheets spreadsheet and reading all entries back to render the name list. A backend or serverless function is needed; the project stack is plain HTML/CSS/JS with GitHub Pages hosting (static only).
**Decision**: Use Google Apps Script deployed as a Web App to handle `doGet` (read all rows) and `doPost` (append a row, return all rows). The spreadsheet is the same Google Sheet the owner already uses to review feedback.
**Why**: Free with no infrastructure to manage; native Google Sheets integration requires no additional auth or SDK; fits the solo, static-site context perfectly. All alternatives require either a paid tier, a separate backend host, or fail to meet the "read back all rows" requirement.
**Consequences**: Cold-start latency of ~50–200ms on first request after idle (acceptable for an event brochure). Google Sheets API rate limit is 300 writes/minute (not a concern at event scale). CORS requires form-encoded POST (see D-003). Apps Script deployment settings must be exact — any deviation silently breaks CORS.
**Alternatives considered**:
- Firebase Realtime DB — rejected; requires Firebase project setup, billing account, and exposes API keys on the frontend.
- Netlify Functions — rejected; requires Netlify hosting (conflicts with GitHub Pages) and separate function deployment.
- Formspree — rejected; handles form POST but cannot return all rows for the name list (read-back requirement fails).

## D-003: application/x-www-form-urlencoded for Apps Script POST
**Status**: Active
**Date**: 2026-05-12
**Context**: Apps Script Web Apps do not respond to CORS preflight OPTIONS requests. A `fetch()` POST with `Content-Type: application/json` triggers a preflight and silently fails in the browser.
**Decision**: All POST requests to the Apps Script endpoint use `Content-Type: application/x-www-form-urlencoded`. The `doPost` handler reads `e.parameter.name` and `e.parameter.text`.
**Why**: Form-encoded POST is a "simple request" under the Fetch spec — no preflight OPTIONS is sent, so the Apps Script CORS headers on the response are sufficient.
**Consequences**: Request body is URL-encoded, not JSON. The Apps Script handler must parse `e.parameter` (not `JSON.parse(e.postData.contents)`). Input values must be URL-encoded by the frontend. This is a permanent constraint — switching to JSON POST would require Apps Script middleware that handles OPTIONS, which is not straightforward.

## D-001: Tamil translation — build-time LLM-generated strings
**Status**: Active
**Date**: 2026-05-12
**Context**: The brochure needs bilingual (English/Tamil) support. Tamil text must come from somewhere — options were runtime API translation or pre-generated static strings.
**Decision**: Tamil translations are generated once by Claude once English content is finalised, stored as static strings in the JS i18n data object, and served via the existing language toggle. No runtime translation API is called.
**Why**: The brochure content is set once for a single event — runtime translation adds latency, API key management complexity, and ongoing cost with no benefit. Build-time generation fits the static-site stack perfectly.
**Consequences**: Owner must re-request LLM translation if English content changes after the initial translation pass. Tamil slots are blank until English content is finalised — the toggle is functional but Tamil sections are empty during development.
**Alternatives considered**:
- Runtime via Apps Script proxy (Claude API called server-side on toggle) — rejected; adds latency (~1–3s per section), API cost, and complexity for a one-time event brochure.
- Owner manually writes Tamil — rejected; impractical, LLM-generated is faster and more accurate.

<!--
Template for new entries:

## D-001: Short descriptive title
**Status**: Active
**Date**: YYYY-MM-DD
**Context**: What problem prompted this decision?
**Decision**: What was chosen?
**Why**: Reasoning; alternatives considered in passing.
**Consequences**: What does this force or rule out?
**Alternatives considered** *(optional, for non-trivial decisions)*:
  - Option X — rejected because ...
**Supersedes** / **Superseded by** *(optional)*:
  - [D-XXX](#d-xxx)
-->
