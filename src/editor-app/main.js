const { app, BrowserWindow, ipcMain, dialog, Menu, protocol, net, shell, clipboard, nativeImage } = require('electron');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const https  = require('https');
const zlib   = require('zlib');
const { PNG } = require('pngjs');
const PDFDocument = require('pdfkit');

// Raise the renderer V8 heap limit so large projects can load during migration.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

const VENDOR_ROOT = path.join(__dirname, '..', 'editor', 'vendor');

// â”€â”€ Asset directory tracking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// null  = no project saved yet â†’ use temp-assets in userData
// path  = <project-dir>/<name>-assets/
let projectAssetsDir = null;

function getTempAssetsDir() {
  return path.join(app.getPath('userData'), 'temp-assets');
}
function getAssetsDir() {
  if (projectAssetsDir) return projectAssetsDir;
  const tmp = getTempAssetsDir();
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
  return tmp;
}
function assetsPathFor(projectFilePath) {
  return path.join(
    path.dirname(projectFilePath),
    path.basename(projectFilePath, '.brochure') + '-assets'
  );
}

// â”€â”€ Custom schemes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
protocol.registerSchemesAsPrivileged([
  { scheme: 'vendor', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true, stream: true } },
  { scheme: 'asset',  privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true } },
]);

let mainWindow;

const SETTINGS_FILE = path.join(app.getPath('userData'), 'editor-settings.json');
const RECOVERY_FILE = path.join(app.getPath('userData'), 'recovery.brochure');
function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { return {}; }
}
function writeSettings(obj) {
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(obj, null, 2), 'utf8'); } catch {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  buildMenu();
}

// â”€â”€ vendor:// protocol â€” serves src/editor/vendor/<pkg>/<rest> â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function registerVendorProtocol() {
  const MIME = {
    '.mjs':  'application/javascript',
    '.js':   'application/javascript',
    '.wasm': 'application/wasm',
    '.json': 'application/json',
    '.bin':  'application/octet-stream',
    '.onnx': 'application/octet-stream',
  };
  protocol.handle('vendor', (request) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    try {
      const url  = new URL(request.url);
      const rel  = url.hostname + url.pathname;
      const file = path.join(VENDOR_ROOT, rel);
      if (!fs.existsSync(file)) return new Response('Not found: ' + rel, { status: 404 });
      const data = fs.readFileSync(file);
      const ext  = path.extname(file).toLowerCase();
      return new Response(data, { headers: { ...corsHeaders, 'Content-Type': MIME[ext] || 'application/octet-stream' } });
    } catch (e) {
      return new Response(e.message, { status: 500, headers: corsHeaders });
    }
  });
}

// â”€â”€ asset:// protocol â€” serves image assets from the project assets folder â”€â”€â”€â”€
function registerAssetProtocol() {
  const MIME = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  };
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD' };
  protocol.handle('asset', (request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      const url  = new URL(request.url);
      // asset://img_abc123.jpg â†’ hostname = "img_abc123.jpg"
      const name = decodeURIComponent(url.hostname);
      const file = path.join(getAssetsDir(), name);
      if (!fs.existsSync(file)) return new Response('Not found: ' + name, { status: 404, headers: CORS });
      const data = fs.readFileSync(file);
      const mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      return new Response(data, { headers: { ...CORS, 'Content-Type': mime, 'Cache-Control': 'max-age=3600' } });
    } catch (e) {
      return new Response(e.message, { status: 500, headers: CORS });
    }
  });
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Project',  accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu:new') },
        { label: 'Openâ€¦',        accelerator: 'CmdOrCtrl+O', click: openProject },
        { label: 'Save',         accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu:save') },
        { label: 'Save Asâ€¦',     accelerator: 'CmdOrCtrl+Shift+S', click: saveProjectAs },
        { type: 'separator' },
        { label: 'Export to HTML/CSSâ€¦', accelerator: 'CmdOrCtrl+E',       click: () => mainWindow.webContents.send('menu:export') },
        { label: 'Export for Print (PNG)â€¦', accelerator: 'CmdOrCtrl+Shift+P', click: () => mainWindow.webContents.send('menu:export-print') },
        { label: 'Export PDF (CMYK)â€¦',      accelerator: 'CmdOrCtrl+Shift+D', click: () => mainWindow.webContents.send('menu:export-pdf') },
        { label: 'Export Digital PDF (sRGB)â€¦', accelerator: 'CmdOrCtrl+Shift+G', click: () => mainWindow.webContents.send('menu:export-digital-pdf') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow.webContents.send('menu:undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => mainWindow.webContents.send('menu:redo') },
        { type: 'separator' },
        { label: 'Delete Selected', accelerator: 'Delete', click: () => mainWindow.webContents.send('menu:delete') },
        { label: 'Duplicate Selected', accelerator: 'CmdOrCtrl+D', click: () => mainWindow.webContents.send('menu:duplicate') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In',  accelerator: 'CmdOrCtrl+=', click: () => mainWindow.webContents.send('menu:zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => mainWindow.webContents.send('menu:zoom-out') },
        { label: 'Fit Section', accelerator: 'CmdOrCtrl+0', click: () => mainWindow.webContents.send('menu:zoom-fit') },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// â”€â”€ IPC handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ipcMain.handle('dialog:openProject', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Brochure Project', extensions: ['brochure'] }],
    properties: ['openFile'],
  });
  if (canceled) return null;
  return { path: filePaths[0], data: fs.readFileSync(filePaths[0], 'utf8') };
});

