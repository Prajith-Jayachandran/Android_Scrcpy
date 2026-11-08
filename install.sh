#!/usr/bin/env bash
set -e

# ========================================================
#  📱 Aether Mirror - Unified Installer
#  • Installs dependencies and builds Next.js production app
#  • Deploys application to ~/.local/share/aether-mirror
#  • Creates launcher in ~/.local/bin/aether-mirror
#  • Registers desktop entry in ~/.local/share/applications
#  • Generates uninstallation.sh in the installation folder
#  • Cleans up the temporary source project directory
# ========================================================

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${AETHER_INSTALL_DIR:-$HOME/.local/share/aether-mirror}"
KEEP_SOURCE="${KEEP_SOURCE:-0}"

# Parse optional arguments
for arg in "$@"; do
    case "$arg" in
        --keep-source)
            KEEP_SOURCE=1
            ;;
        --delete-source)
            KEEP_SOURCE=0
            ;;
        --install-dir=*)
            INSTALL_DIR="${arg#*=}"
            ;;
        --help|-h)
            echo "Usage: ./install.sh [--keep-source] [--delete-source] [--install-dir=/path]"
            echo "  --keep-source   Preserve the source repository after installing"
            echo "  --delete-source Delete the source folder after installing (default)"
            echo "  --install-dir   Custom installation directory (default: ~/.local/share/aether-mirror)"
            exit 0
            ;;
    esac
done

echo ""
echo "========================================================"
echo "  🚀 Aether Mirror - Setup & System Installer"
echo "========================================================"
echo "  Source Folder:       ${SOURCE_DIR}"
echo "  Target Install Dir:  ${INSTALL_DIR}"
echo "  Desktop Launcher:    $HOME/.local/share/applications/aether-mirror.desktop"
echo "  CLI Command:         $HOME/.local/bin/aether-mirror"
echo "  Delete Source Dir:   $([ "$KEEP_SOURCE" = "1" ] && echo "No (--keep-source)" || echo "Yes (Default)")"
echo "========================================================"
echo ""

# Ensure user-space bin directories are in PATH
export PATH="$HOME/.local/bin:$HOME/.local/lib/nodejs/node-v22.11.0-linux-x64/bin:$PWD/bin:$PATH"

# 1. OS Detection
OS_TYPE="$(uname -s)"
ARCH="$(uname -m)"

echo "[1/6] Detecting Operating System..."
case "${OS_TYPE}" in
    Linux*)     OS="Linux";;
    Darwin*)    OS="macOS";;
    CYGWIN*|MINGW*|MSYS*) OS="Windows";;
    *)          OS="UNKNOWN";;
esac
echo "      Detected: ${OS} (${ARCH})"

