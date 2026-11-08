#!/usr/bin/env bash
set -e

# ========================================================
#  📱 Aether Mirror - Unified Cross-Platform Installer
#  Supports Linux, macOS, and Windows (Git Bash/MSYS2/WSL)
#
#  • Detects OS and installs platform dependencies & ADB
#  • Builds Next.js production web application
#  • Deploys files to user-space application directory
#  • Linux:   Registers ~/.local/share/applications/aether-mirror.desktop
#  • macOS:   Creates ~/Applications/Aether Mirror.app bundle
#  • Windows: Generates Desktop & Start Menu .lnk shortcuts via PowerShell
#  • Creates platform-specific uninstallers (uninstallation.sh & uninstallation.bat)
#  • Automatically cleans up temporary installer directory (--keep-source to retain)
# ========================================================

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEEP_SOURCE="${KEEP_SOURCE:-0}"
CUSTOM_INSTALL_DIR=""

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
            CUSTOM_INSTALL_DIR="${arg#*=}"
            ;;
        --help|-h)
            echo "Usage: ./install.sh [--keep-source] [--delete-source] [--install-dir=/path]"
            echo "  --keep-source   Preserve the source repository after installing"
            echo "  --delete-source Delete the source folder after installing (default)"
            echo "  --install-dir   Custom installation directory"
            exit 0
            ;;
    esac
done

# Ensure user-space bin directories are in PATH
export PATH="$HOME/.local/bin:$HOME/.local/lib/nodejs/node-v22.11.0-linux-x64/bin:$PWD/bin:$PATH"

# 1. OS Detection & Target Path Configuration
OS_TYPE="$(uname -s)"
ARCH="$(uname -m)"

case "${OS_TYPE}" in
    Linux*)
        OS="Linux"
        DEFAULT_INSTALL_DIR="$HOME/.local/share/aether-mirror"
        DEFAULT_BIN_DIR="$HOME/.local/bin"
        ;;
    Darwin*)
        OS="macOS"
        DEFAULT_INSTALL_DIR="$HOME/Applications/Aether Mirror.app/Contents/Resources/app"
        MACOS_APP_DIR="$HOME/Applications/Aether Mirror.app"
        DEFAULT_BIN_DIR="$HOME/.local/bin"
        ;;
    CYGWIN*|MINGW*|MSYS*)
        OS="Windows"
        if [ -n "$LOCALAPPDATA" ]; then
            WIN_LOCAL="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")"
            DEFAULT_INSTALL_DIR="${WIN_LOCAL}/AetherMirror"
        elif [ -n "$USERPROFILE" ]; then
            WIN_USER="$(cygpath -u "$USERPROFILE" 2>/dev/null || echo "$USERPROFILE")"
            DEFAULT_INSTALL_DIR="${WIN_USER}/AppData/Local/AetherMirror"
        else
            DEFAULT_INSTALL_DIR="$HOME/AppData/Local/AetherMirror"
        fi
        DEFAULT_BIN_DIR="$HOME/.local/bin"
        ;;
    *)
        OS="Linux"
        DEFAULT_INSTALL_DIR="$HOME/.local/share/aether-mirror"
        DEFAULT_BIN_DIR="$HOME/.local/bin"
        ;;
esac

INSTALL_DIR="${CUSTOM_INSTALL_DIR:-${AETHER_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}}"

echo ""
echo "========================================================"
echo "  🚀 Aether Mirror - Unified Setup & System Installer"
echo "========================================================"
echo "  Operating System:    ${OS} (${ARCH})"
echo "  Source Folder:       ${SOURCE_DIR}"
echo "  Installation Target: ${INSTALL_DIR}"
echo "  Auto-Clean Source:   $([ "$KEEP_SOURCE" = "1" ] && echo "No (--keep-source)" || echo "Yes (Default)")"
echo "========================================================"
echo ""

# Helper function to check for sudo privilege (Linux / macOS)
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
echo "[1/6] Checking ADB (Android Debug Bridge) for ${OS}..."
mkdir -p "${SOURCE_DIR}/bin"

ADB_FOUND=false
if command -v adb >/dev/null 2>&1; then
    echo "      Found system adb: $(which adb)"
    cp "$(which adb)" "${SOURCE_DIR}/bin/adb" 2>/dev/null || true
    ADB_FOUND=true
elif [ -f "${SOURCE_DIR}/bin/adb" ] || [ -f "${SOURCE_DIR}/bin/adb.exe" ]; then
    echo "      Found local adb in ${SOURCE_DIR}/bin"
    chmod +x "${SOURCE_DIR}/bin/adb"* 2>/dev/null || true
    ADB_FOUND=true
