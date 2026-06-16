'use strict';
/* â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const CANVAS_W   = 794;
const CANVAS_JSON_PROPS = [
  'name','fontFamily','fontWeight','fontStyle','underline','fill',
  'textAlign','fontSize','textBackgroundColor','lineHeight','charSpacing',
  'stroke','strokeWidth','opacity','angle','_shadowPreset','_shadowColor','_grayscale',
  '_isGlow','_isGlitter',
];
const ZOOM_STEP  = 0.1;
const ZOOM_MIN   = 0.2;
const ZOOM_MAX   = 3.0;
const HISTORY_MAX = 80;

/* â”€â”€ Font catalogue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const FONTS = [
  // â”€â”€ Classical / Serif â”€â”€
  { name: 'Playfair Display',    cat: 'Serif' },
  { name: 'Cormorant Garamond',  cat: 'Serif' },
  { name: 'EB Garamond',         cat: 'Serif' },
  { name: 'Libre Baskerville',   cat: 'Serif' },
  { name: 'Merriweather',        cat: 'Serif' },
  { name: 'Lora',                cat: 'Serif' },
  { name: 'Crimson Text',        cat: 'Serif' },
  { name: 'Cinzel',              cat: 'Serif' },
  // â”€â”€ Modern / Sans â”€â”€
  { name: 'Lato',                cat: 'Sans' },
  { name: 'Montserrat',          cat: 'Sans' },
  { name: 'Raleway',             cat: 'Sans' },
  { name: 'Open Sans',           cat: 'Sans' },
  { name: 'Poppins',             cat: 'Sans' },
  { name: 'Josefin Sans',        cat: 'Sans' },
  { name: 'Nunito',              cat: 'Sans' },
  { name: 'Quicksand',           cat: 'Sans' },
  // â”€â”€ Script / Decorative â”€â”€
  { name: 'Dancing Script',      cat: 'Script' },
  { name: 'Great Vibes',         cat: 'Script' },
  { name: 'Sacramento',          cat: 'Script' },
  { name: 'Pacifico',            cat: 'Decorative' },
  { name: 'Lobster',             cat: 'Decorative' },
  // â”€â”€ System â”€â”€
  { name: 'Georgia',             cat: 'System' },
  { name: 'Times New Roman',     cat: 'System' },
  { name: 'Arial',               cat: 'System' },
  { name: 'Verdana',             cat: 'System' },
  { name: 'Trebuchet MS',        cat: 'System' },
  { name: 'Impact',              cat: 'System' },
];

const GOOGLE_FONTS = new Set(FONTS.filter(f => f.cat !== 'System').map(f => f.name));

/* â”€â”€ Custom / downloaded fonts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
let customFonts = []; // [{name, cat}] â€” persisted in settings.customFonts

function injectGoogleFont(name) {
  const id = 'gf-' + name.replace(/\s+/g, '-').toLowerCase();
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id   = id;
  link.rel  = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:ital,wght@0,300;0,400;0,700;1,400&display=swap`;
  document.head.appendChild(link);
}

async function persistCustomFonts() {
  await window.editorAPI.setSettings({ customFonts });
}

function registerCustomFont(name, cat) {
  if (FONTS.some(f => f.name === name)) return;
  FONTS.push({ name, cat });
  customFonts.push({ name, cat });
  buildFontPicker();
  persistCustomFonts();
}

function unregisterCustomFont(name) {
  const idx = FONTS.findIndex(f => f.name === name);
  if (idx !== -1) FONTS.splice(idx, 1);
  customFonts = customFonts.filter(f => f.name !== name);
  buildFontPicker();
  persistCustomFonts();
}

function renderFontList() {
  const el = document.getElementById('fm-list');
  if (!customFonts.length) {
    el.innerHTML = '<div class="fm-empty">No custom fonts added yet.</div>';
    return;
  }
  el.innerHTML = customFonts.map(f =>
    `<div class="fm-entry">
       <span class="fm-entry-name" style="font-family:'${f.name}',sans-serif">${f.name}</span>
       <span class="fm-cat-badge">${f.cat}</span>
       <button class="fm-remove" data-name="${f.name}" title="Remove">âœ•</button>
     </div>`
  ).join('');
  el.querySelectorAll('.fm-remove').forEach(btn =>
    btn.addEventListener('click', () => {
      unregisterCustomFont(btn.dataset.name);
      renderFontList();
    })
  );
}

async function loadFontPreview(name) {
  const previewEl  = document.getElementById('fm-preview');
  const previewTxt = document.getElementById('fm-preview-text');
  const previewErr = document.getElementById('fm-preview-error');
  const addRow     = document.getElementById('fm-add-row');
  previewEl.classList.add('visible');
  previewTxt.textContent = '';
  previewErr.textContent = '';
  addRow.style.display   = 'none';
  injectGoogleFont(name);
  try {
    await document.fonts.load(`400 18px '${name}'`);
    if (!document.fonts.check(`400 18px '${name}'`)) throw new Error('not loaded');
    previewTxt.style.fontFamily = `'${name}', sans-serif`;
    previewTxt.textContent = `${name}: Arangetram 2025`;
    document.getElementById('fm-add').dataset.name = name;
    addRow.style.display = 'flex';
  } catch {
    previewErr.textContent = `"${name}" not found. Check the exact name at fonts.google.com`;
  }
}

function openFontManager() {
  const overlay = document.getElementById('font-mgr-overlay');
  overlay.classList.add('open');
  document.getElementById('fm-name').value = '';
  document.getElementById('fm-preview').classList.remove('visible');
  document.getElementById('fm-add-row').style.display = 'none';
  renderFontList();
  document.getElementById('fm-name').focus();
}

function closeFontManager() {
  document.getElementById('font-mgr-overlay').classList.remove('open');
}

function bindFontManager() {
  document.getElementById('btn-font-mgr').addEventListener('click', openFontManager);
  document.getElementById('fm-close').addEventListener('click', closeFontManager);

  document.getElementById('font-mgr-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('font-mgr-overlay')) closeFontManager();
  });

  document.getElementById('fm-load').addEventListener('click', async () => {
    const name = document.getElementById('fm-name').value.trim();
    if (!name) return;
    const btn = document.getElementById('fm-load');
    btn.textContent = 'â€¦';
    btn.disabled = true;
    await loadFontPreview(name);
    btn.textContent = 'Load';
    btn.disabled = false;
  });

  document.getElementById('fm-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('fm-load').click();
  });

  document.getElementById('fm-add').addEventListener('click', () => {
    const name = document.getElementById('fm-add').dataset.name;
    const cat  = document.getElementById('fm-cat').value;
    if (!name) return;
    if (FONTS.some(f => f.name === name)) {
      document.getElementById('fm-preview-error').textContent = `"${name}" is already in the picker.`;
      return;
    }
    registerCustomFont(name, cat);
    renderFontList();
    document.getElementById('fm-add-row').style.display = 'none';
    document.getElementById('fm-preview').classList.remove('visible');
    document.getElementById('fm-name').value = '';
    document.getElementById('fm-name').focus();
  });
}

/* â”€â”€ Shadow presets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const SHADOW_PRESETS = {
  drop:        { color: 'rgba(0,0,0,0.5)',       blur: 6,  offsetX: 3,  offsetY: 3  },
  soft:        { color: 'rgba(0,0,0,0.3)',       blur: 14, offsetX: 0,  offsetY: 5  },
  'glow-gold': { color: 'rgba(212,175,55,0.85)', blur: 20, offsetX: 0,  offsetY: 0  },
  'glow-white':{ color: 'rgba(255,255,255,0.9)', blur: 20, offsetX: 0,  offsetY: 0  },
};

/* â”€â”€ Background helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function makeTextureSVG(type, fg, bg) {
  const enc = s => encodeURIComponent(s);
  const svgs = {
    dots:      `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${bg}"/><circle cx="10" cy="10" r="3" fill="${fg}"/></svg>`,
    lines:     `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${bg}"/><line x1="0" y1="10" x2="20" y2="10" stroke="${fg}" stroke-width="1.5"/></svg>`,
    crosshatch:`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${bg}"/><line x1="0" y1="10" x2="20" y2="10" stroke="${fg}" stroke-width="1"/><line x1="10" y1="0" x2="10" y2="20" stroke="${fg}" stroke-width="1"/></svg>`,
    stripes:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${bg}"/><rect width="10" height="20" fill="${fg}" opacity="0.4"/></svg>`,
    waves:     `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="${bg}"/><path d="M0,13 Q10,7 20,13 Q30,19 40,13" stroke="${fg}" stroke-width="2" fill="none"/></svg>`,
  };
  return 'data:image/svg+xml;charset=utf-8,' + enc(svgs[type] || svgs.dots);
}

function makeFabricGradient(type, c1, c2, dir, w, h) {
  const dirCoords = {
    'to bottom':       { x1:0, y1:0, x2:0, y2:h },
    'to right':        { x1:0, y1:0, x2:w, y2:0 },
    'to bottom right': { x1:0, y1:0, x2:w, y2:h },
    'to top right':    { x1:0, y1:h, x2:w, y2:0 },
  };
  if (type === 'linear') {
    return new fabric.Gradient({
      type: 'linear', gradientUnits: 'pixels',
      coords: dirCoords[dir] || dirCoords['to bottom'],
      colorStops: [{ offset:0, color:c1 }, { offset:1, color:c2 }],
    });
  }
  const r = Math.max(w, h) / 2;
  return new fabric.Gradient({
    type: 'radial', gradientUnits: 'pixels',
    coords: { r1:0, r2:r, x1:w/2, y1:h/2, x2:w/2, y2:h/2 },
    colorStops: [{ offset:0, color:c1 }, { offset:1, color:c2 }],
  });
}

function sectionBgCSS(sec) {
  const type = sec.bgType || 'solid';
  if (type === 'linear')
    return `background:linear-gradient(${sec.bgGradDir||'to bottom'},${sec.bgGrad1||'#ffffff'},${sec.bgGrad2||'#000000'});`;
  if (type === 'radial')
    return `background:radial-gradient(circle,${sec.bgGrad1||'#ffffff'},${sec.bgGrad2||'#000000'});`;
  if (type === 'texture') {
    const url = makeTextureSVG(sec.bgTexture||'dots', sec.bgTexFg||'#c9a84c', sec.bgTexBg||'#5a0a2e');
    return `background:url("${url}") repeat,${sec.bgTexBg||'#5a0a2e'};`;
  }
  return `background-color:${sec.bg||'#ffffff'};`;
}

function shadowToCSS(shadow) {
  if (!shadow) return '';
  const s = typeof shadow === 'object' ? shadow : {};
  const ox = s.offsetX || 0, oy = s.offsetY || 0, b = s.blur || 0, c = s.color || 'rgba(0,0,0,0.5)';
  return `text-shadow:${ox}px ${oy}px ${b}px ${c};`;
}

const DEFAULT_SECTIONS = [
  { label: 'Cover',            height: 700, bg: '#5a0a2e' },
  { label: 'Welcome',          height: 500, bg: '#fff8f2' },
  { label: 'About Performer',  height: 600, bg: '#fff8f2' },
  { label: 'Guru',             height: 500, bg: '#fffaf5' },
  { label: 'Nattuvanar',       height: 400, bg: '#fffaf5' },
  { label: 'Mridangam',        height: 400, bg: '#fffaf5' },
  { label: 'Violin',           height: 400, bg: '#fffaf5' },
  { label: 'Dance Items',      height: 800, bg: '#fff8f2' },
  { label: 'Acknowledgements', height: 500, bg: '#fff8f2' },
  { label: 'Gallery',          height: 600, bg: '#1a1a1a' },
  { label: 'Sponsors',         height: 400, bg: '#fff8f2' },
  { label: 'Back Cover',       height: 700, bg: '#5a0a2e' },
];

/* â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
let sections    = [];
let activeSec   = -1;
let canvas      = null;
let zoom        = 1;
let projectPath = null;
let dirty       = false;
let history     = [];
let historyIdx  = [];
let removeBgFn  = null;
let clipboard   = null;   // stores cloned Fabric objects for copy/paste
let pasteOffset = 0;      // cumulative paste offset so repeated pastes don't stack exactly
let _sectionGen     = 0;     // incremented on every switchSection to discard stale async callbacks
let _sectionLoading = 0;     // >0 while enlivenObjects calls are in-flight; blocks snapshotCurrentSection
let _suppressHistoryPush = false; // true while applyGlow/applyGlitter are mutating canvas objects
let _glowDrag  = null; // { glowId } while user is dragging a glow handle
let _cropState = null; // { obj, scale, imgW, imgH, dispW, dispH, cropX, cropY, cropW, cropH }

/* â”€â”€ Text style presets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const DEFAULT_TEXT_STYLES = [
  { id: 'ts_1', name: 'Title',    fontFamily: 'Playfair Display',   fontSize: 48, fontWeight: 'bold',   fontStyle: 'normal', color: '#ffffff', textAlign: 'center' },
  { id: 'ts_2', name: 'Subtitle', fontFamily: 'Cormorant Garamond', fontSize: 28, fontWeight: 'normal', fontStyle: 'italic', color: '#c9a84c', textAlign: 'center' },
  { id: 'ts_3', name: 'Body',     fontFamily: 'Lora',               fontSize: 16, fontWeight: 'normal', fontStyle: 'normal', color: '#ffffff', textAlign: 'left'   },
  { id: 'ts_4', name: 'Caption',  fontFamily: 'Lato',               fontSize: 13, fontWeight: 'normal', fontStyle: 'normal', color: '#cccccc', textAlign: 'left'   },
  { id: 'ts_5', name: 'Heading',  fontFamily: 'Cinzel',             fontSize: 24, fontWeight: 'bold',   fontStyle: 'normal', color: '#c9a84c', textAlign: 'left'   },
];
let textStyles = DEFAULT_TEXT_STYLES.map(s => ({ ...s }));

/* â”€â”€ Font picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function buildFontPicker() {
  const sel = document.getElementById('prop-font-family');
  sel.innerHTML = '';
  let currentCat = '';
  for (const f of FONTS) {
    if (f.cat !== currentCat) {
      const og = document.createElement('optgroup');
      og.label = f.cat;
      sel.appendChild(og);
      currentCat = f.cat;
    }
    const opt = document.createElement('option');
    opt.value = f.name;
    opt.textContent = f.name;
    opt.style.fontFamily = `'${f.name}', serif`;
    sel.lastChild.appendChild(opt);
  }
}

/* â”€â”€ Fabric canvas init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
// Disable per-object bitmap caches. Without this, Fabric builds each object's
// texture at its natural size and stretches it at non-1Ã— zoom, causing blurry
// text. Disabling caching makes Fabric redraw every object directly each frame â€”
// fine for a brochure with â‰¤50 objects.
fabric.Object.prototype.objectCaching = false;

// Patch Textbox.initDimensions to apply CSS-based word-spacing after Fabric's
// own enlargeSpaces() runs. enlargeSpaces() uses Canvas2D font metrics (no
// ligatures) â†’ near-zero surplus â†’ invisible justification.  The CSS DOM
// measurement correctly accounts for ligatures, giving visible word-spacing
// that matches what text-align:justify produces in the HTML export.
(function patchTextboxJustification() {
  const _orig = fabric.Textbox.prototype.initDimensions;
  fabric.Textbox.prototype.initDimensions = function() {
    _orig.call(this);
    if (this.textAlign && this.textAlign.indexOf('justify') !== -1 && !this.isEditing) {
      applyCSSJustification(this);
    }
  };
})();

// Grayscale via ctx.filter â€” avoids the filter pipeline (which needs getImageData
// and fails on asset:// images due to canvas taint). ctx.save/restore brackets the
// filter so it is automatically cleared after the image is drawn.
(function patchGrayscaleRender() {
  const orig = fabric.Image.prototype._renderFill;
  fabric.Image.prototype._renderFill = function(ctx) {
    if (this._grayscale) {
      ctx.save();
      ctx.filter = 'grayscale(100%)';
      orig.call(this, ctx);
      ctx.restore();
    } else {
      orig.call(this, ctx);
    }
  };
})();

function initCanvas() {
  // Fabric's default NUM_FRACTION_DIGITS=2 rounds scaleX/scaleY to 2 d.p. on toJSON,
  // which discards small resize changes (e.g. 0.1136 â†’ 0.11) causing scale to revert
  // on every section switch. 4 d.p. is sub-pixel precision for any realistic canvas scale.
  fabric.Object.NUM_FRACTION_DIGITS = 4;

  canvas = new fabric.Canvas('c', {
    width:  CANVAS_W,
    height: 600,
    backgroundColor: '#ffffff',
    preserveObjectStacking: true,
    selection: true,
  });
  canvas.on('after:render',        drawSafeMarginGuide);
  canvas.on('selection:created',  updateToolbar);
  canvas.on('selection:updated',  updateToolbar);
  canvas.on('selection:cleared',  updateToolbar);
  canvas.on('object:modified', e => {
    const obj = e.target;
    if (obj && obj._isGlow) return; // glow objects are managed separately
    if (obj) snapObjToPixel(obj);
    normaliseTextScale(obj);
    onCanvasChange();
  });

  // â”€â”€ Glow drag â€” custom hit test so z-order doesn't matter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Handles are non-evented visual markers; drag is detected here via proximity.
  const GLOW_HIT_R = 20; // px â€” click radius that activates glow drag
  canvas.on('mouse:down', e => {
    if (activeSec < 0) return;
    const sec = sections[activeSec];
    const glows = sec.bgGlows || [];
    if (!glows.length) return;
    const ptr = canvas.getPointer(e.e);
    const cw = CANVAS_W, ch = sec.height || 700;
    for (const glow of glows) {
      const cx = cw * (glow.x !== undefined ? glow.x : 0.5);
      const cy = ch * (glow.y !== undefined ? glow.y : 0.5);
      if (Math.hypot(ptr.x - cx, ptr.y - cy) <= GLOW_HIT_R) {
        _glowDrag = { glowId: glow.id };
        // Cancel Fabric's drag/selection state so the nearby user object isn't moved.
        canvas._currentTransform = null;  // abort any object-move Fabric already queued
        canvas._groupSelector = null;     // abort any selection-rect Fabric queued
        canvas.selection = false;
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        break;
      }
    }
  });
  canvas.on('mouse:move', e => {
    // Hover cursor â€” show 'move' when near a glow handle (no drag in progress).
    if (!_glowDrag && activeSec >= 0) {
      const sec = sections[activeSec];
      const glows = sec.bgGlows || [];
      const ptr = canvas.getPointer(e.e);
      const cw = CANVAS_W, ch = sec.height || 700;
      const nearGlow = glows.some(g => {
        const cx = cw * (g.x !== undefined ? g.x : 0.5);
        const cy = ch * (g.y !== undefined ? g.y : 0.5);
        return Math.hypot(ptr.x - cx, ptr.y - cy) <= GLOW_HIT_R;
      });
      canvas.defaultCursor = nearGlow ? 'move' : 'default';
    }
    if (!_glowDrag || activeSec < 0) return;
    // Clear any selection rect that snuck through before the flag was set.
    if (canvas._groupSelector) { canvas._groupSelector = null; canvas.requestRenderAll(); }
    const sec = sections[activeSec];
    const glow = (sec.bgGlows || []).find(g => g.id === _glowDrag.glowId);
    if (!glow) return;
    const ptr = canvas.getPointer(e.e);
    const cw = CANVAS_W, ch = sec.height || 700;
    glow.x = Math.max(0, Math.min(1, ptr.x / cw));
    glow.y = Math.max(0, Math.min(1, ptr.y / ch));
    // Replace this glow's visual and handle position in place (no full rebuild).
    _suppressHistoryPush = true;
    const visObj = canvas.getObjects().find(o => o._isGlowVisual && o._glowId === glow.id);
    if (visObj) {
      const idx = canvas.getObjects().indexOf(visObj);
      canvas.remove(visObj);
      const newVis = _renderGlowImage(glow, cw, ch);
      canvas.insertAt(newVis, idx);
    }
    const hdl = canvas.getObjects().find(o => o._isGlowHandle && o._glowId === glow.id);
    if (hdl) { hdl.set({ left: ptr.x, top: ptr.y }); hdl.setCoords(); }
    _suppressHistoryPush = false;
    applyGlitter(sec);
    canvas.requestRenderAll();
    markDirty();
  });
  canvas.on('mouse:up', () => {
    if (!_glowDrag) return;
    _glowDrag = null;
    canvas.selection = true;
    canvas.defaultCursor = 'default';
    if (activeSec >= 0) applyGlow(sections[activeSec]); // full rebuild for clean state
  });

  canvas.on('object:added',       onCanvasChange);
  canvas.on('object:removed',     onCanvasChange);
}

/* â”€â”€ Section list UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderSectionList() {
  const ul = document.getElementById('section-list');
  ul.innerHTML = '';
  sections.forEach((sec, i) => {
    const li = document.createElement('li');
    if (i === activeSec) li.classList.add('active');

    const handle = document.createElement('span');
    handle.className = 'section-drag-handle';
    handle.textContent = 'â ¿';
    handle.draggable = true;
    handle.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', String(i));
      e.dataTransfer.effectAllowed = 'move';
    });

    const label = document.createElement('span');
    label.className = 'section-label';
    label.textContent = sec.label;

    const btnUp = document.createElement('button');
    btnUp.className = 'section-move-btn';
    btnUp.textContent = 'â–²';
    btnUp.title = 'Move up';
    btnUp.disabled = i === 0;
    btnUp.addEventListener('click', e => { e.stopPropagation(); moveSectionTo(i, i - 1); });

    const btnDown = document.createElement('button');
    btnDown.className = 'section-move-btn';
    btnDown.textContent = 'â–¼';
    btnDown.title = 'Move down';
    btnDown.disabled = i === sections.length - 1;
    btnDown.addEventListener('click', e => { e.stopPropagation(); moveSectionTo(i, i + 1); });

    li.appendChild(handle);
    li.appendChild(label);
    li.appendChild(btnUp);
    li.appendChild(btnDown);
    li.addEventListener('click', () => switchSection(i));
    li.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    li.addEventListener('drop', e => {
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (from !== i) moveSectionTo(from, i);
    });
    ul.appendChild(li);
  });
}

function moveSectionTo(from, to) {
  snapshotCurrentSection();
  const [sec] = sections.splice(from, 1);
  const [h]   = history.splice(from, 1);
  const [hi]  = historyIdx.splice(from, 1);
  sections.splice(to, 0, sec);
  history.splice(to, 0, h);
  historyIdx.splice(to, 0, hi);
  if      (activeSec === from)                          activeSec = to;
  else if (from < activeSec && to >= activeSec)         activeSec--;
  else if (from > activeSec && to <= activeSec)         activeSec++;
  renderSectionList();
  renderSectionProps();
  markDirty();
}

/* â”€â”€ Background propagation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function bgSettingsFrom(src) {
  return {
    bgType: src.bgType || 'solid', bg: src.bg || '#ffffff',
    bgGrad1: src.bgGrad1, bgGrad2: src.bgGrad2, bgGradDir: src.bgGradDir,
    bgTexture: src.bgTexture, bgTexFg: src.bgTexFg, bgTexBg: src.bgTexBg,
    bgImage: src.bgImage || null, bgSize: src.bgSize || 'cover',
    bgGlows:   src.bgGlows ? src.bgGlows.map(g => ({ ...g })) : [],
    glitter:   src.glitter   ? { ...src.glitter   } : null,
  };
}

function applyBgTo(sec, settings) {
  Object.assign(sec, settings);
}

function propagateBgToAll(sourceSec) {
  const settings = bgSettingsFrom(sourceSec);
  sections.forEach((sec, i) => {
    if (sec === sourceSec) return;
    applyBgTo(sec, settings);
    if (i === activeSec) {
      applyCanvasBg(sec);
      if (sec.bgImage) {
        fabric.Image.fromURL(sec.bgImage, img => applyBgImageToCanvas(img, sec), { crossOrigin: 'anonymous' });
      } else {
        canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
      }
    }
  });
  markDirty();
}

/* â”€â”€ Canvas background image â€” match CSS background-size semantics â”€â”€â”€â”€â”€â”€â”€ */
function applyBgImageToCanvas(img, sec, targetCanvas, callback) {
  const W = CANVAS_W, H = sec.height;
  const bgSize = sec.bgSize || 'cover';
  let scaleX, scaleY;

  if (bgSize === 'contain') {
    const s = Math.min(W / img.width, H / img.height);
    scaleX = scaleY = s;
  } else if (bgSize === 'auto') {
    scaleX = scaleY = 1;
  } else {
    // 'cover' (default): scale to cover while preserving aspect ratio
    const s = Math.max(W / img.width, H / img.height);
    scaleX = scaleY = s;
  }

  const left = (W - img.width  * scaleX) / 2;
  const top  = (H - img.height * scaleY) / 2;
  const cv   = targetCanvas || canvas;
  const cb   = callback     || cv.renderAll.bind(cv);

  cv.setBackgroundImage(img, cb, { scaleX, scaleY, left, top, originX: 'left', originY: 'top' });
}

