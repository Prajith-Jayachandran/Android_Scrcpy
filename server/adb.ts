import { execFile, spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface DeviceInfo {
  id: string;
  status: 'device' | 'unauthorized' | 'offline' | 'unknown';
  model?: string;
  product?: string;
}

export class AdbManager {
  private adbPath: string;
  private serverJarPath: string;
  private activeShell: ChildProcess | null = null;
  private activeShellDeviceId: string | null = null;

  constructor() {
    this.adbPath = this.resolveAdbPath();
    this.serverJarPath = path.resolve(__dirname, '../bin/scrcpy-server.jar');
  }

  private resolveAdbPath(): string {
    const candidates = [
      path.resolve(__dirname, '../bin/adb'),
      path.resolve(os.homedir(), '.local/bin/adb'),
      '/usr/local/bin/adb',
      '/usr/bin/adb',
      'adb'
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          fs.accessSync(p, fs.constants.X_OK);
          return p;
        } catch {}
      }
    }
    return 'adb';
  }

  public getAdbPath(): string {
    return this.adbPath;
  }

  // Persistent interactive shell for zero-latency safe Android input injection
  private getOrCreateShell(deviceId: string): ChildProcess {
    if (this.activeShell && this.activeShellDeviceId === deviceId && !this.activeShell.killed) {
      return this.activeShell;
    }

    this.closeShell();

    const shell = spawn(this.adbPath, ['-s', deviceId, 'shell']);
    shell.stdin?.setDefaultEncoding('utf-8');
    this.activeShell = shell;
    this.activeShellDeviceId = deviceId;

    shell.on('exit', () => {
      if (this.activeShell === shell) {
        this.activeShell = null;
        this.activeShellDeviceId = null;
      }
    });

    return shell;
  }

  public closeShell(): void {
    if (this.activeShell) {
      try {
        this.activeShell.stdin?.end();
        this.activeShell.kill();
      } catch (e) {}
      this.activeShell = null;
      this.activeShellDeviceId = null;
    }
  }

  // Query device physical screen dimensions (e.g. 1080x2373)
  public async getDeviceScreenSize(deviceId: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      execFile(this.adbPath, ['-s', deviceId, 'shell', 'wm', 'size'], (err, stdout) => {
        if (!err && stdout) {
          const match = stdout.match(/(?:Override|Physical) size:\s*(\d+)x(\d+)/i);
          if (match) {
            return resolve({
              width: parseInt(match[1], 10),
              height: parseInt(match[2], 10),
            });
          }
        }
        resolve({ width: 1080, height: 2400 });
      });
    });
  }

  public async getDevices(): Promise<DeviceInfo[]> {
    return new Promise((resolve) => {
      execFile(this.adbPath, ['devices', '-l'], (err, stdout) => {
        if (err || !stdout) {
          return resolve([]);
        }

        const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const devices: DeviceInfo[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const id = parts[0];
            const statusStr = parts[1];
            let status: DeviceInfo['status'] = 'unknown';

            if (statusStr === 'device') status = 'device';
            else if (statusStr === 'unauthorized') status = 'unauthorized';
            else if (statusStr === 'offline') status = 'offline';

            const modelMatch = line.match(/model:([^\s]+)/);
            const productMatch = line.match(/product:([^\s]+)/);

            devices.push({
              id,
              status,
              model: modelMatch ? modelMatch[1] : undefined,
              product: productMatch ? productMatch[1] : undefined
            });
          }
        }
        resolve(devices);
      });
    });
  }

  public async pushServer(deviceId: string): Promise<boolean> {
    if (!fs.existsSync(this.serverJarPath)) {
      console.error(`[ADB] scrcpy-server.jar not found at ${this.serverJarPath}`);
      return false;
    }

    return new Promise((resolve) => {
      execFile(
        this.adbPath,
        ['-s', deviceId, 'push', this.serverJarPath, '/data/local/tmp/scrcpy-server.jar'],
        (err) => {
          if (err) {
            console.error(`[ADB] Failed to push scrcpy-server:`, err.message);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  public async forwardPort(deviceId: string, localPort: number): Promise<boolean> {
    return new Promise((resolve) => {
      execFile(
        this.adbPath,
        ['-s', deviceId, 'forward', `tcp:${localPort}`, 'localabstract:scrcpy'],
        (err) => {
          if (err) {
            console.error(`[ADB] Failed to forward port ${localPort}:`, err.message);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    });
  }

  public async removeForward(deviceId: string, localPort: number): Promise<void> {
    return new Promise((resolve) => {
      execFile(this.adbPath, ['-s', deviceId, 'forward', '--remove', `tcp:${localPort}`], () => {
        resolve();
      });
    });
  }

  // Safely kill any existing scrcpy-server instances on Android
  public async killAllScrcpyServers(deviceId: string): Promise<void> {
    return new Promise((resolve) => {
      execFile(
        this.adbPath,
        ['-s', deviceId, 'shell', 'pkill -9 -f com.genymobile.scrcpy.Server || true'],
        () => resolve()
      );
    });
  }

  public spawnServer(deviceId: string): ChildProcess {
    // 100% Safe Parameters:
    // - control=false: Prevents ColorOS SecurityException & InputManager DeadObjectException crash
    // - stay_awake omitted: Prevents ColorOS/Oppo battery thermal watchdog panic
    // - max_size omitted: Preserves native hardware macroblock alignment on MediaTek chipsets
    const args = [
      '-s', deviceId,
      'shell',
      'CLASSPATH=/data/local/tmp/scrcpy-server.jar',
      'app_process',
      '/',
      'com.genymobile.scrcpy.Server',
      '3.1',
      'tunnel_forward=true',
      'video=true',
      'audio=false',
      'control=false',
      'send_dummy_byte=true',
      'send_codec_meta=true',
      'send_frame_meta=true',
      'send_device_meta=false',
      'video_bit_rate=4000000',
      'max_fps=60'
    ];

    console.log(`[ADB] Starting safe scrcpy-server on ${deviceId}...`);
    const proc = spawn(this.adbPath, args);

    proc.stdout?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log(`[scrcpy-server]: ${msg}`);
    });

    proc.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[scrcpy-server error]: ${msg}`);
    });

    return proc;
  }

  // Bulletproof input injection using direct atomic ADB commands
  public injectKey(deviceId: string, keyCode: number): void {
    execFile(this.adbPath, ['-s', deviceId, 'shell', 'input', 'keyevent', keyCode.toString()], (err) => {
      if (err) console.error(`[ADB Key Error]:`, err.message);
    });
  }

  public injectText(deviceId: string, text: string): void {
    const escaped = text.replace(/ /g, '%s').replace(/[^a-zA-Z0-9%s._-]/g, '');
    execFile(this.adbPath, ['-s', deviceId, 'shell', 'input', 'text', escaped], (err) => {
      if (err) console.error(`[ADB Text Error]:`, err.message);
    });
  }

  public injectTap(deviceId: string, x: number, y: number): void {
    execFile(
      this.adbPath,
      ['-s', deviceId, 'shell', 'input', 'tap', Math.round(x).toString(), Math.round(y).toString()],
      (err) => {
        if (err) console.error(`[ADB Tap Error]:`, err.message);
      }
    );
  }

  public injectSwipe(deviceId: string, x1: number, y1: number, x2: number, y2: number, durationMs = 150): void {
    execFile(
      this.adbPath,
      [
        '-s',
        deviceId,
        'shell',
        'input',
        'swipe',
        Math.round(x1).toString(),
        Math.round(y1).toString(),
        Math.round(x2).toString(),
        Math.round(y2).toString(),
        Math.round(durationMs).toString()
      ],
      (err) => {
        if (err) console.error(`[ADB Swipe Error]:`, err.message);
      }
    );
  }
}
