#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""

# Try Python 3 (primary — no install needed)
if command -v python3 &>/dev/null; then
  echo "  Starting Arangetram Brochure Editor (Python 3)…"
  echo "  Open http://localhost:3033 in your browser."
  echo "  Press Ctrl+C to stop."
  echo ""
  exec python3 "$SCRIPT_DIR/server.py"
fi

if command -v python &>/dev/null; then
  echo "  Starting Arangetram Brochure Editor (Python)…"
  echo "  Open http://localhost:3033 in your browser."
  echo "  Press Ctrl+C to stop."
  echo ""
  exec python "$SCRIPT_DIR/server.py"
fi

# Fallback to Node.js
if command -v node &>/dev/null; then
  echo "  Starting Arangetram Brochure Editor (Node.js)…"
  echo "  Open http://localhost:3033 in your browser."
  echo "  Press Ctrl+C to stop."
  echo ""
  exec node "$SCRIPT_DIR/server.js"
fi

echo "  ERROR: Neither Python 3 nor Node.js found on PATH."
echo "  Install Python 3 from https://python.org  (recommended)"
exit 1