/* â”€â”€ Canvas background application â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function applyCanvasBg(sec) {
  const type = sec.bgType || 'solid';
  if (type === 'linear' || type === 'radial') {
    const grad = makeFabricGradient(type, sec.bgGrad1||'#ffffff', sec.bgGrad2||'#000000',
                                    sec.bgGradDir||'to bottom', CANVAS_W, sec.height);
    canvas.setBackgroundColor(grad, canvas.renderAll.bind(canvas));
  } else if (type === 'texture') {
    const url = makeTextureSVG(sec.bgTexture||'dots', sec.bgTexFg||'#c9a84c', sec.bgTexBg||'#5a0a2e');
    fabric.Image.fromURL(url, img => {
      const pat = new fabric.Pattern({ source: img.getElement(), repeat: 'repeat' });
      canvas.setBackgroundColor(pat, canvas.renderAll.bind(canvas));
    });
  } else {
    canvas.setBackgroundColor(sec.bg || '#ffffff', canvas.renderAll.bind(canvas));
  }
}

/* â”€â”€ Golden glow overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
// Renders each glow in sec.bgGlows as a radial-gradient fabric.Image (visual)
// plus a small draggable fabric.Circle handle (main canvas only, not during export).
// All glow objects are tagged _isGlow:true and filtered from sec.objects snapshots.

function _renderGlowImage(glow, cw, ch) {
  const cx = cw * (glow.x !== undefined ? glow.x : 0.5);
  const cy = ch * (glow.y !== undefined ? glow.y : 0.5);
  const r  = Math.sqrt(cw * cw + ch * ch) * Math.max(0.1, glow.area || 0.5);
  const alpha = Math.min(1, Math.max(0, glow.intensity || 0.6));
  const el  = document.createElement('canvas');
  el.width  = cw; el.height = ch;
  const ctx = el.getContext('2d');
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0,   `rgba(255,200,50,${alpha})`);
  grad.addColorStop(0.5, `rgba(255,180,30,${(alpha * 0.4).toFixed(3)})`);
  grad.addColorStop(1,   'rgba(255,160,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cw, ch);
  return new fabric.Image(el, {
    left: 0, top: 0, originX: 'left', originY: 'top',
    width: cw, height: ch, scaleX: 1, scaleY: 1,
    selectable: false, evented: false, hoverCursor: 'default',
    _isGlow: true, _glowId: glow.id, _isGlowVisual: true,
    _isGlowBg: !(glow.stackPos),  // stackPos=0 means behind all user objects
  });
}

function applyGlow(sec, fc) {
  _suppressHistoryPush = true;
  try {
    const cv = fc || canvas;
    cv.getObjects().filter(o => o._isGlow).forEach(o => cv.remove(o));
    const glows = sec.bgGlows || [];
    if (!glows.length) { cv.requestRenderAll(); return; }
    const cw = CANVAS_W;
    const ch = sec.height || 700;

    // Place each glow at its stackPos relative to user-content objects.
    // stackPos=0 â†’ behind all content; stackPos=1 â†’ above first content obj; etc.
    // Glows are inserted in ascending stackPos order so earlier insertions don't
    // shift the anchor index for later ones.
    const sortedGlows = [...glows].sort((a, b) => (a.stackPos || 0) - (b.stackPos || 0));
    sortedGlows.forEach(glow => {
      const sp = Math.max(0, glow.stackPos || 0);
      // Content objects = everything except glow and glitter layers.
      const allObjs  = cv.getObjects();
      const content  = allObjs.filter(o => !o._isGlow && !o._isGlitter);
      // Insert just before the sp-th content object; if sp >= count, append at end.
      const anchor   = content[sp];
      const insertAt = anchor ? allObjs.indexOf(anchor) : allObjs.length;

      cv.insertAt(_renderGlowImage(glow, cw, ch), insertAt);
      if (!fc) {
        const cx = cw * (glow.x !== undefined ? glow.x : 0.5);
        const cy = ch * (glow.y !== undefined ? glow.y : 0.5);
        cv.insertAt(new fabric.Circle({
          left: cx, top: cy, originX: 'center', originY: 'center',
          radius: 12, fill: 'rgba(255,200,50,0.45)',
          stroke: 'rgba(255,220,80,0.9)', strokeWidth: 2,
          selectable: false, evented: false, hoverCursor: 'default',
          _isGlow: true, _glowId: glow.id, _isGlowHandle: true,
        }), insertAt + 1);
      }
    });

    cv.requestRenderAll();
  } finally {
    _suppressHistoryPush = false;
  }
}

/* â”€â”€ Glitter / sun-rays overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
// Draws alternating wide/narrow radial rays for every glow in sec.bgGlows onto
// one off-screen canvas, then places the result as a fabric.Image just above the
// glow layer. Fixed LCG seed keeps ray layout stable across re-renders.
function applyGlitter(sec, fc) {
  _suppressHistoryPush = true;
  try {
    const cv = fc || canvas;
    cv.getObjects().filter(o => o._isGlitter).forEach(o => cv.remove(o));
    const g = sec.glitter;
    if (!g || !g.enabled) { cv.requestRenderAll(); return; }
    const glows = sec.bgGlows || [];
    if (!glows.length) { cv.requestRenderAll(); return; }

    const cw = CANVAS_W;
    const ch = sec.height || 700;
    const level   = g.level || 0.5;
    const numRays = Math.round(16 + level * 32) * 2; // always even so pairs align
    const step    = (Math.PI * 2) / numRays;

    const el  = document.createElement('canvas');
    el.width  = cw; el.height = ch;
    const ctx = el.getContext('2d');

    // Fixed-seed LCG for a stable rotation offset every render.
    let s = 0xA3F1B2C4;
    const rand = () => { s = Math.imul(s ^ (s >>> 15), s | 1); s ^= s + Math.imul(s ^ (s >>> 7), s | 61); return ((s ^ (s >>> 14)) >>> 0) / 0x100000000; };
    const baseAngle = rand() * Math.PI * 2;

    glows.forEach(glow => {
      const cx     = cw * (glow.x !== undefined ? glow.x : 0.5);
      const cy     = ch * (glow.y !== undefined ? glow.y : 0.5);
      const radius = Math.sqrt(cw * cw + ch * ch) * Math.max(0.1, glow.area || 0.5);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      for (let i = 0; i < numRays; i++) {
        const angle     = baseAngle + i * step;
        const isPrimary = i % 2 === 0;
        const halfSpan  = step * (isPrimary ? 0.38 : 0.18);
        const alpha     = isPrimary ? 0.25 + level * 0.35 : 0.1 + level * 0.2;
        const ex   = cx + Math.cos(angle) * radius;
        const ey   = cy + Math.sin(angle) * radius;
        const grad = ctx.createLinearGradient(cx, cy, ex, ey);
        grad.addColorStop(0,   `rgba(255,230,100,${alpha})`);
        grad.addColorStop(0.5, `rgba(255,200,50,${(alpha * 0.6).toFixed(3)})`);
        grad.addColorStop(1,   'rgba(255,180,30,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, angle - halfSpan, angle + halfSpan);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });

    const img = new fabric.Image(el, {
      left: 0, top: 0, originX: 'left', originY: 'top',
      width: cw, height: ch, scaleX: 1, scaleY: 1,
      selectable: false, evented: false, hoverCursor: 'default',
      _isGlitter: true,
    });
    // Insert above background (stackPos=0) glow layers but below user objects.
    const bgGlowCount = cv.getObjects().filter(o => o._isGlow && o._isGlowBg).length;
    cv.insertAt(img, bgGlowCount);
    cv.requestRenderAll();
  } finally {
    _suppressHistoryPush = false;
  }
}

/* â”€â”€ CSS-accurate justification for canvas text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function applyCSSJustification(obj) {
  const nLines = (obj._textLines || []).length;
  if (nLines <= 1) return; // single-line: Fabric's justify-left rightly left-aligns it

  for (let a = 0; a < nLines; a++) {
    // Skip: last line of the whole textbox, or last line of each paragraph
    if (a === nLines - 1) continue;
    if (obj.isEndOfWrapping && obj.isEndOfWrapping(a)) continue;

    const line     = obj._textLines[a];
    const lineText = line.join('');
    const spaces   = (lineText.match(/[ \t]/g) || []);
    if (spaces.length === 0) continue;

    // Reset __charBounds[a] to natural Canvas2D widths; measureLine returns { width }
    // which is the sum of those charBounds â€” the true Canvas2D line width.
    // Using CSS-measured width for surplus overshoots because CSS measures narrower
    // (ligatures collapse glyphs) while charBounds are Canvas2D-based, causing the
    // last character to overflow. Using the Canvas2D width keeps charBounds exact.
    const metrics = obj.measureLine(a);
    const surplus = obj.width - metrics.width;
    if (surplus <= 0.5) continue;

    const extra = surplus / spaces.length;

    // Apply extra width to every space char in __charBounds[a].
    // Also shift subsequent chars' left values for cursor accuracy.
    let offsetLeft = 0;
    for (let h = 0; h <= line.length; h++) {
      const s = obj.__charBounds[a] && obj.__charBounds[a][h];
      if (!s) continue;
      if (h < line.length && /[ \t]/.test(line[h])) {
        s.width       += extra;
        s.kernedWidth += extra;
        s.left        += offsetLeft;
        offsetLeft    += extra;
      } else {
        s.left += offsetLeft;
      }
    }
  }
}

/* â”€â”€ Switch active section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function switchSection(idx) {
  if (idx === activeSec) return;
  clearTimeout(_recoveryTimer); // cancel pending recovery save before navigating away
  snapshotCurrentSection();
  activeSec = idx;
  const sec = sections[idx];
  const gen = ++_sectionGen; // any prior async callbacks with a stale gen will self-abort

  canvas.setHeight(Math.round(sec.height * zoom));
  const _host = document.getElementById('canvas-host');
  if (_host) { _host.scrollTop = 0; _host.scrollLeft = 0; }

  // loadFromJSON clears backgroundColor â€” applyCanvasBg must run AFTER it completes.
  const afterLoad = () => {
    applyCanvasBg(sec);
    if (sec.bgImage) {
      fabric.Image.fromURL(sec.bgImage, img => {
        if (gen !== _sectionGen) return; // stale: another switchSection ran
        applyBgImageToCanvas(img, sec);
      }, { crossOrigin: 'anonymous' });
    } else {
      canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
    }
    applyGlow(sec);
    applyGlitter(sec);
    // Re-render once the section's web fonts are confirmed loaded.
    // document.fonts.ready is unreliable for lazily-loaded @font-face â€” it resolves
    // immediately if nothing is actively downloading. Use explicit per-font loads.
    const sectionFonts = new Set();
    canvas.getObjects().forEach(obj => {
      if ((obj.type === 'textbox' || obj.type === 'i-text') && obj.fontFamily && GOOGLE_FONTS.has(obj.fontFamily)) {
        sectionFonts.add(obj.fontFamily);
      }
    });
    const fontLoads = [];
    sectionFonts.forEach(ff => {
      ['400', '700', 'italic 400'].forEach(v => fontLoads.push(document.fonts.load(`${v} 16px "${ff}"`).catch(() => {})));
    });
    Promise.all(fontLoads).then(() => {
      if (gen !== _sectionGen) return; // stale: user already navigated to a different section
      canvas.getObjects().forEach(obj => {
        if (obj.type === 'textbox' || obj.type === 'i-text') {
          obj.dirty = true;
          obj.initDimensions(); // monkey-patched: calls applyCSSJustification internally
        }
      });
      canvas.requestRenderAll();
    });
  };

  canvas.off('object:added',   onCanvasChange);
  canvas.off('object:removed', onCanvasChange);
  canvas.remove(...canvas.getObjects());
  if (sec.objects && sec.objects.length) {
    _sectionLoading++;
    // Use enlivenObjects instead of loadFromJSON so that canvas.clear() is never
    // called internally by Fabric â€” the gen-check runs before any canvas mutation,
    // eliminating the race where a stale callback fires object:removed on the live canvas.
    fabric.util.enlivenObjects(sec.objects, (enlivenedObjects) => {
      _sectionLoading = Math.max(0, _sectionLoading - 1);
      if (gen !== _sectionGen) return; // stale switch â€” discard; canvas already cleared above
      const prev = canvas.renderOnAddRemove;
      canvas.renderOnAddRemove = false;
      enlivenedObjects.forEach(obj => canvas.add(obj));
      canvas.renderOnAddRemove = prev;
      canvas.getObjects().forEach(snapObjToPixel);
      canvas.renderAll();
      afterLoad();
      canvas.on('object:added',   onCanvasChange);
      canvas.on('object:removed', onCanvasChange);
    }, 'fabric');
  } else {
    afterLoad();
    canvas.on('object:added',   onCanvasChange);
    canvas.on('object:removed', onCanvasChange);
  }

  renderSectionList();
  renderSectionProps();
  updateToolbar();
}

function saveCurrentSectionObjects() {
  if (activeSec < 0 || activeSec >= sections.length) return;
  if (_sectionLoading > 0) return; // don't overwrite section data while enlivenObjects is in flight
  sections[activeSec].objects = canvas.toJSON(CANVAS_JSON_PROPS).objects.filter(o => !o._isGlow && !o._isGlitter);
}

// Use for explicit snapshots only (save / preview / export / section switch).
// Calls discardActiveObject() once so Fabric runs _restoreObjectsState() and
// converts any group-relative coords back to absolute before serialising.
// Do NOT call this from onCanvasChange â€” the repeated qrDecompose accumulates
// floating-point drift that visibly resizes objects.
function snapshotCurrentSection() {
  if (activeSec < 0 || activeSec >= sections.length) return;
  if (_sectionLoading > 0) return; // canvas is mid-load; objects are not yet valid
  const active = canvas.getActiveObject();
  if (active && active.type === 'activeSelection') {
    // discardActiveObject converts group-relative coords back to absolute so toJSON
    // captures the correct positions.  We do NOT recreate the ActiveSelection
    // afterwards: the round-trip (absolute â†’ group-relative â†’ absolute) goes through
    // qrDecompose twice and compounds floating-point errors by 3-4 px per navigation,
    // which visibly drifts objects across the canvas over time.
    canvas.discardActiveObject();
  }
  sections[activeSec].objects = canvas.toJSON(CANVAS_JSON_PROPS).objects.filter(o => !o._isGlow && !o._isGlitter);
}

/* â”€â”€ Glow list UI (dynamic per-section) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderGlowList(sec) {
  const list = document.getElementById('sp-glow-list');
  list.innerHTML = '';
  (sec.bgGlows || []).forEach((glow, idx) => {
    const div = document.createElement('div');
    div.style.cssText = 'border:1px solid #555;border-radius:4px;padding:4px 6px;background:#2a2a2a;margin-top:4px';
    const sp = glow.stackPos || 0;
    div.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
        <span style="font-size:11px;color:#ffd700;font-weight:600">Glow ${idx + 1}</span>
        <div style="display:flex;gap:3px;align-items:center">
          <button class="glow-bg" title="Send one layer back" style="padding:1px 6px;font-size:12px;border:none;border-radius:3px;cursor:pointer;background:#555;color:#fff">â–¼</button>
          <span class="glow-level" style="font-size:10px;color:#aaa;min-width:18px;text-align:center">${sp}</span>
          <button class="glow-fg" title="Bring one layer forward" style="padding:1px 6px;font-size:12px;border:none;border-radius:3px;cursor:pointer;background:#555;color:#fff">â–²</button>
          <button class="glow-rm" style="padding:1px 6px;font-size:11px;border:none;border-radius:3px;cursor:pointer;background:#555;color:#fff">âœ•</button>
        </div>
      </div>
      <label style="display:block;font-size:11px;color:#ccc">Intensity
        <input type="range" class="glow-intensity" min="0" max="100" value="${Math.round((glow.intensity || 0.6) * 100)}" style="width:100%;margin-top:2px">
      </label>
      <label style="display:block;font-size:11px;color:#ccc;margin-top:3px">Area
        <input type="range" class="glow-area" min="10" max="100" value="${Math.round((glow.area || 0.5) * 100)}" style="width:100%;margin-top:2px">
      </label>
    `;
    div.querySelector('.glow-bg').addEventListener('click', () => {
      if (activeSec < 0) return;
      glow.stackPos = Math.max(0, (glow.stackPos || 0) - 1);
      renderGlowList(sec);
      applyGlow(sec);
      applyGlitter(sec);
      markDirty();
    });
    div.querySelector('.glow-fg').addEventListener('click', () => {
      if (activeSec < 0) return;
      glow.stackPos = (glow.stackPos || 0) + 1;
      renderGlowList(sec);
      applyGlow(sec);
      applyGlitter(sec);
      markDirty();
    });
    div.querySelector('.glow-rm').addEventListener('click', () => {
      if (activeSec < 0) return;
      sec.bgGlows.splice(idx, 1);
      renderGlowList(sec);
      applyGlow(sec);
      applyGlitter(sec);
      markDirty();
    });
    div.querySelector('.glow-intensity').addEventListener('input', e => {
      if (activeSec < 0) return;
      glow.intensity = parseInt(e.target.value, 10) / 100;
      applyGlow(sec);
      applyGlitter(sec);
      markDirty();
    });
    div.querySelector('.glow-area').addEventListener('input', e => {
      if (activeSec < 0) return;
      glow.area = parseInt(e.target.value, 10) / 100;
      applyGlow(sec);
      applyGlitter(sec);
      markDirty();
    });
    list.appendChild(div);
  });
}

/* â”€â”€ Section props panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderSectionProps() {
  if (activeSec < 0) return;
  const sec = sections[activeSec];
  document.getElementById('sp-label').value    = sec.label;
  document.getElementById('sp-height').value   = sec.height;
  document.getElementById('sp-bg-color').value = sec.bg || '#ffffff';
  document.getElementById('sp-bg-size').value  = sec.bgSize || 'cover';

  const type = sec.bgType || 'solid';
  document.getElementById('sp-bg-type').value = type;
  document.getElementById('sp-bg-solid-row').style.display   = (type === 'solid')   ? '' : 'none';
  document.getElementById('sp-bg-grad-row').style.display    = (type === 'linear' || type === 'radial') ? '' : 'none';
  document.getElementById('sp-bg-texture-row').style.display = (type === 'texture') ? '' : 'none';

  document.getElementById('sp-bg-grad1').value    = sec.bgGrad1    || '#5a0a2e';
  document.getElementById('sp-bg-grad2').value    = sec.bgGrad2    || '#c9a84c';
  document.getElementById('sp-bg-grad-dir').value = sec.bgGradDir  || 'to bottom';
  document.getElementById('sp-bg-texture').value  = sec.bgTexture  || 'dots';
  document.getElementById('sp-bg-tex-fg').value   = sec.bgTexFg    || '#c9a84c';
  document.getElementById('sp-bg-tex-bg').value   = sec.bgTexBg    || '#5a0a2e';

  // hide grad-dir if radial (direction doesn't apply)
  document.getElementById('sp-bg-grad-dir').style.display = (type === 'radial') ? 'none' : '';

  renderGlowList(sec);

  const gli = sec.glitter || {};
  document.getElementById('sp-glitter-enabled').checked = !!gli.enabled;
  document.getElementById('sp-glitter-level').value     = Math.round((gli.level || 0.5) * 100);
  document.getElementById('sp-glitter-settings').style.display = gli.enabled ? '' : 'none';
}

function bindSectionProps() {
  document.getElementById('sp-label').addEventListener('input', e => {
    if (activeSec < 0) return;
    sections[activeSec].label = e.target.value;
    renderSectionList();
    markDirty();
  });
  document.getElementById('sp-height').addEventListener('change', e => {
    if (activeSec < 0) return;
    const h = Math.max(200, Math.min(4000, parseInt(e.target.value, 10) || 700));
    sections[activeSec].height = h;
    canvas.setHeight(Math.round(h * zoom));
    canvas.renderAll();
    markDirty();
  });
  // BG type selector
  document.getElementById('sp-bg-type').addEventListener('change', e => {
    if (activeSec < 0) return;
    sections[activeSec].bgType = e.target.value;
    renderSectionProps();
    applyCanvasBg(sections[activeSec]);
    markDirty();
  });

  // Solid color
  document.getElementById('sp-bg-color').addEventListener('input', e => {
    if (activeSec < 0) return;
    sections[activeSec].bg = e.target.value;
    applyCanvasBg(sections[activeSec]);
    markDirty();
  });

  // Gradient controls
  const onGradChange = () => {
    if (activeSec < 0) return;
    const sec = sections[activeSec];
    sec.bgGrad1   = document.getElementById('sp-bg-grad1').value;
    sec.bgGrad2   = document.getElementById('sp-bg-grad2').value;
    sec.bgGradDir = document.getElementById('sp-bg-grad-dir').value;
    applyCanvasBg(sec);
    markDirty();
  };
  document.getElementById('sp-bg-grad1').addEventListener('input', onGradChange);
  document.getElementById('sp-bg-grad2').addEventListener('input', onGradChange);
  document.getElementById('sp-bg-grad-dir').addEventListener('change', onGradChange);

  // Texture controls
  const onTexChange = () => {
    if (activeSec < 0) return;
    const sec = sections[activeSec];
    sec.bgTexture = document.getElementById('sp-bg-texture').value;
    sec.bgTexFg   = document.getElementById('sp-bg-tex-fg').value;
    sec.bgTexBg   = document.getElementById('sp-bg-tex-bg').value;
    applyCanvasBg(sec);
    markDirty();
  };
  document.getElementById('sp-bg-texture').addEventListener('change', onTexChange);
  document.getElementById('sp-bg-tex-fg').addEventListener('input', onTexChange);
  document.getElementById('sp-bg-tex-bg').addEventListener('input', onTexChange);

  document.getElementById('sp-bg-size').addEventListener('change', e => {
    if (activeSec < 0) return;
    sections[activeSec].bgSize = e.target.value;
    markDirty();
  });

  // Golden glow controls â€” dynamic per-glow list rendered by renderGlowList()
  document.getElementById('btn-add-glow').addEventListener('click', () => {
    if (activeSec < 0) return;
    const sec = sections[activeSec];
    if (!sec.bgGlows) sec.bgGlows = [];
    sec.bgGlows.push({ id: `glow-${Date.now()}`, intensity: 0.6, area: 0.5, x: 0.5, y: 0.5, stackPos: 0 });
    renderGlowList(sec);
    applyGlow(sec);
    applyGlitter(sec);
    markDirty();
  });

  // Glitter controls
  const getGlitter = () => {
    const sec = sections[activeSec];
    if (!sec.glitter) sec.glitter = { enabled: false, level: 0.5 };
    return sec.glitter;
  };
  document.getElementById('sp-glitter-enabled').addEventListener('change', e => {
    if (activeSec < 0) return;
    getGlitter().enabled = e.target.checked;
    document.getElementById('sp-glitter-settings').style.display = e.target.checked ? '' : 'none';
    applyGlitter(sections[activeSec]);
    markDirty();
  });
  document.getElementById('sp-glitter-level').addEventListener('input', e => {
    if (activeSec < 0) return;
    getGlitter().level = parseInt(e.target.value, 10) / 100;
    applyGlitter(sections[activeSec]);
    markDirty();
  });
  document.getElementById('sp-bg-image-btn').addEventListener('click', async () => {
    if (activeSec < 0) return;
    const imgs = await window.editorAPI.openImages();
    if (!imgs.length) return;
    const assetName = await window.editorAPI.importAsset(imgs[0].srcPath);
    const assetUrl  = 'asset://' + assetName;
    sections[activeSec].bgImage = assetUrl;
    fabric.Image.fromURL(assetUrl, img => applyBgImageToCanvas(img, sections[activeSec]), { crossOrigin: 'anonymous' });
    markDirty();
  });
  document.getElementById('sp-bg-clear-btn').addEventListener('click', () => {
    if (activeSec < 0) return;
    sections[activeSec].bgImage = null;
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
    markDirty();
  });
  document.getElementById('btn-apply-bg-all').addEventListener('click', () => {
    if (activeSec < 0) return;
    propagateBgToAll(sections[activeSec]);
    setStatus('Background applied to all sections.');
  });

  document.getElementById('btn-delete-section').addEventListener('click', () => {
    if (sections.length <= 1) { setStatus('Cannot delete the only section.'); return; }
    if (!confirm(`Delete section "${sections[activeSec].label}"?`)) return;
    // Compute target BEFORE splice (length-2 pre-splice == length-1 post-splice).
    const newActive = Math.min(activeSec, sections.length - 2);
    sections.splice(activeSec, 1);
    history.splice(activeSec, 1);
    historyIdx.splice(activeSec, 1);
    // Reset to -1 so switchSection doesn't early-return (idx === activeSec guard)
    // and snapshotCurrentSection skips saving the now-stale canvas.
    activeSec = -1;
    switchSection(newActive);
    markDirty();
  });
}

/* â”€â”€ Add section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function addSection() {
  snapshotCurrentSection();
  const label   = 'Section ' + (sections.length + 1);
  const coverBg = sections.length ? bgSettingsFrom(sections[0]) : {};
  sections.push({ label, height: 600, objects: [], ...coverBg });
  history.push(['[]']);
  historyIdx.push(0);
  switchSection(sections.length - 1);
  markDirty();
  // Let the user rename immediately via the section panel
  setTimeout(() => {
    const inp = document.getElementById('sp-label');
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
}

/* â”€â”€ Toolbar context sensitivity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function updateToolbar() {
  const objs  = canvas.getActiveObjects();
  const obj   = objs.length === 1 ? objs[0] : null;
  const isText  = obj && (obj.type === 'i-text' || obj.type === 'textbox');
  const isImage = obj && obj.type === 'image';
  const isShape = obj && ['rect','circle','ellipse','triangle','polygon'].includes(obj.type);

  document.getElementById('tb-text-props').classList.toggle('active', isText);
  document.getElementById('tb-image-props').classList.toggle('active', isImage);
  document.getElementById('tb-shape-props').classList.toggle('active', isShape);
  document.getElementById('tb-align-props').classList.toggle('active', objs.length >= 2);

  if (!obj) return;

  if (isText) {
    setSelectVal('prop-font-family', obj.fontFamily || 'Playfair Display');
    document.getElementById('prop-font-size').value = Math.round(obj.fontSize || 24);
    document.getElementById('prop-bold').classList.toggle('on', obj.fontWeight === 'bold');
    document.getElementById('prop-italic').classList.toggle('on', obj.fontStyle === 'italic');
    document.getElementById('prop-underline').classList.toggle('on', !!obj.underline);
    document.getElementById('prop-fill').value = fabricColorToHex(obj.fill) || '#ffffff';
    setSelectVal('prop-align', obj.textAlign || 'left');
    const preset = obj._shadowPreset || '';
    setSelectVal('prop-shadow', preset);
    const showColor = preset === 'custom';
    document.getElementById('prop-shadow-color-wrap').style.display = showColor ? '' : 'none';
    if (obj._shadowColor) document.getElementById('prop-shadow-color').value = obj._shadowColor;
  }
  if (isImage) {
    document.getElementById('prop-opacity').value = Math.round((obj.opacity ?? 1) * 100);
    const hasBorder = (obj.strokeWidth || 0) > 0;
    document.getElementById('prop-border-on').checked = hasBorder;
    document.getElementById('prop-border-color').value = fabricColorToHex(obj.stroke) || '#000000';
    document.getElementById('prop-border-width').value = obj.strokeWidth || 1;
    document.getElementById('btn-grayscale').classList.toggle('on', !!obj._grayscale);
  }
  if (isShape) {
    document.getElementById('prop-shape-fill').value   = fabricColorToHex(obj.fill)   || '#c9a84c';
    document.getElementById('prop-shape-stroke').value = fabricColorToHex(obj.stroke) || '#000000';
    document.getElementById('prop-shape-stroke-width').value = obj.strokeWidth || 0;
    document.getElementById('prop-shape-opacity').value = Math.round((obj.opacity ?? 1) * 100);
  }
}

function setSelectVal(id, val) {
  const el = document.getElementById(id);
  for (const opt of el.options) {
    if (opt.value === val || opt.text === val) { el.value = opt.value; return; }
  }
}

function fabricColorToHex(color) {
  if (!color || color === 'transparent') return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  return '#000000';
}

/* â”€â”€ Toolbar bindings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function bindToolbar() {
  document.getElementById('btn-add-text').addEventListener('click', addText);
  document.getElementById('btn-add-image').addEventListener('click', addImages);
  document.getElementById('btn-add-rect').addEventListener('click', addRect);

  // Text
  document.getElementById('prop-font-family').addEventListener('change', e => applyText('fontFamily', e.target.value));
  document.getElementById('prop-font-size').addEventListener('change',   e => applyText('fontSize', parseInt(e.target.value, 10)));
  document.getElementById('prop-bold').addEventListener('click', () => {
    const obj = canvas.getActiveObject(); if (!obj) return;
    const next = obj.fontWeight === 'bold' ? 'normal' : 'bold';
    applyText('fontWeight', next);
    document.getElementById('prop-bold').classList.toggle('on', next === 'bold');
  });
  document.getElementById('prop-italic').addEventListener('click', () => {
    const obj = canvas.getActiveObject(); if (!obj) return;
    const next = obj.fontStyle === 'italic' ? 'normal' : 'italic';
    applyText('fontStyle', next);
    document.getElementById('prop-italic').classList.toggle('on', next === 'italic');
  });
  document.getElementById('prop-underline').addEventListener('click', () => {
    const obj = canvas.getActiveObject(); if (!obj) return;
    const next = !obj.underline;
    applyText('underline', next);
    document.getElementById('prop-underline').classList.toggle('on', next);
  });
  document.getElementById('prop-fill').addEventListener('input',  e => applyText('fill', e.target.value));
  document.getElementById('prop-align').addEventListener('change', e => applyText('textAlign', e.target.value));
  document.getElementById('prop-shadow').addEventListener('change', e => {
    const obj = canvas.getActiveObject(); if (!obj) return;
    const preset = e.target.value;
    obj._shadowPreset = preset;
    const wrap = document.getElementById('prop-shadow-color-wrap');
    if (!preset) {
      obj.set('shadow', null);
      wrap.style.display = 'none';
    } else if (preset === 'custom') {
      wrap.style.display = '';
      const col = document.getElementById('prop-shadow-color').value;
      obj._shadowColor = col;
      obj.set('shadow', new fabric.Shadow({ color: col, blur: 20, offsetX: 0, offsetY: 0 }));
    } else {
      wrap.style.display = 'none';
      obj.set('shadow', new fabric.Shadow(SHADOW_PRESETS[preset]));
    }
    canvas.renderAll(); onCanvasChange();
  });
  document.getElementById('prop-shadow-color').addEventListener('input', e => {
    const obj = canvas.getActiveObject(); if (!obj) return;
    obj._shadowColor = e.target.value;
    obj.set('shadow', new fabric.Shadow({ color: e.target.value, blur: 20, offsetX: 0, offsetY: 0 }));
    canvas.renderAll();
  });
  document.getElementById('prop-shadow-color').addEventListener('change', () => onCanvasChange());

  // Image
  document.getElementById('prop-opacity').addEventListener('input', e => {
    const obj = canvas.getActiveObject(); if (!obj) return;
    obj.set('opacity', parseInt(e.target.value, 10) / 100);
    canvas.renderAll();
  });
  document.getElementById('prop-opacity').addEventListener('change', () => onCanvasChange());
  document.getElementById('btn-grayscale').addEventListener('click', () => {
    const obj = canvas.getActiveObject(); if (!obj || obj.type !== 'image') return;
    obj._grayscale = !obj._grayscale;
    canvas.renderAll();
    document.getElementById('btn-grayscale').classList.toggle('on', !!obj._grayscale);
    onCanvasChange();
  });
  document.getElementById('prop-border-on').addEventListener('change', e => {
    const obj = canvas.getActiveObject(); if (!obj) return;
    const w = e.target.checked ? (parseInt(document.getElementById('prop-border-width').value, 10) || 1) : 0;
    obj.set({ strokeWidth: w, stroke: document.getElementById('prop-border-color').value });
    canvas.renderAll(); onCanvasChange();
  });
  document.getElementById('prop-border-color').addEventListener('input', e => {
    const obj = canvas.getActiveObject(); if (!obj) return;
    obj.set('stroke', e.target.value); canvas.renderAll();
  });
  document.getElementById('prop-border-color').addEventListener('change', () => onCanvasChange());
  document.getElementById('prop-border-width').addEventListener('change', e => {
    const obj = canvas.getActiveObject(); if (!obj) return;
    obj.set('strokeWidth', parseInt(e.target.value, 10) || 0);
    canvas.renderAll(); onCanvasChange();
  });
  document.getElementById('btn-cutout').addEventListener('click', cutoutImage);
  document.getElementById('btn-crop').addEventListener('click', openCropModal);

  // Shape
  document.getElementById('prop-shape-fill').addEventListener('input',  e => applyShape('fill', e.target.value));
  document.getElementById('prop-shape-fill').addEventListener('change', () => onCanvasChange());
  document.getElementById('prop-shape-stroke').addEventListener('input',  e => applyShape('stroke', e.target.value));
  document.getElementById('prop-shape-stroke').addEventListener('change', () => onCanvasChange());
  document.getElementById('prop-shape-stroke-width').addEventListener('change', e =>
    applyShape('strokeWidth', parseInt(e.target.value, 10) || 0));
  document.getElementById('prop-shape-opacity').addEventListener('input',  e =>
    applyShape('opacity', parseInt(e.target.value, 10) / 100));
  document.getElementById('prop-shape-opacity').addEventListener('change', () => onCanvasChange());

  // Layer
  document.getElementById('btn-copy').addEventListener('click',  copySelected);
  document.getElementById('btn-paste').addEventListener('click', pasteClipboard);

  document.getElementById('btn-bring-fwd').addEventListener('click', () => {
    canvas.getActiveObjects().forEach(o => canvas.bringForward(o));
    canvas.renderAll(); onCanvasChange();
  });
  document.getElementById('btn-send-back').addEventListener('click', () => {
    canvas.getActiveObjects().forEach(o => canvas.sendBackwards(o));
    canvas.renderAll(); onCanvasChange();
  });

  // Undo/Redo
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  // Zoom
  document.getElementById('btn-zoom-in').addEventListener('click',  () => setZoom(zoom + ZOOM_STEP));
  document.getElementById('btn-zoom-out').addEventListener('click', () => setZoom(zoom - ZOOM_STEP));
  document.getElementById('btn-zoom-fit').addEventListener('click', zoomFit);

  // Alignment
  ['left','centerH','right','top','centerV','bottom'].forEach(dir => {
    document.getElementById('btn-align-' + dir).addEventListener('click', () => alignObjects(dir));
  });

  // Text style capture
  document.getElementById('btn-capture-style').addEventListener('click', captureTextStyle);

  // File ops
  document.getElementById('btn-save').addEventListener('click',         () => saveProject(false));
  document.getElementById('btn-preview').addEventListener('click',      previewHTML);
  document.getElementById('btn-export').addEventListener('click',       exportHTML);
  document.getElementById('btn-export-print').addEventListener('click',  exportPrint);
  document.getElementById('btn-export-pdf').addEventListener('click',         exportPDF);
  document.getElementById('btn-export-digital-pdf').addEventListener('click', exportDigitalPDF);
  document.getElementById('btn-export-twoup').addEventListener('click',        exportTwoUp);
}

function applyText(prop, val) {
  const obj = canvas.getActiveObject(); if (!obj) return;
  obj.set(prop, val); canvas.renderAll(); onCanvasChange();
}
function applyShape(prop, val) {
  const obj = canvas.getActiveObject(); if (!obj) return;
  obj.set(prop, val); canvas.renderAll();
}

/* â”€â”€ Multi-select alignment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function alignObjects(dir) {
  const active = canvas.getActiveObject();
  if (!active || active.type !== 'activeSelection') return;

  const objects = active.getObjects().slice();

  // Discard selection so each object returns to independent canvas-space coordinates.
  canvas.discardActiveObject();

  // getBoundingRect(true, true): absolute=true (no viewport transform), calculate=true (fresh).
  const rects = objects.map(o => ({ obj: o, br: o.getBoundingRect(true, true) }));

  const minL = Math.min(...rects.map(r => r.br.left));
  const maxR = Math.max(...rects.map(r => r.br.left + r.br.width));
  const minT = Math.min(...rects.map(r => r.br.top));
  const maxB = Math.max(...rects.map(r => r.br.top + r.br.height));
  const cx   = (minL + maxR) / 2;
  const cy   = (minT + maxB) / 2;

  rects.forEach(({ obj, br }) => {
    switch (dir) {
      case 'left':    obj.set('left', obj.left + (minL - br.left)); break;
      case 'centerH': obj.set('left', obj.left + (cx   - (br.left + br.width  / 2))); break;
      case 'right':   obj.set('left', obj.left + (maxR - (br.left + br.width)));  break;
      case 'top':     obj.set('top',  obj.top  + (minT - br.top)); break;
      case 'centerV': obj.set('top',  obj.top  + (cy   - (br.top  + br.height / 2))); break;
      case 'bottom':  obj.set('top',  obj.top  + (maxB - (br.top  + br.height)));  break;
    }
    obj.setCoords();
  });

  canvas.setActiveObject(new fabric.ActiveSelection(objects, { canvas }));
  canvas.renderAll();
  onCanvasChange();
}

/* â”€â”€ Text style picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderTextStyles() {
  const list = document.getElementById('text-style-list');
  list.innerHTML = '';
  textStyles.forEach(style => {
    const chip = document.createElement('div');
    chip.className = 'ts-chip';
    chip.dataset.sid = style.id;
    chip.title = `Apply: ${style.name}`;

    const aa = document.createElement('span');
    aa.className = 'ts-aa';
    aa.textContent = 'Aa';
    aa.style.cssText = `font-family:'${style.fontFamily}',serif;font-weight:${style.fontWeight};` +
      `font-style:${style.fontStyle};color:${style.color};`;

    const name = document.createElement('span');
    name.className = 'ts-name';
    name.textContent = style.name;

    const del = document.createElement('button');
    del.className = 'ts-del';
    del.textContent = 'âœ•';
    del.title = 'Delete style';
    del.addEventListener('click', e => {
      e.stopPropagation();
      textStyles = textStyles.filter(s => s.id !== style.id);
      renderTextStyles();
      markDirty();
    });

    chip.append(aa, name, del);
    chip.addEventListener('click', () => applyTextStyle(style));
    list.appendChild(chip);
  });
}

function applyTextStyle(style) {
  const obj = canvas.getActiveObject();
  if (!obj || (obj.type !== 'textbox' && obj.type !== 'i-text')) {
    setStatus('Select a text box first, then click a style to apply it.');
    return;
  }
  obj.set({
    fontFamily: style.fontFamily,
    fontSize:   style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle:  style.fontStyle,
    fill:       style.color,
    textAlign:  style.textAlign,
  });
  obj.initDimensions();
  canvas.renderAll();
  updateToolbar();
  onCanvasChange();
}

function captureTextStyle() {
  const obj = canvas.getActiveObject();
  if (!obj || (obj.type !== 'textbox' && obj.type !== 'i-text')) {
    setStatus('Select a text box to capture its style.');
    return;
  }
  const name = prompt('Style name:', 'Custom ' + (textStyles.length + 1));
  if (!name) return;
  textStyles.push({
    id:         'ts_' + Date.now(),
    name,
    fontFamily: obj.fontFamily || 'Playfair Display',
    fontSize:   Math.round(obj.fontSize || 16),
    fontWeight: obj.fontWeight || 'normal',
    fontStyle:  obj.fontStyle  || 'normal',
    color:      fabricColorToHex(obj.fill) || '#ffffff',
    textAlign:  obj.textAlign  || 'left',
  });
  renderTextStyles();
  markDirty();
}

/* â”€â”€ Add objects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function addText() {
  const t = new fabric.Textbox('Double-click to edit', {
    left: 60, top: 60,
    width: 300,
    fontFamily: 'Playfair Display',
    fontSize: 32,
    fill: '#000000',
  });
  canvas.add(t);
  canvas.setActiveObject(t);
  canvas.renderAll();
}

async function addImages() {
  const imgs = await window.editorAPI.openImages();
  for (const { name, srcPath } of imgs) {
    const assetName = await window.editorAPI.importAsset(srcPath);
    fabric.Image.fromURL('asset://' + assetName, img => {
      const scale = Math.min(400 / img.width, 400 / img.height, 1);
      img.set({ left: 80, top: 80, scaleX: scale, scaleY: scale, strokeWidth: 0 });
      img.name = name;
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    }, { crossOrigin: 'anonymous' });
  }
}

function addRect() {
  const r = new fabric.Rect({
    left: 100, top: 100, width: 200, height: 120,
    fill: '#c9a84c', stroke: 'transparent', strokeWidth: 0,
  });
  canvas.add(r);
  canvas.setActiveObject(r);
  canvas.renderAll();
}

/* â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  let mime = (header.match(/:(.*?);/) || [])[1] || 'image/png';
  mime = mime.toLowerCase().replace(/^image\/jpg$/, 'image/jpeg');
  const binary = atob(b64);
  const buf    = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/* â”€â”€ AI Image Cutout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function showCutoutOverlay(show, msg, pct) {
  const overlay = document.getElementById('cutout-overlay');
  overlay.style.display = show ? 'flex' : 'none';
  if (msg) document.getElementById('cutout-msg').textContent = msg;
  if (pct != null) document.getElementById('cutout-bar').style.width = pct + '%';
}

async function cutoutImage() {
  const obj = canvas.getActiveObject();
  if (!obj || obj.type !== 'image') return;

  showCutoutOverlay(true, 'Loading AI model (first run: ~1-2 min WASM compile)â€¦', 0);

  try {
    if (!removeBgFn) {
      showCutoutOverlay(true, 'Importing AI libraryâ€¦', 5);
      const mod = await import('https://esm.sh/@imgly/background-removal@1.4.5');
      removeBgFn = mod.removeBackground
        ?? mod.default?.removeBackground
        ?? (typeof mod.default === 'function' ? mod.default : null);
      if (typeof removeBgFn !== 'function') throw new Error('removeBackground not exported');
    }

    // Draw the canvas image element to a temp canvas â†’ blob (works for any src, incl. asset://)
    const el = obj.getElement();
    const tmpC = document.createElement('canvas');
    tmpC.width = el.naturalWidth || el.width;
    tmpC.height = el.naturalHeight || el.height;
    tmpC.getContext('2d').drawImage(el, 0, 0);
    const blob = await new Promise(res => tmpC.toBlob(res, 'image/png'));

    showCutoutOverlay(true, 'Running AI background removalâ€¦', 10);

    const resultBlob = await removeBgFn(blob, {
      publicPath: 'vendor://background-removal/models/',
      model: 'small',
      output: { format: 'image/png', quality: 1 },
      progress: (key, current, total) => {
        if (total > 0) {
          const pct = Math.round(10 + (current / total) * 85);
          const label = key.includes('inference') ? 'Running inference' :
                        key.includes('fetch')     ? 'Loading model'     : 'Processing';
          showCutoutOverlay(true, label + 'â€¦', pct);
        }
      },
    });

    showCutoutOverlay(true, 'Applying resultâ€¦', 97);

    // Save cutout result as an asset file so it doesn't bloat the project JSON.
    const reader = new FileReader();
    reader.onload = async () => {
      const assetName = await window.editorAPI.importAssetData(reader.result, 'png');
      fabric.Image.fromURL('asset://' + assetName, newImg => {
        newImg.set({
          left: obj.left, top: obj.top,
          scaleX: obj.scaleX * (obj.width / newImg.width),
          scaleY: obj.scaleY * (obj.height / newImg.height),
          angle: obj.angle, opacity: obj.opacity, strokeWidth: 0,
        });
        canvas.remove(obj);
        canvas.add(newImg);
        canvas.setActiveObject(newImg);
        canvas.renderAll();
        onCanvasChange();
        showCutoutOverlay(false);
        setStatus('Cutout done!');
      }, { crossOrigin: 'anonymous' });
    };
    reader.onerror = () => { showCutoutOverlay(false); setStatus('Cutout failed: could not read result blob'); };
    reader.readAsDataURL(resultBlob);
  } catch (err) {
    showCutoutOverlay(false);
    setStatus('Cutout failed: ' + err.message);
    console.error('[Cutout]', err);
  }
}

/* â”€â”€ Image Crop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function openCropModal() {
  const obj = canvas.getActiveObject();
  if (!obj || obj.type !== 'image') return;

  const el   = obj.getElement();
  const imgW = el.naturalWidth  || el.width  || obj.width;
  const imgH = el.naturalHeight || el.height || obj.height;

  const MAX_W = 700, MAX_H = 480;
  const scale = Math.min(MAX_W / imgW, MAX_H / imgH, 1);
  const dispW = Math.round(imgW * scale);
  const dispH = Math.round(imgH * scale);

  const img = document.getElementById('crop-img');
  img.src = el.src;
  img.style.width  = dispW + 'px';
  img.style.height = dispH + 'px';

  const host = document.getElementById('crop-image-host');
  host.style.width  = dispW + 'px';
  host.style.height = dispH + 'px';

  _cropState = { obj, scale, imgW, imgH, dispW, dispH, cropX: 0, cropY: 0, cropW: imgW, cropH: imgH };
  updateCropRect();
  document.getElementById('crop-overlay').classList.add('open');
}

function updateCropRect() {
  if (!_cropState) return;
  const { scale, cropX, cropY, cropW, cropH } = _cropState;

  const dx = Math.round(cropX * scale);
  const dy = Math.round(cropY * scale);
  const dw = Math.max(2, Math.round(cropW * scale));
  const dh = Math.max(2, Math.round(cropH * scale));

  const rect = document.getElementById('crop-rect');
  rect.style.left   = dx + 'px';
  rect.style.top    = dy + 'px';
  rect.style.width  = dw + 'px';
  rect.style.height = dh + 'px';

  document.getElementById('crop-info').textContent = `${cropW} Ã— ${cropH} px`;
}

function closeCropModal() {
  _cropState = null;
  document.getElementById('crop-overlay').classList.remove('open');
}

async function applyCropModal() {
  if (!_cropState) return;
  const { obj, imgW, imgH, cropX, cropY, cropW, cropH } = _cropState;
  if (cropW < 1 || cropH < 1) { closeCropModal(); return; }

  const el    = obj.getElement();
  const tmpC  = document.createElement('canvas');
  tmpC.width  = cropW;
  tmpC.height = cropH;
  tmpC.getContext('2d').drawImage(el, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  closeCropModal();
  setStatus('Saving cropped imageâ€¦');

  const dataUrl   = tmpC.toDataURL('image/png');
  const assetName = await window.editorAPI.importAssetData(dataUrl, 'png');

  fabric.Image.fromURL('asset://' + assetName, newImg => {
    newImg.set({
      left:        obj.left,
      top:         obj.top,
      scaleX:      (obj.scaleX * obj.width)  / newImg.width,
      scaleY:      (obj.scaleY * obj.height) / newImg.height,
      angle:       obj.angle,
      opacity:     obj.opacity,
      strokeWidth: obj.strokeWidth || 0,
      stroke:      obj.stroke,
      _grayscale:  obj._grayscale,
    });
    canvas.remove(obj);
    canvas.add(newImg);
    canvas.setActiveObject(newImg);
    canvas.renderAll();
    onCanvasChange();
    setStatus('Crop applied.');
  }, { crossOrigin: 'anonymous' });
}

function bindCropHandlers() {
  let dragMode  = null;   // null | 'move' | handle-pos string (nw, n, ne, â€¦)
  let dragStart = null;   // { mx, my, cropX, cropY, cropW, cropH, scale, imgW, imgH }

  const rect = document.getElementById('crop-rect');

  rect.addEventListener('mousedown', e => {
    if (e.target !== rect) return;
    e.preventDefault();
    if (!_cropState) return;
    dragMode  = 'move';
    dragStart = { mx: e.clientX, my: e.clientY, ..._cropState };
  });

  rect.querySelectorAll('.ch').forEach(handle => {
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!_cropState) return;
      dragMode  = handle.dataset.pos;
      dragStart = { mx: e.clientX, my: e.clientY, ..._cropState };
    });
  });

  document.addEventListener('mousemove', e => {
    if (!dragMode || !dragStart || !_cropState) return;

    const dx = (e.clientX - dragStart.mx) / dragStart.scale;
    const dy = (e.clientY - dragStart.my) / dragStart.scale;
    const { imgW, imgH } = dragStart;
    let { cropX, cropY, cropW, cropH } = dragStart;

    const MIN = 20;

    if (dragMode === 'move') {
      cropX = Math.max(0, Math.min(imgW - cropW, cropX + dx));
      cropY = Math.max(0, Math.min(imgH - cropH, cropY + dy));
    } else {
      if (dragMode.includes('n')) {
        const newY = Math.max(0, Math.min(cropY + cropH - MIN, cropY + dy));
        cropH = cropH + (cropY - newY);
        cropY = newY;
      }
      if (dragMode.includes('s')) {
        cropH = Math.max(MIN, Math.min(imgH - cropY, cropH + dy));
      }
      if (dragMode.includes('w')) {
        const newX = Math.max(0, Math.min(cropX + cropW - MIN, cropX + dx));
        cropW = cropW + (cropX - newX);
        cropX = newX;
      }
      if (dragMode.includes('e')) {
        cropW = Math.max(MIN, Math.min(imgW - cropX, cropW + dx));
      }
    }

    _cropState.cropX = Math.round(cropX);
    _cropState.cropY = Math.round(cropY);
    _cropState.cropW = Math.round(cropW);
    _cropState.cropH = Math.round(cropH);
    updateCropRect();
  });

  document.addEventListener('mouseup', () => { dragMode = null; dragStart = null; });

  document.getElementById('btn-crop-apply').addEventListener('click', applyCropModal);
  document.getElementById('btn-crop-cancel').addEventListener('click', closeCropModal);
  document.getElementById('btn-crop-reset').addEventListener('click', () => {
    if (!_cropState) return;
    _cropState.cropX = 0;
    _cropState.cropY = 0;
    _cropState.cropW = _cropState.imgW;
    _cropState.cropH = _cropState.imgH;
    updateCropRect();
  });
}

/* â”€â”€ Undo / Redo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function pushHistory() {
  if (activeSec < 0) return;
  const json = JSON.stringify(canvas.toJSON(CANVAS_JSON_PROPS).objects.filter(o => !o._isGlow && !o._isGlitter));
  const h    = history[activeSec];
  const idx  = historyIdx[activeSec];
  h.splice(idx + 1);
  h.push(json);
  if (h.length > HISTORY_MAX) h.shift();
  historyIdx[activeSec] = h.length - 1;
}

const RECOVERY_MAX_BYTES = 10 * 1024 * 1024; // 10 MB â€” skip recovery if project is too large
let _recoveryTimer = null;
function scheduleRecovery() {
  clearTimeout(_recoveryTimer);
  _recoveryTimer = setTimeout(() => {
    const active = canvas.getActiveObject();
    if (!active || active.type !== 'activeSelection') {
      saveCurrentSectionObjects();
    }
    const snap = JSON.stringify({ version: 1, canvasW: CANVAS_W, sections, textStyles });
    if (snap.length > RECOVERY_MAX_BYTES) {
      setStatus('Project is large â€” auto-recovery skipped. Save manually (Ctrl+S).');
      return;
    }
    window.editorAPI.writeRecovery(snap).catch(() => {});
  }, 2000);
}

function onCanvasChange() {
  if (_suppressHistoryPush) return;
  pushHistory();
  saveCurrentSectionObjects();
  markDirty();
  scheduleRecovery();
}

function restoreHistory(json) {
  if (activeSec < 0) return;
  const sec = sections[activeSec];
  const restoredSec = activeSec; // bind at call time in case user switches mid-restore
  const objects = JSON.parse(json);
  canvas.off('object:added',   onCanvasChange);
  canvas.off('object:removed', onCanvasChange);
  canvas.remove(...canvas.getObjects());
  _sectionLoading++;
  fabric.util.enlivenObjects(objects, (enlivenedObjects) => {
    _sectionLoading = Math.max(0, _sectionLoading - 1);
    if (activeSec !== restoredSec) return; // section changed while restoring; discard
    const prev = canvas.renderOnAddRemove;
    canvas.renderOnAddRemove = false;
    enlivenedObjects.forEach(obj => canvas.add(obj));
    canvas.renderOnAddRemove = prev;
    canvas.getObjects().forEach(snapObjToPixel);
    applyCanvasBg(sec);
    if (sec.bgImage) {
      fabric.Image.fromURL(sec.bgImage, img => applyBgImageToCanvas(img, sec), { crossOrigin: 'anonymous' });
    } else {
      canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
    }
    applyGlow(sec);
    applyGlitter(sec);
    canvas.renderAll();
    canvas.on('object:added',   onCanvasChange);
    canvas.on('object:removed', onCanvasChange);
    sec.objects = objects;
  }, 'fabric');
}

function undo() {
  if (activeSec < 0) return;
  let idx = historyIdx[activeSec];
  if (idx <= 0) return;
  historyIdx[activeSec] = --idx;
  restoreHistory(history[activeSec][idx]);
}

function redo() {
  if (activeSec < 0) return;
  const h = history[activeSec];
  let idx = historyIdx[activeSec];
  if (idx >= h.length - 1) return;
  historyIdx[activeSec] = ++idx;
  restoreHistory(h[idx]);
}

/* â”€â”€ Zoom â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function setZoom(z) {
  zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
  canvas.setZoom(zoom);
  // Integer pixel dimensions prevent sub-pixel blurriness
  canvas.setWidth(Math.round(CANVAS_W * zoom));
  canvas.setHeight(Math.round((sections[activeSec]?.height || 600) * zoom));
  document.getElementById('zoom-label').textContent = Math.round(zoom * 100) + '%';
}

function zoomFit() {
  const host = document.getElementById('canvas-host');
  // Never zoom above 1.0: zooming in pushes every object position to a
  // non-integer CSS pixel (e.g. left=60 â†’ 71.16px at 1.19Ã—), which
  // antialiases text edges and makes it look blurry. At 1.0 the canvas
  // scrolls horizontally only when the host is narrower than CANVAS_W.
  const z = Math.min(1.0, (host.clientWidth - 48) / CANVAS_W);
  setZoom(z);
}

/* â”€â”€ Save / Load â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function saveProject(saveAs) {
  clearTimeout(_recoveryTimer);
  // Capture the active section index at the moment Save is clicked.
  // snapshotCurrentSection() already guards against mid-load, so this just
  // ensures the snapshot targets the section the user is actually viewing.
  const saveSec = activeSec;
  if (saveSec >= 0 && saveSec < sections.length && _sectionLoading === 0) {
    snapshotCurrentSection();
  }
  if (saveAs || !projectPath) {
    const p = await window.editorAPI.saveProject(projectPath);
    if (!p) return;
    projectPath = p;
    await window.editorAPI.setAssetDir(projectPath); // migrate temp assets â†’ project assets folder
  }
  await window.editorAPI.writeFile(projectPath, JSON.stringify({ version: 1, canvasW: CANVAS_W, sections, textStyles }, null, 2));
  await window.editorAPI.setSettings({ lastProjectPath: projectPath });
  window.editorAPI.clearRecovery().catch(() => {});
  dirty = false;
  updateTitle();
  setStatus('Saved.');
}

async function openProject() {
  if (dirty && !confirm('Unsaved changes â€” open anyway?')) return;
  const result = await window.editorAPI.openProject();
  if (!result) return;
  projectPath = result.path;
  await window.editorAPI.setAssetDir(projectPath);
  await loadData(JSON.parse(result.data));
  await window.editorAPI.setSettings({ lastProjectPath: projectPath });
  window.editorAPI.clearRecovery().catch(() => {});
}

async function newProject() {
  if (dirty && !confirm('Unsaved changes â€” start new project?')) return;
  projectPath = null;
  await window.editorAPI.clearAssetDir();
  textStyles = DEFAULT_TEXT_STYLES.map(s => ({ ...s }));
  renderTextStyles();
  initSections(DEFAULT_SECTIONS);
  dirty = false;
  updateTitle();
}

async function loadData(data) {
  const secs = data.sections || DEFAULT_SECTIONS;

  // One-time migration: extract any inline base64 images to asset files.
  let total = 0;
  for (const sec of secs) {
    if (sec.bgImage && sec.bgImage.startsWith('data:')) total++;
    for (const obj of (sec.objects || [])) {
      if (obj.type === 'image' && obj.src && obj.src.startsWith('data:')) total++;
    }
  }
  if (total > 0) {
    setStatus(`Migrating ${total} embedded images to files â€” this happens onceâ€¦`);
    let done = 0;
    for (const sec of secs) {
      if (sec.bgImage && sec.bgImage.startsWith('data:')) {
        const ext  = (sec.bgImage.match(/data:image\/([a-z+]+)/) || [])[1] || 'png';
        const name = await window.editorAPI.importAssetData(sec.bgImage, ext);
        sec.bgImage = 'asset://' + name;
        setStatus(`Migrating imagesâ€¦ ${++done}/${total}`);
      }
      for (const obj of (sec.objects || [])) {
        if (obj.type === 'image' && obj.src && obj.src.startsWith('data:')) {
          const ext  = (obj.src.match(/data:image\/([a-z+]+)/) || [])[1] || 'png';
          const name = await window.editorAPI.importAssetData(obj.src, ext);
          obj.src = 'asset://' + name;
          setStatus(`Migrating imagesâ€¦ ${++done}/${total}`);
        }
      }
    }
  }

  // Preload every web font used in this project before handing data to Fabric.
  // Fabric's Textbox._splitTextIntoLines() calls ctx.measureText() at construction
  // time. If the web font hasn't loaded yet it uses the fallback font's (narrower)
  // metrics, calculates wrong line-break positions, and renders words concatenated.
  const usedFonts = new Set();
  for (const sec of secs) {
    for (const obj of (sec.objects || [])) {
      if (obj.fontFamily && GOOGLE_FONTS.has(obj.fontFamily)) usedFonts.add(obj.fontFamily);
    }
  }
  if (usedFonts.size) {
    setStatus('Loading fontsâ€¦');
    await Promise.all([...usedFonts].map(ff =>
      Promise.all(['400', '700', '400italic'].map(variant => {
        const [wt, style] = variant === '400italic' ? ['400', 'italic'] : [variant, 'normal'];
        return document.fonts.load(`${style === 'italic' ? 'italic ' : ''}${wt} 16px "${ff}"`).catch(() => {});
      }))
    ));
  }

  textStyles = data.textStyles ? data.textStyles : DEFAULT_TEXT_STYLES.map(s => ({ ...s }));
  renderTextStyles();
  initSections(secs);
  dirty = total > 0; // mark dirty so the user knows to save the migrated project
  updateTitle();
  setStatus(total > 0 ? `Migrated ${total} images â€” press Ctrl+S to save the smaller project` : 'Opened.');
}

function initSections(defs) {
  sections   = defs.map(s => ({
    label: s.label, height: s.height, bg: s.bg || '#ffffff',
    bgImage: s.bgImage || null, bgSize: s.bgSize || 'cover',
    bgType: s.bgType || 'solid',
    bgGrad1: s.bgGrad1 || '#5a0a2e', bgGrad2: s.bgGrad2 || '#c9a84c',
    bgGradDir: s.bgGradDir || 'to bottom',
    bgTexture: s.bgTexture || 'dots', bgTexFg: s.bgTexFg || '#c9a84c', bgTexBg: s.bgTexBg || '#5a0a2e',
    // Migrate old single bgGlow â†’ bgGlows array.
    bgGlows: s.bgGlows ? s.bgGlows.map(g => ({ stackPos: 0, ...g, foreground: undefined }))
           : (s.bgGlow && s.bgGlow.enabled) ? [{ ...s.bgGlow, id: s.bgGlow.id || 'glow-0', stackPos: 0 }]
           : [],
    glitter: s.glitter ? { ...s.glitter } : null,
    objects: s.objects || [],
  }));
  history    = sections.map(s => [JSON.stringify(s.objects)]);
  historyIdx = sections.map(() => 0);
  activeSec  = -1;
  renderSectionList();
  switchSection(0);
}

/* â”€â”€ Build Google Fonts URL for export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function buildGoogleFontsUrl(usedFonts) {
  const needed = [...usedFonts].filter(f => GOOGLE_FONTS.has(f));
  if (!needed.length) return '';
  const families = needed.map(f => {
    const slug = f.replace(/ /g, '+');
    return `${slug}:ital,wght@0,300;0,400;0,700;1,400`;
  }).join('&family=');
  return `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
}

/* â”€â”€ Export to HTML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function exportHTML() {
  clearTimeout(_recoveryTimer);
  snapshotCurrentSection();
  const destPath = await window.editorAPI.exportDir();
  if (!destPath) return;

  setStatus('Exportingâ€¦');
  try {
    const usedFonts = new Set();
    const images    = [];
    const seenNames = new Set();

    const safeW = CANVAS_W - 2 * SAFE_MARGIN_PX;
    const sectionsHTML = sections.map(sec => {
      const bgStyle     = buildBgStyleForFolder(sec, seenNames, images);
      const safeH       = sec.height - 2 * SAFE_MARGIN_PX;
      const objsHtmlArr = (sec.objects || []).map(o => objectToHTML(o, sec, usedFonts, images, seenNames));
      const children    = mergeGlowsIntoHTML(objsHtmlArr, buildGlowsHTML(sec)).join('\n');
      return `  <section class="bs" style="width:${safeW}px;height:${safeH}px;position:relative;overflow:hidden;margin:0 auto 12px;">\n` +
        `    <div style="position:absolute;left:-${SAFE_MARGIN_PX}px;top:-${SAFE_MARGIN_PX}px;width:${CANVAS_W}px;height:${sec.height}px;${bgStyle}">\n` +
        `${children}\n    </div>\n  </section>`;
    }).join('\n\n');

    const googleFontsUrl = buildGoogleFontsUrl(usedFonts);
    const fontsLink = googleFontsUrl
      ? `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${googleFontsUrl}" rel="stylesheet">`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Arangetram Brochure</title>
${fontsLink}
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
    body { background: #111; overflow-x: hidden; }
    #brochure-wrap { width: 100%; overflow: hidden; }
    #brochure-inner { transform-origin: top left; will-change: transform; }
    .bs { box-sizing: border-box; margin-bottom: 12px; content-visibility: auto; contain-intrinsic-size: auto 800px; }
    img { pointer-events: none; -webkit-user-drag: none; -webkit-touch-callout: none; }
  </style>
</head>
<body>
<div id="brochure-wrap"><div id="brochure-inner">
${sectionsHTML}
</div></div>
<script>
(function(){
  var W=${CANVAS_W - 2 * SAFE_MARGIN_PX};
  function fit(){
    var vw=window.innerWidth;
    if(vw>=W)return;
    var s=vw/W;
    var inner=document.getElementById('brochure-inner');
    inner.style.transform='scale('+s+')';
    inner.style.transformOrigin='top left';
    document.getElementById('brochure-wrap').style.height=Math.round(inner.scrollHeight*s)+'px';
  }
  fit();
  window.addEventListener('resize',fit);
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  document.addEventListener('keydown', function(e){
    if (e.ctrlKey && (e.key==='s' || e.key==='u')) e.preventDefault();
  });
})();
</script>
</body>
</html>`;

    const assetRefs = images.filter(img => img.assetRef).map(img => img.name);
    await window.editorAPI.exportToRepo(destPath, html, assetRefs);
    setStatus('Exported: brochure.html + images/ written to ' + destPath);
  } catch (e) {
    console.error('Export failed:', e);
    setStatus('Export failed: ' + (e && e.message ? e.message : String(e)));
  }
}

/* â”€â”€ Export for Print â€” renders each section to a PNG image file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

// Render one section to a PNG data URL using an off-screen Fabric.StaticCanvas.
// multiplier=2 â†’ 2Ã— pixel density (â‰ˆ190 DPI on A4) for crisp print output.
function renderSectionToDataUrl(sec, multiplier) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('canvas');
    el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(el);

    const fc = new fabric.StaticCanvas(el, {
      width: CANVAS_W, height: sec.height, enableRetinaScaling: false,
    });
    const cleanup = () => { try { fc.dispose(); } catch {} el.remove(); };

    const doExport = () => {
      fc.renderAll();
      try { resolve(fc.toDataURL({ format: 'png', multiplier })); }
      catch (e) { reject(e); }
      finally { cleanup(); }
    };

    const afterGlow = () => { applyGlow(sec, fc); applyGlitter(sec, fc); doExport(); };

    // Apply background image on top of colour/gradient, then export.
    const afterBgColor = () => {
      if (sec.bgImage) {
        fabric.Image.fromURL(sec.bgImage, img => applyBgImageToCanvas(img, sec, fc, afterGlow), { crossOrigin: 'anonymous' });
      } else {
        afterGlow();
      }
    };

    // Apply background colour / gradient / texture.
    const applyBg = () => {
      const type = sec.bgType || 'solid';
      if (type === 'linear' || type === 'radial') {
        const grad = makeFabricGradient(type, sec.bgGrad1 || '#ffffff', sec.bgGrad2 || '#000000',
                                        sec.bgGradDir || 'to bottom', CANVAS_W, sec.height);
        fc.setBackgroundColor(grad, afterBgColor);
      } else if (type === 'texture') {
        const svgUrl = makeTextureSVG(sec.bgTexture || 'dots', sec.bgTexFg || '#c9a84c', sec.bgTexBg || '#5a0a2e');
        fabric.Image.fromURL(svgUrl, img => {
          const pat = new fabric.Pattern({ source: img.getElement(), repeat: 'repeat' });
          fc.setBackgroundColor(pat, afterBgColor);
        });
      } else {
        fc.setBackgroundColor(sec.bg || '#ffffff', afterBgColor);
      }
    };

    // Load objects, ensure web fonts are ready, then apply background.
    const afterLoad = () => {
      const fontLoads = [];
      fc.getObjects().forEach(obj => {
        if ((obj.type === 'textbox' || obj.type === 'i-text') && obj.fontFamily && GOOGLE_FONTS.has(obj.fontFamily)) {
          ['400', '700', 'italic 400'].forEach(v =>
            fontLoads.push(document.fonts.load(`${v} 16px "${obj.fontFamily}"`).catch(() => {}))
          );
        }
      });
      Promise.all(fontLoads).then(() => {
        fc.getObjects().forEach(obj => {
          if (obj.type === 'textbox' || obj.type === 'i-text') { obj.dirty = true; obj.initDimensions(); }
        });
        applyBg();
      });
    };

    if (sec.objects && sec.objects.length) {
      fc.loadFromJSON({ version: '5.3.0', objects: sec.objects }, afterLoad);
    } else {
      afterLoad();
    }
  });
}

// Shared render helper â€” renders all sections to PNG data URLs at print DPI.
// Target spec: 6.00 Ã— 8.50 in @ 300 DPI â†’ 1800 Ã— 2550px per section.
// Set canvas section height to 1124px for exact 6Ã—8.5 proportions.
const PRINT_DPI  = 300;
const PRINT_W_IN = 6.00;
const PRINT_H_IN = 8.50;
const PRINT_MULTIPLIER  = (PRINT_DPI * PRINT_W_IN) / CANVAS_W; // 1800 / 794 â‰ˆ 2.267
// 0.25 inch safe margin in canvas pixels (editor guide only â€” never exported)
const SAFE_MARGIN_PX = Math.round(0.25 * CANVAS_W / PRINT_W_IN); // â‰ˆ 33px
// Screens read ~15% brighter than print; this boosts PDF backgrounds to compensate
// for dot gain and the sRGBâ†’CMYK darkening most printer RIPs apply without an ICC profile.
// Raise toward 1.25 if output is still too dark; lower toward 1.05 if it looks washed out.
const PRINT_BRIGHTNESS_BOOST = 1.15;

function drawSafeMarginGuide() {
  const zoom = canvas.getZoom();
  const dpr  = window.devicePixelRatio || 1;
  const h    = canvas.getHeight() / zoom; // logical section height in px
  const ctx  = canvas.getContext('2d');
  ctx.save();
  // Reset Fabric's viewport transform but keep retina DPR scaling so our
  // coordinates stay in CSS pixels (1 unit = dpr device pixels on HiDPI).
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const m = SAFE_MARGIN_PX * zoom;
  const W = CANVAS_W * zoom;
  const H = h * zoom;
  ctx.strokeStyle = 'rgba(255, 100, 0, 0.7)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
  ctx.restore();
}

async function _renderAllSections(onProgress) {
  clearTimeout(_recoveryTimer);
  snapshotCurrentSection();
  const sanitize = s => (s || 'section').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
  const total = sections.length;
  const files = [];
  for (let i = 0; i < total; i++) {
    onProgress(i + 1, total);
    const dataUrl = await renderSectionToDataUrl(sections[i], PRINT_MULTIPLIER);
    files.push({ name: String(i + 1).padStart(2, '0') + '-' + sanitize(sections[i].label), dataUrl });
  }
  return files;
}

async function exportPrint() {
  const destDir = await window.editorAPI.exportDir();
  if (!destDir) return;
  const files = await _renderAllSections((n, t) => setStatus(`Rendering section ${n}/${t} at ${PRINT_DPI} DPIâ€¦`));
  const imageFiles = files.map(f => ({ name: f.name + '.png', dataUrl: f.dataUrl }));
  await window.editorAPI.savePrintImages(destDir, imageFiles);
  setStatus(`PNG export: ${imageFiles.length} images @ ${PRINT_DPI} DPI (2550Ã—1800px) â†’ ${destDir}`);
}

// Lighten a PNG data URL by factor (e.g. 1.15 = 15% brighter) via CSS filter.
// Used to compensate for screen-vs-print brightness gap before PDF embedding.
function applyBrightness(dataUrl, factor) {
  if (factor === 1) return Promise.resolve(dataUrl);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.filter = `brightness(${factor})`;
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}

// Crop a rendered PNG data URL to the safe content area by removing the 0.25" bleed
// zone from each edge. Used for digital PDF only â€” print exports keep the full bleed.
function cropToSafeArea(dataUrl) {
  const m = Math.round(0.25 * PRINT_DPI); // 75px at 300 DPI
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const cw = img.naturalWidth  - 2 * m;
      const ch = img.naturalHeight - 2 * m;
      const c = document.createElement('canvas');
      c.width = Math.max(1, cw);
      c.height = Math.max(1, ch);
      c.getContext('2d').drawImage(img, m, m, cw, ch, 0, 0, cw, ch);
      resolve(c.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}

// Render a section for vector PDF export: background PNG (no text) + text data.
function renderSectionForPdf(sec, multiplier) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('canvas');
    el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(el);

    const fc = new fabric.StaticCanvas(el, {
      width: CANVAS_W, height: sec.height, enableRetinaScaling: false,
    });
    const cleanup = () => { try { fc.dispose(); } catch {} el.remove(); };

    const doExport = async () => {
      // Extract text data from sec.objects JSON for positions/styles (more reliable than
      // live Fabric objects which can silently drop complex styles like gradients/cutouts).
      // textLines is NOT serialised in JSON â€” it's a computed Fabric property â€” so we
      // build a positional lookup from live canvas objects to get the actual wrapped lines.
      const allObjs  = sec.objects || [];
      const textObjs = allObjs.filter(o => o.type === 'textbox' || o.type === 'i-text');
      console.log(`[PDF] section "${sec.name}": total objects=${allObjs.length}, text objects=${textObjs.length}`);

      // Live Fabric text objects are loaded in the same order as sec.objects JSON entries.
      const liveTextObjs = fc.getObjects().filter(o => o.type === 'textbox' || o.type === 'i-text');

      // For each textLines array, compute which indices are paragraph-ending lines.
      // A paragraph ends at the last wrapped line before an explicit \n (or the very last line).
      // These lines must NOT be fully justified â€” they stay left-aligned.
      function computeParaEndFlags(text, textLines) {
        const flags = new Array(textLines.length).fill(false);
        if (!textLines.length) return flags;
        flags[textLines.length - 1] = true; // Last line is always a paragraph end.
        const paras = (text || '').split('\n');
        if (paras.length <= 1) return flags; // Single paragraph â€” only last line is end.
        let li = 0;
        for (let pi = 0; pi < paras.length - 1 && li < textLines.length; pi++) {
          const target = paras[pi].replace(/\s+/g, ' ').trim();
          let acc = '';
          while (li < textLines.length) {
            acc = acc ? acc + ' ' + textLines[li] : textLines[li];
            li++;
            // Stop accumulating when accumulated text matches the paragraph (or overshoots).
            if (acc.replace(/\s+/g, ' ').trim() === target || acc.length >= target.length) {
              flags[li - 1] = true;
              break;
            }
          }
        }
        return flags;
      }

      const textData = textObjs.map((o, i) => {
          const scaleX = o.scaleX || 1, scaleY = o.scaleY || 1;
          const w = (o.width || 0) * scaleX, h = (o.height || 0) * scaleY;
          const ox = o.originX || 'left', oy = o.originY || 'top';
          const left = ox === 'center' ? (o.left || 0) - w / 2
                     : ox === 'right'  ? (o.left || 0) - w
                     :                   (o.left || 0);
          const top  = oy === 'center' ? (o.top  || 0) - h / 2
                     : oy === 'bottom' ? (o.top  || 0) - h
                     :                   (o.top  || 0);
          // textLines from the live Fabric object â€” computed by Canvas2D, matches the editor.
          const live = liveTextObjs[i];
          const textLines = (live && Array.isArray(live.textLines) && live.textLines.length)
                            ? live.textLines.map(String)
                            : null;
          const isParaEnd = textLines ? computeParaEndFlags(o.text || '', textLines) : null;
          const entry = {
            left:       Math.round(left),
            top:        Math.round(top),
            width:      Math.round(w),
            height:     Math.round(h),
            angle:      o.angle       || 0,
            fontFamily: o.fontFamily  || 'Georgia',
            fontSize:   Math.round((o.fontSize || 16) * scaleY),
            fontWeight: o.fontWeight  || 'normal',
            fontStyle:  o.fontStyle   || 'normal',
            fill:       typeof o.fill === 'string' ? o.fill : '#000000',
            textAlign:  (o.textAlign  || 'left').replace('justify-left', 'justify'),
            opacity:    o.opacity != null ? o.opacity : 1,
            text:       o.text        || '',
            textLines,
            isParaEnd,
            lineHeight: o.lineHeight  || 1.16,
          };
          console.log(`[PDF]   text "${entry.text.slice(0,40).replace(/\n/g,'\\n')}" font=${entry.fontFamily} size=${entry.fontSize} fill=${entry.fill} left=${entry.left} top=${entry.top} w=${entry.width} lines=${textLines ? textLines.length : 'null'}`);
          return entry;
        });

      // Hide text in the StaticCanvas for the background-only PNG.
      fc.getObjects().forEach(obj => {
        if (obj.type === 'textbox' || obj.type === 'i-text') obj.visible = false;
      });

      fc.renderAll();
      let bgDataUrl;
      try { bgDataUrl = fc.toDataURL({ format: 'png', multiplier }); }
      catch (e) { cleanup(); reject(e); return; }
      cleanup();
      bgDataUrl = await applyBrightness(bgDataUrl, PRINT_BRIGHTNESS_BOOST);
      resolve({ bgDataUrl, textData });
    };

    const afterBgColor = () => {
      const afterGlowPdf = () => { applyGlow(sec, fc); applyGlitter(sec, fc); doExport(); };
      if (sec.bgImage) {
        fabric.Image.fromURL(sec.bgImage, img => applyBgImageToCanvas(img, sec, fc, afterGlowPdf), { crossOrigin: 'anonymous' });
      } else {
        afterGlowPdf();
      }
    };

    const applyBg = () => {
      const type = sec.bgType || 'solid';
      if (type === 'linear' || type === 'radial') {
        const grad = makeFabricGradient(type, sec.bgGrad1 || '#ffffff', sec.bgGrad2 || '#000000',
                                        sec.bgGradDir || 'to bottom', CANVAS_W, sec.height);
        fc.setBackgroundColor(grad, afterBgColor);
      } else if (type === 'texture') {
        const svgUrl = makeTextureSVG(sec.bgTexture || 'dots', sec.bgTexFg || '#c9a84c', sec.bgTexBg || '#5a0a2e');
        fabric.Image.fromURL(svgUrl, img => {
          const pat = new fabric.Pattern({ source: img.getElement(), repeat: 'repeat' });
          fc.setBackgroundColor(pat, afterBgColor);
        });
      } else {
        fc.setBackgroundColor(sec.bg || '#ffffff', afterBgColor);
      }
    };

    const afterLoad = () => {
      const fontLoads = [];
      fc.getObjects().forEach(obj => {
        if ((obj.type === 'textbox' || obj.type === 'i-text') && obj.fontFamily) {
          ['400', '700', 'italic 400'].forEach(v =>
            fontLoads.push(document.fonts.load(`${v} 16px "${obj.fontFamily}"`).catch(() => {}))
          );
        }
      });
      Promise.all(fontLoads).then(() => {
        fc.getObjects().forEach(obj => {
          if (obj.type === 'textbox' || obj.type === 'i-text') { obj.dirty = true; obj.initDimensions(); }
        });
        applyBg();
      });
    };

    if (sec.objects && sec.objects.length) {
      fc.loadFromJSON({ version: '5.3.0', objects: sec.objects }, afterLoad);
    } else {
      afterLoad();
    }
  });
}

async function exportPDF() {
  const destDir = await window.editorAPI.exportDir();
  if (!destDir) return;

  clearTimeout(_recoveryTimer);
  snapshotCurrentSection();

  // Collect all Google Fonts used across sections (for main process to download).
  const allFonts = new Set();
  sections.forEach(sec => {
    (sec.objects || []).forEach(obj => {
      if ((obj.type === 'textbox' || obj.type === 'i-text') && obj.fontFamily) {
        allFonts.add(obj.fontFamily);
      }
    });
  });
  // Also include custom fonts; filter to only Google-downloadable ones.
  const googleFontsList = [...allFonts].filter(f => GOOGLE_FONTS.has(f) ||
    customFonts.some(cf => cf.name === f));

  const total = sections.length;
  const pdfSections = [];
  for (let i = 0; i < total; i++) {
    setStatus(`Rendering section ${i + 1}/${total} for PDFâ€¦`);
    const result = await renderSectionForPdf(sections[i], PRINT_MULTIPLIER);
    pdfSections.push(result);
  }

  setStatus(`Assembling PDF with vector textâ€¦`);
  console.log('[PDF] calling exportToPdfVector â€” sections:', pdfSections.length, 'fonts:', googleFontsList);
  let ipcResult;
  try {
    ipcResult = await window.editorAPI.exportToPdfVector(
      destDir, pdfSections, googleFontsList, { wIn: PRINT_W_IN, hIn: PRINT_H_IN, dpi: PRINT_DPI, canvasW: CANVAS_W }
    );
  } catch (err) {
    console.error('[PDF] exportToPdfVector IPC FAILED:', err && err.message, err);
    setStatus(`PDF export failed: ${err && err.message}`);
    return;
  }
  // Main process returns { destPath, logs } so its logs appear in DevTools.
  const { destPath, logs: mainLogs } = ipcResult || {};
  (mainLogs || []).forEach(l => console.log('[main]', l));
  setStatus(`PDF export: ${pdfSections.length} page${pdfSections.length !== 1 ? 's' : ''} â†’ ${destPath || '(no path)'}`);
}

/* Digital PDF: sRGB raster, content cropped to the safe area (0.25" bleed removed from
   each edge). Page size = trim size: 5.50" Ã— 8.00" (6.00" - 0.50" Ã— 8.50" - 0.50"). */
