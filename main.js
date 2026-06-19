const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, execFile } = require('child_process');

let mainWindow;
let activeDevice = null;
let scrcpyProcess = null;
let childHwnd = null;

const adbPath = path.join(__dirname, 'adb.exe');
const scrcpyPath = path.join(__dirname, 'scrcpy-engine.exe');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 900,
    minHeight: 700,
    title: "Android Screen Copy & Control",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    stopStream();
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopStream();
  if (process.platform !== 'darwin') app.quit();
});

// Helper: send logs to renderer
function logToUI(message) {
  if (mainWindow) {
    mainWindow.webContents.send('log', `[${new Date().toLocaleTimeString()}] ${message}`);
  }
}

// IPC Handlers
ipcMain.handle('get-devices', async () => {
  logToUI("Scanning for Android devices...");
  return new Promise((resolve) => {
    execFile(adbPath, ['devices'], (err, stdout) => {
      if (err) {
        logToUI(`Failed to scan devices: ${err.message}`);
        resolve([]);
        return;
      }
      const lines = stdout.split('\r\n').map(l => l.trim()).filter(l => l.length > 0);
      const devices = [];
      // Skip the first line "List of devices attached"
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/\s+/);
        if (parts.length >= 2) {
          devices.push({ id: parts[0], status: parts[1] });
        }
      }
      logToUI(`Found ${devices.length} device(s)`);
      resolve(devices);
    });
  });
});

ipcMain.on('start-stream', (event, { deviceId, x, y, w, h }) => {
  logToUI(`Initializing 60 FPS stream for ${deviceId}...`);
  stopStream();
  activeDevice = deviceId;

  // 1. Spawn scrcpy in borderless mode, initially off-screen
  const embedTitle = `scrcpy-embed-${deviceId}`;
  
  // Arguments to configure scrcpy to run borderless, with custom title
  const scrcpyArgs = [
    '-s', deviceId,
    '--window-title=' + embedTitle,
    '--window-borderless',
    '--window-x=9999',
    '--window-y=9999',
    '--window-width=' + w,
    '--window-height=' + h,
    '--stay-awake'
  ];

  logToUI(`Spawning native scrcpy engine...`);
  scrcpyProcess = spawn(scrcpyPath, scrcpyArgs);

  scrcpyProcess.on('error', (err) => {
    logToUI(`scrcpy process error: ${err.message}`);
  });

  scrcpyProcess.on('close', (code) => {
    logToUI(`scrcpy process closed (exit code: ${code})`);
    stopStream();
  });

  // 2. Wait for scrcpy window to initialize, then find its HWND and embed it
  setTimeout(() => {
    findAndEmbedWindow(embedTitle, x, y, w, h);
  }, 1200); // 1.2s delay to allow the window to fully register
});

ipcMain.on('stop-stream', () => {
  stopStream();
});

ipcMain.on('update-embed-position', (event, { x, y, w, h }) => {
  if (!childHwnd) return;
  
  const moveScript = `
    $sig = '[DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);';
    Add-Type -MemberDefinition $sig -Name "Win32" -Namespace "Win32" -ErrorAction SilentlyContinue;
    [Win32.Win32]::MoveWindow([IntPtr]${childHwnd}, ${x}, ${y}, ${w}, ${h}, $true)
  `;
  
  execFile('powershell', ['-Command', moveScript], (err) => {
    if (err) console.error("Move error:", err);
  });
});

function stopStream() {
  childHwnd = null;
  activeDevice = null;
  if (scrcpyProcess) {
    try {
      scrcpyProcess.kill();
    } catch(e) {}
    scrcpyProcess = null;
  }
}

function findAndEmbedWindow(embedTitle, x, y, w, h) {
  if (!scrcpyProcess || !mainWindow) return;

  // Search for the MainWindowHandle of the scrcpy process having our custom title
  const findCmd = `
    $proc = Get-Process -Name scrcpy-engine -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq "${embedTitle}" };
    if ($proc) { $proc.MainWindowHandle.ToString() } else { "" }
  `;

  execFile('powershell', ['-Command', findCmd], (err, stdout) => {
    if (err) {
      logToUI(`Failed to find scrcpy window: ${err.message}`);
      return;
    }

    const hwnd = stdout.trim();
    if (!hwnd || hwnd === "0") {
      logToUI("scrcpy window not found. Retrying in 1 second...");
      setTimeout(() => findAndEmbedWindow(embedTitle, x, y, w, h), 1000);
      return;
    }

    logToUI(`Found window handle: ${hwnd}. Docking...`);
    childHwnd = hwnd;

    // Get parent HWND of the Electron window
    const parentHwnd = process.arch === 'x64' 
      ? mainWindow.getNativeWindowHandle().readBigInt64LE(0).toString() 
      : mainWindow.getNativeWindowHandle().readInt32LE(0).toString();

    // Call embed.ps1 to reparent and position
    const embedScript = path.join(__dirname, 'embed.ps1');
    const embedArgs = [
      '-childHwndStr', childHwnd,
      '-parentHwndStr', parentHwnd,
      '-x', x,
      '-y', y,
      '-w', w,
      '-h', h
    ];

    execFile('powershell', ['-File', embedScript, ...embedArgs], (embedErr, embedStdout) => {
      if (embedErr) {
        logToUI(`Embedding error: ${embedErr.message}`);
      } else {
        logToUI(`Mirror stream docked successfully at 60 FPS.`);
      }
    });
  });
}

// Sidebar Button Controls
ipcMain.on('key', (event, { deviceId, code }) => {
  if (!deviceId) return;
  execFile(adbPath, ['-s', deviceId, 'shell', 'input', 'keyevent', code], (err) => {
    if (err) logToUI(`Keyevent error: ${err.message}`);
  });
});

ipcMain.on('text', (event, { deviceId, text }) => {
  if (!deviceId || !text) return;
  let escapedText = text.replace(/ /g, '%s');
  escapedText = escapedText.replace(/[^a-zA-Z0-9%s._-]/g, '');
  execFile(adbPath, ['-s', deviceId, 'shell', 'input', 'text', escapedText], (err) => {
    if (err) logToUI(`Text input error: ${err.message}`);
  });
});
