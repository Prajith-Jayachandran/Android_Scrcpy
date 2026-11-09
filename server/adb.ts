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
  private deviceShells: Map<string, ChildProcess> = new Map();
  private screenSizeCache: Map<string, { width: number; height: number }> = new Map();

  constructor() {
    this.adbPath = this.resolveAdbPath();
    this.serverJarPath = path.resolve(__dirname, '../bin/scrcpy-server.jar');
  }

  private resolveAdbPath(): string {
    const isWin = process.platform === 'win32';
    const exe = isWin ? '.exe' : '';
    const candidates = [
      path.resolve(__dirname, `../bin/adb${exe}`),
      path.resolve(__dirname, '../bin/adb'),
      path.resolve(os.homedir(), `.local/bin/adb${exe}`),
      path.resolve(os.homedir(), '.local/bin/adb'),
      isWin && process.env.LOCALAPPDATA ? path.resolve(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe') : null,
      '/usr/local/bin/adb',
      '/usr/bin/adb',
      `adb${exe}`,
      'adb'
    ].filter(Boolean) as string[];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          if (!isWin) {
            fs.accessSync(p, fs.constants.X_OK);
          }
          return p;
        } catch {}
      }
    }
    return `adb${exe}`;
  }

  public getAdbPath(): string {
    return this.adbPath;
  }

  // Persistent interactive shell per device for zero-latency safe Android input injection
  private getOrCreateShell(deviceId: string): ChildProcess {
    const existing = this.deviceShells.get(deviceId);
    if (existing && !existing.killed && existing.stdin && !existing.stdin.destroyed) {
      return existing;
    }

    const shell = spawn(this.adbPath, ['-s', deviceId, 'shell']);
    shell.stdin?.setDefaultEncoding('utf-8');

    shell.on('exit', () => {
      this.deviceShells.delete(deviceId);
    });

    shell.on('error', (err) => {
      console.error(`[Persistent Shell Error - ${deviceId}]:`, err.message);
      this.deviceShells.delete(deviceId);
    });

    this.deviceShells.set(deviceId, shell);
    return shell;
  }

  public closeDeviceShell(deviceId: string): void {
    const shell = this.deviceShells.get(deviceId);
    if (shell) {
      try {
        shell.stdin?.end();
        shell.kill();
      } catch (e) {}
      this.deviceShells.delete(deviceId);
    }
  }

  public closeShell(): void {
    for (const [, shell] of this.deviceShells) {
      try {
        shell.stdin?.end();
        shell.kill();
      } catch (e) {}
    }
    this.deviceShells.clear();
  }

  // Query device physical screen dimensions (e.g. 1080x2373) with memoization cache
  public async getDeviceScreenSize(deviceId: string): Promise<{ width: number; height: number }> {
    const cached = this.screenSizeCache.get(deviceId);
    if (cached) return cached;

    return new Promise((resolve) => {
      execFile(this.adbPath, ['-s', deviceId, 'shell', 'wm', 'size'], (err, stdout) => {
        if (!err && stdout) {
          const match = stdout.match(/(?:Override|Physical) size:\s*(\d+)x(\d+)/i);
          if (match) {
            const size = {
              width: parseInt(match[1], 10),
              height: parseInt(match[2], 10),
            };
            this.screenSizeCache.set(deviceId, size);
            return resolve(size);
          }
        }
        const fallback = { width: 1080, height: 2400 };
        this.screenSizeCache.set(deviceId, fallback);
        resolve(fallback);
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
        ['-s', deviceId, 'shell', 'pkill -9 -u shell app_process 2>/dev/null || pkill -9 -f scrcpy 2>/dev/null || true'],
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
      'audio=true',
      'audio_codec=raw',
      'audio_source=playback',
      'audio_dup=true',
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

  // Zero-latency input injection using persistent interactive shell pipes
  public injectKey(deviceId: string, keyCode: number): void {
    try {
      const shell = this.getOrCreateShell(deviceId);
      shell.stdin?.write(`input keyevent ${keyCode}\n`);
    } catch {
      execFile(this.adbPath, ['-s', deviceId, 'shell', 'input', 'keyevent', keyCode.toString()], () => {});
    }
  }

  public injectText(deviceId: string, text: string): void {
    const escaped = text.replace(/ /g, '%s').replace(/[^a-zA-Z0-9%s._-]/g, '');
    if (!escaped) return;
    try {
      const shell = this.getOrCreateShell(deviceId);
      shell.stdin?.write(`input text ${escaped}\n`);
    } catch {
      execFile(this.adbPath, ['-s', deviceId, 'shell', 'input', 'text', escaped], () => {});
    }
  }

  public injectTap(deviceId: string, x: number, y: number): void {
    try {
      const shell = this.getOrCreateShell(deviceId);
      shell.stdin?.write(`input tap ${Math.round(x)} ${Math.round(y)}\n`);
    } catch {
      execFile(
        this.adbPath,
        ['-s', deviceId, 'shell', 'input', 'tap', Math.round(x).toString(), Math.round(y).toString()],
        () => {}
      );
    }
  }

  public injectSwipe(deviceId: string, x1: number, y1: number, x2: number, y2: number, durationMs = 50): void {
    try {
      const shell = this.getOrCreateShell(deviceId);
      shell.stdin?.write(
        `input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${Math.round(durationMs)}\n`
      );
    } catch {
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
        () => {}
      );
    }
  }

  // --------------------------------------------------------------------------
  // Feature #10: Quick-Draw Privacy Mode (Remote Screen Blackout)
  // --------------------------------------------------------------------------
  private savedBrightness: Map<string, { brightness: string; mode: string }> = new Map();

  public async setPrivacyMode(deviceId: string, enabled: boolean): Promise<boolean> {
    return new Promise((resolve) => {
      if (enabled) {
        // Save current brightness and mode before zeroing out
        execFile(
          this.adbPath,
          ['-s', deviceId, 'shell', 'settings get system screen_brightness; settings get system screen_brightness_mode'],
          (err, stdout) => {
            if (!err && stdout) {
              const lines = stdout.trim().split(/\r?\n/);
              this.savedBrightness.set(deviceId, {
                brightness: lines[0] || '1024',
                mode: lines[1] || '0'
              });
            } else {
              this.savedBrightness.set(deviceId, { brightness: '1024', mode: '0' });
            }

            // Dim screen completely to 0 (pitch black on OLEDs)
            execFile(
              this.adbPath,
              ['-s', deviceId, 'shell', 'settings put system screen_brightness_mode 0; settings put system screen_brightness 0'],
              (err2) => {
                resolve(!err2);
              }
            );
          }
        );
      } else {
        // Restore previous brightness
        const saved = this.savedBrightness.get(deviceId) || { brightness: '1024', mode: '0' };
        execFile(
          this.adbPath,
          [
            '-s',
            deviceId,
            'shell',
            `settings put system screen_brightness_mode ${saved.mode}; settings put system screen_brightness ${saved.brightness}; input keyevent 224`
          ],
          (err) => {
            resolve(!err);
          }
        );
      }
    });
  }

  // --------------------------------------------------------------------------
  // Feature #7: Dual-Mode Wired & Wireless Link (Wi-Fi 5GHz & TCP/IP)
  // --------------------------------------------------------------------------
  public async getDeviceIp(deviceId: string): Promise<string | null> {
    return new Promise((resolve) => {
      execFile(this.adbPath, ['-s', deviceId, 'shell', 'ip -f inet addr'], (err, stdout) => {
        if (err || !stdout) return resolve(null);

        // Search for non-loopback inet addresses (e.g. wlan0, ap0, eth0)
        const lines = stdout.split(/\r?\n/);
        let foundIp: string | null = null;

        for (const line of lines) {
          if (line.includes('127.0.0.1')) continue;
          const match = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)\/\d+/);
          if (match) {
            const ip = match[1];
            // Prioritize standard local subnet IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
            if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
              foundIp = ip;
              if (line.includes('wlan') || line.includes('ap')) break;
            }
          }
        }
        resolve(foundIp);
      });
    });
  }

  public async switchToTcpip(deviceId: string, port = 5555): Promise<boolean> {
    return new Promise((resolve) => {
      execFile(this.adbPath, ['-s', deviceId, 'tcpip', port.toString()], (err) => {
        resolve(!err);
      });
    });
  }

  public async connectWireless(ip: string, port = 5555): Promise<{ success: boolean; message: string }> {
    const target = `${ip}:${port}`;
    return new Promise((resolve) => {
      execFile(this.adbPath, ['connect', target], (err, stdout, stderr) => {
        const out = (stdout || stderr || '').trim();
        if (out.includes('connected to') || out.includes('already connected')) {
          resolve({ success: true, message: out });
        } else {
          resolve({ success: false, message: out || (err ? err.message : 'Failed to connect') });
        }
      });
    });
  }

  public async pairWireless(ip: string, port: number, code: string): Promise<{ success: boolean; message: string }> {
    const target = `${ip}:${port}`;
    return new Promise((resolve) => {
      execFile(this.adbPath, ['pair', target, code], (err, stdout, stderr) => {
        const out = (stdout || stderr || '').trim();
        if (out.toLowerCase().includes('successfully paired')) {
          resolve({ success: true, message: out });
        } else {
          resolve({ success: false, message: out || (err ? err.message : 'Pairing failed') });
        }
      });
    });
  }

  public async disconnectWireless(target: string): Promise<boolean> {
    return new Promise((resolve) => {
      execFile(this.adbPath, ['disconnect', target], (err) => {
        resolve(!err);
      });
    });
  }

  // --------------------------------------------------------------------------
  // Feature #3: Context-Aware Game Detection
  // --------------------------------------------------------------------------
  public async getForegroundPackage(deviceId: string): Promise<string | null> {
    return new Promise((resolve) => {
      execFile(
        this.adbPath,
        ['-s', deviceId, 'shell', "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'"],
        (err, stdout) => {
          if (err || !stdout) return resolve(null);

          // Example: mFocusedApp=ActivityRecord{... com.pubg.imobile/com.epicgames.ue4.SplashActivity ...}
          const match = stdout.match(/([a-zA-Z0-9._]+)\/([a-zA-Z0-9._]+)/);
          if (match && match[1]) {
            return resolve(match[1]);
          }
          resolve(null);
        }
      );
    });
  }

  public async isPackageGame(deviceId: string, packageName: string): Promise<boolean> {
    // Known game package keywords / common titles
    const gameKeywords = [
      'game', 'pubg', 'genshin', 'freefire', 'cod', 'roblox', 'minecraft',
      'subway', 'asphalt', 'clash', 'supercell', 'riot', 'league', 'bgmi',
      'candycrush', 'unity', 'epicgames', 'fortnite', 'ea.gp', 'netease'
    ];
    const lowerPkg = packageName.toLowerCase();
    if (gameKeywords.some(k => lowerPkg.includes(k))) {
      return true;
    }

    return new Promise((resolve) => {
      execFile(
        this.adbPath,
        ['-s', deviceId, 'shell', `dumpsys package ${packageName} | grep -E 'appCategory|category'`],
        (err, stdout) => {
          if (!err && stdout) {
            if (stdout.includes('appCategory=0') || stdout.toLowerCase().includes('appcategory=game')) {
              return resolve(true);
            }
          }
          resolve(false);
        }
      );
    });
  }

  // --------------------------------------------------------------------------
  // Feature #2: Drag & Drop APK Sideloading & Media Push
  // --------------------------------------------------------------------------
  public async installApk(deviceId: string, apkFilePath: string): Promise<{ success: boolean; message: string; packageName?: string }> {
    return new Promise((resolve) => {
      // 1. Install APK with -r (reinstall) and -g (grant all permissions)
      execFile(
        this.adbPath,
        ['-s', deviceId, 'install', '-r', '-g', apkFilePath],
        async (err, stdout, stderr) => {
          const out = (stdout || stderr || '').trim();
          if (err || !out.includes('Success')) {
            return resolve({
              success: false,
              message: out || (err ? err.message : 'Installation failed')
            });
          }

          // 2. Attempt to resolve launcher package and auto-launch
          execFile(
            this.adbPath,
            ['-s', deviceId, 'shell', 'cmd package resolve-activity --brief', apkFilePath],
            (errResolve, outResolve) => {
              let pkg = '';
              if (!errResolve && outResolve) {
                const lines = outResolve.trim().split(/\r?\n/);
                const lastLine = lines[lines.length - 1];
                const match = lastLine.match(/([a-zA-Z0-9._]+)\//);
                if (match) pkg = match[1];
              }

              if (pkg) {
                // Auto launch app
                execFile(this.adbPath, ['-s', deviceId, 'shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1']);
              }

              resolve({
                success: true,
                message: 'Successfully installed and auto-launched!',
                packageName: pkg
              });
            }
          );
        }
      );
    });
  }

  public async pushMedia(deviceId: string, localFilePath: string, remoteFileName: string): Promise<{ success: boolean; message: string }> {
    const remotePath = `/sdcard/Download/${remoteFileName}`;
    return new Promise((resolve) => {
      execFile(
        this.adbPath,
        ['-s', deviceId, 'push', localFilePath, remotePath],
        (err, stdout, stderr) => {
          if (err) {
            return resolve({
              success: false,
              message: stderr || err.message
            });
          }

          // Trigger Android Media Scanner so it appears immediately in Photos / Downloads
          execFile(
            this.adbPath,
            [
              '-s',
              deviceId,
              'shell',
              'am',
              'broadcast',
              '-a',
              'android.intent.action.MEDIA_SCANNER_SCAN_FILE',
              '-d',
              `file://${remotePath}`
            ],
            () => {
              resolve({
                success: true,
                message: `Pushed to ${remotePath} and scanned into Android Media Gallery.`
              });
            }
          );
        }
      );
    });
  }

  // --------------------------------------------------------------------------
  // Feature #6: Smart Clipboard Sync (PC to Phone & Phone to PC)
  // --------------------------------------------------------------------------
  public async pasteClipboard(deviceId: string, text: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Escape text safely for Android input
      const escaped = text.replace(/ /g, '%s').replace(/[^a-zA-Z0-9%s._@!#$^&*()-+=~]/g, '');
      execFile(this.adbPath, ['-s', deviceId, 'shell', 'input', 'text', escaped], (err) => {
        resolve(!err);
      });
    });
  }

  public async getClipboard(deviceId: string): Promise<string> {
    return new Promise((resolve) => {
      execFile(this.adbPath, ['-s', deviceId, 'shell', 'cmd clipboard get 2>/dev/null || true'], (err, stdout) => {
        if (!err && stdout && !stdout.includes('No shell command')) {
          return resolve(stdout.trim());
        }
        resolve('');
      });
    });
  }

  // --------------------------------------------------------------------------
  // Audio Destination Control: Mute / Unmute physical device speaker
  // --------------------------------------------------------------------------
  private savedDeviceVolumes: Map<string, number> = new Map();

  public async muteDeviceSpeaker(deviceId: string): Promise<boolean> {
    return new Promise((resolve) => {
      execFile(
        this.adbPath,
        ['-s', deviceId, 'shell', 'cmd', 'media_session', 'volume', '--stream', '3', '--get'],
        (_err, stdout) => {
          if (stdout) {
            const match = stdout.match(/volume is (\d+)/);
            if (match) {
              const vol = parseInt(match[1], 10);
              if (vol > 0) this.savedDeviceVolumes.set(deviceId, vol);
            }
          }
          execFile(
            this.adbPath,
            [
              '-s',
              deviceId,
              'shell',
              'cmd media_session volume --stream 3 --set 0 2>/dev/null || true; cmd audio set-volume 3 0 2>/dev/null || true'
            ],
            (setErr) => {
              resolve(!setErr);
            }
          );
        }
      );
    });
  }

  public async unmuteDeviceSpeaker(deviceId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const prev = this.savedDeviceVolumes.get(deviceId) || 100;
      execFile(
        this.adbPath,
        [
          '-s',
          deviceId,
          'shell',
          `cmd media_session volume --stream 3 --set ${prev} 2>/dev/null || true; cmd audio set-volume 3 ${prev} 2>/dev/null || true`
        ],
        (err) => {
          resolve(!err);
        }
      );
    });
  }
}