async function exportDigitalPDF() {
  const destDir = await window.editorAPI.exportDir();
  if (!destDir) return;

  clearTimeout(_recoveryTimer);
  snapshotCurrentSection();

  const total = sections.length;
  const images = [];
  for (let i = 0; i < total; i++) {
    setStatus(`Rendering section ${i + 1}/${total} for digital PDFâ€¦`);
    const dataUrl = await renderSectionToDataUrl(sections[i], PRINT_MULTIPLIER);
    const cropped = await cropToSafeArea(dataUrl);
    images.push({ dataUrl: cropped });
  }

  setStatus('Assembling digital PDFâ€¦');
  const safeWIn = PRINT_W_IN - 0.50; // 5.50" â€” 6.00" minus 0.25" bleed on each side
  const safeHIn = PRINT_H_IN - 0.50; // 8.00" â€” 8.50" minus 0.25" bleed on each side
  try {
    const destPath = await window.editorAPI.exportToPdf(
      destDir, images, { wIn: safeWIn, hIn: safeHIn, filename: 'brochure-digital.pdf' }
    );
    setStatus(`Digital PDF: ${total} page${total !== 1 ? 's' : ''} â†’ ${destPath}`);
  } catch (err) {
    setStatus(`Digital PDF export failed: ${err && err.message}`);
  }
}

