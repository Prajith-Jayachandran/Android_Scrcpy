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

If you have cloned this repository, you must download the native binaries and install dependencies before running the app. You can do this automatically or manually.

### Option A: Automated Setup (Recommended & Fastest)
We have provided an automated setup script that downloads the official Genymobile Scrcpy release, extracts it, configures the engine, installs all Node.js dependencies, and starts the application:

1. Double-click the **`install.bat`** file in the project root directory (or run it from your terminal).
2. Wait for the process to complete. The app will launch automatically when finished!

---

### Option B: Manual Setup
If you prefer to perform the setup steps manually, follow the instructions below:

#### Step 1: Install Node.js Dependencies
Open a terminal in the project directory and run:
```bash
npm install
```

#### Step 2: Download Native Scrcpy Binaries
1. Go to the [Official Genymobile Scrcpy Releases](https://github.com/Genymobile/scrcpy/releases).
2. Download the **Windows 64-bit release** (version **v4.0** is recommended, e.g., `scrcpy-win64-v4.0.zip`).
3. Extract the downloaded ZIP archive.
4. Copy the following files and folders from the extracted directory directly into the root of this project:
   - `scrcpy.exe`
   - `scrcpy-server`
   - `adb.exe`
   - `AdbWinApi.dll` and `AdbWinUsbApi.dll`
   - `SDL3.dll`
   - All other `.dll` files (`avcodec-62.dll`, `avformat-62.dll`, `avutil-60.dll`, `swresample-6.dll`, `libusb-1.0.dll`, etc.)
5. **Rename** the copied **`scrcpy.exe`** to **`scrcpy-engine.exe`** in the project root. (This prevents namespace conflict with the main Electron application launcher).

---

## 🚀 Running the App (Manual Mode)

### 1. Run in Development Mode
Once the native binaries are copied into the root folder, launch the app directly using:
```bash
npm start
```

### 2. Package into a Standalone Executable
If you want to build a standalone portable executable package:
1. Run the packaging command:
   ```bash
   npm run package
   ```
2. The packager will create a new directory: `dist\AndroidScreenCopy-win32-x64\`.
3. To distribute or run the packaged version, copy the native dependencies (`scrcpy-engine.exe`, `scrcpy-server`, `adb.exe`, `embed.ps1`, and all `.dll` files) from your project root into `dist\AndroidScreenCopy-win32-x64\`.
4. In `dist\AndroidScreenCopy-win32-x64\`, rename `AndroidScreenCopy.exe` to `scrcpy.exe` for the final clean branding.
5. Run `scrcpy.exe` to launch the application.

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
