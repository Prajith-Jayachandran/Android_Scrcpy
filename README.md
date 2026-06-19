# Android Mirroring Tool (60 FPS Hybrid)

A standalone desktop screen mirroring and control application for Android devices. This tool integrates Genymobile's native high-performance `scrcpy` engine directly into a custom, premium dark glassmorphic control dashboard.

## Features

*   **Fluid 60 FPS Mirroring**: Native hardware-accelerated video decoding with sub-70ms latency.
*   **Aesthetic Custom Dashboard**: Glassmorphic layout containing a device selector, auto-polling state indicators, volume adjustment, and quick-action hardware keys.
*   **Seamless Controls**: Supports direct touch clicks, swipe gestures, physical PC keyboard typing, and clipboard synchronization (`Ctrl + C` / `Ctrl + V`).
*   **Window Alignment**: Automatically anchors and resizes the native video stream window to stay locked inside the mockup smartphone border.

---

## Quick Start (How to Use)

### Step 1: Prepare your Phone
1.  Enable **USB Debugging** on your Android device:
    *   Open **Settings** -> **About Phone** -> Tap **Build Number** 7 times.
    *   Go back to **System** -> **Developer options** -> Toggle **USB Debugging** ON.
2.  Connect your phone to your PC via a USB cable.
3.  Unlock your phone and approve the fingerprint popup: **"Allow USB debugging? -> Always allow from this computer -> Allow"**.

### Step 2: Launch the Mirror Tool
1.  Copy the files to your desired directory
1.  Navigate to that directory in File Explorer.
2.  Double-click **`scrcpy.exe`**.
3.  The control dashboard will load and automatically scan for your connected device.
4.  Once the status indicator turns green (**"Authorized"**), click the **Start Mirroring** button.
5.  The mirroring stream will dock inside the phone frame!

---

## Native Interaction Controls

*   **Click / Drag**: Left-click to tap, click & drag to swipe or scroll.
*   **Back Key**: Right-click inside the mirror screen (or click the **Back** button on the right sidebar, or press `ESC` on your keyboard).
*   **Home Key**: Middle-click inside the mirror screen (or click the **Home** button on the right sidebar).
*   **App Switcher**: Click the **Recents** button on the right sidebar.
*   **Volume / Power**: Use the **Power**, **Vol +**, and **Vol -** buttons in the sidebar.
*   **Text Typing**: Click inside the screen and type on your computer keyboard to input text directly on the phone. Alternatively, type into the **Text Input** field in the sidebar and click **Send**.

---

## For Developers (Modifying the Code)

If you wish to modify the application UI or script logic, you can run the app in development mode:

### 1. Install Node Dependencies
Open a command prompt in `D:\Scrcpy` and run:
```bash
npm install
```

### 2. Start in Development Mode
To launch the application directly from the source code:
```bash
npm start
```

### 3. Rebuild / Repackage the Executable
If you modify `main.js`, `renderer.js`, `index.html`, or `style.css` and want to compile a new standalone executable:
1.  Package the files:
    ```bash
    npm run package
    ```
2.  A new build will be created in `dist\AndroidScreenCopy-win32-x64\`.
3.  Move the files from `dist\AndroidScreenCopy-win32-x64\*` up to `D:\Scrcpy` (overwriting the old executables and folders).
4.  Rename the new `AndroidScreenCopy.exe` to `scrcpy.exe`.
5.  Delete the temporary `dist/` directory.

*(Note: The backend C/SDL binary `scrcpy-engine.exe` must remain in the same folder as `scrcpy.exe` for the mirroring to start.)*
