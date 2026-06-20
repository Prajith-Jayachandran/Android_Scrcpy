#!/bin/bash
echo "======================================================"
echo " 📱 Android Mirroring Linux Installer"
echo "======================================================"
echo

# 1. Check for Node.js and npm
if ! command -v npm &> /dev/null; then
    echo "[ERROR] Node.js and npm are not installed."
    echo "Please install them using your package manager (e.g., sudo apt install nodejs npm)."
    exit 1
fi

# 2. Check and Install System Dependencies (scrcpy, adb, xdotool, wmctrl)
MISSING_DEPS=()
for dep in adb scrcpy xdotool wmctrl; do
    if ! command -v $dep &> /dev/null; then
        MISSING_DEPS+=($dep)
    fi
done

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    echo "Missing system packages: ${MISSING_DEPS[*]}"
    echo "Attempting to install missing dependencies..."
    
    # Detect package manager
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y "${MISSING_DEPS[@]}"
    elif command -v dnf &> /dev/null; then
        sudo dnf install -y "${MISSING_DEPS[@]}"
    elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm "${MISSING_DEPS[@]}"
    else
        echo "[WARNING] Unknown package manager. Please install the following manually: ${MISSING_DEPS[*]}"
        exit 1
    fi
fi

# 3. Install Node.js packages
echo
echo "Installing Node.js packages..."
npm install
if [ $? -ne 0 ]; then
    echo "[ERROR] npm install failed."
    exit 1
fi

# 4. Package application
echo
echo "Building the standalone launcher application..."
rm -rf dist
npm run package
if [ $? -ne 0 ]; then
    echo "[ERROR] Packaging failed."
    exit 1
fi

# 5. Extract and finalize files
echo
echo "Finalizing application setup..."
# Determine the build directory name (e.g. AndroidScreenCopy-linux-x64)
BUILD_DIR=$(find dist -maxdepth 1 -type d -name "AndroidScreenCopy-linux-*" | head -n 1)

if [ -z "$BUILD_DIR" ]; then
    echo "[ERROR] Could not find compiled build 
<truncated 739 bytes>