/* Two-Up PNG: sections 4 + 5 side-by-side on 12"Ã—8.5" landscape at 300 DPI.
   Each section fills its 6"Ã—8.5" slot exactly (1800Ã—2550px) â€” no crop, no borders. */
async function exportTwoUp() {
  if (sections.length < 5) {
    setStatus('Two-Up export needs at least 5 sections (sections 4 & 5 will be combined side-by-side).');
    return;
  }
  const destDir = await window.editorAPI.exportDir();
  if (!destDir) return;

  clearTimeout(_recoveryTimer);
  snapshotCurrentSection();

  // Scale each section so its height fills 8.5" @ 300 DPI = 2550px exactly.
  const TWO_UP_H = 2550;
  const mult3 = TWO_UP_H / (sections[3].height || 1124);
  const mult4 = TWO_UP_H / (sections[4].height || 1124);

  setStatus('Rendering section 4 for Two-Upâ€¦');
  const url3 = await renderSectionToDataUrl(sections[3], mult3);
  setStatus('Rendering section 5 for Two-Upâ€¦');
  const url4 = await renderSectionToDataUrl(sections[4], mult4);

  setStatus('Building Two-Up PNGâ€¦');
  let result;
  try {
    result = await window.editorAPI.exportTwoUp(destDir, [{ dataUrl: url3 }, { dataUrl: url4 }]);
  } catch (err) {
    setStatus('Two-Up export failed: ' + (err && err.message));
    return;
  }
  setStatus('Two-Up PNG: ' + (result && result.destPath ? result.destPath : 'done'));
}

