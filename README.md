# Aether Mirror (Next.js • TypeScript • Tailwind • Multi-WebCodecs 60 FPS)

An ultra-low-latency, pure-web Android screen mirroring, multi-device management, and automation dashboard. Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **HTML5 WebCodecs (`VideoDecoder`)**, completely eliminating native window embedding hacks or Electron overhead.

---

## 🏗️ Architecture

```
 ┌────────────────────────────────────────────────────────┐
 │                   Connected Devices                    │
 │  ┌───────────────────────┐   ┌───────────────────────┐ │
 │  │ Device 1 (OPPO)       │   │ Device 2 (Moto G05)   │ │
 │  │ MediaCodec (H.264)    │   │ MediaCodec (H.264)    │ │
 │  └──────────┬────────────┘   └──────────┬────────────┘ │
 └─────────────┼───────────────────────────┼──────────────┘
         TCP Port 27183              TCP Port 27184
               │                           │
 ┌─────────────▼───────────────────────────▼──────────────┐
 │             Node.js Backend (server/index.ts)          │
 │  • Headless scrcpy-server agent lifecycle management   │
 │  • Dynamic TCP port allocation per active session      │
 │  • Multiplexed Binary WebSocket Stream Server          │
 │  • ADB Input & APK Sideload / File Upload Dispatcher   │
 └─────────────────────────────┬──────────────────────────┘
                         Binary WebSocket
                               │
 ┌─────────────────────────────▼──────────────────────────┐
 │             Next.js Frontend (Web Dashboard)           │
 │  • Multi-Device WebCodecs Decoder Pool (GPU Decoders)  │
 │  • Independent 60 FPS HTML5 <canvas> Video Surfaces    │
 │  • Numbered Device Tabs & Side-by-Side Split View      │
 │  • Per-Device Workflow Automator (Isolated Macros)     │
 │  • Contextual Gamepad Overlay & F1 Aim Lock            │
 │  • OLED Screen Blanking / Hardware Privacy Mode        │
 │  • Drag & Drop APK Sideloading & Media Gallery Drop    │
 └────────────────────────────────────────────────────────┘
```

1. **Hardware-Accelerated In-Browser Decoding**: Directly decodes raw H.264 NALUs using the browser's native **WebCodecs API** (`VideoDecoder`). Each video surface paints to an independent GPU-accelerated `<canvas>` element.
2. **Parallel Multi-Device Streaming**: Simultaneously streams and decodes multiple physical or wireless Android devices side-by-side with independent dynamic socket channels (`27183`, `27184`, ...), zero stream teardowns, and 0ms instantaneous tab switching.
3. **Ultra-Low Latency (~20–35 ms)**: Low-overhead binary WebSocket transport streaming up to 60 FPS with hardware decoding.
4. **Pure Web Standard**: No OS window capture hacks, no Win32 `SetParent` glitches, and zero Electron bloat. Works seamlessly on Linux, macOS, and Windows.

---

## ✨ Features

### 📱 1. Multi-Device Numbered Tabs & Side-by-Side Split View
* **Numbered Tabs**: Displays all connected devices with clean hardware identifiers (e.g., `Tab 1: OPPO CPH2689`, `Tab 2: moto g05`).
* **Continuous Parallel Mirroring**: Switching tabs does not terminate or drop background streams. Both devices continue streaming and decoding in the background without interruptions.
* **Side-by-Side Split View Mode (`⊞ Side-by-Side`)**: View and interact with multiple devices side-by-side on a unified screen simultaneously.
* **Plug & Play USB Auto-Detection**: Automatically detects newly plugged-in USB Android devices and presents a prompt to instantly open a new mirroring tab.

### 🤖 2. Per-Device Workflow Automator (Macro Engine)
* **Isolated Device Workflows**: Each connected Android device maintains its own independent macro timeline. Switching between Device 1 and Device 2 loads that specific device's macros.
* **Full Gesture & Input Recording**: Records screen taps, swipes, hardware keys (Back, Home, Recents, Power, Volume), and text inputs with exact coordinate mapping and microsecond timing.
* **Variable Speed & Looping**: Replay macros at 0.5x, 1x, 2x, or 4x speed with single-shot or infinite loop execution.
* **Persistent Storage & Tagged Export**: Macros automatically persist across reloads in `localStorage` under `aether_macro_${deviceId}`. Export macros to JSON with device-tagged filenames (`aether_macro_${deviceName}_${timestamp}.json`).

### 🎮 3. Contextual Gamepad & Aim Lock Keymapper
* **Contextual Floating Controls**: Gamepad overlay automatically activates when games are launched or toggled.
* **WASD Virtual Joystick**: Maps PC keyboard inputs (`W`, `A`, `S`, `D`) to analog thumbstick gestures on the Android display.
* **F1 Aim Lock Mode**: Press `F1` to lock the mouse cursor inside the phone viewport for native FPS/third-person shooter mouse aiming.
* **Action Buttons**: Floating on-screen buttons mapped to customizable touch coordinates.