ipcMain.handle('dialog:saveProject', async (_e, defaultPath) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultPath || 'brochure.brochure',
    filters: [{ name: 'Brochure Project', extensions: ['brochure'] }],
  });
  return canceled ? null : filePath;
});

ipcMain.handle('fs:writeFile', async (_e, filePath, data) => {
  fs.writeFileSync(filePath, data, 'utf8');
  return true;
});

// Write brochure.html + images/ to a target directory for GitHub Pages hosting.
// PNGs wider than 900px (2Ã— the 450px canvas) are resized with nativeImage to
// shrink AI-cutout files from 30â€“50 MB down to a few hundred KB. WebP/JPEG are
// already compressed and copied as-is.
ipcMain.handle('export:writeToRepo', async (_e, dir, html, assetNames) => {
  const MAX_W = 900;
  const imgDir = path.join(dir, 'images');
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'brochure.html'), html, 'utf8');
  const src = getAssetsDir();
  for (const name of (assetNames || [])) {
    const srcFile = path.join(src, name);
    if (!fs.existsSync(srcFile)) { console.warn('asset not found:', srcFile); continue; }
    const destFile = path.join(imgDir, name);
    if (path.extname(name).toLowerCase() === '.png') {
      try {
        const img = nativeImage.createFromPath(srcFile);
        const { width } = img.getSize();
        if (width > MAX_W) {
          fs.writeFileSync(destFile, img.resize({ width: MAX_W, quality: 'better' }).toPNG());
          continue;
        }
      } catch (e) { console.warn('resize failed, copying original:', name, e.message); }
    }
    fs.copyFileSync(srcFile, destFile);
  }
  return true;
});

// Return source paths only â€” no base64. The renderer calls asset:import to copy.
ipcMain.handle('dialog:openImages', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled) return [];
  return filePaths.map(p => ({ name: path.basename(p), srcPath: p }));
});

ipcMain.handle('dialog:exportDir', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Export â€” choose target folder (brochure.html + images/ will be written here)',
    buttonLabel: 'Export here',
  });
  return canceled ? null : filePaths[0];
});

// Save rendered section images (PNG data URLs) to a folder.
ipcMain.handle('export:savePrintImages', async (_e, dir, images) => {
  fs.mkdirSync(dir, { recursive: true });
  for (const { name, dataUrl } of (images || [])) {
    const b64 = (dataUrl || '').split(',')[1];
    if (b64) fs.writeFileSync(path.join(dir, name), Buffer.from(b64, 'base64'));
  }
  return true;
});

// Assemble a print-ready PDF from rendered PNG sections.
// PNGs are embedded as sRGB via pdfkit's native image support â€” colors match
// the screen exactly. Print shops' RIPs convert to press CMYK with ICC
// profiles, which is more accurate than a profile-less software conversion.
ipcMain.handle('export:toPdf', async (_e, dir, images, spec) => {
  const { wIn = 6, hIn = 8.5, filename = 'brochure-print.pdf' } = spec || {};
  const PT_PER_IN = 72;
  const pageW = wIn * PT_PER_IN;
  const pageH = hIn * PT_PER_IN;

  fs.mkdirSync(dir, { recursive: true });
  const destPath = path.join(dir, filename);

  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    info: { Title: 'Arangetram Brochure', Creator: 'Arangetram Editor' },
  });
  const ws = fs.createWriteStream(destPath);
  doc.pipe(ws);

  for (const { dataUrl } of (images || [])) {
    const b64 = (dataUrl || '').split(',')[1];
    if (!b64) continue;
    const buf = Buffer.from(b64, 'base64');
    doc.addPage({ size: [pageW, pageH], margin: 0 });
    doc.image(buf, 0, 0, { width: pageW, height: pageH });
  }

  doc.end();
  return new Promise((resolve, reject) => {
    ws.on('finish', () => resolve(destPath));
    ws.on('error', reject);
  });
});

