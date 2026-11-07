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
  controlSocket: net.Socket | null;
  forwardPort: number;
  videoWidth: number;
  videoHeight: number;
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
    perMessageDeflate: false // Disable compression for real-time lowest latency
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

            // Stop existing session if active
            stopCurrentSession();

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

            // 3. Spawn server on device with control channel enabled
            sendLog(`Spawning scrcpy-server process on Android...`);
            const proc = adb.spawnServer(deviceId);

            activeSession = {
              deviceId,
              serverProc: proc,
              videoSocket: null,
              controlSocket: null,
              forwardPort: FORWARD_PORT,
              videoWidth: 1080,
              videoHeight: 2400
            };

            // 4. Connect sockets
            setTimeout(() => {
              sendLog(`Connecting video and native control channels...`);
              connectToScrcpySockets(deviceId, FORWARD_PORT, ws, sendLog);
            }, 1200);
            break;
          }

          case 'stop-stream': {
            sendLog(`Stopping active stream...`);
            stopCurrentSession();
            ws.send(JSON.stringify({ type: 'stream-stopped' }));
            break;
          }

          // Real-time native touch injection via scrcpy control socket
          case 'touch': {
            if (activeSession && activeSession.controlSocket && !activeSession.controlSocket.destroyed) {
              // action: 0 = DOWN, 1 = UP, 2 = MOVE
              const action = msg.action === 'down' ? 0 : msg.action === 'up' ? 1 : 2;
              const w = activeSession.videoWidth || msg.width || 1080;
              const h = activeSession.videoHeight || msg.height || 2400;

              const buf = Buffer.alloc(32);
              buf.writeUInt8(2, 0); // TYPE_INJECT_TOUCH_EVENT = 2
              buf.writeUInt8(action, 1);
              buf.writeBigInt64BE(-1n, 2); // pointerId = -1 (mouse/touch pointer)
              buf.writeInt32BE(Math.round(msg.x), 10);
              buf.writeInt32BE(Math.round(msg.y), 14);
              buf.writeUInt16BE(w, 18);
              buf.writeUInt16BE(h, 20);
              buf.writeFloatBE(action === 1 ? 0.0 : 1.0, 22); // pressure
              buf.writeInt32BE(action === 0 ? 1 : 0, 26); // actionButton (BUTTON_PRIMARY on down)
              buf.writeInt32BE(action === 1 ? 0 : 1, 30); // buttons (BUTTON_PRIMARY down/move)

              activeSession.controlSocket.write(buf);
            } else if (msg.deviceId) {
              if (msg.action === 'down' || msg.action === 'up') {
                adb.injectTap(msg.deviceId, msg.x, msg.y);
              }
            }
            break;
          }

          // Mouse wheel scrolling
          case 'scroll': {
            if (activeSession && activeSession.controlSocket && !activeSession.controlSocket.destroyed) {
              const w = activeSession.videoWidth || msg.width || 1080;
              const h = activeSession.videoHeight || msg.height || 2400;

              const buf = Buffer.alloc(21);
              buf.writeUInt8(3, 0); // TYPE_INJECT_SCROLL_EVENT = 3
              buf.writeInt32BE(Math.round(msg.x), 1);
              buf.writeInt32BE(Math.round(msg.y), 5);
              buf.writeUInt16BE(w, 9);
              buf.writeUInt16BE(h, 11);
              buf.writeInt32BE(0, 13); // hScroll
              buf.writeInt32BE(Math.round(msg.vScroll || 0), 17); // vScroll

              activeSession.controlSocket.write(buf);
            }
            break;
          }

          // Native keycode injection
          case 'key': {
            if (activeSession && activeSession.controlSocket && !activeSession.controlSocket.destroyed) {
              const down = Buffer.alloc(14);
              down.writeUInt8(0, 0); // TYPE_INJECT_KEYCODE = 0
              down.writeUInt8(0, 1); // ACTION_DOWN = 0
              down.writeInt32BE(msg.code, 2);
              down.writeInt32BE(0, 6);
              down.writeInt32BE(0, 10);
              activeSession.controlSocket.write(down);

              const up = Buffer.alloc(14);
              up.writeUInt8(0, 0);
              up.writeUInt8(1, 1); // ACTION_UP = 1
              up.writeInt32BE(msg.code, 2);
              up.writeInt32BE(0, 6);
              up.writeInt32BE(0, 10);
              activeSession.controlSocket.write(up);
            } else if (msg.deviceId) {
              adb.injectKey(msg.deviceId, msg.code);
            }
            break;
          }

          // Native text injection
          case 'text': {
            if (activeSession && activeSession.controlSocket && !activeSession.controlSocket.destroyed && msg.text) {
              const textBytes = Buffer.from(msg.text, 'utf8');
              const buf = Buffer.alloc(5 + textBytes.length);
              buf.writeUInt8(1, 0); // TYPE_INJECT_TEXT = 1
              buf.writeInt32BE(textBytes.length, 1);
              textBytes.copy(buf, 5);
              activeSession.controlSocket.write(buf);
            } else if (msg.deviceId && msg.text) {
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
      try {
        if (activeSession.videoSocket) {
          activeSession.videoSocket.destroy();
        }
        if (activeSession.controlSocket) {
          activeSession.controlSocket.destroy();
        }
        if (activeSession.serverProc) {
          activeSession.serverProc.kill();
        }
        adb.removeForward(activeSession.deviceId, activeSession.forwardPort);
      } catch (e) {}
      activeSession = null;
    }
  }

  function connectToScrcpySockets(
    deviceId: string,
    port: number,
    ws: WebSocket,
    sendLog: (msg: string) => void
  ) {
    // 1. Connect video socket (first socket accepted by scrcpy-server)
    const videoSocket = new net.Socket();
    videoSocket.setNoDelay(true);

    if (activeSession) {
      activeSession.videoSocket = videoSocket;
    }

    let buffer = Buffer.alloc(0);
    let state: 'DUMMY' | 'CODEC_METADATA' | 'PACKET_HEADER' | 'PACKET_PAYLOAD' = 'DUMMY';
    let currentPts = 0n;
    let currentPacketSize = 0;
    let currentIsKeyFrame = false;
    let currentIsConfig = false;

    videoSocket.connect(port, '127.0.0.1', () => {
      sendLog(`Video stream connected. Initializing native control channel...`);

      // 2. Connect control socket (second socket accepted by scrcpy-server)
      const controlSocket = new net.Socket();
      controlSocket.setNoDelay(true);

      controlSocket.connect(port, '127.0.0.1', () => {
        sendLog(`Native touch & control channel active (<1 ms latency).`);
        if (activeSession) {
          activeSession.controlSocket = controlSocket;
        }
      });

      controlSocket.on('error', (err) => {
        console.warn(`[Control Socket Error]: ${err.message}`);
      });
    });

    videoSocket.on('data', (chunk: Buffer) => {
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
            // 4 bytes codec ID, 4 bytes width, 4 bytes height
            if (buffer.length >= 12) {
              const codecId = buffer.subarray(0, 4).toString('utf8');
              const width = buffer.readUInt32BE(4);
              const height = buffer.readUInt32BE(8);

              if (activeSession) {
                activeSession.videoWidth = width;
                activeSession.videoHeight = height;
              }

              sendLog(`Stream Online: ${codecId.toUpperCase()} @ ${width}x${height}`);

              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'meta',
                  codec: codecId,
                  width,
                  height
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

    videoSocket.on('error', (err) => {
      sendLog(`[Video Socket Error]: ${err.message}`);
    });

    videoSocket.on('close', () => {
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
