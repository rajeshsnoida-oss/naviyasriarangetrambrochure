'use strict';
/* ── Constants ──────────────────────────────────────────────────────────── */
const CANVAS_W   = 794;
const CANVAS_JSON_PROPS = [
  'name','fontFamily','fontWeight','fontStyle','underline','fill',
  'textAlign','fontSize','textBackgroundColor','lineHeight','charSpacing',
  'stroke','strokeWidth','opacity','angle','_shadowPreset','_shadowColor',
];
const ZOOM_STEP  = 0.1;
const ZOOM_MIN   = 0.2;
const ZOOM_MAX   = 3.0;
const HISTORY_MAX = 80;

/* ── Font catalogue ─────────────────────────────────────────────────────── */
const FONTS = [
  // ── Classical / Serif ──
  { name: 'Playfair Display',    cat: 'Serif' },
  { name: 'Cormorant Garamond',  cat: 'Serif' },
  { name: 'EB Garamond',         cat: 'Serif' },
  { name: 'Libre Baskerville',   cat: 'Serif' },
  { name: 'Merriweather',        cat: 'Serif' },
  { name: 'Lora',                cat: 'Serif' },
  { name: 'Crimson Text',        cat: 'Serif' },
  { name: 'Cinzel',              cat: 'Serif' },
  // ── Modern / Sans ──
  { name: 'Lato',                cat: 'Sans' },
  { name: 'Montserrat',          cat: 'Sans' },
  { name: 'Raleway',             cat: 'Sans' },
  { name: 'Open Sans',           cat: 'Sans' },
  { name: 'Poppins',             cat: 'Sans' },
  { name: 'Josefin Sans',        cat: 'Sans' },
  { name: 'Nunito',              cat: 'Sans' },
  { name: 'Quicksand',           cat: 'Sans' },
  // ── Script / Decorative ──
  { name: 'Dancing Script',      cat: 'Script' },
  { name: 'Great Vibes',         cat: 'Script' },
  { name: 'Sacramento',          cat: 'Script' },
  { name: 'Pacifico',            cat: 'Decorative' },
  { name: 'Lobster',             cat: 'Decorative' },
  // ── System ──
  { name: 'Georgia',             cat: 'System' },
  { name: 'Times New Roman',     cat: 'System' },
  { name: 'Arial',               cat: 'System' },
  { name: 'Verdana',             cat: 'System' },
  { name: 'Trebuchet MS',        cat: 'System' },
  { name: 'Impact',              cat: 'System' },
];

const GOOGLE_FONTS = new Set(FONTS.filter(f => f.cat !== 'System').map(f => f.name));

/* ── Shadow presets ─────────────────────────────────────────────────────── */
const SHADOW_PRESETS = {
  drop:        { color: 'rgba(0,0,0,0.5)',       blur: 6,  offsetX: 3,  offsetY: 3  },
  soft:        { color: 'rgba(0,0,0,0.3)',       blur: 14, offsetX: 0,  offsetY: 5  },
  'glow-gold': { color: 'rgba(212,175,55,0.85)', blur: 20, offsetX: 0,  offsetY: 0  },
  'glow-white':{ color: 'rgba(255,255,255,0.9)', blur: 20, offsetX: 0,  offsetY: 0  },
};

/* ── Background helpers ─────────────────────────────────────────────────── */
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

/* ── State ──────────────────────────────────────────────────────────────── */
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

/* ── Text style presets ─────────────────────────────────────────────────── */
const DEFAULT_TEXT_STYLES = [
  { id: 'ts_1', name: 'Title',    fontFamily: 'Playfair Display',   fontSize: 48, fontWeight: 'bold',   fontStyle: 'normal', color: '#ffffff', textAlign: 'center' },
  { id: 'ts_2', name: 'Subtitle', fontFamily: 'Cormorant Garamond', fontSize: 28, fontWeight: 'normal', fontStyle: 'italic', color: '#c9a84c', textAlign: 'center' },
  { id: 'ts_3', name: 'Body',     fontFamily: 'Lora',               fontSize: 16, fontWeight: 'normal', fontStyle: 'normal', color: '#ffffff', textAlign: 'left'   },
  { id: 'ts_4', name: 'Caption',  fontFamily: 'Lato',               fontSize: 13, fontWeight: 'normal', fontStyle: 'normal', color: '#cccccc', textAlign: 'left'   },
  { id: 'ts_5', name: 'Heading',  fontFamily: 'Cinzel',             fontSize: 24, fontWeight: 'bold',   fontStyle: 'normal', color: '#c9a84c', textAlign: 'left'   },
];
let textStyles = DEFAULT_TEXT_STYLES.map(s => ({ ...s }));

