# Android Web Mirror (Next.js • TypeScript • Tailwind • WebCodecs 60 FPS)

An ultra-low-latency, pure-web Android screen mirroring and control dashboard. Built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **HTML5 WebCodecs (`VideoDecoder`)**, completely eliminating native window embedding hacks.

---

## 🏗️ Architecture

```
 ┌────────────────┐          ┌──────────────────────┐          ┌────────────────────────┐
 │ Android Device │          │ Node.js Server       │          │ Next.js Frontend (Web) │
 │                │          │                      │          │                        │
 │  MediaCodec    │   TCP    │  WebSocket Bridge    │    WS    │  WebCodecs GPU         │
 │  (H.264 NALUs) ├─────────►│  (server/index.ts)   ├─────────►│  (VideoDecoder)        │
 │                │   ADB    │                      │          │           │            │
 │  Touch Input   │◄─────────┤  Control Dispatcher  │◄─────────┤  HTML5 <canvas>        │
 └────────────────┘ Forward  └──────────────────────┘  Binary  │  (Mouse & Key Events)  │
                                                               └────────────────────────┘
```

1. **In-Browser Hardware Video Decoding**: Decodes the phone's raw H.264 video stream directly inside the browser using the **WebCodecs API** (`VideoDecoder`). Frames are painted to a `<canvas>` element with GPU acceleration.
2. **True Cross-Platform**: No Win32 `SetParent` hacks, no OS-specific window docking glitches, and zero Electron bloat. Works seamlessly on Linux, macOS, and Windows.
3. **Low Latency (~25–35 ms)**: H.264 video packets stream directly over a binary WebSocket connection at up to 60 FPS.
4. **Interactive Emulation**: Click and drag on the phone canvas to tap and swipe. Full sidebar navigation (Back, Home, Recents, Power, Volume) and text input injection via ADB.

---

## 📋 System Requirements

* **Computer**: Linux, macOS, or Windows.
* **Browser**: Any modern browser supporting WebCodecs (Google Chrome, Microsoft Edge, Mozilla Firefox 130+, Safari 16.4+, or Chromium-based browsers).
* **Node.js**: v18.0.0 or higher.
* **Android Device**: Android 5.0 (Lollipop) or higher with USB Debugging enabled.

---

## ⚡ Installation Procedure

We have provided a unified installer script that handles system package management, automatic OS detection, binary downloads, and application compilation.

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
> - Uses `sudo` with your native package manager (`pacman`, `apt-get`, `dnf`, `brew`) whenever available to install prerequisites (`android-tools`, `curl`, `unzip`, `nodejs`).
> - Gracefully falls back to downloading Google's official Android platform-tools standalone binaries if `sudo` is unavailable.
> - Verifies and fetches the headless `scrcpy-server.jar` Android agent.
> - Installs all project dependencies (`npm install`) and builds the production Next.js bundle (`npm run build`).

### 3. Launch the Application
```bash
./start.sh
# or run:
npm start
```

Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.

---

## 📱 Preparing Your Phone

1. **Enable Developer Options**:
   - Go to **Settings** -> **About Phone** -> Tap **Build Number** 7 times until you see *"You are now a developer!"*.
2. **Enable USB Debugging**:
   - Go to **Settings** -> **System** / **Developer Options** -> Enable **USB Debugging**.
3. **Connect & Authorize**:
   - Connect your phone via USB cable (set to *File Transfer / MTP* mode if prompted).
   - On the phone screen, check **"Always allow from this computer"** and tap **Allow**.

---

## 🎮 Interaction & Controls

* **Left Click & Drag**: Tap, select, swipe, or scroll on the device screen.
* **Right Click**: Triggers the **Back** key.
* **Middle Click**: Triggers the **Home** key.
* **Keyboard Forwarding**: Click the screen canvas and type on your computer keyboard to type on Android.
* **Navigation Buttons**: Dedicated on-screen buttons for **Back**, **Home**, and **Recents** (App Switcher).
* **Hardware Buttons**: Buttons for **Power**, **Volume Up**, and **Volume Down**.
* **Text Input Injection**: Dedicated input box to paste or type strings directly into Android fields.
* **Diagnostics**: Live framerate counter, estimated latency, resolution telemetry, and system log console.

---

## 🛠️ Development & Manual Commands

```bash
# Start development server with hot-reloading
npm run dev

# Rebuild production bundle
npm run build

# Start production server
npm start
```