// â”€â”€ CMYK PDF helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function httpGet(url, headers, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const opts = Object.assign({ headers: Object.assign({ 'User-Agent': 'Mozilla/5.0' }, headers || {}) }, require('url').parse(url));
    const req = https.get(opts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(httpGet(res.headers.location, headers, timeoutMs));
        return;
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error(`httpGet timeout: ${url.slice(0, 80)}`)); });
  });
}

const FONT_CACHE_DIR = path.join(app.getPath('userData'), 'pdf-fonts');

// pdfkit built-in equivalents for system fonts used in the editor.
const SYSTEM_FONT_MAP = {
  'Georgia':         { n: 'Times-Roman',    b: 'Times-Bold',          i: 'Times-Italic',          bi: 'Times-BoldItalic'       },
  'Times New Roman': { n: 'Times-Roman',    b: 'Times-Bold',          i: 'Times-Italic',          bi: 'Times-BoldItalic'       },
  'Arial':           { n: 'Helvetica',      b: 'Helvetica-Bold',      i: 'Helvetica-Oblique',     bi: 'Helvetica-BoldOblique'  },
  'Verdana':         { n: 'Helvetica',      b: 'Helvetica-Bold',      i: 'Helvetica-Oblique',     bi: 'Helvetica-BoldOblique'  },
  'Trebuchet MS':    { n: 'Helvetica',      b: 'Helvetica-Bold',      i: 'Helvetica-Oblique',     bi: 'Helvetica-BoldOblique'  },
  'Impact':          { n: 'Helvetica-Bold', b: 'Helvetica-Bold',      i: 'Helvetica-BoldOblique', bi: 'Helvetica-BoldOblique'  },
};

// Download a Google Font as TTF/OTF and cache it. Returns Buffer or null on failure.
// targetCodepoint (optional): when set, selects the @font-face block whose unicode-range
// covers that codepoint â€” required for non-Latin fonts (e.g. Noto Sans Tamil U+0B89)
// because Google Fonts CSS splits the font into per-script subsets; taking the first URL
// blindly gives the Latin block which has no Tamil glyphs.
async function fetchGoogleFont(family, weight, italic, targetCodepoint) {
  const cacheKey = `${family.replace(/\s+/g, '_')}_${weight}_${italic ? 'i' : 'n'}.ttf`;
  const cachePath = path.join(FONT_CACHE_DIR, cacheKey);
  if (fs.existsSync(cachePath)) return fs.readFileSync(cachePath);

  const TTF_RE = /url\(['"]?([^'")\s]+\.(?:ttf|otf))['"]?\)/i;

  // Parse @font-face blocks from CSS; return the src URL covering targetCodepoint,
  // or the first URL found when no targetCodepoint is specified.
  function pickFontUrl(css, cp) {
    const blocks = css.split('@font-face').slice(1);
    let firstUrl = null;
    for (const block of blocks) {
      const urlM = block.match(TTF_RE);
      if (!urlM) continue;
      if (!firstUrl) firstUrl = urlM[1];
      if (!cp) return firstUrl; // No target â€” first URL wins
      const rangeM = block.match(/unicode-range\s*:\s*([^;]+)/i);
      if (!rangeM) return urlM[1]; // No range constraint = full font
      const covered = rangeM[1].split(',').some(r => {
        r = r.trim().replace(/^U\+/i, '');
        if (r.includes('-')) {
          const [s, e] = r.split('-').map(x => parseInt(x, 16));
          return cp >= s && cp <= e;
        }
        return parseInt(r, 16) === cp;
      });
      if (covered) return urlM[1];
    }
    return firstUrl; // Fallback: first URL in file
  }

  try {
    // Attempt 1: v1 API â€” returns full TTF for most older fonts, no subsetting.
    const styleStr = italic ? `${weight}italic` : weight;
    const v1Css = (await httpGet(
      `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:${styleStr}`,
      { 'User-Agent': 'Mozilla/5.0' }
    )).toString('utf8');
    let fontUrl = pickFontUrl(v1Css, targetCodepoint);

    // Attempt 2: v2 API with old IE UA forces TTF/OTF for newer fonts (e.g. Noto Sans Tamil).
    // The v2 CSS lists multiple @font-face blocks with unicode-range; pickFontUrl selects
    // the block covering targetCodepoint so we download the Tamil subset, not the Latin one.
    if (!fontUrl) {
      const v2Css = (await httpGet(
        `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@${italic ? 1 : 0},${weight}`,
        { 'User-Agent': 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)' }
      )).toString('utf8');
      fontUrl = pickFontUrl(v2Css, targetCodepoint);
    }

    if (!fontUrl) return null;
    const buf = await httpGet(fontUrl);
    if (!fs.existsSync(FONT_CACHE_DIR)) fs.mkdirSync(FONT_CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath, buf);
    return buf;
  } catch { return null; }
}

