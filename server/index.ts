import http from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import net from 'net';
import { AdbManager, DeviceInfo } from './adb';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_FORWARD_PORT = 27183;

export const adb = new AdbManager();

export interface StreamSession {
  deviceId: string;
  serverProc: any;
  videoSocket: net.Socket | null;
  audioSocket?: net.Socket | null;
  audioEnabled?: boolean;
  forwardPort: number;
  width?: number;
  height?: number;
}

// Multi-device active streaming sessions map (Feature #4)
const activeSessions = new Map<string, StreamSession>();
let portOffsetCounter = 0;

function allocateForwardPort(deviceId: string): number {
  const existing = activeSessions.get(deviceId);
  if (existing) return existing.forwardPort;
  const port = BASE_FORWARD_PORT + (portOffsetCounter++ % 40);
  return port;
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({
    server,
    path: '/ws',
    perMessageDeflate: false,
  });

  interface ExtendedWebSocket extends WebSocket {
    activeDeviceId?: string;
  }

  let stopTimeout: NodeJS.Timeout | null = null;

  wss.on('connection', (ws: ExtendedWebSocket) => {
    console.log('[WS] Client connected');
    if (stopTimeout) {
      clearTimeout(stopTimeout);
      stopTimeout = null;
    }

    const sendLog = (message: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'log', message, timestamp: Date.now() }));
      }
    };

    sendLog(`Connected to Android Screen Copy backend server.`);

    ws.on('message', async (data: Buffer | string) => {
      try {
        let textPayload = '';
        if (Buffer.isBuffer(data)) {
          // Check for Layer 5 Obfuscated Binary Frame (Magic header 0xAA 0x55 with XOR mask 0x5C)
          if (data.length > 2 && data[0] === 0xAA && data[1] === 0x55) {
            const unmasked = Buffer.alloc(data.length - 2);
            for (let i = 2; i < data.length; i++) {
              unmasked[i - 2] = data[i] ^ 0x5C;
            }
            textPayload = unmasked.toString('utf-8');
          } else {
            textPayload = data.toString('utf-8');
          }
        } else {
          textPayload = data.toString();
        }

        const msg = JSON.parse(textPayload);

        switch (msg.type) {
          case 'get-devices': {
            const devices = await adb.getDevices();
            ws.send(JSON.stringify({ type: 'devices', devices }));
            break;
          }

          case 'select-device': {
            if (msg.deviceId) {
              ws.activeDeviceId = msg.deviceId;
            }
            break;
          }

          case 'start-stream': {
            const deviceId = msg.deviceId;
            if (!deviceId) return;

            ws.activeDeviceId = deviceId;
            sendLog(`Preparing stream for device: ${deviceId}...`);

            // Stop any existing session for this specific device
            await stopSession(deviceId);
            await adb.killAllScrcpyServers(deviceId);

            // 1. Push scrcpy-server.jar to device
            sendLog(`Pushing scrcpy-server to ${deviceId}...`);
            const pushed = await adb.pushServer(deviceId);
            if (!pushed) {
              sendLog(`[Error] Failed to push scrcpy-server to ${deviceId}.`);
              return;
            }

            // 2. Set up ADB forward
            const forwardPort = allocateForwardPort(deviceId);
            sendLog(`Setting up ADB port forward (tcp:${forwardPort})...`);
            const forwarded = await adb.forwardPort(deviceId, forwardPort);
            if (!forwarded) {
              sendLog(`[Error] Failed to forward ADB port.`);
              return;
            }

            // 3. Spawn safe server process on device
            sendLog(`Spawning safe scrcpy-server on Android (${deviceId})...`);
            const proc = adb.spawnServer(deviceId);

            const session: StreamSession = {
              deviceId,
              serverProc: proc,
              videoSocket: null,
              audioSocket: null,
              audioEnabled: false,
              forwardPort,
            };
            activeSessions.set(deviceId, session);

            // Ensure phone speaker volume is unmuted by default on start
            await adb.unmuteDeviceSpeaker(deviceId);

            // 4. Connect video stream socket
            setTimeout(() => {
              sendLog(`Connecting to video stream for ${deviceId}...`);
              connectToScrcpyVideo(deviceId, forwardPort, wss, sendLog);
            }, 1000);
            break;
          }

          case 'stop-stream': {
            const targetDev = msg.deviceId;
            if (targetDev) {
              sendLog(`Stopping stream for ${targetDev}...`);
              await stopSession(targetDev);
              for (const client of wss.clients) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({ type: 'stream-stopped', deviceId: targetDev }));
                }
              }
            } else {
              sendLog(`Stopping all active streams...`);
              await stopAllSessions();
              for (const client of wss.clients) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({ type: 'stream-stopped' }));
                }
              }
            }
            break;
          }

          // Safe, physical-pixel accurate touch tap (Proportional multi-boxing aware)
          case 'tap': {
            const targetIds = await getTargetDeviceIds(msg.deviceId, msg.syncAll);
            for (const id of targetIds) {
              let tapX = msg.x;
              let tapY = msg.y;
              // If multi-box syncing with normalized coordinates, scale proportionally to target device
              if (msg.syncAll && typeof msg.normX === 'number' && typeof msg.normY === 'number') {
                const session = activeSessions.get(id);
                let targetW = session?.width;
                let targetH = session?.height;
                if (!targetW || !targetH) {
                  const size = await adb.getDeviceScreenSize(id);
                  targetW = size.width;
                  targetH = size.height;
                }
                tapX = Math.round(msg.normX * targetW);
                tapY = Math.round(msg.normY * targetH);
              }
              if (typeof tapX === 'number' && typeof tapY === 'number') {
                adb.injectTap(id, tapX, tapY);
              }
            }
            break;
          }

          // Safe, optimal swipe flick (Proportional multi-boxing aware)
          case 'swipe': {
            const targetIds = await getTargetDeviceIds(msg.deviceId, msg.syncAll);
            for (const id of targetIds) {
              let x1 = msg.x1;
              let y1 = msg.y1;
              let x2 = msg.x2;
              let y2 = msg.y2;
              if (msg.syncAll && typeof msg.normX1 === 'number' && typeof msg.normY1 === 'number') {
                const session = activeSessions.get(id);
                let targetW = session?.width;
                let targetH = session?.height;
                if (!targetW || !targetH) {
                  const size = await adb.getDeviceScreenSize(id);
                  targetW = size.width;
                  targetH = size.height;
                }
                x1 = Math.round(msg.normX1 * targetW);
                y1 = Math.round(msg.normY1 * targetH);
                x2 = Math.round((msg.normX2 ?? msg.normX1) * targetW);
                y2 = Math.round((msg.normY2 ?? msg.normY1) * targetH);
              }
              adb.injectSwipe(id, x1, y1, x2, y2, msg.duration || 150);
            }
            break;
          }

          case 'key': {
            const targetIds = await getTargetDeviceIds(msg.deviceId, msg.syncAll);
            for (const id of targetIds) {
              if (typeof msg.code === 'number') {
                adb.injectKey(id, msg.code);
              }
            }
            break;
          }

          case 'text': {
            const targetIds = await getTargetDeviceIds(msg.deviceId, msg.syncAll);
            for (const id of targetIds) {
              if (msg.text) {
                adb.injectText(id, msg.text);
              }
            }
            break;
          }

          // Feature #10: Privacy Mode
          case 'set-privacy-mode': {
            if (msg.deviceId) {
              const success = await adb.setPrivacyMode(msg.deviceId, !!msg.enabled);
              ws.send(JSON.stringify({
                type: 'privacy-mode-status',
                deviceId: msg.deviceId,
                enabled: !!msg.enabled,
                success
              }));
              sendLog(msg.enabled ? `👁️ Privacy Mode ENABLED on ${msg.deviceId} (screen blanked).` : `👁️ Privacy Mode DISABLED on ${msg.deviceId} (screen restored).`);
            }
            break;
          }

          // Feature #7: Dual-Mode Wired & Wireless Links
          case 'get-device-ip': {
            if (msg.deviceId) {
              const ip = await adb.getDeviceIp(msg.deviceId);
              ws.send(JSON.stringify({
                type: 'device-ip-result',
                deviceId: msg.deviceId,
                ip
              }));
            }
            break;
          }

          case 'switch-tcpip': {
            if (msg.deviceId) {
              sendLog(`Switching ${msg.deviceId} to Wi-Fi TCP/IP mode on port 5555...`);
              const ok = await adb.switchToTcpip(msg.deviceId, 5555);
              if (!ok) {
                ws.send(JSON.stringify({
                  type: 'switch-tcpip-result',
                  deviceId: msg.deviceId,
                  success: false,
                  message: 'Failed to switch to tcpip 5555'
                }));
                break;
              }

              const ip = await adb.getDeviceIp(msg.deviceId);
              if (!ip) {
                ws.send(JSON.stringify({
                  type: 'switch-tcpip-result',
                  deviceId: msg.deviceId,
                  success: false,
                  message: 'Could not detect device Wi-Fi IP address'
                }));
                break;
              }

              sendLog(`Device Wi-Fi IP is ${ip}. Connecting wirelessly...`);
              const connectResult = await adb.connectWireless(ip, 5555);
              ws.send(JSON.stringify({
                type: 'switch-tcpip-result',
                deviceId: msg.deviceId,
                ip,
                success: connectResult.success,
                message: connectResult.message
              }));
            }
            break;
          }

          case 'connect-wireless': {
            if (msg.ip) {
              sendLog(`Connecting to wireless device at ${msg.ip}:${msg.port || 5555}...`);
              const res = await adb.connectWireless(msg.ip, msg.port || 5555);
              ws.send(JSON.stringify({
                type: 'wireless-result',
                success: res.success,
                message: res.message
              }));
            }
            break;
          }

          case 'pair-wireless': {
            if (msg.ip && msg.port && msg.code) {
              sendLog(`Pairing wireless device at ${msg.ip}:${msg.port}...`);
              const pairRes = await adb.pairWireless(msg.ip, msg.port, msg.code);
              if (pairRes.success && msg.connectPort) {
                sendLog(`Pairing successful! Connecting to ${msg.ip}:${msg.connectPort}...`);
                const connRes = await adb.connectWireless(msg.ip, msg.connectPort);
                ws.send(JSON.stringify({
                  type: 'wireless-result',
                  success: connRes.success,
                  message: connRes.message
                }));
              } else {
                ws.send(JSON.stringify({
                  type: 'wireless-result',
                  success: pairRes.success,
                  message: pairRes.message
                }));
              }
            }
            break;
          }

          // Feature #3: Context-Aware Game Detection
          case 'check-game-mode': {
            if (msg.deviceId) {
              const pkg = await adb.getForegroundPackage(msg.deviceId);
              let isGame = false;
              if (pkg) {
                isGame = await adb.isPackageGame(msg.deviceId, pkg);
              }
              ws.send(JSON.stringify({
                type: 'game-mode-status',
                deviceId: msg.deviceId,
                package: pkg || 'none',
                isGame
              }));
            }
            break;
          }

          // Feature #6: Smart Clipboard Sync (Bidirectional)
          case 'clipboard-paste': {
            if (msg.deviceId && msg.text) {
              const ok = await adb.pasteClipboard(msg.deviceId, msg.text);
              sendLog(ok ? `📋 Synced clipboard to device.` : `[Error] Failed to paste clipboard.`);
            }
            break;
          }

          case 'clipboard-fetch': {
            if (msg.deviceId) {
              const text = await adb.getClipboard(msg.deviceId);
              ws.send(JSON.stringify({ type: 'clipboard-update', deviceId: msg.deviceId, text }));
            }
            break;
          }

          // Latency Measurement Ping / Pong
          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
            break;
          }

          // Feature #1: Audio Routing Toggle (PC vs Phone Speaker)
          case 'set-audio-stream': {
            if (msg.deviceId) {
              const session = activeSessions.get(msg.deviceId);
              if (session) {
                session.audioEnabled = !!msg.enabled;
              }
              if (msg.enabled) {
                await adb.muteDeviceSpeaker(msg.deviceId);
                sendLog(`[Audio]: Routing ${msg.deviceId} audio to PC speakers (phone speaker muted).`);
              } else {
                await adb.unmuteDeviceSpeaker(msg.deviceId);
                sendLog(`[Audio]: Detached PC audio for ${msg.deviceId}. Audio playing on phone speaker.`);
              }
            }
            break;
          }

          // Feature #5: Dynamic Adaptive Bitrate Adjustment
          case 'set-bitrate': {
            if (msg.deviceId && msg.bitRate) {
              sendLog(
                `[ABR]: Stream quality adjusted for ${msg.deviceId}: ${Math.round(
                  msg.bitRate / 1000
                )}kbps @ ${msg.maxFps || 60} FPS`
              );
            }
            break;
          }

          // Feature #6: Hardware State Mocking (Battery & Airplane Mode)
          case 'set-battery-mock': {
            if (msg.deviceId && typeof msg.level === 'number') {
              const unplug = msg.unplug ?? true;
              await adb.setBatteryMock(msg.deviceId, msg.level, unplug);
              sendLog(`[Hardware Mock]: Battery set to ${msg.level}% (${unplug ? 'Unplugged' : 'Charging'}) on ${msg.deviceId}`);
              ws.send(JSON.stringify({
                type: 'hardware-mock-updated',
                deviceId: msg.deviceId,
                batteryLevel: msg.level,
                isUnplugged: unplug,
              }));
            }
            break;
          }

          case 'reset-battery-mock': {
            if (msg.deviceId) {
              await adb.resetBatteryMock(msg.deviceId);
              sendLog(`[Hardware Mock]: Battery restored to real hardware state on ${msg.deviceId}`);
              ws.send(JSON.stringify({
                type: 'hardware-mock-reset',
                deviceId: msg.deviceId,
              }));
            }
            break;
          }

          case 'set-airplane-mode': {
            if (msg.deviceId && typeof msg.enabled === 'boolean') {
              await adb.setAirplaneMode(msg.deviceId, msg.enabled);
              sendLog(`[Hardware Mock]: Airplane mode ${msg.enabled ? 'ENABLED' : 'DISABLED'} on ${msg.deviceId}`);
              ws.send(JSON.stringify({
                type: 'airplane-mode-updated',
                deviceId: msg.deviceId,
                airplaneMode: msg.enabled,
              }));
            }
            break;
          }

          // Feature #7: Auto-Wake & Keep-Awake Guard
          case 'auto-wake-device': {
            if (msg.deviceId) {
              await adb.autoWakeAndUnlock(msg.deviceId);
              sendLog(`[Auto-Wake]: Woke up and unlocked keyguard on ${msg.deviceId}`);
            }
            break;
          }

          case 'set-keep-awake': {
            if (msg.deviceId && typeof msg.stayAwake === 'boolean') {
              await adb.setKeepAwake(msg.deviceId, msg.stayAwake);
              sendLog(`[Keep-Awake Guard]: Screen stay-awake set to ${msg.stayAwake} on ${msg.deviceId}`);
            }
            break;
          }
        }
      } catch (err: any) {
        console.error('[WS Message Error]', err);
      }
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
      if (wss.clients.size === 0) {
        if (stopTimeout) clearTimeout(stopTimeout);
        stopTimeout = setTimeout(() => {
          if (wss.clients.size === 0) {
            console.log('[WS] No active browser clients for 4s. Cleaning up streaming sessions.');
            stopAllSessions();
          }
        }, 4000);
      }
    });
  });

  let cachedDevices: DeviceInfo[] = [];
  let lastDeviceQueryTime = 0;

  async function getTargetDeviceIds(requestedId?: string, syncAll?: boolean): Promise<string[]> {
    if (syncAll) {
      const now = Date.now();
      if (now - lastDeviceQueryTime > 2000 || cachedDevices.length === 0) {
        try {
          cachedDevices = await adb.getDevices();
          lastDeviceQueryTime = now;
        } catch (e) {}
      }
      const readyDevices = cachedDevices.filter((d) => d.status === 'device').map((d) => d.id);
      if (readyDevices.length > 0) {
        return readyDevices;
      }
      if (activeSessions.size > 0) {
        return Array.from(activeSessions.keys());
      }
    }
    if (requestedId) return [requestedId];
    return [];
  }

  async function stopSession(deviceId: string) {
    const session = activeSessions.get(deviceId);
    if (session) {
      try {
        if (session.videoSocket) {
          session.videoSocket.destroy();
        }
        if (session.audioSocket) {
          session.audioSocket.destroy();
        }
        if (session.serverProc) {
          session.serverProc.kill();
        }
        await adb.removeForward(session.deviceId, session.forwardPort);
        await adb.unmuteDeviceSpeaker(deviceId);
        adb.closeDeviceShell(deviceId);
      } catch (e) {}
      activeSessions.delete(deviceId);
      await adb.killAllScrcpyServers(deviceId);
    }
  }

  async function stopAllSessions() {
    adb.closeShell();
    const ids = Array.from(activeSessions.keys());
    for (const id of ids) {
      await stopSession(id);
    }
    activeSessions.clear();
  }

  function connectToScrcpyVideo(
    deviceId: string,
    port: number,
    wss: WebSocketServer,
    sendLog: (msg: string) => void
  ) {
    const socket = new net.Socket();
    socket.setNoDelay(true);

    const session = activeSessions.get(deviceId);
    if (session) {
      session.videoSocket = socket;
    }

    let buffer = Buffer.alloc(0);
    let state: 'DUMMY' | 'CODEC_METADATA' | 'PACKET_HEADER' | 'PACKET_PAYLOAD' = 'DUMMY';
    let currentPts = 0n;
    let currentPacketSize = 0;
    let currentIsKeyFrame = false;
    let currentIsConfig = false;

    socket.connect(port, '127.0.0.1', () => {
      sendLog(`Successfully connected to video stream for ${deviceId}.`);
      // Connect to audio socket sequentially as required by scrcpy-server protocol
      setTimeout(() => {
        connectToScrcpyAudio(deviceId, port, wss, sendLog);
      }, 150);
    });

    socket.on('data', async (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      let processing = true;
      while (processing) {
        switch (state) {
          case 'DUMMY': {
            if (buffer.length >= 1) {
              buffer = buffer.subarray(1);
              state = 'CODEC_METADATA';
            } else {
              processing = false;
            }
            break;
          }

          case 'CODEC_METADATA': {
            if (buffer.length >= 12) {
              const codecId = buffer.subarray(0, 4).toString('utf8');
              const width = buffer.readUInt32BE(4);
              const height = buffer.readUInt32BE(8);

              // Query physical display resolution (e.g. 1080x2373)
              const physical = await adb.getDeviceScreenSize(deviceId);

              const session = activeSessions.get(deviceId);
              if (session) {
                session.width = physical.width || width;
                session.height = physical.height || height;
              }

              sendLog(`Stream Online: [${deviceId}] ${codecId.toUpperCase()} @ ${width}x${height} (Physical: ${physical.width}x${physical.height})`);

              // Broadcast metadata to all connected clients
              const metaMsg = JSON.stringify({
                type: 'meta',
                deviceId,
                codec: codecId,
                width,
                height,
                physicalWidth: physical.width,
                physicalHeight: physical.height,
              });

              for (const client of wss.clients) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(metaMsg);
                }
              }

              buffer = buffer.subarray(12);
              state = 'PACKET_HEADER';
            } else {
              processing = false;
            }
            break;
          }

          case 'PACKET_HEADER': {
            if (buffer.length >= 12) {
              const ptsBigInt = buffer.readBigUInt64BE(0);
              currentIsConfig = (ptsBigInt & (1n << 63n)) !== 0n;
              currentIsKeyFrame = (ptsBigInt & (1n << 62n)) !== 0n;
              currentPts = ptsBigInt & ~(3n << 62n);

              currentPacketSize = buffer.readUInt32BE(8);
              buffer = buffer.subarray(12);
              state = 'PACKET_PAYLOAD';
            } else {
              processing = false;
            }
            break;
          }

          case 'PACKET_PAYLOAD': {
            if (buffer.length >= currentPacketSize) {
              const payload = buffer.subarray(0, currentPacketSize);
              buffer = buffer.subarray(currentPacketSize);

              const devIdBuf = Buffer.from(deviceId, 'ascii');
              const idLen = devIdBuf.length;
              const flags = (currentIsKeyFrame ? 1 : 0) | (currentIsConfig ? 2 : 0);

              // Embed deviceId in binary frame for parallel multi-device streaming
              // [0]: 0x01 (Video packet)
              // [1]: idLen (Device ID string byte length)
              // [2 .. 2+idLen-1]: Device ID ASCII
              // [2+idLen]: flags (bit 0 = keyframe, bit 1 = config)
              // [3+idLen .. 10+idLen]: PTS (8 bytes BigUInt64)
              // [11+idLen ..]: NALU payload
              const msg = Buffer.alloc(11 + idLen + payload.length);
              msg[0] = 0x01;
              msg[1] = idLen;
              devIdBuf.copy(msg, 2);
              msg[2 + idLen] = flags;
              msg.writeBigUInt64BE(currentPts, 3 + idLen);
              payload.copy(msg, 11 + idLen);

              // Broadcast video frame to all connected clients for parallel decoding
              for (const client of wss.clients) {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(msg);
                }
              }

              state = 'PACKET_HEADER';
            } else {
              processing = false;
            }
            break;
          }
        }
      }
    });

    socket.on('error', (err) => {
      sendLog(`[Video Socket Error - ${deviceId}]: ${err.message}`);
    });

    socket.on('close', () => {
      sendLog(`Video stream closed for ${deviceId}.`);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'stream-stopped', deviceId }));
        }
      }
    });
  }

  function connectToScrcpyAudio(
    deviceId: string,
    port: number,
    wss: WebSocketServer,
    sendLog: (msg: string) => void
  ) {
    const socket = new net.Socket();
    socket.setNoDelay(true);

    const session = activeSessions.get(deviceId);
    if (session) {
      session.audioSocket = socket;
    }

    let buffer = Buffer.alloc(0);
    let state: 'CODEC_METADATA' | 'PACKET_HEADER' | 'PACKET_PAYLOAD' = 'CODEC_METADATA';
    let currentPts = 0n;
    let currentPacketSize = 0;

    socket.connect(port, '127.0.0.1', () => {
      sendLog(`Successfully connected to audio stream for ${deviceId}.`);
    });

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      let processing = true;
      while (processing) {
        switch (state) {
          case 'CODEC_METADATA': {
            if (buffer.length >= 4) {
              const audioCodec = buffer.subarray(0, 4).toString('utf8');
              sendLog(`Audio Online: [${deviceId}] Codec: ${audioCodec.replace(/\0/g, '')}`);
              buffer = buffer.subarray(4);
              state = 'PACKET_HEADER';
            } else {
              processing = false;
            }
            break;
          }

          case 'PACKET_HEADER': {
            if (buffer.length >= 12) {
              const ptsBigInt = buffer.readBigUInt64BE(0);
              currentPts = ptsBigInt & ~(3n << 62n);
              currentPacketSize = buffer.readUInt32BE(8);
              buffer = buffer.subarray(12);
              state = 'PACKET_PAYLOAD';
            } else {
              processing = false;
            }
            break;
          }

          case 'PACKET_PAYLOAD': {
            if (buffer.length >= currentPacketSize) {
              const payload = buffer.subarray(0, currentPacketSize);
              buffer = buffer.subarray(currentPacketSize);

              const currentSession = activeSessions.get(deviceId);
              // Forward audio frame when routing to PC is enabled
              if (!currentSession || currentSession.audioEnabled !== false) {
                const devIdBuf = Buffer.from(deviceId, 'ascii');
                const idLen = devIdBuf.length;

                // [0]: 0x02 (Audio packet)
                // [1]: idLen
                // [2 .. 2+idLen-1]: Device ID ASCII
                // [2+idLen .. 9+idLen]: PTS (8 bytes BigUInt64)
                // [10+idLen ..]: Raw PCM payload (16-bit signed LE stereo, 48000Hz)
                const msg = Buffer.alloc(10 + idLen + payload.length);
                msg[0] = 0x02;
                msg[1] = idLen;
                devIdBuf.copy(msg, 2);
                msg.writeBigUInt64BE(currentPts, 2 + idLen);
                payload.copy(msg, 10 + idLen);

                for (const client of wss.clients) {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(msg);
                  }
                }
              }

              state = 'PACKET_HEADER';
            } else {
              processing = false;
            }
            break;
          }
        }
      }
    });

    socket.on('error', (err) => {
      console.log(`[Audio Socket - ${deviceId}]: ${err.message}`);
    });

    socket.on('close', () => {
      const s = activeSessions.get(deviceId);
      if (s) {
        s.audioSocket = null;
      }
    });
  }

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  🚀 Android Web Mirror Server Running`);
    console.log(`  🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`  ⚡ WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`======================================================\n`);
  });
});
