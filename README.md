# Android Mirroring Tool (60 FPS Hybrid)

A standalone desktop screen mirroring and control application for Android devices. This tool integrates Genymobile's native high-performance `scrcpy` engine directly into a custom, premium dark glassmorphic control dashboard.

---

## 🏗️ Architecture: How It Works

To achieve a fluid, zero-latency **60 FPS** stream without lag, this application uses a hybrid architecture:
1. **Frontend (Electron)**: A modern HTML5/CSS3 glassmorphic dashboard handles device selection, status tracking, window controls, volume, and input emulation.
2. **Streaming Engine (`scrcpy`)**: Genymobile's native C/SDL compiled `scrcpy` engine is spawned in borderless mode.
3. **Win32 Docking**: A PowerShell script (`embed.ps1`) hooks into the Windows API, reparenting the native `scrcpy` video window (`SetParent`) and docking it precisely inside the Electron smartphone mockup frame.

Since large binary executables (`.exe`), dynamic-link libraries (`.dll`), and browser packages are ignored by Git to keep the repository under 1 MB, you must download the native binaries separately to run or compile the project.

---

## 🛠️ Repository Setup (For Cloned Code)

If you have cloned this repository, you must restore the native binaries, install dependencies, and build the launcher. We have provided a fully automated script to do this:

### ⚡ Automated Installation
1. Double-click the **`install.bat`** file in the project root directory (or run it from your terminal).
2. The installation script will automatically:
   - Download the official Genymobile `scrcpy` engine binaries.
   - Install the project's Node.js packages.
   - Compile and build the standalone application bundle.
   - Launch the mirroring dashboard immediately.
   - **Self-delete** the `install.bat` file to keep the workspace clean.

---

## 🚀 Running the App

After the setup is complete, you can launch the mirroring dashboard at any time by double-clicking the newly compiled **`scrcpy.exe`** file in the project root directory.

> [!IMPORTANT]
> Make sure to double-click and run **`scrcpy.exe`** (our custom dashboard launcher), **NOT `scrcpy-engine.exe`** (which is the headless native backend engine spawned by Electron and will not display the control dashboard).

---

## 📱 How to Prepare Your Phone

1. Enable **USB Debugging** on your Android device:
   - Open **Settings** -> **About Phone** -> Tap **Build Number** 7 times.
   - Go back to **Settings** -> **System** / **Developer Options** -> Turn **USB Debugging** ON.
2. Connect the phone to your computer with a USB cable.
   - Select **File Transfer** (MTP) if prompted.
3. Approve the fingerprint popup on your phone screen:
   - Check **"Always allow from this computer"** and tap **Allow**.

---

## 🎮 Interaction Controls

* **Left Click & Drag**: Tap, select, swipe, or scroll on the device screen.
* **Right Click**: Triggers the **Back** button (or press `ESC` on your keyboard, or click the **Back** sidebar button).
* **Middle Click**: Triggers the **Home** button (or click the **Home** sidebar button).
* **Sidebar Controls**: Use the on-screen keys for **Recents**, **Power**, **Vol +**, and **Vol -**.
* **Direct Typing**: Click inside the screen and type on your computer keyboard to input text on the phone. Alternatively, type into the **Text Input** field in the sidebar and click **Send**.
