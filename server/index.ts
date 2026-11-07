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
  tcpSocket: net.Socket | null;
  forwardPort: number;
}

let activeSession: StreamSession | null = null;

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

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

            // 3. Spawn server on device
            sendLog(`Spawning scrcpy-server process on Android...`);
            const proc = adb.spawnServer(deviceId);

            activeSession = {
              deviceId,
              serverProc: proc,
              tcpSocket: null,
              forwardPort: FORWARD_PORT
            };

            // 4. Connect to forwarded port after a short delay for server initialization
            setTimeout(() => {
              sendLog(`Connecting to scrcpy video socket...`);
              connectToScrcpySocket(deviceId, FORWARD_PORT, ws, sendLog);
            }, 1000);
            break;
          }

          case 'stop-stream': {
            sendLog(`Stopping active stream...`);
            stopCurrentSession();
            ws.send(JSON.stringify({ type: 'stream-stopped' }));
            break;
          }

          case 'key': {
            if (msg.deviceId && typeof msg.code === 'number') {
              await adb.injectKey(msg.deviceId, msg.code);
            }
            break;
          }

          case 'text': {
            if (msg.deviceId && msg.text) {
              await adb.injectText(msg.deviceId, msg.text);
            }
            break;
          }

          case 'tap': {
            if (msg.deviceId && typeof msg.x === 'number' && typeof msg.y === 'number') {
              await adb.injectTap(msg.deviceId, msg.x, msg.y);
            }
            break;
          }

          case 'swipe': {
            if (msg.deviceId) {
              await adb.injectSwipe(msg.deviceId, msg.x1, msg.y1, msg.x2, msg.y2, msg.duration || 150);
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
      // If no clients left, stop active stream to save device battery
      if (wss.clients.size === 0) {
        stopCurrentSession();
      }
    });
  });

  function stopCurrentSession() {
    if (activeSession) {
      try {
        if (activeSession.tcpSocket) {
          activeSession.tcpSocket.destroy();
        }
        if (activeSession.serverProc) {
          activeSession.serverProc.kill();
        }
        adb.removeForward(activeSession.deviceId, activeSession.forwardPort);
      } catch (e) {}
      activeSession = null;
    }
  }

  function connectToScrcpySocket(
    deviceId: string,
    port: number,
    ws: WebSocket,
    sendLog: (msg: string) => void
  ) {
    const socket = new net.Socket();
    if (activeSession) {
      activeSession.tcpSocket = socket;
    }

    let buffer = Buffer.alloc(0);
    let state: 'DUMMY' | 'DEVICE_NAME' | 'CODEC_METADATA' | 'PACKET_HEADER' | 'PACKET_PAYLOAD' = 'DUMMY';
    let currentPts = 0n;
    let currentPacketSize = 0;
    let currentIsKeyFrame = false;
    let currentIsConfig = false;

    socket.connect(port, '127.0.0.1', () => {
      sendLog(`Successfully connected to video stream! Receiving H.264 packets...`);
    });

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      let processing = true;
      while (processing) {
        switch (state) {
          case 'DUMMY': {
            if (buffer.length >= 1) {
              // 1 dummy byte (0x00)
              buffer = buffer.subarray(1);
              state = 'DEVICE_NAME';
            } else {
              processing = false;
            }
            break;
          }

          case 'DEVICE_NAME': {
            if (buffer.length >= 64) {
              const devNameBytes = buffer.subarray(0, 64);
              const devName = devNameBytes.toString('utf8').replace(/\0/g, '');
              sendLog(`Device Name: ${devName}`);
              buffer = buffer.subarray(64);
              state = 'CODEC_METADATA';
            } else {
              processing = false;
            }
            break;
          }

          case 'CODEC_METADATA': {
            // 4 bytes codec ID ('h264' = 0x68323634), 4 bytes width, 4 bytes height
            if (buffer.length >= 12) {
              const codecId = buffer.subarray(0, 4).toString('utf8');
              const width = buffer.readUInt32BE(4);
              const height = buffer.readUInt32BE(8);
              sendLog(`Video Stream Ready: Codec=${codecId}, Resolution=${width}x${height}`);

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
            // Packet header in scrcpy v2/v3: 8 bytes PTS + 4 bytes packet size = 12 bytes
            if (buffer.length >= 12) {
              const ptsBigInt = buffer.readBigUInt64BE(0);
              // Bits flags in scrcpy:
              // Bit 63: Config packet (SPS/PPS)
              // Bit 62: Keyframe
              currentIsConfig = (ptsBigInt & (1n << 63n)) !== 0n;
              currentIsKeyFrame = (ptsBigInt & (1n << 62n)) !== 0n;
              currentPts = ptsBigInt & ~(3n << 62n); // clear flag bits

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
                // Construct a compact binary message for WebCodecs:
                // Byte 0: 0x01 (Video Packet indicator)
                // Byte 1: 1 if keyframe or config, 0 otherwise
                // Bytes 2-9: 8-byte PTS (UInt64 BE)
                // Bytes 10+: Raw H.264 NAL units
                const msg = Buffer.alloc(10 + payload.length);
                msg[0] = 0x01;
                msg[1] = (currentIsKeyFrame || currentIsConfig) ? 1 : 0;
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
      sendLog(`Video stream socket closed.`);
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
