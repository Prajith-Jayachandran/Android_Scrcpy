const deviceSelect = document.getElementById('device-select');
const btnRefresh = document.getElementById('btn-refresh');
const deviceStatusBadge = document.getElementById('device-status-badge');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const statLatency = document.getElementById('stat-latency');
const statFps = document.getElementById('stat-fps');
const mirrorContainer = document.getElementById('mirror-container');
const screenPlaceholder = document.getElementById('screen-placeholder');
const textInput = document.getElementById('text-input');
const btnSendText = document.getElementById('btn-send-text');
const logConsole = document.getElementById('log-console');
const btnClearLogs = document.getElementById('btn-clear-logs');

let selectedDeviceId = "";
let isStreaming = false;
let currentDevices = [];

// Log writer helper
function addLog(message) {
  const line = document.createElement('div');
  line.className = 'log-line';
  if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail')) {
    line.classList.add('error');
  } else if (message.toLowerCase().includes('scanning') || message.toLowerCase().includes('ready') || message.toLowerCase().includes('docked')) {
    line.classList.add('system');
  }
  line.textContent = message;
  logConsole.appendChild(line);
  logConsole.scrollTop = logConsole.scrollHeight;
}

// Intercept window logs from main process
window.electronAPI.onLog((msg) => {
  addLog(msg);
});

// Scan/Refresh Devices
async function scanDevices(silent = false) {
  if (!silent) {
    deviceSelect.disabled = true;
    btnStart.disabled = true;
    deviceSelect.innerHTML = '<option value="">Scanning...</option>';
  }
  
  try {
    const devices = await window.electronAPI.getDevices();
    
    // Check if the devices list has changed (length or statuses)
    const changed = devices.length !== currentDevices.length || 
      devices.some((d, idx) => d.id !== currentDevices[idx].id || d.status !== currentDevices[idx].status);
      
    if (changed || !silent) {
      currentDevices = devices;
      const prevSelected = selectedDeviceId;
      deviceSelect.innerHTML = '';
      
      if (devices.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "No devices connected";
        deviceSelect.appendChild(opt);
        updateStatusBadge('disconnected');
        btnStart.disabled = true;
      } else {
        devices.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.id;
          opt.textContent = `${d.id} (${d.status})`;
          opt.dataset.status = d.status;
          deviceSelect.appendChild(opt);
        });
        deviceSelect.disabled = false;
        
        // Restore previous selection if it still exists
        let found = false;
        for (let i = 0; i < deviceSelect.options.length; i++) {
          if (deviceSelect.options[i].value === prevSelected) {
            deviceSelect.selectedIndex = i;
            found = true;
            break;
          }
        }
        
        onDeviceSelectionChange();
      }
    }
  } catch (err) {
    if (!silent) {
      addLog(`[Error] Failed to scan: ${err.message}`);
      updateStatusBadge('disconnected');
    }
  }
}

function updateStatusBadge(status) {
  deviceStatusBadge.className = 'status-badge ' + status;
  const badgeText = deviceStatusBadge.querySelector('.text');
  
  if (status === 'connected') {
    badgeText.textContent = 'Authorized';
  } else if (status === 'unauthorized') {
    badgeText.textContent = 'Unauthorized';
  } else {
    badgeText.textContent = 'Disconnected';
  }
}

async function onDeviceSelectionChange() {
  const selectedOpt = deviceSelect.options[deviceSelect.selectedIndex];
  if (!selectedOpt || !selectedOpt.value) {
    selectedDeviceId = "";
    btnStart.disabled = true;
    updateStatusBadge('disconnected');
    return;
  }
  
  selectedDeviceId = selectedOpt.value;
  const status = selectedOpt.dataset.status;
  
  if (status === 'device') {
    updateStatusBadge('connected');
    if (!isStreaming) btnStart.disabled = false;
  } else if (status === 'unauthorized') {
    updateStatusBadge('unauthorized');
    btnStart.disabled = true;
    addLog(`[Warning] Device ${selectedDeviceId} is unauthorized. Allow USB debugging on your device screen.`);
  } else {
    updateStatusBadge('disconnected');
    btnStart.disabled = true;
  }
}