/* ── Font picker ────────────────────────────────────────────────────────── */
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

/* ── Fabric canvas init ─────────────────────────────────────────────────── */
// Disable per-object bitmap caches. Without this, Fabric builds each object's
// texture at its natural size and stretches it at non-1× zoom, causing blurry
// text. Disabling caching makes Fabric redraw every object directly each frame —
// fine for a brochure with ≤50 objects.
fabric.Object.prototype.objectCaching = false;

function initCanvas() {
  canvas = new fabric.Canvas('c', {
    width:  CANVAS_W,
    height: 600,
    backgroundColor: '#ffffff',
    preserveObjectStacking: true,
    selection: true,
  });
  canvas.on('selection:created',  updateToolbar);
  canvas.on('selection:updated',  updateToolbar);
  canvas.on('selection:cleared',  updateToolbar);
  canvas.on('object:modified', e => {
    const obj = e.target;
    if (obj) snapObjToPixel(obj);
    normaliseTextScale(obj);
    onCanvasChange();
  });
  canvas.on('object:added',       onCanvasChange);
  canvas.on('object:removed',     onCanvasChange);
}

/* ── Section list UI ────────────────────────────────────────────────────── */
function renderSectionList() {
  const ul = document.getElementById('section-list');
  ul.innerHTML = '';
  sections.forEach((sec, i) => {
    const li = document.createElement('li');
    if (i === activeSec) li.classList.add('active');

    const handle = document.createElement('span');
    handle.className = 'section-drag-handle';
    handle.textContent = '⠿';
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
    btnUp.textContent = '▲';
    btnUp.title = 'Move up';
    btnUp.disabled = i === 0;
    btnUp.addEventListener('click', e => { e.stopPropagation(); moveSectionTo(i, i - 1); });

    const btnDown = document.createElement('button');
    btnDown.className = 'section-move-btn';
    btnDown.textContent = '▼';
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

/* ── Background propagation ─────────────────────────────────────────────── */
function bgSettingsFrom(src) {
  return {
    bgType: src.bgType || 'solid', bg: src.bg || '#ffffff',
    bgGrad1: src.bgGrad1, bgGrad2: src.bgGrad2, bgGradDir: src.bgGradDir,
    bgTexture: src.bgTexture, bgTexFg: src.bgTexFg, bgTexBg: src.bgTexBg,
    bgImage: src.bgImage || null, bgSize: src.bgSize || 'cover',
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
        fabric.Image.fromURL(sec.bgImage, img => {
          canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
            scaleX: CANVAS_W / img.width,
            scaleY: sec.height / img.height,
          });
        }, { crossOrigin: 'anonymous' });
      } else {
        canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
      }
    }
  });
  markDirty();
}

/* ── Canvas background application ─────────────────────────────────────── */
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

/* ── Switch active section ──────────────────────────────────────────────── */
function switchSection(idx) {
  if (idx === activeSec) return;
  snapshotCurrentSection();
  activeSec = idx;
  const sec = sections[idx];

  canvas.setHeight(Math.round(sec.height * zoom));

  // loadFromJSON clears backgroundColor — applyCanvasBg must run AFTER it completes.
  const afterLoad = () => {
    applyCanvasBg(sec);
    if (sec.bgImage) {
      fabric.Image.fromURL(sec.bgImage, img => {
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
          scaleX: CANVAS_W / img.width,
          scaleY: sec.height / img.height,
        });
      }, { crossOrigin: 'anonymous' });
    }
    // Re-render once the section's web fonts are confirmed loaded.
    // document.fonts.ready is unreliable for lazily-loaded @font-face — it resolves
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
      canvas.getObjects().forEach(obj => {
        if (obj.type === 'textbox' || obj.type === 'i-text') {
          obj.dirty = true;
          obj.initDimensions();
        }
      });
      canvas.requestRenderAll();
    });
  };

  canvas.off('object:added',   onCanvasChange);
  canvas.off('object:removed', onCanvasChange);
  canvas.remove(...canvas.getObjects());
  if (sec.objects && sec.objects.length) {
    canvas.loadFromJSON({ version: '5.3.0', objects: sec.objects }, () => {
      // Snap every loaded object to physical-pixel-aligned coordinates.
      // Objects created or dragged at zoom>1 end up with fractional left/top
      // values that produce non-integer buffer pixels → blurry text edges.
      canvas.getObjects().forEach(snapObjToPixel);
      afterLoad();
      canvas.on('object:added',   onCanvasChange);
      canvas.on('object:removed', onCanvasChange);
    });
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
  sections[activeSec].objects = canvas.toJSON(CANVAS_JSON_PROPS).objects;
}