/* Fabric stores left/top at the object's originX/originY point.
   CSS position:absolute always needs the top-left corner. */
function fabricLeft(o) {
  const w  = (o.width  || 0) * (o.scaleX || 1);
  const ox = o.originX || 'left';
  if (ox === 'center') return Math.round(o.left - w / 2);
  if (ox === 'right')  return Math.round(o.left - w);
  return Math.round(o.left);
}
function fabricTop(o) {
  const h  = (o.height || 0) * (o.scaleY || 1);
  const oy = o.originY || 'top';
  if (oy === 'center') return Math.round(o.top - h / 2);
  if (oy === 'bottom') return Math.round(o.top - h);
  return Math.round(o.top);
}

/* CSS transform-origin must match Fabric's rotation pivot (the origin point).
   fabricLeft/Top shift the element to its top-left corner, so the origin
   point is at offset (originX%, originY%) within that positioned element. */
function buildTransform(angle, scaleX) {
  const parts = [];
  if (angle) parts.push(`rotate(${angle}deg)`);
  if (Math.abs((scaleX || 1) - 1) > 0.01) parts.push(`scaleX(${(scaleX).toFixed(3)})`);
  if (!parts.length) return '';
  // Fabric always rotates/scales around the object's CENTER, regardless of originX/Y.
  // CSS transform-origin:50% 50% matches this (it's also the CSS default).
  return `transform:${parts.join(' ')};transform-origin:50% 50%;`;
}