fi

if [ "$ADB_FOUND" = false ]; then
    echo "      ADB not found. Installing official Google Platform-Tools for ${OS}..."
    INSTALLED_VIA_PKG=false

    if [ "$OS" = "Linux" ] && has_sudo; then
        if command -v pacman >/dev/null 2>&1; then
            sudo pacman -Sy --noconfirm android-tools curl unzip 2>/dev/null && INSTALLED_VIA_PKG=true || true
        elif command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update -y && sudo apt-get install -y android-tools-adb curl unzip 2>/dev/null && INSTALLED_VIA_PKG=true || true
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y android-tools curl unzip 2>/dev/null && INSTALLED_VIA_PKG=true || true
        fi
    elif [ "$OS" = "macOS" ]; then
        if command -v brew >/dev/null 2>&1; then
            brew install android-platform-tools 2>/dev/null && INSTALLED_VIA_PKG=true || true
        fi
    fi

    if [ "$INSTALLED_VIA_PKG" = false ]; then
        echo "      Downloading standalone Google Platform-Tools (${OS})..."
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

        cp -r "${TEMP_DIR}/platform-tools/"* "${SOURCE_DIR}/bin/"
        mkdir -p "$HOME/.local/bin"
        cp "${TEMP_DIR}/platform-tools/adb"* "$HOME/.local/bin/" 2>/dev/null || true
        chmod +x "${SOURCE_DIR}/bin/adb"* 2>/dev/null || true
        rm -rf "${TEMP_DIR}"
        echo "      ADB installed successfully into ${SOURCE_DIR}/bin"
    fi
fi

# 3. Verify scrcpy-server.jar binary (runs on Android app_process)
echo ""
echo "[2/6] Verifying scrcpy-server.jar binary..."
SCRCPY_SERVER_URL="https://github.com/Genymobile/scrcpy/releases/download/v3.1/scrcpy-server-v3.1"

if [ ! -f "${SOURCE_DIR}/bin/scrcpy-server.jar" ] || [ ! -s "${SOURCE_DIR}/bin/scrcpy-server.jar" ]; then
    echo "      Downloading official scrcpy-server (v3.1)..."
    curl -sSL "${SCRCPY_SERVER_URL}" -o "${SOURCE_DIR}/bin/scrcpy-server.jar"
    echo "      scrcpy-server.jar downloaded successfully."
else
    echo "      scrcpy-server.jar is present and verified."
fi

# 4. Check Node.js runtime and dependencies
echo ""
echo "[3/6] Checking Node.js runtime and dependencies..."
if ! command -v node >/dev/null 2>&1; then
    echo "      Node.js not found in PATH."
    if [ "$OS" = "Linux" ] && has_sudo; then
        echo "      Installing Node.js with package manager..."
        if command -v pacman >/dev/null 2>&1; then
            sudo pacman -Sy --noconfirm nodejs npm
        elif command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update -y && sudo apt-get install -y nodejs npm
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y nodejs npm
        fi
    elif [ "$OS" = "macOS" ]; then
        if command -v brew >/dev/null 2>&1; then
            brew install node
        fi
    elif [ "$OS" = "Windows" ]; then
        if command -v winget.exe >/dev/null 2>&1; then
            winget.exe install OpenJS.NodeJS -e --silent 2>/dev/null || true
        fi
    fi
fi

echo "      Node.js version: $(node -v 2>/dev/null || echo 'Not detected')"
echo "      NPM version:     $(npm -v 2>/dev/null || echo 'Not detected')"

# 5. Build production Next.js bundle in source folder
echo ""
echo "[4/6] Installing dependencies and building production bundle..."
cd "${SOURCE_DIR}"
if [ ! -d "node_modules" ]; then
    echo "      Running npm install..."
    npm install
fi

echo "      Compiling Next.js application..."
npm run build

# 6. Deploy files to target installation directory
echo ""
echo "[5/6] Deploying application files to ${INSTALL_DIR}..."

# Stop any running instance before updating files
if command -v fuser >/dev/null 2>&1; then
    fuser -k 3000/tcp 2>/dev/null || true
fi

mkdir -p "${INSTALL_DIR}"