// Use for explicit snapshots only (save / preview / export / section switch).
// Calls discardActiveObject() once so Fabric runs _restoreObjectsState() and
// converts any group-relative coords back to absolute before serialising.
// Do NOT call this from onCanvasChange — the repeated qrDecompose accumulates
// floating-point drift that visibly resizes objects.
function snapshotCurrentSection() {
  if (activeSec < 0 || activeSec >= sections.length) return;
  const active = canvas.getActiveObject();
  if (active && active.type === 'activeSelection') {
    const members = active.getObjects().slice();
    canvas.discardActiveObject();
    sections[activeSec].objects = canvas.toJSON(CANVAS_JSON_PROPS).objects;
    canvas.setActiveObject(new fabric.ActiveSelection(members, { canvas }));
    canvas.renderAll();
  } else {
    sections[activeSec].objects = canvas.toJSON(CANVAS_JSON_PROPS).objects;
  }
}

/* ── Section props panel ────────────────────────────────────────────────── */
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
  document.getElementById('sp-bg-image-btn').addEventListener('click', async () => {
    if (activeSec < 0) return;
    const imgs = await window.editorAPI.openImages();
    if (!imgs.length) return;
    const assetName = await window.editorAPI.importAsset(imgs[0].srcPath);
    const assetUrl  = 'asset://' + assetName;
    sections[activeSec].bgImage = assetUrl;
    fabric.Image.fromURL(assetUrl, img => {
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        scaleX: CANVAS_W / img.width,
        scaleY: sections[activeSec].height / img.height,
      });
    }, { crossOrigin: 'anonymous' });
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
    sections.splice(activeSec, 1);
    history.splice(activeSec, 1);
    historyIdx.splice(activeSec, 1);
    activeSec = Math.min(activeSec, sections.length - 1);
    canvas.remove(...canvas.getObjects());
    switchSection(activeSec);
    markDirty();
  });
}

/* ── Add section ────────────────────────────────────────────────────────── */
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

/* ── Toolbar context sensitivity ────────────────────────────────────────── */
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

/* ── Toolbar bindings ───────────────────────────────────────────────────── */
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
  document.getElementById('btn-save').addEventListener('click',    () => saveProject(false));
  document.getElementById('btn-preview').addEventListener('click', previewHTML);
  document.getElementById('btn-export').addEventListener('click',  exportHTML);
}

function applyText(prop, val) {
  const obj = canvas.getActiveObject(); if (!obj) return;
  obj.set(prop, val); canvas.renderAll(); onCanvasChange();
}
function applyShape(prop, val) {
  const obj = canvas.getActiveObject(); if (!obj) return;
  obj.set(prop, val); canvas.renderAll();
}

/* ── Multi-select alignment ─────────────────────────────────────────────── */
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

/* ── Text style picker ──────────────────────────────────────────────────── */
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
    del.textContent = '✕';
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

/* ── Add objects ────────────────────────────────────────────────────────── */
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

/* ── Helpers ────────────────────────────────────────────────────────────── */
function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  let mime = (header.match(/:(.*?);/) || [])[1] || 'image/png';
  mime = mime.toLowerCase().replace(/^image\/jpg$/, 'image/jpeg');
  const binary = atob(b64);
  const buf    = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/* ── AI Image Cutout ────────────────────────────────────────────────────── */
function showCutoutOverlay(show, msg, pct) {
  const overlay = document.getElementById('cutout-overlay');
  overlay.style.display = show ? 'flex' : 'none';
  if (msg) document.getElementById('cutout-msg').textContent = msg;
  if (pct != null) document.getElementById('cutout-bar').style.width = pct + '%';
}

