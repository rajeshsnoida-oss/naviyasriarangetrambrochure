@echo off
echo.

:: Try Python (primary — no install needed beyond Python 3)
python --version >nul 2>&1
if not errorlevel 1 (
    echo  Starting Arangetram Brochure Editor (Python)...
    echo  Open http://localhost:3033 in your browser.
    echo  Press Ctrl+C in this window to stop.
    echo.
    python "%~dp0server.py"
    goto end
)

py --version >nul 2>&1
if not errorlevel 1 (
    echo  Starting Arangetram Brochure Editor (Python)...
    echo  Open http://localhost:3033 in your browser.
    echo  Press Ctrl+C in this window to stop.
    echo.
    py "%~dp0server.py"
    goto end
)

:: Fallback to Node.js
node --version >nul 2>&1
if not errorlevel 1 (
    echo  Starting Arangetram Brochure Editor (Node.js)...
    echo  Open http://localhost:3033 in your browser.
    echo  Press Ctrl+C in this window to stop.
    echo.
    node "%~dp0server.js"
    goto end
)

echo  ERROR: Neither Python 3 nor Node.js found on PATH.
echo  Install Python 3 from https://python.org  (recommended)
echo  or Node.js from https://nodejs.org

:end
pause