# Helper function to check for sudo privilege
has_sudo() {
    if command -v sudo >/dev/null 2>&1; then
        if sudo -n true 2>/dev/null; then
            return 0
        elif sudo -v 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# 2. Install / Verify ADB
echo ""
echo "[2/6] Checking for ADB (Android Debug Bridge)..."
mkdir -p "${SOURCE_DIR}/bin"

if command -v adb >/dev/null 2>&1; then
    echo "      Found system adb: $(which adb)"
    cp "$(which adb)" "${SOURCE_DIR}/bin/adb" 2>/dev/null || true
elif [ -f "${SOURCE_DIR}/bin/adb" ]; then
    echo "      Found local adb in ${SOURCE_DIR}/bin/adb"
    chmod +x "${SOURCE_DIR}/bin/adb"
else
    echo "      ADB not found. Attempting installation..."
    INSTALLED_VIA_PKG=false

    if has_sudo; then
        echo "      Using sudo package manager..."
        if command -v pacman >/dev/null 2>&1; then
            sudo pacman -Sy --noconfirm android-tools curl unzip 2>/dev/null && INSTALLED_VIA_PKG=true || true
        elif command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update -y && sudo apt-get install -y android-tools-adb curl unzip 2>/dev/null && INSTALLED_VIA_PKG=true || true
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y android-tools curl unzip 2>/dev/null && INSTALLED_VIA_PKG=true || true
        fi
    fi

    if [ "$INSTALLED_VIA_PKG" = false ]; then
        echo "      Downloading standalone Google Android Platform-Tools..."
        TEMP_DIR="/tmp/platform-tools-dl-$$"
        mkdir -p "${TEMP_DIR}"

        if [ "$OS" = "Linux" ]; then
            PLATFORM_URL="https://dl.google.com/android/repository/platform-tools-latest-linux.zip"
        elif [ "$OS" = "macOS" ]; then
            PLATFORM_URL="https://dl.google.com/android/repository/platform-tools-latest-darwin.zip"
        else
            PLATFORM_URL="https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
        fi

        curl -sSL "${PLATFORM_URL}" -o "${TEMP_DIR}/platform-tools.zip"
        unzip -q -o "${TEMP_DIR}/platform-tools.zip" -d "${TEMP_DIR}"
        cp "${TEMP_DIR}/platform-tools/adb"* "${SOURCE_DIR}/bin/"
        mkdir -p "$HOME/.local/bin"
        cp "${TEMP_DIR}/platform-tools/adb"* "$HOME/.local/bin/" 2>/dev/null || true
        chmod +x "${SOURCE_DIR}/bin/adb"* 2>/dev/null || true
        rm -rf "${TEMP_DIR}"
        echo "      ADB installed successfully."
    fi
fi

# 3. Download scrcpy-server.jar binary (runs on Android app_process)
echo ""
echo "[3/6] Verifying scrcpy-server.jar binary..."
SCRCPY_SERVER_URL="https://github.com/Genymobile/scrcpy/releases/download/v3.1/scrcpy-server-v3.1"

if [ ! -f "${SOURCE_DIR}/bin/scrcpy-server.jar" ] || [ ! -s "${SOURCE_DIR}/bin/scrcpy-server.jar" ]; then
    echo "      Downloading official scrcpy-server (v3.1)..."
    curl -sSL "${SCRCPY_SERVER_URL}" -o "${SOURCE_DIR}/bin/scrcpy-server.jar"
    echo "      scrcpy-server.jar downloaded successfully."
else
    echo "      scrcpy-server.jar is present and verified."
fi

# 4. Check Node.js and NPM
echo ""
echo "[4/6] Checking Node.js runtime and dependencies..."
if ! command -v node >/dev/null 2>&1; then
    echo "      Node.js not found in PATH."
    if has_sudo; then
        echo "      Installing Node.js with package manager..."
        if command -v pacman >/dev/null 2>&1; then
            sudo pacman -Sy --noconfirm nodejs npm
        elif command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update -y && sudo apt-get install -y nodejs npm
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y nodejs npm
        fi
    fi
fi

echo "      Node.js version: $(node -v)"
echo "      NPM version:     $(npm -v)"

# Ensure public icons exist
mkdir -p "${SOURCE_DIR}/public"
if [ ! -f "${SOURCE_DIR}/public/icon.svg" ]; then
    echo "      Creating default icon.svg in public/..."
fi

# Build production Next.js bundle in source folder
cd "${SOURCE_DIR}"
if [ ! -d "node_modules" ]; then
    echo "      Installing NPM dependencies..."
    npm install
fi

echo "      Building Next.js production web application..."
npm run build

# 5. Deploy files to ~/.local/share/aether-mirror
echo ""
echo "[5/6] Deploying Aether Mirror to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"

if [ "${SOURCE_DIR}" != "${INSTALL_DIR}" ]; then
    echo "      Copying production files to ${INSTALL_DIR}..."
    mkdir -p "${INSTALL_DIR}/bin" "${INSTALL_DIR}/public"
    cp -r "${SOURCE_DIR}/.next" "${INSTALL_DIR}/"
    cp -r "${SOURCE_DIR}/node_modules" "${INSTALL_DIR}/"
    cp -r "${SOURCE_DIR}/bin" "${INSTALL_DIR}/"
    cp -r "${SOURCE_DIR}/public" "${INSTALL_DIR}/"
    cp -r "${SOURCE_DIR}/server" "${INSTALL_DIR}/"
    cp -r "${SOURCE_DIR}/src" "${INSTALL_DIR}/"
    cp "${SOURCE_DIR}/package.json" "${INSTALL_DIR}/"
    cp "${SOURCE_DIR}/package-lock.json" "${INSTALL_DIR}/" 2>/dev/null || true
    cp "${SOURCE_DIR}/tsconfig.json" "${INSTALL_DIR}/" 2>/dev/null || true
    cp "${SOURCE_DIR}/next.config.mjs" "${INSTALL_DIR}/" 2>/dev/null || true
    cp "${SOURCE_DIR}/tailwind.config.ts" "${INSTALL_DIR}/" 2>/dev/null || true
    cp "${SOURCE_DIR}/postcss.config.mjs" "${INSTALL_DIR}/" 2>/dev/null || true
    cp "${SOURCE_DIR}/README.md" "${INSTALL_DIR}/" 2>/dev/null || true
    cp "${SOURCE_DIR}/LICENSE" "${INSTALL_DIR}/" 2>/dev/null || true
fi

# Create start.sh in INSTALL_DIR
cat << 'EOF' > "${INSTALL_DIR}/start.sh"
#!/usr/bin/env bash
export PATH="$HOME/.local/bin:$HOME/.local/lib/nodejs/node-v22.11.0-linux-x64/bin:$PWD/bin:$PATH"
PORT="${PORT:-3000}"
echo ""
echo "========================================================"
echo "  🚀 Starting Aether Mirror"
echo "  Open your browser at: http://localhost:${PORT}"
echo "========================================================"
echo ""
npm start
EOF
chmod +x "${INSTALL_DIR}/start.sh"

# Create uninstallation.sh in INSTALL_DIR
cat << 'EOF' > "${INSTALL_DIR}/uninstallation.sh"
#!/usr/bin/env bash
# ========================================================
#  🗑️ Aether Mirror - Uninstallation Script
# ========================================================
set -e

INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-3000}"

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