// Bind Select Event
deviceSelect.addEventListener('change', onDeviceSelectionChange);
btnRefresh.addEventListener('click', () => scanDevices(false));

// Start Mirroring (60 FPS Embedded Window)
btnStart.addEventListener('click', () => {
  if (!selectedDeviceId) return;
  
  isStreaming = true;
  btnStart.disabled = true;
  btnStop.disabled = false;
  deviceSelect.disabled = true;
  btnRefresh.disabled = true;
  textInput.disabled = false;
  btnSendText.disabled = false;
  
  screenPlaceholder.style.display = 'none';
  mirrorContainer.style.display = 'block';
  
  // Calculate window-relative coordinate bounding box of mirrorContainer
  const rect = mirrorContainer.getBoundingClientRect();
  
  // Launch and embed scrcpy
  window.electronAPI.startStream({
    deviceId: selectedDeviceId,
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    w: Math.round(rect.width),
    h: Math.round(rect.height)
  });
  
  addLog(`Mirroring started for device: ${selectedDeviceId}`);
});

// Stop Mirroring
btnStop.addEventListener('click', () => {
  stopMirroring();
});

function stopMirroring() {
  if (!isStreaming) return;
  
  isStreaming = false;
  window.electronAPI.stopStream();
  
  btnStart.disabled = false;
  btnStop.disabled = true;
  deviceSelect.disabled = false;
  btnRefresh.disabled = false;
  textInput.disabled = true;
  btnSendText.disabled = true;
  
  mirrorContainer.style.display = 'none';
  screenPlaceholder.style.display = 'flex';
  
  addLog("Mirroring stopped.");
}

// Monitor Window Resizes and reposition the child window
window.addEventListener('resize', () => {
  if (isStreaming) {
    const rect = mirrorContainer.getBoundingClientRect();
    window.electronAPI.updateEmbedPosition({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      w: Math.round(rect.width),
      h: Math.round(rect.height)
    });
  }
});

// Clear Logs
btnClearLogs.addEventListener('click', () => {
  logConsole.innerHTML = '';
});

// Shortcut Action Keys Bindings (for buttons)
document.getElementById('btn-key-back').addEventListener('click', () => {
  if (isStreaming && selectedDeviceId) window.electronAPI.key({ deviceId: selectedDeviceId, code: 4 });
});
document.getElementById('btn-key-home').addEventListener('click', () => {
  if (isStreaming && selectedDeviceId) window.electronAPI.key({ deviceId: selectedDeviceId, code: 3 });
});
document.getElementById('btn-key-recents').addEventListener('click', () => {
  if (isStreaming && selectedDeviceId) window.electronAPI.key({ deviceId: selectedDeviceId, code: 187 });
});
document.getElementById('btn-key-power').addEventListener('click', () => {
  if (isStreaming && selectedDeviceId) window.electronAPI.key({ deviceId: selectedDeviceId, code: 26 });
});
document.getElementById('btn-key-volup').addEventListener('click', () => {
  if (isStreaming && selectedDeviceId) window.electronAPI.key({ deviceId: selectedDeviceId, code: 24 });
});
document.getElementById('btn-key-voldown').addEventListener('click', () => {
  if (isStreaming && selectedDeviceId) window.electronAPI.key({ deviceId: selectedDeviceId, code: 25 });
});

// Text Input Sending
function sendText() {
  const text = textInput.value;
  if (!text || !selectedDeviceId) return;
  window.electronAPI.text({ deviceId: selectedDeviceId, text });
  textInput.value = '';
}

btnSendText.addEventListener('click', sendText);
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    sendText();
  }
});

// Init on startup
scanDevices();

// Auto-poll devices every 2.5 seconds if not streaming
setInterval(() => {
  if (!isStreaming) {
    scanDevices(true);
  }
}, 2500);