// lazyLoad=true for export (bandwidth savings); false for preview (CSS transform
// scale causes the browser to evaluate lazy-load intersection in layout space,
// so images in the lower portion of a scaled section never trigger a load).
function objectToHTML(o, sec, usedFonts, images, seenNames, dataUrlMap, lazyLoad = true) {
  const pxL = fabricLeft(o) + 'px';
  const pxT = fabricTop(o)  + 'px';
  // Fabric always rotates/flips around the object CENTER regardless of originX/Y,
  // so CSS transform-origin must always be 50% 50% (the CSS default anyway).
  const rotateCss = o.angle  ? `transform:rotate(${o.angle}deg);transform-origin:50% 50%;` : '';
  const opacity   = (o.opacity != null && o.opacity < 1) ? `opacity:${o.opacity.toFixed(2)};` : '';

  if (o.type === 'i-text' || o.type === 'textbox') {
    const ff  = o.fontFamily || 'Georgia';
    const sx  = o.scaleX || 1;
    const sy  = o.scaleY || 1;
    const fz  = Math.round((o.fontSize || 16) * sy);
    const fw  = o.fontWeight  || 'normal';
    const fi  = o.fontStyle   || 'normal';
    const td  = o.underline   ? 'underline' : 'none';
    const col = safeColor(o.fill, '#000000');
    // Map Fabric justify variants to CSS text-align + text-align-last.
    // Fabric's justify-left/center/right mean "justify all lines but align the last line
    // (and lines before explicit \n) to left/center/right" â€” CSS text-align-last mirrors this.
    // Without text-align-last, browsers stretch pre-wrap lines before \n, which looks different.
    const taRaw = o.textAlign || 'left';
    const ta    = taRaw.startsWith('justify') ? 'justify' : taRaw;
    const talLast = taRaw === 'justify-left'   ? 'left'
                  : taRaw === 'justify-center' ? 'center'
                  : taRaw === 'justify-right'  ? 'right'
                  : taRaw === 'justify'        ? 'justify'
                  : null;
    const tal   = talLast ? `text-align-last:${talLast};` : '';
    const lh  = (o.lineHeight || 1.16).toFixed(2);
    const w   = Math.round((o.width || 200) * sx);
    const ws  = (o.type === 'textbox') ? 'pre-wrap' : 'pre';
    const txf = buildTransform(o.angle, sx);
    const tsh = shadowToCSS(o.shadow);
    usedFonts.add(ff);
    return `    <p style="position:absolute;left:${pxL};top:${pxT};width:${w}px;` +
      `font-family:'${ff}',serif;font-size:${fz}px;font-weight:${fw};font-style:${fi};` +
      `text-decoration:${td};color:${col};text-align:${ta};${tal}line-height:${lh};` +
      `${txf}${tsh}${opacity}margin:0;padding:0;white-space:${ws};">` +
      `${escHtml(o.text || '')}</p>`;
  }

  if (o.type === 'image') {
    const w = Math.round((o.width  || 100) * (o.scaleX || 1));
    const h = Math.round((o.height || 100) * (o.scaleY || 1));
    // Only emit a CSS border when both strokeWidth > 0 AND stroke is a real colour.
    // Fabric skips drawing a stroke when stroke is null/'' regardless of strokeWidth,
    // so matching that behaviour prevents a spurious 1px black frame on cutout images
    // (which inherit Fabric's default strokeWidth:1 but have stroke:null).
    const hasStroke = o.strokeWidth > 0 && o.stroke && o.stroke !== '' && o.stroke !== 'transparent';
    const border    = hasStroke ? `border:${o.strokeWidth}px solid ${o.stroke};` : '';
    const gsCss     = o._grayscale ? 'filter:grayscale(100%);' : '';
    // Fabric flipX/flipY â€” reflect via CSS transform so the image matches the canvas.
    const flipParts = [];
    if (o.flipX) flipParts.push('scaleX(-1)');
    if (o.flipY) flipParts.push('scaleY(-1)');
    const flipCss = flipParts.length
      ? `transform:${(o.angle ? `rotate(${o.angle}deg) ` : '') + flipParts.join(' ')};transform-origin:50% 50%;`
      : rotateCss;
    if (dataUrlMap) {
      const src = o.src || '';
      const imgSrc = src.startsWith('asset://') ? (dataUrlMap.get(assetName(src)) || '') : src;
      return `    <img src="${imgSrc}" alt="" style="position:absolute;left:${pxL};top:${pxT};` +
        `width:${w}px;height:${h}px;${border}${gsCss}${flipCss}${opacity}">`;
    }
    const name   = collectImage(o.src || '', seenNames, images);
    const loading = lazyLoad ? ' loading="lazy"' : '';
    return `    <img src="images/${name}" alt=""${loading} draggable="false" style="position:absolute;left:${pxL};top:${pxT};` +
      `width:${w}px;height:${h}px;${border}${gsCss}${flipCss}${opacity}">` +
      `\n    <div style="position:absolute;left:${pxL};top:${pxT};width:${w}px;height:${h}px;z-index:1;"></div>`;
  }

  if (['rect','circle','ellipse','triangle'].includes(o.type)) {
    const w  = Math.round((o.width  || 100) * (o.scaleX || 1));
    const h  = Math.round((o.height || 100) * (o.scaleY || 1));
    const bg = safeColor(o.fill,   'transparent');
    const bc = safeColor(o.stroke, 'transparent');
    const bw = o.strokeWidth || 0;
    const br = (o.type === 'circle' || o.type === 'ellipse') ? 'border-radius:50%;' : '';
    return `    <div style="position:absolute;left:${pxL};top:${pxT};width:${w}px;height:${h}px;` +
      `background:${bg};border:${bw}px solid ${bc};${br}${rotateCss}${opacity}"></div>`;
  }
  return '';
}

