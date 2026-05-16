# Decisions

## D-024 — `normaliseTextScale`: convert scale handles to real `fontSize`/`width` on resize

**Status**: Active
**Date**: 2026-05-16
**Context**: Dragging a Fabric resize handle on a text object stores the change as `scaleX`/`scaleY` rather than updating `width` or `fontSize`. This breaks word-wrap (`Textbox` wraps at `width`, not `width × scaleX`) and makes export CSS incorrect (export multiplies width × scaleX again, doubling the effect).
**Decision**: On `object:modified` for text objects, if scale ≠ 1: compute `newFontSize = fontSize × scaleY`, `newWidth = width × scaleX` (clamped to page), set both, reset scale to 1 and call `initDimensions()`.
**Why**: Normalised measurements make the object behave identically to a freshly-created one — word-wrap, export, and copy/paste all work from clean values. Keeping scaled rendering would require every downstream consumer (export, preview, paste) to account for the scale factor.
**Consequences**: Resize handle behaves as "change font size + width" not "stretch glyphs." Font size rounds to the nearest pixel. Existing `i-text` objects in older saves are also normalised when the user resizes them.

## D-023 — `fabric.Textbox` replaces `fabric.IText` for new text objects

**Status**: Active
**Date**: 2026-05-16
**Context**: `IText` grows horizontally without wrapping; pasting multi-line or long text causes the object to overflow past page boundaries with no way to constrain it.
**Decision**: `addText()` creates `fabric.Textbox` with `width: 300` instead of `fabric.IText`. `insertTextAtCursor` clamps width to the page right edge and calls `obj.initDimensions()` so the box auto-expands downward.
**Why**: `Textbox` is Fabric's built-in wrapping text type — wraps at its `width` and auto-calculates height. Capping `IText` width doesn't produce wrapping; it just clips. Converting existing `IText` objects to `Textbox` on-the-fly during paste would require removing and re-adding them to the canvas.
**Consequences**: New text objects serialise as `type: "textbox"` in `.brochure` saves. Existing saves with `type: "i-text"` still load correctly — Fabric handles both, and export/preview already checks for both types.

## D-022 — Electron native clipboard IPC for system-clipboard text paste

**Status**: Active
**Date**: 2026-05-16
**Context**: Needed to paste system clipboard text into a Fabric text object while in editing mode. Two approaches failed first: (1) letting Ctrl+V pass through to Fabric → garbled characters (Fabric's hidden-textarea paste handler misreads Electron's clipboard format); (2) capture-phase `paste` event listener reading `e.clipboardData.getData('text/plain')` → returned empty string in Electron's renderer.
**Decision**: Expose Electron's native `clipboard.readText()` via IPC — `clipboard:readText` handler in `main.js`, `readClipboardText()` in `preload.js`. On Ctrl+V with a text object in editing mode, call this IPC method and insert the returned string via `insertTextAtCursor`.
**Why**: Electron's `clipboard` module reads the system clipboard reliably regardless of renderer security context. `navigator.clipboard` is unavailable in non-secure contexts (Electron's custom `vendor:` protocol). The DOM paste event's `clipboardData` was unreliable in Electron's sandboxed renderer.
**Consequences**: IPC round-trip on each paste keystroke (negligible latency). Paste always delivers plain text — no rich-text formatting is preserved (intentional for a layout tool).

## D-021 — Cumulative paste offset resets on each new copy

**Status**: Active
**Date**: 2026-05-15
**Context**: Repeated Ctrl+V pastes from the same clipboard would stack exactly on top of each other if placed at a fixed offset from the original position.
**Decision**: `pasteOffset` increments by 20px on each paste and resets to 0 on each copy. Paste positions the new object at `original + pasteOffset`.
**Why**: Matches the convention in most design tools (Figma, Illustrator) where repeated pastes cascade diagonally so each copy is visible and selectable.
**Consequences**: If the user copies, pastes many times, then copies again, the offset resets — the next paste lands near the original. This is intentional and expected.

## D-020 — Clipboard stores cloned Fabric objects (not serialised JSON)

**Status**: Active
**Date**: 2026-05-15
**Context**: Copy/paste needed to preserve all object properties including custom ones (`_shadowPreset`, `_shadowColor`) and Fabric internals (shadow, font, etc.). Two options: store `obj.toObject()` JSON and re-enliven on paste, or store `obj.clone()` live Fabric objects.
**Decision**: Store `obj.clone()` results in the `clipboard` array. Each paste re-clones from the stored clone (`src.clone()`), so the clipboard survives multiple pastes.
**Why**: `obj.clone()` preserves all Fabric properties including computed ones without needing a round-trip through JSON serialisation. `fabric.util.enlivenObjects` (the JSON path) requires careful property include lists and is more brittle with custom properties. Clone is the idiomatic Fabric copy mechanism.
**Consequences**: Clipboard is process-local memory — it doesn't survive app restart and can't be shared across app instances. Custom properties must be listed in the `propertiesToInclude` array passed to `clone()` to be preserved; omitting them silently drops them.

