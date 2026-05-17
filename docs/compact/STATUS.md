# Status

**Active phase**: development
**Last updated**: 2026-05-16
**Last drift-check**: 2026-05-12 — mode: design — 0 resolved, 2 skipped

## Done

- 2026-05-12 Project initialized via `/project-init`
- 2026-05-12 Requirements phase complete — FR-1–FR-13, NFR-1–NFR-4 confirmed; all Open questions resolved; D-001 logged
- 2026-05-12 Architecture phase complete — MODULE.md drafted for brochure, feedback, i18n, print; D-002–D-006 logged; MAP.md generated
- 2026-05-12 Brochure CSS styling — dark maroon dual-shade cover; warm rose-blush body gradient across all sections; border image placeholders
- 2026-05-12 Visual editor requirements added — FR-14–FR-20, NFR-5
- 2026-05-12 Editor module architected — src/editor/MODULE.md; brochure invariants updated; D-007–D-010 logged; MAP.md regenerated
- 2026-05-12 Editor module implemented — src/editor/server.py + editor.html (GrapesJS 0.21 CDN); Python HTTP server; save-to-index.html + CSS vars; section reorder + text editing + image asset manager; start.bat launcher
- 2026-05-12 Editor polish — cache-control fix (design tokens always fresh on reload); font picker ✓ selected-state indicator; Duplicate button with unique style classes per clone (independent resize); AI Cutout modal (@imgly/background-removal CDN, browser-side); D-011–D-013 logged
- 2026-05-13 AI Cutout model download fixed — download-vendor.py rewrote to fetch from npm registry tarball; 211 MB model chunks extracted to vendor/background-removal/models/
- 2026-05-13 Editor server fixes — .mjs/.wasm MIME types added; Unicode console crash removed; processFile switched to import map + local index.mjs for reliable onnxruntime-web WASM loading
- 2026-05-14 Replaced GrapesJS web editor with Electron 33 + Fabric.js v5.3 desktop app — canvas editor with text/image/shape tools, undo/redo, section management, save/export-to-HTML; AI Cutout ported; D-016 logged
- 2026-05-14 Editor preview fixes — text alignment (buildTransform, pixel positions, correct lineHeight, IText→white-space:pre / Textbox→white-space:pre-wrap); cutout images converted to data URLs for cross-process portability; D-017, D-018 logged
- 2026-05-14 Editor auto-recovery — 2s debounced write to recovery.brochure in userData; startup: saved path → recovery snapshot → default template
- 2026-05-15 Editor: text shadow/glow effects (drop, soft, gold glow, white glow, custom); section background gradients (linear/radial) and textures (5 patterns)
- 2026-05-15 Editor: background propagation — "Apply bg to all sections" button; new sections inherit cover bg; loadFromJSON background-clear bug fixed
- 2026-05-15 Editor: copy/paste (Ctrl+C/V + toolbar buttons) — copies all object properties including shadow; works cross-section
- 2026-05-16 Editor: system clipboard paste into text boxes (Ctrl+V in editing mode via Electron IPC; Fabric's own paste handler bypassed)
- 2026-05-16 Editor: preview fixed — `angle` undefined in objectToHTMLInline for image/shape objects
- 2026-05-16 Editor: text box improvements — Textbox replaces IText (auto-wraps); paste constrains to page width; manual resize normalises scaleX/Y into real fontSize/width
- 2026-05-16 Editor: add-section button fixed (prompt→auto-name); ▲▼ reorder buttons added to section list
- 2026-05-16 Editor: export HTML fixed — objectToHTML used undefined `angle` for images/shapes (rotateCss was defined but not used); switchSection canvas height corrected to account for zoom
- 2026-05-16 Editor: justify text alignment added (Fabric justify-left; CSS text-align:justify)

## In progress

*(empty)*

## Next

- **Use the editor**: double-click `src\editor-app\start.bat`
- `/switch-phase development feedback` — implement feedback module (Google Apps Script integration; highest risk)
- Provide border image assets: assets/images/border-kolam.png and assets/images/border-bottom.png (seamless horizontal tile, ≤96px tall, transparent PNG)
- Populate index.html with actual event content (performer names, bio text, dance item details, photos) — use the editor for this
- Implement js/i18n.js, js/feedback.js, js/print.js, css/print.css

## Flags

*(none — DRIFT-1 resolved by D-007, DRIFT-2 resolved by D-008, ARCH-FLAG-1 resolved by D-009)*