### 📦 4. Drag & Drop APK Sideloading & Media Drop
* **Drag-and-Drop APK Installation**: Simply drop `.apk` files anywhere onto the device canvas to automatically trigger silent ADB installation (`adb install -r`).
* **Instant Media Transfer**: Drop images, videos, audio, or documents directly onto the canvas to upload them to `/sdcard/Download/` and fire an automatic `MEDIA_SCANNER_SCAN_FILE` broadcast so they appear immediately in Android's gallery.

### 🌑 5. OLED Privacy Mode / Screen Blanking
* One-click hardware screen blanking turns off / blacks out the physical smartphone OLED screen while maintaining full 60 FPS mirror and touch interactivity on the web dashboard.
* Saves device battery, reduces thermals, and prevents shoulder surfing.

### ⚡ 6. Wired & Wireless ADB Connectivity
* Seamless support for both USB-cabled devices and wireless ADB over TCP/IP (`adb connect`).
* Automatic reconnection and dynamic device enumeration.

### 💎 7. Ultra-Realistic Glassmorphic UI & Diagnostics
* Futuristic cyberpunk/glassmorphism interface with ambient edge lighting and device chassis.
* Real-time telemetry diagnostics: live FPS counter, resolution telemetry, frame render time, and system logs.

---

## 📋 System Requirements

* **Computer**: Linux, macOS, or Windows.
* **Browser**: Any modern browser supporting WebCodecs (Google Chrome, Microsoft Edge, Mozilla Firefox 130+, Safari 16.4+, or Chromium-based browsers).
* **Node.js**: v18.0.0 or higher (v20+ recommended).
* **Android Device**: Android 5.0 (Lollipop) or higher with USB Debugging enabled.

---

## ⚡ Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/Prajith-Jayachandran/Android_Scrcpy.git
cd Android_Scrcpy
```

### 2. Run the Unified Installer
```bash
chmod +x install.sh
./install.sh
```

> **What `install.sh` does automatically:**
> - Detects your OS (`Linux`, `macOS`, or `Windows`).
> - Installs prerequisites (`android-tools`, `curl`, `unzip`, `nodejs`) using your native package manager (`apt-get`, `pacman`, `dnf`, `brew`).
> - Gracefully downloads standalone Google platform-tools if package manager access is restricted.
> - Verifies and downloads the headless `scrcpy-server.jar` Android agent.
> - Installs dependencies (`npm install`) and builds the Next.js bundle (`npm run build`).

### 3. Launch the Application
```bash
chmod +x start.sh
./start.sh
```

Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.

---

## 📱 Preparing Your Android Device

1. **Enable Developer Options**:
   - Go to **Settings** -> **About Phone** -> Tap **Build Number** 7 times until you see *"You are now a developer!"*.
2. **Enable USB Debugging**:
   - Go to **Settings** -> **System** / **Developer Options** -> Enable **USB Debugging**.
3. **Connect & Authorize**:
   - Connect your phone via USB cable.
   - On the phone screen, select **"Always allow from this computer"** and tap **Allow**.

---

## 🎮 Interaction & Controls Reference

| Control | Action |
| :--- | :--- |
| **Left Click & Drag** | Tap, select, swipe, or flick on the device canvas |
| **Right Click** | Triggers Android **Back** (`KEYCODE_BACK`) |
| **Middle Click** | Triggers Android **Home** (`KEYCODE_HOME`) |
| **Keyboard Forwarding** | Click the canvas and type on your computer keyboard to input text on Android |
| **Navigation Dock** | Dedicated buttons for **Back**, **Home**, and **Recents** (App Switcher) |
| **Hardware Buttons** | Dedicated controls for **Power**, **Volume Up**, and **Volume Down** |
| **OLED Privacy Mode** | Blacks out phone display while continuing to mirror on desktop |
| **Workflow Automator** | Record, replay, loop, delete, import, and export automated device macros |
| **WASD / Gamepad** | On-screen virtual joystick and floating gaming keys |
| **F1 Key** | Toggle Aim Lock mouse capture for mobile games |
| **File Drag & Drop** | Drop `.apk` to install; drop images/videos/documents to push to `/sdcard/Download/` |

---

## 🛠️ Development & Testing

```bash
# Start development server with hot-reloading
npm run dev

# Compile production Next.js bundle and verify TypeScript types
npm run build

# Start production server
npm start
```

### Automated End-to-End Smoke Test Suite
The project includes an automated end-to-end smoke test suite verifying all 9 critical layers:
1. Environment & ADB binary dependencies.
2. Authorized Android hardware detection.
3. Next.js HTTP dashboard health (HTTP 200).
4. WebSocket handshake on `/ws`.
5. WebSocket control protocol (`get-devices`).
6. 60 FPS hardware mirror streaming & H.264 packet delivery.
7. Input gestures (Wake Key, Tap, Swipe flick).
8. Stream teardown & port release (`stop-stream`).
9. Android system stability & kernel health.