// Convert hex color to CMYK [c,m,y,k] (0â€“1 range, float).
function hexToCmyk(hex) {
  const c = parseInt(hex.slice(1), 16);
  const r = ((c >> 16) & 0xff) / 255;
  const g = ((c >>  8) & 0xff) / 255;
  const b = (  c        & 0xff) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return [0, 0, 0, 1];
  return [
    (1 - r - k) / (1 - k),
    (1 - g - k) / (1 - k),
    (1 - b - k) / (1 - k),
    k,
  ];
}

// Decode a PNG buffer and return a raw DeviceCMYK XObject reference for pdfkit.
function pngToCmykXObject(pngBuf, doc, pageW, pageH) {
  const png  = PNG.sync.read(pngBuf);
  const imgW = png.width;
  const imgH = png.height;
  const src  = png.data; // RGBA, 4 bytes/pixel
  const cmyk = Buffer.allocUnsafe(imgW * imgH * 4);

  for (let i = 0, j = 0; i < src.length; i += 4, j += 4) {
    // Composite pixel over white (handle transparency).
    const a  = src[i + 3] / 255;
    const r  = src[i    ] / 255 * a + (1 - a);
    const g  = src[i + 1] / 255 * a + (1 - a);
    const b  = src[i + 2] / 255 * a + (1 - a);
    const k  = 1 - Math.max(r, g, b);
    if (k >= 1) { cmyk[j]=0; cmyk[j+1]=0; cmyk[j+2]=0; cmyk[j+3]=255; continue; }
    cmyk[j    ] = Math.round((1 - r - k) / (1 - k) * 255);
    cmyk[j + 1] = Math.round((1 - g - k) / (1 - k) * 255);
    cmyk[j + 2] = Math.round((1 - b - k) / (1 - k) * 255);
    cmyk[j + 3] = Math.round(k * 255);
  }

  const compressed = zlib.deflateSync(cmyk);
  const xobj = doc.ref({
    Type:             'XObject',
    Subtype:          'Image',
    Width:            imgW,
    Height:           imgH,
    ColorSpace:       'DeviceCMYK',
    BitsPerComponent: 8,
    Filter:           'FlateDecode',
    Length:           compressed.length,
  });
  xobj.write(compressed);
  xobj.end();
  return { ref: xobj, imgW, imgH };
}

