"""
Arangetram Brochure — local editor server (Python 3, stdlib only).
Serves the GrapesJS editor at http://localhost:3033

Usage:  python src/editor/server.py
   or:  double-click src/editor/start.bat  (Windows)
        bash src/editor/start.sh           (Mac / Linux)
"""

import http.server
import json
import mimetypes
import os
import re
import sys
import urllib.parse
from pathlib import Path

PORT = 3033

# Project root = two levels up from this file (utils/)
ROOT       = Path(__file__).resolve().parent.parent.parent
EDITOR_DIR = Path(__file__).resolve().parent

MIME_MAP = {
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
}

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'}


def parse_multipart(body: bytes, boundary: str):
    """Minimal multipart parser. Returns list of (field_name, filename, data)."""
    results = []
    sep = ('--' + boundary).encode('utf-8')
    parts = body.split(sep)
    for part in parts[1:]:
        # Final boundary ends with b'--'
        if part.lstrip(b'\r\n').startswith(b'--'):
            break
        # Split header block from content
        if b'\r\n\r\n' in part:
            header_block, content = part.split(b'\r\n\r\n', 1)
        elif b'\n\n' in part:
            header_block, content = part.split(b'\n\n', 1)
        else:
            continue
        content = content.rstrip(b'\r\n')
        headers_str = header_block.decode('utf-8', errors='replace')
        fn_match   = re.search(r'filename=["\']?([^"\';\r\n]+)["\']?', headers_str)
        name_match = re.search(r';\s*name=["\']?([^"\';\r\n]+)["\']?', headers_str)
        if fn_match:
            filename   = fn_match.group(1).strip()
            field_name = name_match.group(1).strip() if name_match else 'file'
            results.append((field_name, filename, content))
    return results


def ensure_google_font_links(index_html: str, links: list) -> str:
    """Add Google Fonts <link> tags to <head> if not already present.
    links: list of {"family": str, "href": str}
    Existing Noto Sans Tamil and other non-managed links are untouched.
    """
    for item in links:
        family = item.get('family', '')
        href   = item.get('href', '')
        if not href:
            continue
        # Check if this font family is already linked (by family name in href)
        family_slug = family.replace(' ', '+')
        if family_slug in index_html or family.replace(' ', '%20') in index_html:
            continue
        link_tag = f'  <link rel="stylesheet" href="{href}">\n'
        # Insert before </head>
        index_html = re.sub(r'(</head>)', link_tag + r'\1', index_html, flags=re.IGNORECASE)
    return index_html


def replace_body_content(index_html: str, new_body: str) -> str:
    """Replace content between <body ...> and </body> in index.html."""
    return re.sub(
        r'(<body[^>]*>)([\s\S]*)(<\/body>)',
        lambda m: f'{m.group(1)}\n{new_body}\n{m.group(3)}',
        index_html,
        flags=re.IGNORECASE,
    )


def update_css_custom_props(style_css: str, new_vars: dict) -> str:
    """Update only named CSS custom property values inside :root { }."""
    def replace_root(m):
        block = m.group(2)
        for prop, value in new_vars.items():
            escaped = re.escape(prop)
            block = re.sub(
                rf'({escaped}\s*:\s*)([^;]+)(;)',
                lambda mm, v=value: f'{mm.group(1)}{v}{mm.group(3)}',
                block,
            )
        return f'{m.group(1)}{block}{m.group(3)}'

    return re.sub(r'(:root\s*\{)([^}]+)(\})', replace_root, style_css)