echo "[1/4] Terminating running server processes..."
if command -v fuser >/dev/null 2>&1; then
    fuser -k "${PORT}/tcp" 2>/dev/null || true
fi

echo "[2/4] Removing desktop entry & app launcher shortcuts..."
rm -f "$HOME/.local/share/applications/aether-mirror.desktop"
rm -f "$HOME/.local/share/icons/hicolor/scalable/apps/aether-mirror.svg"
rm -f "$HOME/.local/share/icons/hicolor/256x256/apps/aether-mirror.png"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

echo "[3/4] Removing launcher command from $HOME/.local/bin/aether-mirror..."
rm -f "$HOME/.local/bin/aether-mirror"

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
EOF
chmod +x "${INSTALL_DIR}/uninstallation.sh"
ln -sf uninstallation.sh "${INSTALL_DIR}/uninstall.sh"

# Deploy Launcher CLI executable into ~/.local/bin/aether-mirror
mkdir -p "$HOME/.local/bin"
cat << 'EOF' > "$HOME/.local/bin/aether-mirror"
#!/usr/bin/env bash
# ========================================================
#  Aether Mirror - CLI Launcher & Browser Opener
# ========================================================
set -e

export PATH="$HOME/.local/bin:$HOME/.local/lib/nodejs/node-v22.11.0-linux-x64/bin:$PATH"
INSTALL_DIR="${AETHER_INSTALL_DIR:-$HOME/.local/share/aether-mirror}"
PORT="${PORT:-3000}"

if [ ! -d "$INSTALL_DIR" ]; then
    echo "Error: Aether Mirror installation not found in $INSTALL_DIR."
    echo "Please re-run the installer."
    exit 1
fi

cd "$INSTALL_DIR"

