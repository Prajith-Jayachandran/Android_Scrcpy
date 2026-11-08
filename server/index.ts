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
  forwardPort: number;
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

  wss.on('connection', (ws: ExtendedWebSocket) => {
    console.log('[WS] Client connected');

    const sendLog = (message: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'log', message, timestamp: Date.now() }));
      }
    };

    sendLog(`Connected to Android Screen Copy backend server.`);

    ws.on('message', async (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString());

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
            sendLog(`Spawning safe scrcpy-server on Android...`);
            const proc = adb.spawnServer(deviceId);

            const session: StreamSession = {
              deviceId,
              serverProc: proc,
              videoSocket: null,
              forwardPort,
            };
            activeSessions.set(deviceId, session);

            // 4. Connect video stream socket
            setTimeout(() => {
              sendLog(`Connecting to video stream for ${deviceId}...`);
              connectToScrcpyVideo(deviceId, forwardPort, wss, sendLog);
            }, 1000);
            break;
          }

          case 'stop-stream': {
            const targetDev = msg.deviceId || ws.activeDeviceId;
            if (targetDev) {
              sendLog(`Stopping active stream for ${targetDev}...`);
              await stopSession(targetDev);
            } else {
              sendLog(`Stopping all active streams...`);
              await stopAllSessions();
            }
            ws.send(JSON.stringify({ type: 'stream-stopped', deviceId: targetDev }));
            break;
          }

          // Safe, physical-pixel accurate touch tap
          case 'tap': {
            const targetIds = getTargetDeviceIds(msg.deviceId, msg.syncAll);
            for (const id of targetIds) {
              if (typeof msg.x === 'number' && typeof msg.y === 'number') {
                adb.injectTap(id, msg.x, msg.y);
              }
            }
            break;
          }

          // Safe, optimal 150ms swipe flick
          case 'swipe': {
            const targetIds = getTargetDeviceIds(msg.deviceId, msg.syncAll);
            for (const id of targetIds) {
              adb.injectSwipe(id, msg.x1, msg.y1, msg.x2, msg.y2, msg.duration || 150);
            }
            break;
          }

          case 'key': {
            const targetIds = getTargetDeviceIds(msg.deviceId, msg.syncAll);
            for (const id of targetIds) {
              if (typeof msg.code === 'number') {
                adb.injectKey(id, msg.code);
              }
            }
            break;
          }

          case 'text': {
            const targetIds = getTargetDeviceIds(msg.deviceId, msg.syncAll);
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

          // Feature #6: Smart Clipboard Sync
          case 'clipboard-paste': {
            if (msg.deviceId && msg.text) {
              const ok = await adb.pasteClipboard(msg.deviceId, msg.text);
              sendLog(ok ? `📋 Synced clipboard to device.` : `[Error] Failed to paste clipboard.`);
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
        stopAllSessions();
      }
    });
  });

  function getTargetDeviceIds(requestedId?: string, syncAll?: boolean): string[] {
    if (syncAll && activeSessions.size > 0) {
      return Array.from(activeSessions.keys());
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
        if (session.serverProc) {
          session.serverProc.kill();
        }
        await adb.removeForward(session.deviceId, session.forwardPort);
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

              const flags = (currentIsKeyFrame ? 1 : 0) | (currentIsConfig ? 2 : 0);
              const msg = Buffer.alloc(10 + payload.length);
              msg[0] = 0x01; // Video Frame identifier
              msg[1] = flags;
              msg.writeBigUInt64BE(currentPts, 2);
              payload.copy(msg, 10);

              // Forward video frame to clients viewing this device
              for (const client of wss.clients) {
                const extClient = client as ExtendedWebSocket;
                if (
                  extClient.readyState === WebSocket.OPEN &&
                  (!extClient.activeDeviceId || extClient.activeDeviceId === deviceId)
                ) {
                  extClient.send(msg);
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

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  🚀 Android Web Mirror Server Running`);
    console.log(`  🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`  ⚡ WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`======================================================\n`);
  });
});
