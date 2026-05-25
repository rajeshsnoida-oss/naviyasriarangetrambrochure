const { app, BrowserWindow, ipcMain, dialog, Menu, protocol, net, shell, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// Raise the renderer V8 heap limit so large projects can load during migration.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

const VENDOR_ROOT = path.join(__dirname, '..', 'editor', 'vendor');

// ── Asset directory tracking ──────────────────────────────────────────────────
// null  = no project saved yet → use temp-assets in userData
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

// ── Custom schemes ────────────────────────────────────────────────────────────
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

// ── vendor:// protocol — serves src/editor/vendor/<pkg>/<rest> ───────────────
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

// ── asset:// protocol — serves image assets from the project assets folder ────
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
      // asset://img_abc123.jpg → hostname = "img_abc123.jpg"
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
        { label: 'Open…',        accelerator: 'CmdOrCtrl+O', click: openProject },
        { label: 'Save',         accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu:save') },
        { label: 'Save As…',     accelerator: 'CmdOrCtrl+Shift+S', click: saveProjectAs },
        { type: 'separator' },
        { label: 'Export to HTML/CSS…', accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.send('menu:export') },
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

// ── IPC handlers ─────────────────────────────────────────────────────────────

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

// Write index.html + images/ to a target directory for GitHub Pages hosting.
// PNGs wider than 900px (2× the 450px canvas) are resized with nativeImage to
// shrink AI-cutout files from 30–50 MB down to a few hundred KB. WebP/JPEG are
// already compressed and copied as-is.
ipcMain.handle('export:writeToRepo', async (_e, dir, html, assetNames) => {
  const MAX_W = 900;
  const imgDir = path.join(dir, 'images');
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
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

// Return source paths only — no base64. The renderer calls asset:import to copy.
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
    title: 'Export — choose target folder (index.html + images/ will be written here)',
    buttonLabel: 'Export here',
  });
  return canceled ? null : filePaths[0];
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

// ── Asset IPC ─────────────────────────────────────────────────────────────────

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
ipcMain.handle('settings:set',      (_e, obj) => { writeSettings(obj); return true; });
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
  const htmlPath = path.join(tmpDir, 'index.html');
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