// Assemble vector PDF: DeviceCMYK background images (via pngToCmykXObject) + DeviceRGB vector text.
ipcMain.handle('export:toPdfVector', async (_e, dir, pdfSections, googleFontsList, spec) => {
  // Collect logs to return to renderer (they appear in DevTools console, not terminal).
  const logs = [];
  const plog = (...a) => { const m = a.join(' '); console.log(m); logs.push(m); };
  const pwarn = (...a) => { const m = '[WARN] ' + a.join(' '); console.warn(m); logs.push(m); };
  const perr = (...a) => { const m = '[ERR] ' + a.join(' '); console.error(m); logs.push(m); };

  const { wIn = 6, hIn = 8.5, canvasW = 794 } = spec || {};
  const PT_PER_IN = 72;
  const pageW = wIn * PT_PER_IN;
  const pageH = hIn * PT_PER_IN;
  const scale = pageW / canvasW; // canvas pixels â†’ PDF points

  fs.mkdirSync(dir, { recursive: true });
  const destPath = path.join(dir, 'brochure-print.pdf');

  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    info: { Title: 'Arangetram Brochure', Creator: 'Arangetram Editor' },
  });

  // Pre-load fonts into pdfkit (register each family/style combination found).
  const registeredFonts = new Map(); // key â†’ pdfkit font name
  const weights = ['400', '700'];
  plog(`[PDF fonts] families to load: ${JSON.stringify(googleFontsList)}`);
  for (const family of (googleFontsList || [])) {
    for (const w of weights) {
      for (const italic of [false, true]) {
        plog(`[PDF fonts] fetching: ${family} w=${w} italic=${italic}`);
        let buf = null;
        try { buf = await fetchGoogleFont(family, w, italic); } catch (e) { pwarn(`[PDF fonts] fetch threw: ${e && e.message}`); }
        if (!buf) { pwarn(`[PDF fonts] SKIP (no buf): ${family} w=${w} italic=${italic}`); continue; }
        const key = `${family}|${w}|${italic ? 'i' : 'n'}`;
        const regName = `GF_${family.replace(/\s+/g, '_')}_${w}${italic ? 'i' : 'n'}`;
        try {
          doc.registerFont(regName, buf);
          registeredFonts.set(key, regName);
          plog(`[PDF fonts] OK: ${regName} (${buf.length} bytes)`);
        } catch (e) {
          perr(`[PDF fonts] REGISTER ERROR: ${regName} â€” ${e && e.message}`);
        }
      }
    }
  }
  plog(`[PDF fonts] done â€” ${registeredFonts.size} variants registered, starting page renderâ€¦`);

  // Pre-register Noto Sans Tamil if any text object contains Tamil Unicode characters (U+0B80â€“U+0BFF).
  const TAMIL_RE = /[à®€-à¯¿]/;
  let tamilFontName = null;
  const hasTamilText = (pdfSections || []).some(s => (s.textData || []).some(t => TAMIL_RE.test(t.text || '')));
  if (hasTamilText) {
    plog(`[PDF fonts] Tamil text detected â€” fetching Noto Sans Tamil`);
    try {
      const tamilBuf = await fetchGoogleFont('Noto Sans Tamil', '400', false, 0x0B89);
      if (tamilBuf) {
        doc.registerFont('NotoSansTamil', tamilBuf);
        tamilFontName = 'NotoSansTamil';
        plog(`[PDF fonts] Noto Sans Tamil registered (${tamilBuf.length} bytes)`);
      } else {
        pwarn(`[PDF fonts] Noto Sans Tamil fetch returned null â€” Tamil glyphs will be missing`);
      }
    } catch (e) {
      pwarn(`[PDF fonts] Noto Sans Tamil fetch failed: ${e && e.message}`);
    }
  }

  function getPdfFont(family, weight, italic) {
    const isBold = weight === 'bold' || parseInt(weight) >= 700;
    if (SYSTEM_FONT_MAP[family]) {
      const m = SYSTEM_FONT_MAP[family];
      if (isBold && italic) return m.bi;
      if (isBold)           return m.b;
      if (italic)           return m.i;
      return m.n;
    }
    const wNorm = isBold ? '700' : '400';
    const key = `${family}|${wNorm}|${italic ? 'i' : 'n'}`;
    return registeredFonts.get(key) || registeredFonts.get(`${family}|400|n`) || 'Helvetica';
  }

  const ws = fs.createWriteStream(destPath);
  doc.pipe(ws);

  let pageIdx = 0;
  for (const { bgDataUrl, textData } of (pdfSections || [])) {
    pageIdx++;
    doc.addPage({ size: [pageW, pageH], margin: 0 });

    if (bgDataUrl) {
      const b64 = bgDataUrl.split(',')[1];
      if (b64) {
        try {
          const pngBuf = Buffer.from(b64, 'base64');
          const { ref } = pngToCmykXObject(pngBuf, doc, pageW, pageH);
          const xName = `CMYKBg${pageIdx}`;
          doc.page.xobjects[xName] = ref;
          doc.save();
          doc.transform(pageW, 0, 0, -pageH, 0, pageH);
          doc.addContent(`/${xName} Do`);
          doc.restore();
        }
        catch (e) { perr(`[PDF main] bg image failed: ${e && e.message}`); }
      }
    }

    plog(`[PDF main] page â€” textData count: ${(textData || []).length}`);
    for (const t of (textData || [])) {
      const x  = t.left * scale;
      // Clamp to page top â€” canvas objects positioned â‰¤1px above the section render
      // at slightly negative PDF y (e.g. yâ‰ˆ-0.27 pts), which pdfkit clips silently.
      const y  = Math.max(0, t.top * scale);
      const fs = t.fontSize * scale;

      plog(`[PDF main]   text "${(t.text||'').slice(0,30).replace(/\n/g,'\\n')}" x=${x.toFixed(1)} y=${y.toFixed(1)} fs=${fs.toFixed(1)} font=${t.fontFamily} fill=${t.fill}`);

      if (!Number.isFinite(x) || !Number.isFinite(y) || fs < 0.5) {
        pwarn(`[PDF main]   SKIP bad coords/size x=${x} y=${y} fs=${fs}`);
        continue;
      }
      if (y >= pageH) {
        pwarn(`[PDF main]   SKIP off-page y=${y.toFixed(1)} >= pageH=${pageH}`);
        continue;
      }

      const fontName  = (tamilFontName && TAMIL_RE.test(t.text || ''))
                        ? tamilFontName
                        : getPdfFont(t.fontFamily, t.fontWeight, t.fontStyle === 'italic');
      const fillColor = (typeof t.fill === 'string' && t.fill) ? t.fill : '#000000';
      const textW     = Math.max(1, t.width * scale);
      let   alignOpt  = t.textAlign || 'left';
      if (alignOpt === 'justify-left') alignOpt = 'justify';

      plog(`[PDF main]     â†’ font=${fontName} color=${fillColor} w=${textW.toFixed(1)}`);

      try {
        doc.save();
        if (t.angle) {
          const cx = (t.left + t.width  / 2) * scale;
          const cy = (t.top  + t.height / 2) * scale;
          doc.translate(cx, cy).rotate(-t.angle).translate(-cx, -cy);
        }
        if (t.opacity < 1) doc.opacity(t.opacity);
        doc.fillColor(fillColor);
        doc.font(fontName).fontSize(fs);
        if (t.text) {
          if (t.textLines && t.textLines.length) {
            // Line-by-line with explicit y coordinates and lineBreak:false.
            // This is the only approach that prevents pdfkit from re-flowing text
            // with its own metrics (which differ from Canvas2D/Fabric) and from
            // inserting extra lines when there is insufficient space between text boxes.
            // Each line is placed at the exact y Fabric computed; pdfkit never advances
            // the cursor on its own.
            const lines = t.textLines;
            const lineH = fs * (t.lineHeight || 1.16);
            const isJust = alignOpt === 'justify';
            let rendered = 0;
            for (let li = 0; li < lines.length; li++) {
              // Trim: Fabric preserves leading/trailing spaces from the original text
              // (e.g. "\n Para two") which pdfkit renders as visible space characters.
              const line  = lines[li].trim();
              const lineY = y + li * lineH;
              if (lineY >= pageH) break; // Beyond page â€” skip; never let pdfkit auto-add pages.
              if (!line) { rendered++; continue; } // Empty paragraph line â€” occupy the slot, skip render.

              // isParaEnd: true for the last wrapped line of each paragraph and for the
              // very last line of the text box. These must NOT be justified â€” a para-end
              // line should stay left-aligned so it doesn't stretch to fill the width.
              const isParaEnd = t.isParaEnd ? t.isParaEnd[li] : (li === lines.length - 1);

              if (isJust && !isParaEnd && line.includes(' ')) {
                // Non-para-end justify: distribute surplus width across word gaps.
                // doc.widthOfString uses fontkit metrics; small deviations from Canvas2D
                // are acceptable â€” positions are driven by explicit lineY, not re-flow.
                const naturalW    = doc.widthOfString(line);
                const wordGaps    = line.split(' ').length - 1;
                const wordSpacing = wordGaps > 0 ? Math.max(0, (textW - naturalW) / wordGaps) : 0;
                doc.text(line, x, lineY, { lineBreak: false, wordSpacing });
              } else {
                // Para-end or non-justify: left-align the last line of each paragraph.
                const lineAlign = (isJust && isParaEnd) ? 'left' : alignOpt;
                doc.text(line, x, lineY, { width: textW, lineBreak: false, align: lineAlign });
              }
              rendered++;
            }
            plog(`[PDF main]     âœ“ rendered ${rendered}/${lines.length} line(s)`);
          } else {
            // Fallback: pdfkit re-flow when textLines unavailable (should not happen
            // in normal operation â€” live Fabric objects always have textLines).
            const remainingH = Math.max(1, pageH - y);
            doc.text(t.text, x, y, { width: textW, height: remainingH, align: alignOpt, lineBreak: true });
            plog(`[PDF main]     âœ“ rendered (reflow fallback)`);
          }
        } else {
          pwarn(`[PDF main]     SKIP empty text`);
        }
        doc.restore();
      } catch (_err) {
        perr(`[PDF main]   ERROR: ${_err && _err.message}`);
        try { doc.restore(); } catch {}
      }
    }
  }

  doc.end();
  return new Promise((resolve, reject) => {
    ws.on('finish', () => resolve({ destPath, logs }));
    ws.on('error', reject);
  });
});