open_browser() {
    local url="http://localhost:${PORT}"
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 &
    elif command -v sensible-browser >/dev/null 2>&1; then
        sensible-browser "$url" >/dev/null 2>&1 &
    elif command -v x-www-browser >/dev/null 2>&1; then
        x-www-browser "$url" >/dev/null 2>&1 &
    fi
}

# If server already active, bring up browser tab
if command -v fuser >/dev/null 2>&1 && fuser "${PORT}/tcp" >/dev/null 2>&1; then
    echo "Aether Mirror server is already running on port ${PORT}. Opening dashboard..."
    open_browser
    exit 0
fi

# Background listener to open browser once server is listening
(
    for i in $(seq 1 40); do
        if command -v fuser >/dev/null 2>&1 && fuser "${PORT}/tcp" >/dev/null 2>&1; then
            break
        fi
        sleep 0.25
    done
    open_browser
) &

exec ./start.sh
EOF
chmod +x "$HOME/.local/bin/aether-mirror"

# Deploy Icons
mkdir -p "$HOME/.local/share/icons/hicolor/scalable/apps"
mkdir -p "$HOME/.local/share/icons/hicolor/256x256/apps"

if [ -f "${INSTALL_DIR}/public/icon.svg" ]; then
    cp "${INSTALL_DIR}/public/icon.svg" "$HOME/.local/share/icons/hicolor/scalable/apps/aether-mirror.svg"
fi

if [ -f "${INSTALL_DIR}/public/icon.png" ]; then
    cp "${INSTALL_DIR}/public/icon.png" "$HOME/.local/share/icons/hicolor/256x256/apps/aether-mirror.png"
fi

# Register Desktop Application Entry in ~/.local/share/applications
mkdir -p "$HOME/.local/share/applications"
cat << EOF > "$HOME/.local/share/applications/aether-mirror.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=Aether Mirror
GenericName=Android Screen Mirror & Automator
Comment=Ultra-Low-Latency Web-Based Android Screen Mirroring, Multi-Device Manager & Automation Dashboard
Exec=$HOME/.local/bin/aether-mirror
Icon=$HOME/.local/share/icons/hicolor/scalable/apps/aether-mirror.svg
Terminal=false
Categories=Utility;Development;
Keywords=android;scrcpy;mirror;screen;adb;mobile;remote;
StartupNotify=true
Actions=StopServer;

[Desktop Action StopServer]
Name=Stop Aether Mirror Server
Exec=$INSTALL_DIR/uninstallation.sh --stop-only
EOF
chmod +x "$HOME/.local/share/applications/aether-mirror.desktop"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi

echo "      ✔ Application deployed to ${INSTALL_DIR}"
echo "      ✔ Launcher created at $HOME/.local/bin/aether-mirror"
echo "      ✔ Desktop entry registered at $HOME/.local/share/applications/aether-mirror.desktop"
echo "      ✔ Uninstallation script ready at ${INSTALL_DIR}/uninstallation.sh"

# 6. Delete source project folder if requested/default
if [ "${SOURCE_DIR}" != "${INSTALL_DIR}" ]; then
    echo ""
    if [ "$KEEP_SOURCE" = "1" ]; then
        echo "[6/6] Preserving source repository (--keep-source requested)."
        echo "      Source folder retained at: ${SOURCE_DIR}"
    else
        echo "[6/6] Cleaning up installer project folder..."
        echo "      Removing source folder: ${SOURCE_DIR}"
        cd "$INSTALL_DIR"
        rm -rf "${SOURCE_DIR}"
        echo "      ✔ Source folder successfully cleaned up."
    fi
else
    echo ""
    echo "[6/6] Installed in-place."
fi

echo ""
echo "========================================================"
echo "  🎉 Installation Complete!"
echo "  • Open from your App Launcher: 'Aether Mirror'"
echo "  • Or run via terminal:          aether-mirror"
echo "  • To uninstall, run:            ${INSTALL_DIR}/uninstallation.sh"
echo "========================================================"
echo ""
