/**
 * Arangetram Brochure — local editor server.
 * Serves the GrapesJS editor at http://localhost:3033
 * and provides API endpoints to read/write index.html + css/style.css.
 *
 * Usage: node src/editor/server.js
 *   (or double-click src/editor/start.bat on Windows)
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const ROOT       = path.resolve(__dirname, '../..');   // project root (utils/)
const EDITOR_DIR = __dirname;
const PORT       = 3033;

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css',
  '.js':    'application/javascript',
  '.json':  'application/json',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.webp':  'image/webp',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
};

// ── Helpers ──────────────────────────────────────────────────────────────

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + path.basename(filePath));
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function replaceBodyContent(indexHtml, newBody) {
  return indexHtml.replace(
    /(<body[^>]*>)([\s\S]*)(<\/body>)/i,
    (_, open, _old, close) => `${open}\n${newBody}\n${close}`
  );
}

function updateCSSCustomProps(styleCss, newVars) {
  // Update only the values of listed CSS custom properties inside :root { }
  // Every other byte of style.css is left unchanged.
  return styleCss.replace(
    /(:root\s*\{)([^}]+)(\})/,
    (_, open, block, close) => {
      let updated = block;
      for (const [prop, value] of Object.entries(newVars)) {
        const escaped = prop.replace(/[-]/g, '\\$&');
        updated = updated.replace(
          new RegExp(`(${escaped}\\s*:\\s*)([^;]+)(;)`, 'g'),
          (_, p1, _old, p3) => `${p1}${value}${p3}`
        );
      }
      return `${open}${updated}${close}`;
    }
  );
}

function safeJoin(base, rel) {
  const full = path.normalize(path.join(base, rel));
  if (!full.startsWith(base)) return null;
  return full;
}

// ── Server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── API ───────────────────────────────────────────────────────────────

  if (pathname === '/api/brochure' && req.method === 'GET') {
    serveFile(res, path.join(ROOT, 'index.html'), 'text/html; charset=utf-8');
    return;
  }

  if (pathname === '/api/style' && req.method === 'GET') {
    serveFile(res, path.join(ROOT, 'css/style.css'), 'text/css');
    return;
  }

  if (pathname === '/api/assets' && req.method === 'GET') {
    const imagesDir = path.join(ROOT, 'assets/images');
    let files = [];
    try {
      files = fs.readdirSync(imagesDir)
        .filter(f => /\.(jpe?g|png|gif|svg|webp)$/i.test(f))
        .map(f => ({ src: `/assets/images/${f}`, name: f, type: 'image' }));
    } catch (_) { /* assets/images doesn't exist yet — that's fine */ }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(files));
    return;
  }

  if (pathname === '/api/save' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const { html, cssVars } = JSON.parse(raw);

      const indexPath = path.join(ROOT, 'index.html');
      const original  = fs.readFileSync(indexPath, 'utf8');
      fs.writeFileSync(indexPath, replaceBodyContent(original, html), 'utf8');
      console.log('[save] index.html updated');

      if (cssVars && Object.keys(cssVars).length > 0) {
        const stylePath = path.join(ROOT, 'css/style.css');
        const styleOrig = fs.readFileSync(stylePath, 'utf8');
        fs.writeFileSync(stylePath, updateCSSCustomProps(styleOrig, cssVars), 'utf8');
        console.log('[save] style.css vars updated:', Object.keys(cssVars).join(', '));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error('[save] error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // ── Static files ─────────────────────────────────────────────────────

  if (pathname === '/' || pathname === '/editor.html') {
    serveFile(res, path.join(EDITOR_DIR, 'editor.html'), 'text/html; charset=utf-8');
    return;
  }

  // Everything else: serve from project root
  const safePath = safeJoin(ROOT, pathname);
  if (!safePath) { res.writeHead(403); res.end('Forbidden'); return; }

  const ext = path.extname(safePath).toLowerCase();
  serveFile(res, safePath, MIME[ext] || 'application/octet-stream');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is in use. Stop the other server and try again.\n`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  const addr = `http://localhost:${PORT}`;
  console.log('');
  console.log('  ✦  Arangetram Brochure Editor');
  console.log('');
  console.log(`  Open:    ${addr}`);
  console.log(`  Editing: ${path.join(ROOT, 'index.html')}`);
  console.log('');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
