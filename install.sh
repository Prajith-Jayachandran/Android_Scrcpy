#!/usr/bin/env bash
set -e

# ========================================================
#  📱 Android Web Mirror - Unified Installer
#  Detects OS, installs system/user dependencies,
#  fetches binaries, and builds the production web app.
# ========================================================

echo ""
echo "========================================================"
echo "  🚀 Android Web Mirror - Setup & Installer"
echo "========================================================"
echo ""

# Ensure user-space bin directories are in PATH
export PATH="$HOME/.local/bin:$HOME/.local/lib/nodejs/node-v22.11.0-linux-x64/bin:$PWD/bin:$PATH"

# 1. OS Detection
OS_TYPE="$(uname -s)"
ARCH="$(uname -m)"

echo "[1/5] Detecting Operating System..."
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
echo "[2/5] Checking for ADB (Android Debug Bridge)..."
mkdir -p bin

if command -v adb >/dev/null 2>&1; then
    echo "      Found system adb: $(which adb)"
    cp "$(which adb)" bin/adb 2>/dev/null || true
elif [ -f "./bin/adb" ]; then
    echo "      Found local adb in ./bin/adb"
    chmod +x ./bin/adb
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
        cp "${TEMP_DIR}/platform-tools/adb"* bin/
        mkdir -p "$HOME/.local/bin"
        cp "${TEMP_DIR}/platform-tools/adb"* "$HOME/.local/bin/" 2>/dev/null || true
        chmod +x bin/adb* 2>/dev/null || true
        rm -rf "${TEMP_DIR}"
        echo "      ADB installed into ./bin/adb successfully."
    fi
fi

# 3. Download scrcpy-server.jar binary (runs on Android app_process)
echo ""
echo "[3/5] Verifying scrcpy-server.jar binary..."
SCRCPY_SERVER_URL="https://github.com/Genymobile/scrcpy/releases/download/v3.1/scrcpy-server-v3.1"

if [ ! -f "bin/scrcpy-server.jar" ] || [ ! -s "bin/scrcpy-server.jar" ]; then
    echo "      Downloading official scrcpy-server (v3.1)..."
    curl -sSL "${SCRCPY_SERVER_URL}" -o "bin/scrcpy-server.jar"
    echo "      scrcpy-server.jar downloaded successfully."
else
    echo "      scrcpy-server.jar is present and verified."
fi

# 4. Check Node.js and NPM
echo ""
echo "[4/5] Checking Node.js and package manager..."
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

# 5. Install Dependencies and Build Application
echo ""
echo "[5/5] Installing dependencies and building production app..."
npm install
npm run build

# Create convenient startup script
cat << 'EOF' > start.sh
#!/usr/bin/env bash
export PATH="$HOME/.local/bin:$HOME/.local/lib/nodejs/node-v22.11.0-linux-x64/bin:$PWD/bin:$PATH"
PORT="${PORT:-3000}"
echo ""
echo "========================================================"
echo "  🚀 Starting Android Web Mirror"
echo "  Open your browser at: http://localhost:${PORT}"
echo "========================================================"
echo ""
npm start
EOF
chmod +x start.sh

echo ""
echo "========================================================"
echo "  🎉 Installation & Build Successful!"
echo "  Run './start.sh' (or 'npm start') to launch the app."
echo "========================================================"
echo ""
