const { app, BrowserWindow, ipcMain, dialog, Menu, protocol, net, shell, clipboard } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const VENDOR_ROOT = path.join(__dirname, '..', 'editor', 'vendor');

protocol.registerSchemesAsPrivileged([
  { scheme: 'vendor', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: true, stream: true } },
]);

let mainWindow;

const SETTINGS_FILE  = path.join(app.getPath('userData'), 'editor-settings.json');
const RECOVERY_FILE  = path.join(app.getPath('userData'), 'recovery.brochure');
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
      // vendor://background-removal/dist/index.mjs
      //   host = 'background-removal', pathname = '/dist/index.mjs'
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

ipcMain.handle('dialog:openImages', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled) return [];
  return filePaths.map(p => ({
    name: path.basename(p),
    dataUrl: 'data:image/' + path.extname(p).slice(1).toLowerCase().replace('jpg','jpeg') + ';base64,' +
             fs.readFileSync(p).toString('base64'),
  }));
});

ipcMain.handle('dialog:exportDir', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'index.html',
    filters: [{ name: 'HTML file', extensions: ['html'] }],
    title: 'Export — choose where to save index.html',
  });
  return canceled ? null : filePath;
});

ipcMain.handle('fs:readFile', async (_e, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
});

ipcMain.handle('dialog:copyImages', async (_e, destDir, images) => {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  for (const img of images) {
    const buf = Buffer.from(img.dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(destDir, img.name), buf);
  }
  return true;
});

ipcMain.handle('settings:get',      () => readSettings());
ipcMain.handle('settings:set',      (_e, obj) => { writeSettings(obj); return true; });
ipcMain.handle('recovery:write',    (_e, data) => { try { fs.writeFileSync(RECOVERY_FILE, data, 'utf8'); } catch {} return true; });
ipcMain.handle('recovery:read',     () => { try { return fs.readFileSync(RECOVERY_FILE, 'utf8'); } catch { return null; } });
ipcMain.handle('recovery:clear',    () => { try { if (fs.existsSync(RECOVERY_FILE)) fs.unlinkSync(RECOVERY_FILE); } catch {} return true; });;

ipcMain.handle('clipboard:readText',  () => clipboard.readText());

ipcMain.handle('preview:open', async (_e, html) => {
  const tmp = path.join(os.tmpdir(), 'brochure-preview.html');
  fs.writeFileSync(tmp, html, 'utf8');
  await shell.openPath(tmp);
  return true;
});

function openProject()  { mainWindow.webContents.send('menu:open'); }
function saveProjectAs() { mainWindow.webContents.send('menu:save-as'); }

app.whenReady().then(() => {
  registerVendorProtocol();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
