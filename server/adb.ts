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

  // Persistent interactive shell for zero-latency input injection
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

  public async getDevices(): Promise<DeviceInfo[]> {
    return new Promise((resolve) => {
      execFile(this.adbPath, ['devices', '-l'], (err, stdout) => {
        if (err || !stdout) {
          return resolve([]);
        }

        const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const devices: DeviceInfo[] = [];

        // Skip header: "List of devices attached"
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

  // Terminate any existing scrcpy-server instances on Android to prevent MediaTek encoder exhaustion
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
    // Safe scrcpy v3.1 parameters:
    // 1. 'stay_awake' is omitted to prevent ColorOS/OEM battery watchdog crash
    // 2. 'max_size' is omitted to preserve native macroblock alignment on MediaTek/Qualcomm encoders
    // 3. Bitrate is capped at 4 Mbps for stable thermal performance
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
      'control=true',
      'send_dummy_byte=true',
      'send_codec_meta=true',
      'send_frame_meta=true',
      'send_device_meta=false',
      'video_bit_rate=4000000',
      'max_fps=60'
    ];

    console.log(`[ADB] Starting scrcpy-server on ${deviceId}...`);
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

  public injectKey(deviceId: string, keyCode: number): void {
    const shell = this.getOrCreateShell(deviceId);
    shell.stdin?.write(`input keyevent ${keyCode}\n`);
  }

  public injectText(deviceId: string, text: string): void {
    const shell = this.getOrCreateShell(deviceId);
    const escaped = text.replace(/ /g, '%s').replace(/[^a-zA-Z0-9%s._-]/g, '');
    shell.stdin?.write(`input text ${escaped}\n`);
  }

  public injectTap(deviceId: string, x: number, y: number): void {
    const shell = this.getOrCreateShell(deviceId);
    shell.stdin?.write(`input tap ${Math.round(x)} ${Math.round(y)}\n`);
  }

  public injectSwipe(deviceId: string, x1: number, y1: number, x2: number, y2: number, durationMs = 150): void {
    const shell = this.getOrCreateShell(deviceId);
    shell.stdin?.write(`input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${Math.round(durationMs)}\n`);
  }
}