## D-019 — Re-apply canvas background after loadFromJSON

**Status**: Active
**Date**: 2026-05-15
**Context**: `switchSection` called `applyCanvasBg` before `canvas.loadFromJSON`. Fabric.js v5's `loadFromJSON` always resets `backgroundColor` to null when the JSON object doesn't contain a `background` key — since we only serialise `objects`, not the full canvas state, the background was wiped on every section switch.
**Decision**: Move `applyCanvasBg` (and `setBackgroundImage`) into an `afterLoad` callback that runs inside the `loadFromJSON` completion handler, ensuring background is applied last.
**Why**: Simpler than including background in the serialised JSON (which would require serialising Fabric Gradient/Pattern objects and deserialising them on load — fragile and format-coupled). The callback approach keeps background state in the section data model, not in Fabric's JSON.
**Consequences**: Background is applied asynchronously after objects are loaded. For texture backgrounds (which use `fabric.Image.fromURL` internally), there is a brief flash of no-background between section switch and texture render — acceptable at event-brochure scale.

## D-018 — buildTransform() to combine CSS rotation and horizontal scale

**Status**: Active
**Date**: 2026-05-14
**Context**: Fabric text objects carry both `angle` (rotation) and `scaleX` (horizontal stretch from drag-resize handles). Exporting these to HTML naively produced two separate `transform:` declarations — `transform: rotate(30deg)` and `transform: scaleX(1.4)` — in the same style string. CSS ignores all but the last `transform:` declaration; rotation was silently dropped.
**Decision**: A `buildTransform(angle, scaleX)` helper combines non-identity transforms into a single `transform: rotate(Xdeg) scaleX(Y);` declaration with a shared `transform-origin: top left`.
**Why**: The CSS spec allows only one `transform:` property per element; multiple declarations cascade like any other property — last wins. Combining into one value is the only correct approach short of using CSS variables or SVG transforms.
**Consequences**: Any new transform types (skew, scaleY, etc.) must go through `buildTransform` — callers cannot emit their own `transform:` alongside it. The helper skips identity values (angle=0, scaleX=1) to keep exported HTML clean.

## D-017 — FileReader.readAsDataURL for cutout results

**Status**: Active
**Date**: 2026-05-14
**Context**: After AI background removal, the result blob was stored as `URL.createObjectURL(blob)` = `blob:file:///...`. This URL is a memory reference in the Electron renderer process. When the project is exported or previewed in the system browser, the blob reference is invalid — images rendered as broken.
**Decision**: Replace `URL.createObjectURL()` with `FileReader.readAsDataURL()` to convert the result blob to a base64 data URL before storing it in the Fabric canvas object.
**Why**: A data URL is a self-contained string that encodes the image bytes directly. It survives serialisation to `.brochure` JSON, export to HTML, and opening in any process or browser. Blob URLs are process-local memory references that expire when the renderer closes.
**Consequences**: Cutout images are stored as base64 in the `.brochure` project file (~33% size overhead vs raw bytes). A typical portrait cutout at 1–3 MB adds ~1.3–4 MB to the project file — acceptable for a single-event brochure. The `FileReader` API is async so the cutout flow gained a callback chain.

## D-016 — Electron + Fabric.js as editor platform

**Status**: Active
**Date**: 2026-05-14
**Context**: FR-14–FR-20 were originally satisfied by a GrapesJS web editor served via a Python HTTP server. In practice, cutout results stored as blob: URLs broke preview, and the HTTP server added friction (manual start, port conflicts). A canvas-native approach was needed to give precise pixel-level control over element positions, transforms, and export fidelity.
**Decision**: Replace the GrapesJS web editor with an Electron 33 desktop app using Fabric.js v5.3 as the canvas library. Project state serialises to `.brochure` JSON (Fabric canvas + section metadata). Export renders Fabric canvas objects to absolute-positioned HTML/CSS.
**Why**: Fabric.js gives direct access to every object's position, scale, rotation, font, and fill — no DOM-diffing or CSS cascade to reason about during export. Electron removes the local server entirely; native file dialogs and `fs` access replace the HTTP API.
**Consequences**: Brochure content is edited in a separate desktop tool and exported to `index.html`; the two are decoupled. The old `src/editor/server.py` and `editor.html` are retained but no longer the primary path. Fabric.js canvas coordinates are design-space (unaffected by zoom), which simplifies export math.
**Supersedes**: D-010

## D-015: npm registry tarball as model download source

**Status**: Active
**Date**: 2026-05-13
**Context**: download-vendor.py needed to fetch ~211 MB of ONNX model chunks and WASM files. The library's default publicPath is staticimgly.com; jsDelivr also hosts the data package. Both returned HTTP 403 to Python urllib requests (block non-browser User-Agents). The same data is published as the separate npm package @imgly/background-removal-data@1.4.5.
**Decision**: Download the tarball directly from the npm registry (registry.npmjs.org) using urllib + a browser User-Agent header, extract the package/dist/ tree in-memory with tarfile, and write the contents to src/editor/vendor/background-removal/models/.
**Why**: npm registry served the tarball successfully where staticimgly.com and jsDelivr did not. The registry URL is stable, unauthenticated, and contains identical content to the CDN. In-memory extraction avoids writing a temporary .tgz file to disk.
**Consequences**: One-time ~211 MB download required before using Cutout. If the library version is bumped, the VERSION constant in download-vendor.py must be updated and the script re-run. The models/ folder is large and must be excluded from git (or already is via .gitignore).