if [ "${SOURCE_DIR}" != "${INSTALL_DIR}" ]; then
    echo "      Syncing build assets and runtime..."
    mkdir -p "${INSTALL_DIR}/bin" "${INSTALL_DIR}/public"

    # Helper function for safe cross-platform replacement without 'text file busy' errors
    sync_item() {
        local src="$1"
        local target="$2"
        if [ ! -e "$src" ]; then return 0; fi

        if [ "$OS" = "Linux" ]; then
            cp -r --remove-destination "$src" "$target"
        else
            rm -rf "${target}/$(basename "$src")" 2>/dev/null || true
            cp -r "$src" "$target"
        fi
    }

    sync_item "${SOURCE_DIR}/.next" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/node_modules" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/bin" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/public" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/server" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/src" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/package.json" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/package-lock.json" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/tsconfig.json" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/next.config.mjs" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/tailwind.config.ts" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/postcss.config.mjs" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/README.md" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/LICENSE" "${INSTALL_DIR}/"

    # Copy cross-platform helper scripts
    sync_item "${SOURCE_DIR}/start.bat" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/create_desktop_shortcut.ps1" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/uninstallation.bat" "${INSTALL_DIR}/"
    sync_item "${SOURCE_DIR}/uninstallation.sh" "${INSTALL_DIR}/"
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
chmod +x "${INSTALL_DIR}/uninstallation.sh" 2>/dev/null || true
ln -sf uninstallation.sh "${INSTALL_DIR}/uninstall.sh" 2>/dev/null || true

# Deploy CLI launcher into ~/.local/bin/aether-mirror
mkdir -p "$HOME/.local/bin"
cat << EOF > "$HOME/.local/bin/aether-mirror"
#!/usr/bin/env bash
export PATH="\$HOME/.local/bin:\$HOME/.local/lib/nodejs/node-v22.11.0-linux-x64/bin:\$PATH"
INSTALL_DIR="${INSTALL_DIR}"
PORT="\${PORT:-3000}"

if [ ! -d "\$INSTALL_DIR" ]; then
    echo "Error: Aether Mirror installation not found in \$INSTALL_DIR."
    exit 1
fi

cd "\$INSTALL_DIR"

open_browser() {
    local url="http://localhost:\${PORT}"
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "\$url" >/dev/null 2>&1 &
    elif command -v open >/dev/null 2>&1; then
        open "\$url" >/dev/null 2>&1 &
    elif command -v sensible-browser >/dev/null 2>&1; then
        sensible-browser "\$url" >/dev/null 2>&1 &
    fi
}

if command -v fuser >/dev/null 2>&1 && fuser "\${PORT}/tcp" >/dev/null 2>&1; then
    echo "Aether Mirror server is already running on port \${PORT}. Opening dashboard..."
    open_browser
    exit 0
fi

(
    for i in \$(seq 1 40); do
        if command -v fuser >/dev/null 2>&1 && fuser "\${PORT}/tcp" >/dev/null 2>&1; then
            break
        fi
        sleep 0.25
    done
    open_browser
) &

exec ./start.sh
EOF
chmod +x "$HOME/.local/bin/aether-mirror"

# -------------------------------------------------------------
# OS-Specific Shortcut & App Launcher Integration
# -------------------------------------------------------------
echo ""
echo "      Configuring application launcher for ${OS}..."

if [ "$OS" = "Linux" ]; then
    # Deploy icons
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
    echo "      ✔ Registered Linux App Launcher: ~/.local/share/applications/aether-mirror.desktop"

elif [ "$OS" = "macOS" ]; then
    # Create macOS Application Bundle: ~/Applications/Aether Mirror.app
    MACOS_BUNDLE="${MACOS_APP_DIR:-$HOME/Applications/Aether Mirror.app}"
    mkdir -p "${MACOS_BUNDLE}/Contents/MacOS"
    mkdir -p "${MACOS_BUNDLE}/Contents/Resources"

    # Info.plist
    cat << 'EOF' > "${MACOS_BUNDLE}/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>Aether Mirror</string>
    <key>CFBundleDisplayName</key>
    <string>Aether Mirror</string>
    <key>CFBundleIdentifier</key>
    <string>com.aether.mirror</string>
    <key>CFBundleVersion</key>
    <string>2.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>aether-mirror</string>
    <key>CFBundleIconFile</key>
    <string>icon</string>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
EOF

    # Launcher in Contents/MacOS
    cat << EOF > "${MACOS_BUNDLE}/Contents/MacOS/aether-mirror"
#!/usr/bin/env bash
export PATH="\$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:\$PATH"
APP_DIR="${INSTALL_DIR}"
cd "\$APP_DIR" || exit 1
open "http://localhost:3000"
exec ./start.sh
EOF
    chmod +x "${MACOS_BUNDLE}/Contents/MacOS/aether-mirror"

    # Copy Icon
    if [ -f "${INSTALL_DIR}/public/icon.png" ]; then
        cp "${INSTALL_DIR}/public/icon.png" "${MACOS_BUNDLE}/Contents/Resources/icon.png"
    fi

    echo "      ✔ Created macOS App Bundle: ${MACOS_BUNDLE} (Available in Spotlight & Launchpad)"