// Two-up PNG: sections 4 + 5 side-by-side on 12"Ã—8.5" landscape (3600Ã—2550 @ 300 DPI).
// Each slot is 1800Ã—2550px = exactly 6"Ã—8.5" â€” matches the editor's per-section canvas.
// No CMYK conversion â€” original RGB colors are preserved exactly.
ipcMain.handle('export:twoUp', async (_e, dir, images) => {
  const OUT_W = 3600, OUT_H = 2550;
  const halfW = OUT_W >> 1;  // 1800 px per slot (6" Ã— 300 DPI)

  // White background in BGRA (nativeImage.createFromBitmap requires BGRA)
  const outBuf = Buffer.alloc(OUT_W * OUT_H * 4, 255);

  for (let side = 0; side < Math.min((images || []).length, 2); side++) {
    const { dataUrl } = images[side];
    const ni   = nativeImage.createFromDataURL(dataUrl);
    const bgra = ni.getBitmap();  // BGRA, 4 bytes/px
    const { width: imgW, height: imgH } = ni.getSize();

    const xOff     = side * halfW;
    // yOff: residual gap if height doesn't hit OUT_H exactly due to rounding
    const yOff     = Math.max(0, Math.floor((OUT_H - imgH) / 2));
    // center-crop horizontally when rendered width exceeds the 1650px slot
    const colStart = Math.max(0, Math.floor((imgW - halfW) / 2));
    const copyW    = Math.min(imgW - colStart, halfW);

    for (let row = 0; row < imgH && (yOff + row) < OUT_H; row++) {
      const outRowBase = (yOff + row) * OUT_W;
      const srcRowBase =       row    * imgW;
      for (let col = 0; col < copyW; col++) {
        const si = (srcRowBase + colStart + col) << 2;
        const di = (outRowBase + xOff    + col) << 2;
        outBuf[di]     = bgra[si];      // B
        outBuf[di + 1] = bgra[si + 1];  // G
        outBuf[di + 2] = bgra[si + 2];  // R
        // outBuf[di + 3] stays 255 (pre-filled)
      }
    }
  }

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const destPath = path.join(dir, 'brochure-twoup.png');
  const outNI = nativeImage.createFromBitmap(outBuf, { width: OUT_W, height: OUT_H, scaleFactor: 1.0 });
  fs.writeFileSync(destPath, outNI.toPNG());
  return { destPath };
});