## D-014: Import map + local index.mjs for background removal library

**Status**: Active
**Date**: 2026-05-13
**Context**: processFile dynamically imported @imgly/background-removal via esm.sh (full-package URL). The cutout feature hung indefinitely — esm.sh bundles onnxruntime-web into a single opaque file, and the WASM loading behaviour inside that bundle was unpredictable (likely triggering WASM fetch before the library could set ort.env.wasm.wasmPaths to local blob URLs).
**Decision**: Add a `<script type="importmap">` to editor.html that resolves the four bare specifiers used by index.mjs (lodash, ndarray, onnxruntime-web, zod) to individual esm.sh CDN URLs. Import the library itself from the locally-served vendor file (/src/editor/vendor/background-removal/dist/index.mjs).
**Why**: Separate module imports give the browser a proper module graph where onnxruntime-web is its own module instance. The imgly library sets ort.env.wasm.wasmPaths before InferenceSession.create(), which works correctly when ORT is a separate module. The esm.sh full-bundle bypassed this by merging ORT into one file with unpredictable init ordering.
**Consequences**: editor.html requires internet on first use to download four dependency modules from esm.sh (cached after that). The import map version pins must stay in sync with the versions used by background-removal@1.4.5. Updating the library version requires re-checking the import map entries.

## D-013: Cache-Control: no-store on all editor API endpoints

**Status**: Active
**Date**: 2026-05-12
**Context**: server.py served all files without cache-control headers. After a user saved CSS token changes and reopened the editor, the browser served /api/style from cache — the Design Tokens panel showed stale values, making it appear the editor wasn't reflecting saved changes.
**Decision**: send_file() gained a no_cache parameter; send_json() always sends no-store. All API-served content (editor.html, /api/brochure, /api/style, all JSON responses) gets `Cache-Control: no-store, no-cache, must-revalidate` + `Pragma: no-cache`. Static assets served from the filesystem without the no_cache flag are unaffected.
**Why**: The editor is a local dev tool where stale data breaks the workflow entirely. No-store is the simplest and most reliable approach for a local server; cache-busting via query strings or ETags would require client-side coordination with no benefit here.
**Consequences**: No browser caching of brochure files or editor CSS while the local server runs. Intentional for development. The deployed brochure on GitHub Pages uses its own cache headers independent of this server.

## D-012: Duplicate style independence via unique CSS class injection

**Status**: Active
**Date**: 2026-05-12
**Context**: GrapesJS stores style-manager edits against CSS class selectors. When a component is cloned (⎘ Duplicate), the clone shares the original's classes. Resizing an image in the clone also resized the original — reported by user immediately after Duplicate was added.
**Decision**: The duplicate-component command walks all descendant components via onAll() and adds a unique class `gjsc-<uid>-<n>` to each structural element before inserting the clone. Original layout classes remain intact (CSS layout is unaffected); editor-applied style overrides write to the unique class, scoping them to that copy only.
**Why**: Simpler than (a) converting class styles to inline styles post-clone (requires reading the CSS cascade at runtime) or (b) configuring GrapesJS to use component-ID selectors globally (changes behaviour for all components, not just clones, with unpredictable side effects).
**Consequences**: Cloned elements carry extra classes in the serialised HTML saved to index.html. These classes are unstyled until the user edits that specific clone — harmless but slightly noisier HTML.

## D-011: Client-side AI background removal via @imgly/background-removal

**Status**: Active
**Date**: 2026-05-12
**Context**: FR-18 (image upload) was extended with a user request to extract the dancer from a photo (remove background). Three options were considered and presented to the user.
**Decision**: @imgly/background-removal loaded from jsDelivr CDN — ONNX model runs entirely in the browser via WebAssembly. First use downloads ~50 MB of model files (cached by browser permanently). Result saved as a transparent PNG to assets/images/ via the existing /api/upload endpoint.
**Why**: No API key, no per-image cost, works offline after first model download. Fits the stdlib-only local server philosophy. User selected this when offered the three options.
**Consequences**: First use requires ~50 MB download from jsDelivr CDN; browser must be online that once. Subsequent uses are fully offline. Quality is good for portrait photos; complex or low-contrast backgrounds may leave fringing. Requires a modern browser with WebAssembly and dynamic import() support (all major browsers since ~2020).
**Alternatives considered**:
- Remove.bg API — rejected by user; requires paid API key, per-image cost, always-online.
- Manual crop/clip tool — rejected by user; no background removal, just framing change.

## D-010: GrapesJS as editor framework
**Status**: Superseded
**Superseded by**: D-016
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
