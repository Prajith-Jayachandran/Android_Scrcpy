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
const FORWARD_PORT = 27183;

const adb = new AdbManager();

interface StreamSession {
  deviceId: string;
  serverProc: any;
  videoSocket: net.Socket | null;
  forwardPort: number;
}

let activeSession: StreamSession | null = null;

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({
    server,
    path: '/ws',
    perMessageDeflate: false
  });

  wss.on('connection', (ws: WebSocket) => {
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

          case 'start-stream': {
            const deviceId = msg.deviceId;
            if (!deviceId) return;

            sendLog(`Preparing stream for device: ${deviceId}...`);

            // Clean up any existing sessions or zombie processes on Android
            stopCurrentSession();
            await adb.killAllScrcpyServers(deviceId);

            // 1. Push scrcpy-server.jar to device
            sendLog(`Pushing scrcpy-server to device...`);
            const pushed = await adb.pushServer(deviceId);
            if (!pushed) {
              sendLog(`[Error] Failed to push scrcpy-server to device.`);
              return;
            }

            // 2. Set up ADB forward
            sendLog(`Setting up ADB port forward (tcp:${FORWARD_PORT})...`);
            const forwarded = await adb.forwardPort(deviceId, FORWARD_PORT);
            if (!forwarded) {
              sendLog(`[Error] Failed to forward ADB port.`);
              return;
            }

            // 3. Spawn safe server process on device
            sendLog(`Spawning safe scrcpy-server on Android...`);
            const proc = adb.spawnServer(deviceId);

            activeSession = {
              deviceId,
              serverProc: proc,
              videoSocket: null,
              forwardPort: FORWARD_PORT
            };

            // 4. Connect video stream socket
            setTimeout(() => {
              sendLog(`Connecting to video stream...`);
              connectToScrcpyVideo(deviceId, FORWARD_PORT, ws, sendLog);
            }, 1000);
            break;
          }

          case 'stop-stream': {
            sendLog(`Stopping active stream...`);
            stopCurrentSession();
            ws.send(JSON.stringify({ type: 'stream-stopped' }));
            break;
          }

          // Safe, physical-pixel accurate touch tap
          case 'tap': {
            if (msg.deviceId && typeof msg.x === 'number' && typeof msg.y === 'number') {
              adb.injectTap(msg.deviceId, msg.x, msg.y);
            }
            break;
          }

          // Safe, optimal 150ms swipe flick
          case 'swipe': {
            if (msg.deviceId) {
              adb.injectSwipe(msg.deviceId, msg.x1, msg.y1, msg.x2, msg.y2, msg.duration || 150);
            }
            break;
          }

          case 'key': {
            if (msg.deviceId && typeof msg.code === 'number') {
              adb.injectKey(msg.deviceId, msg.code);
            }
            break;
          }

          case 'text': {
            if (msg.deviceId && msg.text) {
              adb.injectText(msg.deviceId, msg.text);
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
        stopCurrentSession();
      }
    });
  });

  function stopCurrentSession() {
    adb.closeShell();
    if (activeSession) {
      const devId = activeSession.deviceId;
      try {
        if (activeSession.videoSocket) {
          activeSession.videoSocket.destroy();
        }
        if (activeSession.serverProc) {
          activeSession.serverProc.kill();
        }
        adb.removeForward(activeSession.deviceId, activeSession.forwardPort);
      } catch (e) {}
      activeSession = null;
      adb.killAllScrcpyServers(devId);
    }
  }

  function connectToScrcpyVideo(
    deviceId: string,
    port: number,
    ws: WebSocket,
    sendLog: (msg: string) => void
  ) {
    const socket = new net.Socket();
    socket.setNoDelay(true);

    if (activeSession) {
      activeSession.videoSocket = socket;
    }

    let buffer = Buffer.alloc(0);
    let state: 'DUMMY' | 'CODEC_METADATA' | 'PACKET_HEADER' | 'PACKET_PAYLOAD' = 'DUMMY';
    let currentPts = 0n;
    let currentPacketSize = 0;
    let currentIsKeyFrame = false;
    let currentIsConfig = false;

    socket.connect(port, '127.0.0.1', () => {
      sendLog(`Successfully connected to video stream.`);
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

              sendLog(`Stream Online: ${codecId.toUpperCase()} @ ${width}x${height} (Physical: ${physical.width}x${physical.height})`);

              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'meta',
                  codec: codecId,
                  width,
                  height,
                  physicalWidth: physical.width,
                  physicalHeight: physical.height,
                }));
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

              if (ws.readyState === WebSocket.OPEN) {
                const flags = (currentIsKeyFrame ? 1 : 0) | (currentIsConfig ? 2 : 0);
                const msg = Buffer.alloc(10 + payload.length);
                msg[0] = 0x01;
                msg[1] = flags;
                msg.writeBigUInt64BE(currentPts, 2);
                payload.copy(msg, 10);

                ws.send(msg);
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
      sendLog(`[Video Socket Error]: ${err.message}`);
    });

    socket.on('close', () => {
      sendLog(`Video stream closed.`);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stream-stopped' }));
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