class EditorHandler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        # Suppress default access log noise; only print saves
        pass

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path: Path, content_type: str, no_cache: bool = False):
        try:
            data = path.read_bytes()
        except FileNotFoundError:
            self.send_error(404, f'Not found: {path.name}')
            return
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', len(data))
        if no_cache:
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            self.send_header('Pragma', 'no-cache')
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')

    def read_body(self) -> bytes:
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length)

    def safe_path(self, url_path: str) -> Path | None:
        """Resolve url_path under ROOT, guard against directory traversal."""
        clean = urllib.parse.unquote(url_path).lstrip('/')
        full  = (ROOT / clean).resolve()
        if not str(full).startswith(str(ROOT)):
            return None
        return full

    # ── OPTIONS ────────────────────────────────────────────────────────

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    # ── GET ─────────────────────────────────────────────────────────────

    def do_GET(self):
        parsed  = urllib.parse.urlparse(self.path)
        path    = parsed.path

        if path in ('/', '/editor.html'):
            self.send_file(EDITOR_DIR / 'editor.html', 'text/html; charset=utf-8', no_cache=True)
            return

        if path == '/api/brochure':
            self.send_file(ROOT / 'index.html', 'text/html; charset=utf-8', no_cache=True)
            return

        if path == '/api/style':
            self.send_file(ROOT / 'css' / 'style.css', 'text/css', no_cache=True)
            return

        if path == '/api/assets':
            images_dir = ROOT / 'assets' / 'images'
            assets = []
            if images_dir.exists():
                for f in sorted(images_dir.iterdir()):
                    if f.suffix.lower() in IMAGE_EXTS:
                        assets.append({'src': f'/assets/images/{f.name}', 'name': f.name, 'type': 'image'})
            self.send_json(assets)
            return

        # Static files from project root
        file_path = self.safe_path(path)
        if not file_path:
            self.send_error(403, 'Forbidden')
            return
        ext          = file_path.suffix.lower()
        content_type = MIME_MAP.get(ext, 'application/octet-stream')
        self.send_file(file_path, content_type)

    # ── POST ─────────────────────────────────────────────────────────────

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path   = parsed.path

        if path == '/api/save':
            try:
                raw     = self.read_body()
                payload = json.loads(raw)
                html         = payload.get('html', '')
                css_vars     = payload.get('cssVars', {})
                font_links   = payload.get('googleFontLinks', [])

                index_path = ROOT / 'index.html'
                original   = index_path.read_text(encoding='utf-8')
                updated    = replace_body_content(original, html)
                if font_links:
                    updated = ensure_google_font_links(updated, font_links)
                index_path.write_text(updated, encoding='utf-8')
                print('[save] index.html updated')

                if css_vars:
                    style_path = ROOT / 'css' / 'style.css'
                    style_orig = style_path.read_text(encoding='utf-8')
                    style_new  = update_css_custom_props(style_orig, css_vars)
                    style_path.write_text(style_new, encoding='utf-8')
                    print('[save] style.css vars updated:', ', '.join(css_vars.keys()))

                self.send_json({'ok': True})
            except Exception as exc:
                print('[save] error:', exc)
                self.send_json({'ok': False, 'error': str(exc)}, status=500)
            return

        if path == '/api/upload':
            try:
                content_type = self.headers.get('Content-Type', '')
                boundary_m   = re.search(r'boundary=([^\s;]+)', content_type)
                if not boundary_m:
                    self.send_json({'error': 'No multipart boundary'}, status=400)
                    return

                boundary   = boundary_m.group(1)
                raw        = self.read_body()
                parts      = parse_multipart(raw, boundary)
                images_dir = ROOT / 'assets' / 'images'
                images_dir.mkdir(parents=True, exist_ok=True)

                uploaded = []
                for _, filename, data in parts:
                    # Sanitise filename
                    safe_name = re.sub(r'[^\w.\-]', '_', Path(filename).name)
                    dest = images_dir / safe_name
                    dest.write_bytes(data)
                    uploaded.append({'src': f'/assets/images/{safe_name}', 'name': safe_name, 'type': 'image'})
                    print(f'[upload] saved {safe_name} ({len(data)} bytes)')

                # GrapesJS expects {"data": [...]}
                self.send_json({'data': uploaded})
            except Exception as exc:
                print('[upload] error:', exc)
                self.send_json({'error': str(exc)}, status=500)
            return

        self.send_error(404, 'Not found')


def main():
    addr = ('127.0.0.1', PORT)
    httpd = http.server.HTTPServer(addr, EditorHandler)

    print()
    print('  ✦  Arangetram Brochure Editor')
    print()
    print(f'  Open:    http://localhost:{PORT}')
    print(f'  Editing: {ROOT / "index.html"}')
    print()
    print('  Press Ctrl+C to stop.')
    print()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n  Editor stopped.')
        httpd.server_close()


if __name__ == '__main__':
    main()
