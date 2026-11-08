#!/usr/bin/env bash
# ========================================================
#  🗑️ Aether Mirror - Cross-Platform Uninstallation Script
#  Supports Linux, macOS, and Windows (Git Bash/MSYS2/WSL)
# ========================================================
set -e

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"

# Detect OS
OS_TYPE="$(uname -s)"
case "${OS_TYPE}" in
    Linux*)               OS="Linux";;
    Darwin*)              OS="macOS";;
    CYGWIN*|MINGW*|MSYS*) OS="Windows";;
    *)                    OS="Linux";;
esac

# Support --stop-only flag to just gracefully shut down server
if [ "$1" = "--stop-only" ]; then
    echo "Stopping Aether Mirror server on port ${PORT}..."
    if command -v fuser >/dev/null 2>&1; then
        fuser -k "${PORT}/tcp" 2>/dev/null || true
    elif command -v lsof >/dev/null 2>&1; then
        lsof -ti:"${PORT}" | xargs kill -9 2>/dev/null || true
    fi
    exit 0
fi

echo ""
echo "========================================================"
echo "  🗑️ Aether Mirror - Uninstaller (${OS})"
echo "========================================================"
echo ""

# 1. Terminate running server processes
echo "[1/4] Terminating running server processes..."
if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
    lsof -ti:"${PORT}" | xargs kill -9 2>/dev/null || true
fi

# Windows netstat kill fallback
if [ "$OS" = "Windows" ]; then
    if command -v powershell.exe >/dev/null 2>&1; then
        powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>/dev/null || true
    fi
fi

# 2. Remove desktop shortcut and icons based on OS
echo "[2/4] Removing desktop and application launcher shortcuts..."
if [ "$OS" = "Linux" ]; then
    rm -f "$HOME/.local/share/applications/aether-mirror.desktop"
    rm -f "$HOME/.local/share/icons/hicolor/scalable/apps/aether-mirror.svg"
    rm -f "$HOME/.local/share/icons/hicolor/256x256/apps/aether-mirror.png"

    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    fi
elif [ "$OS" = "macOS" ]; then
    rm -rf "$HOME/Applications/Aether Mirror.app"
    rm -rf "/Applications/Aether Mirror.app" 2>/dev/null || true
elif [ "$OS" = "Windows" ]; then
    # Remove Windows .lnk shortcuts from Desktop and Start Menu
    if [ -n "$USERPROFILE" ]; then
        WIN_USER="$(cygpath -u "$USERPROFILE" 2>/dev/null || echo "$USERPROFILE")"
        rm -f "${WIN_USER}/Desktop/Aether Mirror.lnk"
    fi
    rm -f "$HOME/Desktop/Aether Mirror.lnk"

    if [ -n "$APPDATA" ]; then
        WIN_APPDATA="$(cygpath -u "$APPDATA" 2>/dev/null || echo "$APPDATA")"
        rm -f "${WIN_APPDATA}/Microsoft/Windows/Start Menu/Programs/Aether Mirror.lnk"
    fi

    if command -v powershell.exe >/dev/null 2>&1; then
        powershell.exe -NoProfile -Command "
            \$desk = [Environment]::GetFolderPath('Desktop');
            \$menu = [Environment]::GetFolderPath('Programs');
            Remove-Item -Path \"\$desk\Aether Mirror.lnk\" -Force -ErrorAction SilentlyContinue;
            Remove-Item -Path \"\$menu\Aether Mirror.lnk\" -Force -ErrorAction SilentlyContinue;
        " 2>/dev/null || true
    fi
fi

# 3. Remove executable CLI wrapper
echo "[3/4] Removing launcher command from PATH..."
rm -f "$HOME/.local/bin/aether-mirror"
rm -f "/usr/local/bin/aether-mirror" 2>/dev/null || true

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