function pct(val, total) { return ((val / total) * 100).toFixed(2) + '%'; }

function safeColor(color, fallback) {
  if (!color || color === 'transparent' || color === '') return fallback;
  return color;
}

function collectImage(src, seenNames, images) {
  if (!src) return '';
  if (src.startsWith('asset://')) {
    const name = assetName(src);
    if (!seenNames.has(name)) { seenNames.add(name); images.push({ name, assetRef: name }); }
    return name;
  }
  if (src.startsWith('data:')) {
    let hash = 0;
    for (let i = 0; i < Math.min(src.length, 300); i++) hash = ((hash << 5) - hash + src.charCodeAt(i)) | 0;
    const ext  = (src.match(/data:image\/(\w+)/) || [])[1] || 'png';
    const name = 'img_' + Math.abs(hash).toString(36) + '.' + ext;
    if (!seenNames.has(name)) { seenNames.add(name); images.push({ name, dataUrl: src }); }
    return name;
  }
  const name = src.split(/[/\\]/).pop();
  if (!seenNames.has(name)) { seenNames.add(name); images.push({ name, dataUrl: src }); }
  return name;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* â”€â”€ Preview / Export helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function assetName(src) {
  // Chromium normalises asset://img.png â†’ asset://img.png/ (trailing slash for empty path).
  // Use URL.hostname to reliably strip the scheme + any trailing slash.
  try { return new URL(src).hostname; } catch { return src.slice(8); }
}

// Convert sec.bgGlows into { stackPos, html } items for HTML export/preview.
function buildGlowsHTML(sec) {
  const glows = sec.bgGlows || [];
  if (!glows.length) return [];
  const cw   = CANVAS_W;
  const ch   = sec.height || 700;
  const diag = Math.sqrt(cw * cw + ch * ch);
  return glows.map(glow => {
    const x  = Math.round((glow.x !== undefined ? glow.x : 0.5) * cw);
    const y  = Math.round((glow.y !== undefined ? glow.y : 0.5) * ch);
    const r  = Math.round(diag * Math.max(0.1, glow.area || 0.5));
    const a  = Math.min(1, Math.max(0, glow.intensity || 0.6));
    const a2 = (a * 0.4).toFixed(3);
    const style = `position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle ${r}px at ${x}px ${y}px,rgba(255,200,50,${a.toFixed(3)}) 0%,rgba(255,180,30,${a2}) 50%,rgba(255,160,0,0) 100%)`;
    return { stackPos: glow.stackPos || 0, html: `<div style="${style}"></div>` };
  }).sort((a, b) => a.stackPos - b.stackPos);
}

// Interleave objectToHTML strings with glow overlay divs in correct z-order.
// stackPos=0 â†’ before all objects; stackPos=N â†’ after the N-th object.
function mergeGlowsIntoHTML(objsHtmlArr, glowItems) {
  if (!glowItems.length) return objsHtmlArr;
  const result = [];
  let gi = 0;
  while (gi < glowItems.length && glowItems[gi].stackPos <= 0) result.push(glowItems[gi++].html);
  for (let i = 0; i < objsHtmlArr.length; i++) {
    result.push(objsHtmlArr[i]);
    while (gi < glowItems.length && glowItems[gi].stackPos === i + 1) result.push(glowItems[gi++].html);
  }
  while (gi < glowItems.length) result.push(glowItems[gi++].html);
  return result;
}

// Build the CSS background string for a section, collecting any asset image
// into the shared `images` array so the caller can copy files to disk.
function buildBgStyleForFolder(sec, seenNames, images) {
  if (!sec.bgImage) return sectionBgCSS(sec);
  if (sec.bgImage.startsWith('asset://')) {
    const name = assetName(sec.bgImage);
    if (!seenNames.has(name)) { seenNames.add(name); images.push({ name, assetRef: name }); }
    return `background:url('images/${name}') center/${sec.bgSize||'cover'} no-repeat, ${sec.bg};`;
  }
  return `background:url('${sec.bgImage}') center/${sec.bgSize||'cover'} no-repeat, ${sec.bg};`;
}

async function previewHTML() {
  clearTimeout(_recoveryTimer);
  snapshotCurrentSection();
  setStatus('Generating previewâ€¦');
  try {
    const usedFonts = new Set();
    const images    = [];
    const seenNames = new Set();

    const sectionsHTML = sections.map(sec => {
      const bgStyle     = buildBgStyleForFolder(sec, seenNames, images);
      const objsHtmlArr = (sec.objects || []).map(o => objectToHTML(o, sec, usedFonts, images, seenNames, undefined, false));
      const children    = mergeGlowsIntoHTML(objsHtmlArr, buildGlowsHTML(sec)).join('\n');
      return `  <section class="bs" style="height:${sec.height}px;position:relative;${bgStyle}overflow:hidden;width:${CANVAS_W}px;">\n${children}\n  </section>`;
    }).join('\n\n');

    const totalHeight = sections.reduce((s, sec) => s + (sec.height || 600), 0) + sections.length * 12;
    const PHONE_W = 390;
    const scale   = PHONE_W / CANVAS_W;
    const scaledH = Math.round(totalHeight * scale);

    const googleFontsUrl = buildGoogleFontsUrl(usedFonts);
    const fontsLink = googleFontsUrl
      ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${googleFontsUrl}" rel="stylesheet">`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${fontsLink}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#1a1a1a;display:flex;flex-direction:column;align-items:center;padding:40px 16px;font-family:sans-serif}
.preview-label{color:#777;font-size:11px;margin-bottom:14px;letter-spacing:0.08em;text-transform:uppercase}
.phone-frame{width:406px;border-radius:24px;border:8px solid #444;background:#000;box-shadow:0 0 0 1px #555,0 32px 80px rgba(0,0,0,0.7);overflow:hidden}
.phone-screen{overflow:hidden;position:relative;height:${scaledH}px}
.phone-content{transform-origin:top left;transform:scale(${scale.toFixed(4)});width:${CANVAS_W}px;position:absolute;top:0;left:0}
.bs{position:relative;overflow:hidden;margin-bottom:12px}
</style>
</head>
<body>
<div class="preview-label">Mobile Preview â€” 390px</div>
<div class="phone-frame">
  <div class="phone-screen">
    <div class="phone-content">
${sectionsHTML}
    </div>
  </div>
</div>
</body>
</html>`;

    const assetRefs   = images.filter(img => img.assetRef).map(img => img.name);
    const dataUrlImgs = images.filter(img => img.dataUrl);
    await window.editorAPI.previewOpenFolder(html, assetRefs, dataUrlImgs);
    setStatus('Preview opened in browser.');
  } catch (e) {
    setStatus('Preview failed: ' + (e && e.message ? e.message : String(e)));
  }
}


/* â”€â”€ Status / title helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function setStatus(msg) { document.getElementById('status-msg').textContent = msg; }
function markDirty() { dirty = true; updateTitle(); }
function updateTitle() {
  const name = projectPath ? projectPath.split(/[/\\]/).pop() : 'Untitled';
  document.getElementById('status-project').textContent = (dirty ? 'â— ' : '') + name;
}

/* â”€â”€ Keyboard shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function bindKeyboard() {
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'z') { e.preventDefault(); undo(); }
    if (ctrl && e.key === 'y') { e.preventDefault(); redo(); }
    if (ctrl && e.key === 's') { e.preventDefault(); saveProject(e.shiftKey); }
    if (ctrl && e.key === 'd') { e.preventDefault(); duplicateSelected(); }
    const activeObj   = canvas.getActiveObject();
    const textEditing = activeObj?.isEditing;
    if (ctrl && e.key === 'c' && !textEditing) { e.preventDefault(); copySelected(); }
    if (ctrl && e.key === 'v') {
      e.preventDefault();
      if (textEditing) {
        window.editorAPI.readClipboardText().then(text => {
          if (!text) return;
          insertTextAtCursor(activeObj, text);
          canvas.renderAll();
          onCanvasChange();
        }).catch(() => {});
      } else {
        pasteClipboard();
      }
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === document.body) deleteSelected();
    if (ctrl && e.key === '=') { e.preventDefault(); setZoom(zoom + ZOOM_STEP); }
    if (ctrl && e.key === '-') { e.preventDefault(); setZoom(zoom - ZOOM_STEP); }
    if (ctrl && e.key === '0') { e.preventDefault(); zoomFit(); }
  });

}

function insertTextAtCursor(obj, text) {
  const start  = obj.selectionStart;
  const end    = obj.selectionEnd;
  const before = obj.text.slice(0, start);
  const after  = obj.text.slice(end);
  obj.text = before + text + after;
  const newPos = start + text.length;
  obj.selectionStart = newPos;
  obj.selectionEnd   = newPos;
  if (obj.hiddenTextarea) {
    obj.hiddenTextarea.value = obj.text;
    obj.hiddenTextarea.selectionStart = newPos;
    obj.hiddenTextarea.selectionEnd   = newPos;
  }
  if (obj.type === 'textbox') {
    // Clamp width so text stays inside the page, then let Textbox auto-expand height.
    const maxW = CANVAS_W - Math.round(obj.left) - 10;
    if ((obj.width || 0) > maxW) obj.set('width', maxW);
    obj.initDimensions();
  }
}

// When a text object is manually resized by dragging handles, Fabric stores the
// change as scaleX/scaleY rather than updated width/fontSize. Normalise those
// back to real measurements so further edits and word-wrap stay predictable.
// Snap an object's left/top to integer CSS pixels so the canvas position
// matches fabricLeft/Top (which also uses Math.round).  DPR-based snapping
// produced non-integer CSS values at DPRâ‰ 1 (e.g. -18.5 at DPR=2) that
// fabricLeft then rounded to a different integer (-18 vs -19), causing a
// visible 1-pixel misalignment between the canvas and the HTML preview.
function snapObjToPixel(obj) {
  if (!obj) return;
  const sl = Math.round(obj.left);
  const st = Math.round(obj.top);
  if (sl !== obj.left || st !== obj.top) {
    obj.set({ left: sl, top: st });
    obj.setCoords();
    canvas.requestRenderAll();
  }
}

function normaliseTextScale(obj) {
  if (!obj || (obj.type !== 'i-text' && obj.type !== 'textbox')) return;
  const sx = obj.scaleX || 1;
  const sy = obj.scaleY || 1;
  if (Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
  const newFontSize = Math.max(6, Math.round((obj.fontSize || 16) * sy));
  const newWidth    = Math.min(
    Math.round((obj.width || 200) * sx),
    CANVAS_W - Math.round(obj.left) - 10
  );
  obj.set({ fontSize: newFontSize, width: newWidth, scaleX: 1, scaleY: 1 });
  if (obj.type === 'textbox') obj.initDimensions();
  canvas.renderAll();
}

function deleteSelected() {
  canvas.getActiveObjects().forEach(o => canvas.remove(o));
  canvas.discardActiveObject();
  canvas.renderAll();
  onCanvasChange();
}

function copySelected() {
  const objs = canvas.getActiveObjects();
  if (!objs.length) return;
  clipboard = null;
  pasteOffset = 0;
  const EXTRA = ['_shadowPreset', '_shadowColor'];
  const clones = [];
  let done = 0;
  objs.forEach(obj => {
    obj.clone(cl => {
      clones.push(cl);
      if (++done === objs.length) { clipboard = clones; setStatus('Copied ' + clones.length + ' object(s).'); }
    }, EXTRA);
  });
}

function pasteClipboard() {
  if (!clipboard || !clipboard.length) return;
  pasteOffset += 20;
  canvas.discardActiveObject();
  const EXTRA = ['_shadowPreset', '_shadowColor'];
  const placed = [];
  let done = 0;
  clipboard.forEach(src => {
    src.clone(cl => {
      cl.set({ left: (src.left || 0) + pasteOffset, top: (src.top || 0) + pasteOffset, evented: true });
      canvas.add(cl);
      placed.push(cl);
      if (++done === clipboard.length) {
        if (placed.length === 1) canvas.setActiveObject(placed[0]);
        else canvas.setActiveObject(new fabric.ActiveSelection(placed, { canvas }));
        canvas.renderAll();
        onCanvasChange();
        setStatus('Pasted ' + placed.length + ' object(s).');
      }
    }, EXTRA);
  });
}

function duplicateSelected() {
  const objs = canvas.getActiveObjects();
  if (!objs.length) return;
  canvas.discardActiveObject();
  const clones = [];
  let done = 0;
  objs.forEach(obj => {
    obj.clone(cl => {
      cl.set({ left: obj.left + 20, top: obj.top + 20, evented: true });
      canvas.add(cl);
      clones.push(cl);
      if (++done === objs.length) {
        const sel = new fabric.ActiveSelection(clones, { canvas });
        canvas.setActiveObject(sel);
        canvas.renderAll();
        onCanvasChange();
      }
    });
  });
}

/* â”€â”€ Menu events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function bindMenuEvents() {
  const api = window.editorAPI;
  api.onMenu('menu:new',       () => newProject());
  api.onMenu('menu:open',      () => openProject());
  api.onMenu('menu:save',      () => saveProject(false));
  api.onMenu('menu:save-as',   () => saveProject(true));
  api.onMenu('menu:export',       () => exportHTML());
  api.onMenu('menu:export-print', () => exportPrint());
  api.onMenu('menu:export-pdf',         () => exportPDF());
  api.onMenu('menu:export-digital-pdf', () => exportDigitalPDF());
  api.onMenu('menu:undo',      () => undo());
  api.onMenu('menu:redo',      () => redo());
  api.onMenu('menu:delete',    () => deleteSelected());
  api.onMenu('menu:duplicate', () => duplicateSelected());
  api.onMenu('menu:zoom-in',   () => setZoom(zoom + ZOOM_STEP));
  api.onMenu('menu:zoom-out',  () => setZoom(zoom - ZOOM_STEP));
  api.onMenu('menu:zoom-fit',  () => zoomFit());
}

/* â”€â”€ Bootstrap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
document.addEventListener('DOMContentLoaded', async () => {
  // Load persisted custom fonts before building the picker
  try {
    const s = await window.editorAPI.getSettings();
    if (Array.isArray(s.customFonts) && s.customFonts.length) {
      customFonts = s.customFonts;
      customFonts.forEach(f => {
        injectGoogleFont(f.name);
        if (!FONTS.some(ff => ff.name === f.name)) FONTS.push({ name: f.name, cat: f.cat });
      });
    }
  } catch { /* ignore â€” settings unavailable */ }

  buildFontPicker();
  renderTextStyles();
  initCanvas();
  bindToolbar();
  bindSectionProps();
  bindKeyboard();
  bindMenuEvents();
  bindFontManager();
  bindCropHandlers();
  document.getElementById('btn-add-section').addEventListener('click', addSection);

  // Try to resume: saved project â†’ recovery snapshot â†’ default template
  let resumed = false;
  try {
    const settings = await window.editorAPI.getSettings();
    if (settings.lastProjectPath) {
      const raw = await window.editorAPI.readFile(settings.lastProjectPath);
      if (raw) {
        projectPath = settings.lastProjectPath;
        await window.editorAPI.setAssetDir(projectPath);
        await loadData(JSON.parse(raw));
        setStatus('Resumed: ' + projectPath.split(/[/\\]/).pop());
        resumed = true;
      }
    }
  } catch (e) { /* missing or corrupt */ }

  if (!resumed) {
    try {
      const rec = await window.editorAPI.readRecovery();
      if (rec) {
        await loadData(JSON.parse(rec));
        dirty = true;
        updateTitle();
        setStatus('Recovered unsaved work â€” press Ctrl+S to save.');
        resumed = true;
      }
    } catch (e) { /* corrupt recovery */ }
  }

  if (!resumed) {
    initSections(DEFAULT_SECTIONS);
    setStatus('Ready â€” drag images, click T for text, â–­ for shapes.');
  }

  updateTitle();
  setTimeout(zoomFit, 100);
});