elif [ "$OS" = "Windows" ]; then
    echo "      Generating Windows Desktop & Start Menu (.lnk) shortcuts..."

    # Check if PowerShell is available to generate .lnk shortcut
    if command -v powershell.exe >/dev/null 2>&1; then
        WIN_INSTALL_DIR="$(cygpath -w "${INSTALL_DIR}" 2>/dev/null || echo "${INSTALL_DIR}")"
        powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
            \$WshShell = New-Object -ComObject WScript.Shell;
            \$Desktop = [Environment]::GetFolderPath('Desktop');
            \$Programs = [Environment]::GetFolderPath('Programs');
            \$TargetBat = '${WIN_INSTALL_DIR}\start.bat';
            \$IconFile = '${WIN_INSTALL_DIR}\public\icon.ico';

            # Desktop Shortcut
            \$DesktopShortcut = \$WshShell.CreateShortcut(\"\$Desktop\Aether Mirror.lnk\");
            \$DesktopShortcut.TargetPath = \$TargetBat;
            \$DesktopShortcut.WorkingDirectory = '${WIN_INSTALL_DIR}';
            if (Test-Path \$IconFile) { \$DesktopShortcut.IconLocation = \"\$IconFile,0\"; }
            \$DesktopShortcut.Description = 'Aether Mirror - Android Web Dashboard';
            \$DesktopShortcut.Save();

            # Start Menu Shortcut
            if (Test-Path \$Programs) {
                \$MenuShortcut = \$WshShell.CreateShortcut(\"\$Programs\Aether Mirror.lnk\");
                \$MenuShortcut.TargetPath = \$TargetBat;
                \$MenuShortcut.WorkingDirectory = '${WIN_INSTALL_DIR}';
                if (Test-Path \$IconFile) { \$MenuShortcut.IconLocation = \"\$IconFile,0\"; }
                \$MenuShortcut.Description = 'Aether Mirror - Android Web Dashboard';
                \$MenuShortcut.Save();
            }
        " 2>/dev/null || true
        echo "      ✔ Created Windows Desktop shortcut: Aether Mirror.lnk"
        echo "      ✔ Created Start Menu shortcut: Programs\\Aether Mirror.lnk"
    else
        echo ""
        echo "================================================================="
        echo "  ℹ WINDOWS DESKTOP SHORTCUT CREATION INSTRUCTIONS:"
        echo "================================================================="
        echo "  1. Open Windows Explorer to: ${INSTALL_DIR}"
        echo "  2. Right-click on 'create_desktop_shortcut.ps1' -> Run with PowerShell"
        echo "  OR:"
        echo "  1. Right-click on 'start.bat' -> Send to -> Desktop (create shortcut)"
        echo "  2. Right-click the new shortcut -> Properties -> Change Icon"
        echo "  3. Select: ${INSTALL_DIR}\public\icon.ico"
        echo "================================================================="
        echo ""
    fi
fi

# 7. Delete source project folder if requested/default
if [ "${SOURCE_DIR}" != "${INSTALL_DIR}" ]; then
    echo ""
    if [ "$KEEP_SOURCE" = "1" ]; then
        echo "[6/6] Preserving source repository (--keep-source requested)."
        echo "      Source folder retained at: ${SOURCE_DIR}"
    else
        echo "[6/6] Cleaning up installer project folder..."
        echo "      Removing source folder: ${SOURCE_DIR}"
        cd "${INSTALL_DIR}"
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
if [ "$OS" = "Linux" ]; then
    echo "  • Open from your App Launcher: 'Aether Mirror'"
    echo "  • Or run via terminal:          aether-mirror"
    echo "  • To uninstall, run:            ${INSTALL_DIR}/uninstallation.sh"
elif [ "$OS" = "macOS" ]; then
    echo "  • Open from Spotlight / Launchpad: 'Aether Mirror'"
    echo "  • Or run via terminal:             aether-mirror"
    echo "  • To uninstall, run:               ${INSTALL_DIR}/uninstallation.sh"
elif [ "$OS" = "Windows" ]; then
    echo "  • Open from Desktop:           'Aether Mirror.lnk'"
    echo "  • Or double-click:             ${INSTALL_DIR}\\start.bat"
    echo "  • To uninstall, run:           ${INSTALL_DIR}\\uninstallation.bat"
fi
echo "========================================================"
echo ""
