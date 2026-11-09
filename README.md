# Aether Mirror

High-performance, ultra-low-latency pure-web Android screen mirroring and multi-device workstation.

---

## 📋 System Requirements

* **Operating System**: Linux (x86_64), macOS (Intel / Apple Silicon), or Windows 10/11.
* **Browser**: Any modern browser supporting WebCodecs (Google Chrome, Microsoft Edge, Brave, Chromium).
* **Node.js**: v18.0.0 or higher.
* **Android Device**: Android 5.0+ with USB Debugging enabled.

---

## 📱 Preparing Your Android Device

1. **Enable Developer Options**:
   - Go to **Settings** → **About Phone** → Tap **Build Number** 7 times until you see *"You are now a developer!"*.
2. **Enable USB Debugging**:
   - Go to **Settings** → **System** / **Developer Options** → Toggle **USB Debugging** ON.
3. **Connect & Authorize**:
   - Connect your phone to your computer via USB.
   - When prompted on your phone screen, check **"Always allow from this computer"** and tap **Allow**.

---

## ⚡ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Prajith-Jayachandran/Android_Scrcpy.git
cd Android_Scrcpy
```

### 2. Run the Unified Installer
```bash
chmod +x install.sh
./install.sh --keep-source
```

The installer automatically verifies platform tools, installs dependencies, builds the production application, and creates native desktop shortcuts for your operating system.

---

## 🚀 Launching Aether Mirror

### 🐧 Linux
* **App Launcher**: Search for **"Aether Mirror"** in your application launcher or dock.
* **Terminal**: Run `aether-mirror` from any shell.
* **Direct**: Run `~/.local/share/aether-mirror/start.sh`.

### 🍎 macOS
* **Spotlight / Launchpad**: Press `Cmd + Space` and search for **"Aether Mirror"**, or open it from Launchpad.
* **Terminal**: Run `aether-mirror`.
* **Direct**: Open `~/Applications/Aether Mirror.app`.

### 🪟 Windows
* **Desktop Shortcut**: Double-click **`Aether Mirror.lnk`** on your Desktop.
* **Start Menu**: Search for **"Aether Mirror"** in the Windows Start Menu.
* **Batch Launcher**: Double-click `%LOCALAPPDATA%\AetherMirror\start.bat`.

---

## 🗑️ Uninstallation

* **Linux**:
  ```bash
  ~/.local/share/aether-mirror/uninstallation.sh
  ```
* **macOS**:
  ```bash
  ~/Applications/Aether\ Mirror.app/Contents/Resources/app/uninstallation.sh
  ```
* **Windows**:
  Run `%LOCALAPPDATA%\AetherMirror\uninstallation.bat` or run `uninstallation.sh` in Git Bash.

---

## 📄 License & Proprietary Notice

**Copyright © 2026 Prajith. All Rights Reserved.**

This software is **Proprietary and Confidential**. Unauthorized copying, distribution, modification, reverse engineering, decompilation, public recreation, or commercial exploitation of this codebase or its underlying concepts is strictly prohibited without explicit prior written permission from the author.