ipcMain.handle('fs:readFile', async (_e, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
});

// Copy data-URL images to an export directory (for embedded images in old projects)
ipcMain.handle('dialog:copyImages', async (_e, destDir, images) => {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  for (const img of images) {
    const buf = Buffer.from(img.dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(destDir, img.name), buf);
  }
  return true;
});

// â”€â”€ Asset IPC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Copy an image file from anywhere on disk into the active assets folder.
ipcMain.handle('asset:import', async (_e, srcPath) => {
  const dir = getAssetsDir();
  const ext = path.extname(srcPath).toLowerCase().replace('.jpeg', '.jpg');
  const name = 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7) + ext;
  fs.copyFileSync(srcPath, path.join(dir, name));
  return name;
});

// Write a data URL as a file in the active assets folder (for cutout results, migration).
ipcMain.handle('asset:importDataUrl', async (_e, dataUrl, ext) => {
  const dir = getAssetsDir();
  const extMap = { jpeg: 'jpg', jpg: 'jpg', png: 'png', gif: 'gif', webp: 'webp', svg: 'svg', 'svg+xml': 'svg' };
  const safeExt = extMap[(ext || 'png').replace(/[^a-z0-9+]/g, '')] || 'png';
  const name = 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7) + '.' + safeExt;
  const b64 = dataUrl.split(',')[1] || '';
  fs.writeFileSync(path.join(dir, name), Buffer.from(b64, 'base64'));
  return name;
});

