"""
Download @imgly/background-removal model data + WASM runtime from npm registry.

The model files live in the *data* package (@imgly/background-removal-data),
not the code package. This script downloads the tarball from the npm registry,
extracts the dist/ contents, and places them where the local server can serve
them as the publicPath for the removeBackground() call.

Saves to: src/editor/vendor/background-removal/models/

Usage:  python src/editor/download-vendor.py
        (run from the project root, or from src/editor/)
"""

import urllib.request
import tarfile
import io
import shutil
from pathlib import Path

VERSION     = '1.4.5'
TARBALL_URL = (
    f'https://registry.npmjs.org/@imgly/background-removal-data/'
    f'-/background-removal-data-{VERSION}.tgz'
)

DEST = Path(__file__).resolve().parent / 'vendor' / 'background-removal' / 'models'

HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; download-vendor/1.0)'}


def fetch_bytes(url: str, label: str = '') -> bytes:
    label = label or url.split('/')[-1]
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        total = int(resp.headers.get('Content-Length', 0))
        buf = io.BytesIO()
        downloaded = 0
        while chunk := resp.read(65536):
            buf.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = downloaded * 100 // total
                print(f'\r    {label}  {pct:3d}%  ({downloaded // 1024} KB)', end='', flush=True)
    size_kb = downloaded // 1024
    print(f'\r    {label}  done  ({size_kb} KB)           ')
    return buf.getvalue()


def main():
    print()
    print(f'  @imgly/background-removal-data v{VERSION} — model download')
    print(f'  Source : {TARBALL_URL}')
    print(f'  Dest   : {DEST}')
    print()

    if DEST.exists():
        print('  Clearing existing models folder…')
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True)

    # ── Download tarball ────────────────────────────────────────────────────
    print('  Step 1/2  Downloading tarball…')
    tgz_bytes = fetch_bytes(TARBALL_URL, f'background-removal-data-{VERSION}.tgz')

    # ── Extract dist/ from tarball ──────────────────────────────────────────
    print()
    print('  Step 2/2  Extracting dist/ from tarball…')
    buf = io.BytesIO(tgz_bytes)
    extracted = 0
    with tarfile.open(fileobj=buf, mode='r:gz') as tar:
        for member in tar.getmembers():
            # Tarball paths are like: package/dist/resources.json
            #                         package/dist/onnxruntime-web/ort-wasm.wasm
            if not member.name.startswith('package/dist/'):
                continue
            rel = member.name[len('package/dist/'):]   # strip package/dist/
            if not rel:
                continue
            dest_path = DEST / rel
            if member.isdir():
                dest_path.mkdir(parents=True, exist_ok=True)
                continue
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            f = tar.extractfile(member)
            if f is None:
                continue
            dest_path.write_bytes(f.read())
            size_kb = dest_path.stat().st_size // 1024
            print(f'    extracted: {rel}  ({size_kb} KB)')
            extracted += 1

    # ── Done ────────────────────────────────────────────────────────────────
    all_files = list(DEST.rglob('*'))
    total_mb  = sum(f.stat().st_size for f in all_files if f.is_file()) // 1_048_576
    print()
    print(f'  Done — {extracted} files extracted, ~{total_mb} MB total')
    print(f'  Server serves models at /src/editor/vendor/background-removal/models/')
    print()

    if extracted == 0:
        print('  WARNING: no files were extracted from package/dist/')
        print('  The tarball structure may have changed. Inspect with:')
        print('    python -c "import tarfile; [print(m.name) for m in tarfile.open(...)[:20]]"')


if __name__ == '__main__':
    main()