async function cutoutImage() {
  const obj = canvas.getActiveObject();
  if (!obj || obj.type !== 'image') return;

  showCutoutOverlay(true, 'Loading AI model (first run: ~1-2 min WASM compile)…', 0);

  try {
    if (!removeBgFn) {
      showCutoutOverlay(true, 'Importing AI library…', 5);
      const mod = await import('https://esm.sh/@imgly/background-removal@1.4.5');
      removeBgFn = mod.removeBackground
        ?? mod.default?.removeBackground
        ?? (typeof mod.default === 'function' ? mod.default : null);
      if (typeof removeBgFn !== 'function') throw new Error('removeBackground not exported');
    }

    // Draw the canvas image element to a temp canvas → blob (works for any src, incl. asset://)
    const el = obj.getElement();
    const tmpC = document.createElement('canvas');
    tmpC.width = el.naturalWidth || el.width;
    tmpC.height = el.naturalHeight || el.height;
    tmpC.getContext('2d').drawImage(el, 0, 0);
    const blob = await new Promise(res => tmpC.toBlob(res, 'image/png'));

    showCutoutOverlay(true, 'Running AI background removal…', 10);

    const resultBlob = await removeBgFn(blob, {
      publicPath: 'vendor://background-removal/models/',
      model: 'small',
      output: { format: 'image/png', quality: 1 },
      progress: (key, current, total) => {
        if (total > 0) {
          const pct = Math.round(10 + (current / total) * 85);
          const label = key.includes('inference') ? 'Running inference' :
                        key.includes('fetch')     ? 'Loading model'     : 'Processing';
          showCutoutOverlay(true, label + '…', pct);
        }
      },
    });

    showCutoutOverlay(true, 'Applying result…', 97);

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

/* ── Undo / Redo ────────────────────────────────────────────────────────── */
function pushHistory() {
  if (activeSec < 0) return;
  const json = JSON.stringify(canvas.toJSON().objects);
  const h    = history[activeSec];
  const idx  = historyIdx[activeSec];
  h.splice(idx + 1);
  h.push(json);
  if (h.length > HISTORY_MAX) h.shift();
  historyIdx[activeSec] = h.length - 1;
}

const RECOVERY_MAX_BYTES = 10 * 1024 * 1024; // 10 MB — skip recovery if project is too large
let _recoveryTimer = null;
function scheduleRecovery() {
  clearTimeout(_recoveryTimer);
  _recoveryTimer = setTimeout(() => {
    // Skip saving if an active selection is live — canvas.toJSON() would return
    // group-relative coords which would corrupt sections[activeSec].objects.
    // onCanvasChange already called saveCurrentSectionObjects() synchronously,
    // so sections data is as fresh as it can be without a discard/restore cycle.
    const active = canvas.getActiveObject();
    if (!active || active.type !== 'activeSelection') {
      saveCurrentSectionObjects();
    }
    const snap = JSON.stringify({ version: 1, canvasW: CANVAS_W, sections, textStyles });
    if (snap.length > RECOVERY_MAX_BYTES) {
      setStatus('Project is large — auto-recovery skipped. Save manually (Ctrl+S).');
      return;
    }
    window.editorAPI.writeRecovery(snap).catch(() => {});
  }, 2000);
}

function onCanvasChange() {
  pushHistory();
  saveCurrentSectionObjects();
  markDirty();
  scheduleRecovery();
}

function restoreHistory(json) {
  canvas.off('object:added',   onCanvasChange);
  canvas.off('object:removed', onCanvasChange);
  canvas.remove(...canvas.getObjects());
  canvas.loadFromJSON({ version: '5.3.0', objects: JSON.parse(json) }, () => {
    canvas.renderAll();
    canvas.on('object:added',   onCanvasChange);
    canvas.on('object:removed', onCanvasChange);
    sections[activeSec].objects = JSON.parse(json);
  });
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

/* ── Zoom ───────────────────────────────────────────────────────────────── */
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
  // non-integer CSS pixel (e.g. left=60 → 71.16px at 1.19×), which
  // antialiases text edges and makes it look blurry. At 1.0 the canvas
  // scrolls horizontally only when the host is narrower than CANVAS_W.
  const z = Math.min(1.0, (host.clientWidth - 48) / CANVAS_W);
  setZoom(z);
}

/* ── Save / Load ────────────────────────────────────────────────────────── */
async function saveProject(saveAs) {
  clearTimeout(_recoveryTimer);
  snapshotCurrentSection();
  if (saveAs || !projectPath) {
    const p = await window.editorAPI.saveProject(projectPath);
    if (!p) return;
    projectPath = p;
    await window.editorAPI.setAssetDir(projectPath); // migrate temp assets → project assets folder
  }
  await window.editorAPI.writeFile(projectPath, JSON.stringify({ version: 1, canvasW: CANVAS_W, sections, textStyles }, null, 2));
  await window.editorAPI.setSettings({ lastProjectPath: projectPath });
  window.editorAPI.clearRecovery().catch(() => {});
  dirty = false;
  updateTitle();
  setStatus('Saved.');
}

async function openProject() {
  if (dirty && !confirm('Unsaved changes — open anyway?')) return;
  const result = await window.editorAPI.openProject();
  if (!result) return;
  projectPath = result.path;
  await window.editorAPI.setAssetDir(projectPath);
  await loadData(JSON.parse(result.data));
  await window.editorAPI.setSettings({ lastProjectPath: projectPath });
  window.editorAPI.clearRecovery().catch(() => {});
}

async function newProject() {
  if (dirty && !confirm('Unsaved changes — start new project?')) return;
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
    setStatus(`Migrating ${total} embedded images to files — this happens once…`);
    let done = 0;
    for (const sec of secs) {
      if (sec.bgImage && sec.bgImage.startsWith('data:')) {
        const ext  = (sec.bgImage.match(/data:image\/([a-z+]+)/) || [])[1] || 'png';
        const name = await window.editorAPI.importAssetData(sec.bgImage, ext);
        sec.bgImage = 'asset://' + name;
        setStatus(`Migrating images… ${++done}/${total}`);
      }
      for (const obj of (sec.objects || [])) {
        if (obj.type === 'image' && obj.src && obj.src.startsWith('data:')) {
          const ext  = (obj.src.match(/data:image\/([a-z+]+)/) || [])[1] || 'png';
          const name = await window.editorAPI.importAssetData(obj.src, ext);
          obj.src = 'asset://' + name;
          setStatus(`Migrating images… ${++done}/${total}`);
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
    setStatus('Loading fonts…');
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
  setStatus(total > 0 ? `Migrated ${total} images — press Ctrl+S to save the smaller project` : 'Opened.');
}

function initSections(defs) {
  sections   = defs.map(s => ({
    label: s.label, height: s.height, bg: s.bg || '#ffffff',
    bgImage: s.bgImage || null, bgSize: s.bgSize || 'cover',
    bgType: s.bgType || 'solid',
    bgGrad1: s.bgGrad1 || '#5a0a2e', bgGrad2: s.bgGrad2 || '#c9a84c',
    bgGradDir: s.bgGradDir || 'to bottom',
    bgTexture: s.bgTexture || 'dots', bgTexFg: s.bgTexFg || '#c9a84c', bgTexBg: s.bgTexBg || '#5a0a2e',
    objects: s.objects || [],
  }));
  history    = sections.map(s => [JSON.stringify(s.objects)]);
  historyIdx = sections.map(() => 0);
  activeSec  = -1;
  renderSectionList();
  switchSection(0);
}

/* ── Build Google Fonts URL for export ──────────────────────────────────── */
function buildGoogleFontsUrl(usedFonts) {
  const needed = [...usedFonts].filter(f => GOOGLE_FONTS.has(f));
  if (!needed.length) return '';
  const families = needed.map(f => {
    const slug = f.replace(/ /g, '+');
    return `${slug}:ital,wght@0,300;0,400;0,700;1,400`;
  }).join('&family=');
  return `https://fonts.googleapis.com/css2?family=${families}&display=swap`;
}

/* ── Export to HTML ─────────────────────────────────────────────────────── */
async function exportHTML() {
  clearTimeout(_recoveryTimer);
  snapshotCurrentSection();
  const destPath = await window.editorAPI.exportDir();
  if (!destPath) return;

  setStatus('Bundling assets…');
  try {
  // Pre-load every asset:// image as a data URL so the exported HTML is fully
  // self-contained — no separate images/ folder required.
  const assetNames = new Set();
  sections.forEach(sec => {
    if (sec.bgImage?.startsWith('asset://')) assetNames.add(assetName(sec.bgImage));
    (sec.objects || []).forEach(o => {
      if (o.type === 'image' && o.src?.startsWith('asset://')) assetNames.add(assetName(o.src));
    });
  });
  _assetCache = {};
  for (const name of assetNames) {
    const dataUrl = await window.editorAPI.readAsset(name);
    if (dataUrl) _assetCache['asset://' + name] = dataUrl;
  }

  const usedFonts = new Set();

  const sectionsHTML = sections.map(sec => {
    let bgStyle = sectionBgCSS(sec);
    if (sec.bgImage) {
      const bg = resolveImgUrl(sec.bgImage) || sec.bgImage;
      bgStyle = `background:url('${bg}') center/${sec.bgSize||'cover'} no-repeat, ${sec.bg};`;
    }
    const objsHtml = (sec.objects || []).map(o => objectToHTMLInline(o, sec, usedFonts)).join('\n');
    return `  <section class="bs" style="height:${sec.height}px;position:relative;${bgStyle}overflow:hidden;width:${CANVAS_W}px;margin:0 auto;">\n${objsHtml}\n  </section>`;
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
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #111; overflow-x: hidden; }
    #brochure-wrap { width: 100%; overflow: hidden; }
    #brochure-inner { transform-origin: top left; }
    .bs { box-sizing: border-box; }
  </style>
</head>
<body>
<div id="brochure-wrap"><div id="brochure-inner">
${sectionsHTML}
</div></div>
<script>
(function(){
  var W=${CANVAS_W};
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
})();
</script>
</body>
</html>`;

  await window.editorAPI.writeFile(destPath, html);
  setStatus('Exported to ' + destPath);
  } catch (e) {
    setStatus('Export failed: ' + (e && e.message ? e.message : String(e)));
  }
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

function buildTransform(angle, scaleX) {
  const parts = [];
  if (angle) parts.push(`rotate(${angle}deg)`);
  if (Math.abs((scaleX || 1) - 1) > 0.01) parts.push(`scaleX(${(scaleX).toFixed(3)})`);
  return parts.length ? `transform:${parts.join(' ')};transform-origin:top left;` : '';
}

function objectToHTML(o, sec, usedFonts, images, seenNames) {
  const pxL = fabricLeft(o) + 'px';
  const pxT = fabricTop(o)  + 'px';
  const rotateCss = o.angle  ? `transform:rotate(${o.angle}deg);transform-origin:top left;` : '';
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
    const ta  = (o.textAlign === 'justify-left') ? 'justify' : (o.textAlign || 'left');
    const lh  = (o.lineHeight || 1.16).toFixed(2);
    const w   = Math.round((o.width || 200) * sx);
    const ws  = (o.type === 'textbox') ? 'pre-wrap' : 'pre';
    const txf = buildTransform(o.angle, sx);
    const tsh = shadowToCSS(o.shadow);
    usedFonts.add(ff);
    return `    <p style="position:absolute;left:${pxL};top:${pxT};width:${w}px;` +
      `font-family:'${ff}',serif;font-size:${fz}px;font-weight:${fw};font-style:${fi};` +
      `text-decoration:${td};color:${col};text-align:${ta};line-height:${lh};` +
      `${txf}${tsh}${opacity}margin:0;padding:0;white-space:${ws};">` +
      `${escHtml(o.text || '')}</p>`;
  }

  if (o.type === 'image') {
    const name   = collectImage(o.src || '', seenNames, images);
    const w      = Math.round((o.width  || 100) * (o.scaleX || 1));
    const h      = Math.round((o.height || 100) * (o.scaleY || 1));
    const border = (o.strokeWidth > 0) ? `border:${o.strokeWidth}px solid ${safeColor(o.stroke,'#000')};` : '';
    return `    <img src="images/${name}" alt="" style="position:absolute;left:${pxL};top:${pxT};` +
      `width:${w}px;height:${h}px;${border}${rotateCss}${opacity}">`;
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
    const name = src.slice(8); // strip 'asset://'
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

/* ── Preview ────────────────────────────────────────────────────────────── */

// Populated before preview HTML is generated; maps 'asset://name' → data URL.
// Allows objectToHTMLInline to inline asset images without async calls.
let _assetCache = {};
function assetName(src) {
  // Chromium normalises asset://img.png → asset://img.png/ (adds trailing slash for empty path).
  // Use URL.hostname to reliably strip the scheme + any trailing slash.
  try { return new URL(src).hostname; } catch { return src.slice(8); }
}

function resolveImgUrl(src) {
  if (!src) return '';
  if (src.startsWith('asset://')) return _assetCache['asset://' + assetName(src)] || '';
  return src;
}

async function previewHTML() {
  clearTimeout(_recoveryTimer);
  snapshotCurrentSection();
  setStatus('Generating preview…');
  try {
  // Load all referenced asset images as data URLs so the preview file is self-contained.
  const assetNames = new Set();
  sections.forEach(sec => {
    if (sec.bgImage?.startsWith('asset://')) assetNames.add(assetName(sec.bgImage));
    (sec.objects || []).forEach(o => {
      if (o.type === 'image' && o.src?.startsWith('asset://')) assetNames.add(assetName(o.src));
    });
  });
  _assetCache = {};
  for (const name of assetNames) {
    const dataUrl = await window.editorAPI.readAsset(name);
    if (dataUrl) _assetCache['asset://' + name] = dataUrl;
  }

  const usedFonts = new Set();

  // Inline images as data-URIs so the temp file is self-contained
  const sectionsHTML = sections.map(sec => {
    let bgStyle = sectionBgCSS(sec);
    if (sec.bgImage) {
      const bg = resolveImgUrl(sec.bgImage) || sec.bgImage;
      bgStyle = `background:url('${bg}') center/${sec.bgSize||'cover'} no-repeat, ${sec.bg};`;
    }
    const objsHtml = (sec.objects || []).map(o => objectToHTMLInline(o, sec, usedFonts)).join('\n');
    return `  <section class="bs" style="height:${sec.height}px;position:relative;${bgStyle}overflow:hidden;width:${CANVAS_W}px;">\n${objsHtml}\n  </section>`;
  }).join('\n\n');

  const totalHeight = sections.reduce((s, sec) => s + (sec.height || 600), 0);
  const PHONE_W = 390;
  const scale = PHONE_W / CANVAS_W;
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
.phone-frame{width:406px;border-radius:48px;border:8px solid #444;background:#000;box-shadow:0 0 0 1px #555,0 32px 80px rgba(0,0,0,0.7);overflow:hidden;position:relative}
.phone-notch{width:120px;height:30px;background:#000;border-radius:0 0 20px 20px;position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:10}
.phone-screen{overflow:hidden;position:relative;height:${scaledH}px}
.phone-content{transform-origin:top left;transform:scale(${scale.toFixed(4)});width:${CANVAS_W}px;position:absolute;top:0;left:0}
.bs{position:relative;overflow:hidden}
</style>
</head>
<body>
<div class="preview-label">Mobile Preview — 390px</div>
<div class="phone-frame">
  <div class="phone-notch"></div>
  <div class="phone-screen">
    <div class="phone-content">
${sectionsHTML}
    </div>
  </div>
</div>
</body>
</html>`;

  await window.editorAPI.previewOpen(html);
  setStatus('Preview opened in browser.');
  } catch (e) {
    setStatus('Preview failed: ' + (e && e.message ? e.message : String(e)));
  }
}

function objectToHTMLInline(o, sec, usedFonts) {
  const pxL  = fabricLeft(o) + 'px';
  const pxT  = fabricTop(o)  + 'px';
  const angle = o.angle ? `transform:rotate(${o.angle}deg);transform-origin:top left;` : '';
  const opacity = (o.opacity != null && o.opacity < 1) ? `opacity:${o.opacity.toFixed(2)};` : '';

  if (o.type === 'i-text' || o.type === 'textbox') {
    const ff  = o.fontFamily || 'Georgia';
    const sx  = o.scaleX || 1;
    const sy  = o.scaleY || 1;
    const fz  = Math.round((o.fontSize || 16) * sy);
    const fw  = o.fontWeight  || 'normal';
    const fi  = o.fontStyle   || 'normal';
    const td  = o.underline   ? 'underline' : 'none';
    const col = safeColor(o.fill, '#000000');
    const ta  = (o.textAlign === 'justify-left') ? 'justify' : (o.textAlign || 'left');
    const lh  = (o.lineHeight || 1.16).toFixed(2);
    const w   = Math.round((o.width || 200) * sx);
    const ws  = (o.type === 'textbox') ? 'pre-wrap' : 'pre';
    const txf = buildTransform(o.angle, sx);
    const tsh = shadowToCSS(o.shadow);
    usedFonts.add(ff);
    return `    <p style="position:absolute;left:${pxL};top:${pxT};width:${w}px;` +
      `font-family:'${ff}',serif;font-size:${fz}px;font-weight:${fw};font-style:${fi};` +
      `text-decoration:${td};color:${col};text-align:${ta};line-height:${lh};` +
      `${txf}${tsh}${opacity}margin:0;padding:0;white-space:${ws};">` +
      `${escHtml(o.text || '')}</p>`;
  }

  if (o.type === 'image') {
    const src    = resolveImgUrl(o.src); // asset:// → data URL; blob:// → ''
    const w      = Math.round((o.width  || 100) * (o.scaleX || 1));
    const h      = Math.round((o.height || 100) * (o.scaleY || 1));
    const border = (o.strokeWidth > 0) ? `border:${o.strokeWidth}px solid ${safeColor(o.stroke,'#000')};` : '';
    if (!src) return '';
    return `    <img src="${src}" alt="" style="position:absolute;left:${pxL};top:${pxT};` +
      `width:${w}px;height:${h}px;${border}${angle}${opacity}">`;
  }

  if (['rect','circle','ellipse','triangle'].includes(o.type)) {
    const w  = Math.round((o.width  || 100) * (o.scaleX || 1));
    const h  = Math.round((o.height || 100) * (o.scaleY || 1));
    const bg = safeColor(o.fill,   'transparent');
    const bc = safeColor(o.stroke, 'transparent');
    const bw = o.strokeWidth || 0;
    const br = (o.type === 'circle' || o.type === 'ellipse') ? 'border-radius:50%;' : '';
    return `    <div style="position:absolute;left:${pxL};top:${pxT};width:${w}px;height:${h}px;` +
      `background:${bg};border:${bw}px solid ${bc};${br}${angle}${opacity}"></div>`;
  }
  return '';
}

/* ── Status / title helpers ─────────────────────────────────────────────── */
function setStatus(msg) { document.getElementById('status-msg').textContent = msg; }
function markDirty() { dirty = true; updateTitle(); }
function updateTitle() {
  const name = projectPath ? projectPath.split(/[/\\]/).pop() : 'Untitled';
  document.getElementById('status-project').textContent = (dirty ? '● ' : '') + name;
}

/* ── Keyboard shortcuts ─────────────────────────────────────────────────── */
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
// Snap an object's left/top so they land on integer physical pixels.
// At Windows 125 % scaling (DPR=1.25) an object at left=84.3 maps to
// buffer pixel 105.375 — non-integer → blurry text edges.  After snapping:
// left = Math.round(84.3 * 1.25) / 1.25 = 84.8, buffer pixel = 106. ✓
function snapObjToPixel(obj) {
  if (!obj) return;
  const dpr = window.devicePixelRatio || 1;
  const sl  = Math.round(obj.left * dpr) / dpr;
  const st  = Math.round(obj.top  * dpr) / dpr;
  if (sl !== obj.left || st !== obj.top) {
    obj.set({ left: sl, top: st });
    obj.setCoords();
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

/* ── Menu events ────────────────────────────────────────────────────────── */
function bindMenuEvents() {
  const api = window.editorAPI;
  api.onMenu('menu:new',       () => newProject());
  api.onMenu('menu:open',      () => openProject());
  api.onMenu('menu:save',      () => saveProject(false));
  api.onMenu('menu:save-as',   () => saveProject(true));
  api.onMenu('menu:export',    () => exportHTML());
  api.onMenu('menu:undo',      () => undo());
  api.onMenu('menu:redo',      () => redo());
  api.onMenu('menu:delete',    () => deleteSelected());
  api.onMenu('menu:duplicate', () => duplicateSelected());
  api.onMenu('menu:zoom-in',   () => setZoom(zoom + ZOOM_STEP));
  api.onMenu('menu:zoom-out',  () => setZoom(zoom - ZOOM_STEP));
  api.onMenu('menu:zoom-fit',  () => zoomFit());
}

/* ── Bootstrap ──────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  buildFontPicker();
  renderTextStyles();
  initCanvas();
  bindToolbar();
  bindSectionProps();
  bindKeyboard();
  bindMenuEvents();
  document.getElementById('btn-add-section').addEventListener('click', addSection);

  // Try to resume: saved project → recovery snapshot → default template
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
        setStatus('Recovered unsaved work — press Ctrl+S to save.');
        resumed = true;
      }
    } catch (e) { /* corrupt recovery */ }
  }

  if (!resumed) {
    initSections(DEFAULT_SECTIONS);
    setStatus('Ready — drag images, click T for text, ▭ for shapes.');
  }

  updateTitle();
  setTimeout(zoomFit, 100);
});