// Read an asset as a data URL (used for preview HTML generation).
ipcMain.handle('asset:readDataUrl', async (_e, name) => {
  const file = path.join(getAssetsDir(), name);
  if (!fs.existsSync(file)) return null;
  const data = fs.readFileSync(file);
  const ext  = path.extname(file).toLowerCase();
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' }[ext] || 'image/png';
  return `data:${mime};base64,${data.toString('base64')}`;
});

// Copy named assets to an export directory (avoids base64 round-trip during export).
ipcMain.handle('asset:copyToDir', async (_e, names, destDir) => {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const src = getAssetsDir();
  for (const name of names) {
    const srcFile = path.join(src, name);
    if (fs.existsSync(srcFile)) fs.copyFileSync(srcFile, path.join(destDir, name));
  }
  return true;
});

// Set the active project path and migrate assets from temp dir if needed.
ipcMain.handle('asset:setDir', async (_e, projectFilePath) => {
  const newDir = assetsPathFor(projectFilePath);
  if (projectAssetsDir === newDir) return newDir;
  if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });

  const tempDir = getTempAssetsDir();
  if (!projectAssetsDir && fs.existsSync(tempDir)) {
    // First save: migrate temp assets into the project assets dir.
    for (const f of fs.readdirSync(tempDir)) {
      const dest = path.join(newDir, f);
      if (!fs.existsSync(dest)) fs.copyFileSync(path.join(tempDir, f), dest);
    }
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  } else if (projectAssetsDir && fs.existsSync(projectAssetsDir) && projectAssetsDir !== newDir) {
    // Save-As: copy assets to new location.
    for (const f of fs.readdirSync(projectAssetsDir)) {
      const dest = path.join(newDir, f);
      if (!fs.existsSync(dest)) fs.copyFileSync(path.join(projectAssetsDir, f), dest);
    }
  }
  projectAssetsDir = newDir;
  return newDir;
});

// Reset to temp dir (new project).
ipcMain.handle('asset:clearDir', async () => {
  projectAssetsDir = null;
  const tempDir = getTempAssetsDir();
  try { if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  return true;
});

ipcMain.handle('settings:get',      () => readSettings());
ipcMain.handle('settings:set',      (_e, obj) => { writeSettings({ ...readSettings(), ...obj }); return true; });
ipcMain.handle('recovery:write',    (_e, data) => { try { fs.writeFileSync(RECOVERY_FILE, data, 'utf8'); } catch {} return true; });
ipcMain.handle('recovery:read',     () => { try { return fs.readFileSync(RECOVERY_FILE, 'utf8'); } catch { return null; } });
ipcMain.handle('recovery:clear',    () => { try { if (fs.existsSync(RECOVERY_FILE)) fs.unlinkSync(RECOVERY_FILE); } catch {} return true; });

ipcMain.handle('clipboard:readText',  () => clipboard.readText());

ipcMain.handle('preview:open', async (_e, html) => {
  const tmp = path.join(os.tmpdir(), 'brochure-preview.html');
  fs.writeFileSync(tmp, html, 'utf8');
  await shell.openPath(tmp);
  return true;
});

// Folder-based preview: copies asset files and data-URL images to a temp
// images/ subfolder so the HTML string stays small (no embedded base64).
ipcMain.handle('preview:openFolder', async (_e, html, assetNames, dataUrlImages) => {
  const tmpDir = path.join(os.tmpdir(), 'brochure-preview');
  const imgDir = path.join(tmpDir, 'images');
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(imgDir, { recursive: true });
  const src = getAssetsDir();
  for (const name of (assetNames || [])) {
    const srcFile = path.join(src, name);
    if (fs.existsSync(srcFile)) fs.copyFileSync(srcFile, path.join(imgDir, name));
  }
  for (const img of (dataUrlImages || [])) {
    const b64 = (img.dataUrl || '').split(',')[1];
    if (b64) fs.writeFileSync(path.join(imgDir, img.name), Buffer.from(b64, 'base64'));
  }
  const htmlPath = path.join(tmpDir, 'brochure.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  await shell.openPath(htmlPath);
  return true;
});

function openProject()   { mainWindow.webContents.send('menu:open'); }
function saveProjectAs() { mainWindow.webContents.send('menu:save-as'); }

app.whenReady().then(() => {
  registerVendorProtocol();
  registerAssetProtocol();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

