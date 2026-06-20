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

If you have cloned this repository, you must restore the native binaries, install dependencies, and build the launcher. We have provided automated scripts for both Windows and Linux:

### Option A: Windows Setup (Automated)
1. Double-click the **`install.bat`** file in the project root directory.
2. The installation script will automatically:
   - Download the official Genymobile `scrcpy` engine binaries.
   - Install the project's Node.js packages.
   - Compile and build the standalone application bundle.
   - Launch the mirroring dashboard immediately.
   - **Self-delete** the `install.bat` file to keep the workspace clean.

---

### Option B: Linux Setup (Automated)
1. Clone the repository and navigate into the folder:
   ```bash
   git clone https://github.com/Prajith-Jayachandran/Android_Scrcpy.git
   cd Android_Scrcpy
   ```
2. Make the installer script executable and run it:
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
   *(Note: The script will prompt you for your `sudo` password to install system dependencies like `adb`, `scrcpy`, `xdotool`, and `wmctrl` if they are missing.)*
3. The installation script will automatically:
   - Detect your package manager and install missing system dependencies.
   - Install the project's Node.js packages.
   - Compile and build the standalone Linux binary.
   - Launch the mirroring dashboard immediately.
   - **Self-delete** the `install.sh` file to keep the workspace clean.

---

## 🚀 Running the App

After the setup is complete, you can launch the mirroring dashboard at any time:

* **Windows**: Double-click the newly compiled **`scrcpy.exe`** file in the project root directory.
  > [!IMPORTANT]
  > Make sure to double-click and run **`scrcpy.exe`** (our custom dashboard launcher), **NOT `scrcpy-engine.exe`** (which is the headless native backend engine spawned by Electron and will not display the control dashboard).

* **Linux**: Execute **`./scrcpy`** in your terminal or double-click the compiled **`scrcpy`** binary.
  > [!IMPORTANT]
  > If you are running a Wayland-native desktop environment, make sure to run the application using XWayland by running:
  > `ELECTRON_OZONE_PLATFORM_HINT=x11 ./scrcpy`

---

## 📱 How to Prepare Your Phone

### Android Devices:
1. Enable **USB Debugging** on your device:
   - Open **Settings** -> **About Phone** -> Tap **Build Number** 7 times.
   - Go back to **Settings** -> **System** / **Developer Options** -> Turn **USB Debugging** ON.
2. Connect the phone to your computer with a USB cable.
   - Select **File Transfer** (MTP) if prompted.
3. Approve the fingerprint popup on your phone screen:
   - Check **"Always allow from this computer"** and tap **Allow**.

### iOS Devices (iPhone/iPad):
1. Enable **Developer Mode**:
   - Open **Settings** -> **Privacy & Security** -> Scroll down to **Developer Mode** -> Toggle ON.
   - Restart your phone and confirm the prompt to turn Developer Mode ON.
2. Connect the iPhone to your computer via USB.
3. Approve the Trust prompt on your phone screen:
   - Tap **"Trust This Computer"** and enter your device passcode.

---

## 🎮 Interaction Controls

* **Left Click & Drag**: Tap, select, swipe, or scroll on the device screen.
* **Right Click**: Triggers the **Back** button (or press `ESC` on your keyboard, or click the **Back** sidebar button).
* **Middle Click**: Triggers the **Home** button (or click the **Home** sidebar button).
* **Sidebar Controls**: Use the on-screen keys for **Recents**, **Power**, **Vol +**, and **Vol -**.
* **Direct Typing**: Click inside the screen and type on your computer keyboard to input text on the phone. Alternatively, type into the **Text Input** field in the sidebar and click **Send**.

---

## 🍎 iOS Code-Signing & Setup Requirements

To enable mirroring and remote touch control on iOS devices, the application uses **`go-ios`** and Facebook's **`WebDriverAgent` (WDA)** test runner on-device. Due to Apple's security sandbox, you must prepare the following:

### 🔑 Apple Developer Profile Required (For Remote Control)
* **Code-Signing**: WebDriverAgent must be signed and installed on your iOS device to execute touch gestures and key inputs from the PC.
* **Requirements**: You will need an **Apple Developer Profile** (either a free personal developer account or a paid Apple Developer program membership) and your Apple Team ID.
* **Automated Installation**: During iOS device setup, the launcher will prompt you for your Team ID to automatically sign, install, and run WDA on the phone using `go-ios`.

### 📺 Alternative: Plug-and-Play AirPlay (View-Only Mode)
If you do not want to configure a developer profile, you can launch the app in **AirPlay Receiver Mode** (using `UxPlay`). 
* This provides a 60 FPS screen mirror stream without requiring any developer profile or code-signing, but is **view-only** (you cannot control the phone from your PC).
