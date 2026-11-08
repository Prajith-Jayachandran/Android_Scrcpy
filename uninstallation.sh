#!/usr/bin/env bash
# ========================================================
#  🗑️ Aether Mirror - Uninstallation Script
# ========================================================
set -e

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"

# Support --stop-only flag to just gracefully shut down server
if [ "$1" = "--stop-only" ]; then
    echo "Stopping Aether Mirror server on port ${PORT}..."
    if command -v fuser >/dev/null 2>&1; then
        fuser -k "${PORT}/tcp" 2>/dev/null || true
    fi
    exit 0
fi

echo ""
echo "========================================================"
echo "  🗑️ Aether Mirror - Uninstaller"
echo "========================================================"
echo ""

# 1. Terminate running server processes
echo "[1/4] Terminating running server processes..."
if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
fi

# 2. Remove desktop shortcut and icons from application launcher
echo "[2/4] Removing desktop entry & app launcher shortcuts..."
rm -f "$HOME/.local/share/applications/aether-mirror.desktop"
rm -f "$HOME/.local/share/icons/hicolor/scalable/apps/aether-mirror.svg"
rm -f "$HOME/.local/share/icons/hicolor/256x256/apps/aether-mirror.png"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

# 3. Remove executable CLI wrapper
echo "[3/4] Removing launcher command from $HOME/.local/bin/aether-mirror..."
rm -f "$HOME/.local/bin/aether-mirror"

# 4. Remove installation files
echo "[4/4] Removing installation directory (${INSTALL_DIR})..."
if [ -d "${INSTALL_DIR}" ]; then
    cd "$HOME"
    rm -rf "${INSTALL_DIR}"
fi

echo ""
echo "========================================================"
echo "  ✔ Aether Mirror has been completely uninstalled!"
echo "========================================================"
echo ""
