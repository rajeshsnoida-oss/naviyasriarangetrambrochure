# Status

**Active phase**: development
**Last updated**: 2026-06-16
**Last drift-check**: 2026-05-21 — mode: design — 0 resolved, 0 skipped

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
- 2026-05-17 Editor: HTML preview/export position fixes — origin-aware fabricLeft/Top helpers; transform-origin:top left for rotated images/shapes; removed object-fit:contain from image render (was causing border/divider images to appear visually misplaced); D-027–D-029 logged
- 2026-05-20 Editor: font preloading fix — await document.fonts.load() for all web fonts used in project before Fabric initSections(); replaced unreliable document.fonts.ready with explicit per-font loads + initDimensions() in switchSection afterLoad; fixes words concatenated without spaces in Textbox (wrong fallback font metrics at measureText time)
- 2026-05-21 Editor: text style presets — 5 built-in presets (Title/Subtitle/Body/Caption/Heading); "Capture" button saves selected text object's style as a named preset; chips in right panel apply style to selection; persisted in .brochure JSON; loaded on project open/new
- 2026-05-21 Editor: snapshotCurrentSection — discards active object before serialising (forces Fabric _restoreObjectsState so group-relative coords convert to absolute); prevents multi-select save from corrupting objects; used in save/export/preview/section-switch; D-032
- 2026-05-21 Editor: propagateBgToAll + bgSettingsFrom fix — now copies bgImage and bgSize when propagating background to all sections (was silently dropping image backgrounds)
- 2026-05-21 Editor: self-contained HTML export — pre-loads all asset:// images as data URLs before render; exported HTML embeds images inline; no separate images/ folder required; D-033
- 2026-05-22 Editor: preview fixed — folder-based temp dir (images/ + small HTML over IPC); eliminates "invalid string length" on large projects; D-034
- 2026-05-22 Editor: delete section bug fixed — activeSec reset to -1 before switchSection() so early-return guard doesn't fire and empty canvas isn't snapshotted over surviving section
- 2026-05-22 Editor: preview phone notch removed — position:absolute overlay was hiding first section header
- 2026-05-22 Editor: 12px gap between sections in preview and export; export inline margin fixed; preview scaledH accounts for gaps
- 2026-05-22 Editor: export HTML self-contained — main process streams base64 substitution via WriteStream; works when opened via file:// on mobile; no V8 string limit hit; D-035, D-036
- 2026-05-24 Editor: export changed to GitHub Pages folder format — writes index.html + images/ to chosen directory; folder picker replaces single-file save dialog; D-037
- 2026-05-24 Brochure published to GitHub Pages — lazy loading, mobile download protection (overlay divs + touch-callout), PNG resize to 900px via nativeImage, will-change + content-visibility for smooth scroll/zoom; D-038, D-039
- 2026-05-26 Editor: phone-frame border-radius 48px→24px in preview — border images at left edge of cover/last page no longer clipped by overflow:hidden corner rounding
- 2026-05-26 Editor: section content corruption fixed — _sectionGen + _sectionLoading guard prevents snapshotCurrentSection capturing empty canvas during async loadFromJSON; stale bgImage callbacks also guarded
- 2026-05-26 Editor: undo removes background fixed — restoreHistory re-applies applyCanvasBg + bgImage reload after loadFromJSON (Fabric's internal canvas.clear() was erasing background)
- 2026-05-26 Editor: pushHistory now uses CANVAS_JSON_PROPS — undo/redo preserves _grayscale, _shadowPreset, _shadowColor etc.
- 2026-05-27 Editor: print export upgraded to 300 DPI — multiplier calculated from PRINT_W_IN/CANVAS_W; PNG-only output (no HTML wrapper); settled on 8.50×11.22in → 2550×3366px per image; set sections to 1048px tall for exact height fit
- 2026-05-29 Editor: print spec corrected to 6.00×8.50in portrait (was 8.50×11.22in); PRINT_MULTIPLIER updated (2.267×); _renderAllSections shared render helper extracted; section height should be 1124px for exact 6×8.5 proportions
- 2026-05-29 Editor: CMYK PDF export — export:toPdf IPC handler (pngjs decode, RGBA→DeviceCMYK, zlib FlateDecode, raw XObject in pdfkit); Export PDF button + Ctrl+Shift+D menu shortcut
- 2026-05-29 Editor: transform-origin bug fixed — removed originToCSSTransformOrigin (Fabric always rotates/flips around geometric CENTER regardless of originX/Y); all CSS transforms now hardcode 50% 50%; flipX/flipY CSS scaleX(-1)/scaleY(-1) added
- 2026-05-29 Editor: preview lazyLoad fixed — objectToHTML lazyLoad param (true=export, false=preview); avoids images never loading inside CSS-scaled phone preview; stroke guard for cutout images (no spurious 1px border)
- 2026-05-29 Editor: image position drift fixed — snapshotCurrentSection no longer recreates ActiveSelection after toJSON (qrDecompose round-trip was compounding 3-4px float error per navigation); switchSection race condition fixed via __loadGen reviver tag + targeted stale-object removal; D-043, D-044
- 2026-05-30 Editor: PDF export switched from DeviceCMYK XObject to sRGB via pdfkit native image embedding — colors now match screen; output renamed brochure-print.pdf; zlib + pngjs imports removed; D-045
- 2026-05-31 Editor: canvas justify-left fix — DOM span measurement overrides Fabric's enlargeSpaces() (which uses Canvas2D metrics without ligatures, giving near-zero word-spacing); CSS-measured surplus applied to __charBounds for visible justification matching HTML export; HTML text-align-last:left fix retained; D-046
- 2026-05-31 Editor: section-load race condition eliminated — replaced canvas.loadFromJSON with fabric.util.enlivenObjects in switchSection + restoreHistory; gen-check now runs before any canvas mutation; _sectionLoading changed from bool to numeric counter; saveProject captures activeSec at click time and skips snapshot if load is in-flight; D-047
- 2026-05-31 Editor: Google Font manager — "＋ Font" button in text toolbar opens modal to search/load/preview any Google Font by name; fonts persisted in app-global settings; settings:set fixed to merge-not-overwrite so font list survives project saves; D-048
- 2026-06-01 Editor: justify text overflow fixed — applyCSSJustification now uses measureLine(a).width (Canvas2D natural line width) for surplus instead of CSS DOM measurement; charBounds sum exactly to obj.width; removed _cssJustCache, _cssLineWidth, and clip-patch workaround; D-049
- 2026-06-03 Editor: image scale not retained across section switches fixed — fabric.Object.NUM_FRACTION_DIGITS raised 2→4 in initCanvas(); prevents rounding of scaleX/scaleY to 2 d.p. on every toJSON() call during section switch; D-051
- 2026-06-05 Editor: vector PDF text rendering — TTF font fetch (Google Fonts v1/v2 with unicode-range subset picking); Noto Sans Tamil for Tamil characters; line-by-line layout (lineBreak:false) matching Fabric Canvas2D metrics; paragraph-end justify detection (computeParaEndFlags); y-clamp for near-top objects; D-052, D-053
- 2026-06-05 Editor: Two-Up PNG export — sections 4+5 side-by-side on 12"×8.5" landscape (3600×2550px @ 300 DPI); height-filling multiplier per section (2550/sec.height); RGB colors preserved, no CMYK conversion; D-054, D-055, D-056
- 2026-06-01 Editor: bgImage bleed fixed — switchSection afterLoad + restoreHistory now call canvas.setBackgroundImage(null, …) when sec.bgImage is falsy, clearing previous section's background image on navigation; D-050
- 2026-06-12 Editor: Digital PDF export (sRGB, bleed-cropped) — cropToSafeArea() removes 0.25" bleed (75px @ 300 DPI) from each edge; exportDigitalPDF() renders at print DPI, crops to 5.50"×8.00" trim size, embeds as sRGB PNG via pdfkit; output brochure-digital.pdf; "Digital PDF" toolbar button + Ctrl+Shift+G menu; export:toPdf gains optional filename param; D-057 logged
- 2026-06-12 Editor: HTML export bleed trim — section container clipped to safe area (728×(sec.height−66)px); inner div at full canvas size offset −33px on each axis carries bgStyle + all objects; responsive scale threshold 794→728px; D-058 logged
- 2026-06-15 index.html / main-style.css: PC layout — .phone-page centered at max-width:728px on viewports ≥769px, matching brochure column width; min-height:max(100vh,1085px) ensures full portrait image visible and page scrollable on short viewports; D-059, D-060 logged
- 2026-06-15 index.html / main-style.css: phone button layout — removed shared .top-bar flex wrapper; .button-group and .instagram-link given independent position:absolute placements (.button-group at right:calc(4%+44px), .instagram-link at right:4%); eliminates flex-wrap on mobile; D-061 logged
- 2026-06-16 Editor: export HTML renamed index.html → brochure.html in export:writeToRepo handler, preview temp file, dialog title, and status-bar message — matches "Program Brochure" href in event landing page

## In progress

- Test vector PDF export — verify text alignment, Tamil character rendering, and justify spacing in a PDF viewer
- Test Digital PDF export — open brochure-digital.pdf, verify content is within 0.25" safe-area boundary and colors match screen
- Test HTML export bleed trim — open exported brochure.html, verify 0.25" boundary is cropped, backgrounds fill correctly, no layout breaks

## Next

- **Use the editor**: double-click `src\editor-app\start.bat`
- Set canvas section height to 1124px for exact 6×8.5in print proportions (previously 1048px for old spec)
- Test Two-Up PNG — open brochure-twoup.png, verify no white borders, full color, correct 12"×8.5" layout
- Test CMYK PDF export — open in Adobe Acrobat Preflight to verify DeviceCMYK colorspace is present
- If image quality looks soft on high-DPI phones, raise MAX_W 900→1350 in src/editor-app/main.js, re-export and push
- `/switch-phase development feedback` — implement feedback module (Google Apps Script integration; highest risk)
- Provide border image assets: assets/images/border-kolam.png and assets/images/border-bottom.png (seamless horizontal tile, ≤96px tall, transparent PNG)
- Populate index.html with actual event content (performer names, bio text, dance item details, photos) — use the editor for this
- Implement js/i18n.js, js/feedback.js, js/print.js, css/print.css

## Flags

*(none — DRIFT-1 resolved by D-007, DRIFT-2 resolved by D-008, ARCH-FLAG-1 resolved by D-009)*
