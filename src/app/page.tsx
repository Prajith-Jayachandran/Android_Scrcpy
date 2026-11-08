'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DeviceManager } from '@/components/DeviceManager';
import { ControlsSidebar } from '@/components/ControlsSidebar';
import { ScreenViewer } from '@/components/ScreenViewer';
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';
import { LogsConsole } from '@/components/LogsConsole';
import { CursorTrail } from '@/components/CursorTrail';
import { DeviceTabBar } from '@/components/DeviceTabBar';
import { NewUsbDeviceModal } from '@/components/NewUsbDeviceModal';
import { MacroEditor } from '@/components/MacroEditor';
import { useWebCodecs } from '@/hooks/useWebCodecs';
import { useMacroRecorder } from '@/hooks/useMacroRecorder';
import { DeviceInfo, StreamMeta, LogMessage } from '@/lib/types';
import { Cast, ShieldCheck } from 'lucide-react';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [streamingDeviceIds, setStreamingDeviceIds] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamMeta, setStreamMeta] = useState<StreamMeta | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [logs, setLogs] = useState<LogMessage[]>([]);

  // Feature #4: Multi-Device Sync Input Toggle
  const [syncAll, setSyncAll] = useState<boolean>(false);

  // Feature #10: Quick-Draw Privacy Mode State
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);

  // Feature #3: Context-Aware Game Detection State
  const [isGameActive, setIsGameActive] = useState<boolean>(false);
  const [activePackage, setActivePackage] = useState<string>('');

  // USB Multi-Device Link Pop-up Modal State
  const [newUsbModalOpen, setNewUsbModalOpen] = useState<boolean>(false);
  const [detectedUsbDevice, setDetectedUsbDevice] = useState<DeviceInfo | null>(null);
  const isManualRefreshRef = useRef<boolean>(false);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev.slice(-150),
      {
        id: Math.random().toString(36).substring(2, 9),
        message,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const { decodeChunk, resetDecoder } = useWebCodecs({
    canvasRef,
    meta: streamMeta,
    onFpsUpdate: setFps,
  });

  // Base raw command dispatches (wrapped for Macro Recording)
  const rawSendKey = useCallback(
    (code: number) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !selectedDeviceId) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'key',
          deviceId: selectedDeviceId,
          code,
          syncAll,
        })
      );
    },
    [selectedDeviceId, syncAll]
  );

  const rawSendText = useCallback(
    (text: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !selectedDeviceId) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'text',
          deviceId: selectedDeviceId,
          text,
          syncAll,
        })
      );
    },
    [selectedDeviceId, syncAll]
  );

  const rawTap = useCallback(
    (x: number, y: number) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !selectedDeviceId) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'tap',
          deviceId: selectedDeviceId,
          x,
          y,
          syncAll,
        })
      );
    },
    [selectedDeviceId, syncAll]
  );

  const rawSwipe = useCallback(
    (x1: number, y1: number, x2: number, y2: number, duration: number) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !selectedDeviceId) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'swipe',
          deviceId: selectedDeviceId,
          x1,
          y1,
          x2,
          y2,
          duration,
          syncAll,
        })
      );
    },
    [selectedDeviceId, syncAll]
  );

  // Feature #8: Macro Recorder Hook
  const macroRecorder = useMacroRecorder({
    onDispatchTap: rawTap,
    onDispatchSwipe: rawSwipe,
    onDispatchKey: rawSendKey,
    onDispatchText: rawSendText,
  });

  // Intercepting dispatchers that feed the macro recorder
  const sendKey = useCallback(
    (code: number) => {
      macroRecorder.recordAction({ type: 'key', keyCode: code });
      rawSendKey(code);
    },
    [macroRecorder, rawSendKey]
  );

  const sendText = useCallback(
    (text: string) => {
      macroRecorder.recordAction({ type: 'text', text });
      rawSendText(text);
    },
    [macroRecorder, rawSendText]
  );

  const handleTap = useCallback(
    (x: number, y: number) => {
      macroRecorder.recordAction({ type: 'tap', x, y });
      rawTap(x, y);
    },
    [macroRecorder, rawTap]
  );

  const handleSwipe = useCallback(
    (x1: number, y1: number, x2: number, y2: number, duration: number) => {
      macroRecorder.recordAction({ type: 'swipe', x1, y1, x2, y2, duration });
      rawSwipe(x1, y1, x2, y2, duration);
    },
    [macroRecorder, rawSwipe]
  );

  // Connect to WebSocket Server
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    addLog(`Connecting to backend server at ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      addLog('WebSocket connection established. Scanning for devices...');
      ws.send(JSON.stringify({ type: 'get-devices' }));
    };

    ws.onmessage = (event) => {
      // Binary Video Packet from Server
      if (event.data instanceof ArrayBuffer) {
        const view = new Uint8Array(event.data);
        if (view[0] === 0x01) {
          const flags = view[1];
          const isKeyFrame = (flags & 0x01) !== 0;
          const isConfig = (flags & 0x02) !== 0;
          const dataView = new DataView(event.data);
          const pts = Number(dataView.getBigUint64(2, false));
          const naluPayload = view.subarray(10);

          decodeChunk(naluPayload, isKeyFrame, isConfig, pts);
        }
        return;
      }

      // JSON Control/Log messages
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'devices':
            setIsScanning(false);
            const newDevices: DeviceInfo[] = msg.devices || [];
            setDevices(newDevices);

            // Handle Manual Refresh Pop-up trigger
            if (isManualRefreshRef.current) {
              isManualRefreshRef.current = false;
              // Check for any authorized USB device
              // Prefer a device that is not currently selected or not streaming yet
              const unlinkedDevice = newDevices.find(
                (d) => d.status === 'device' && (!selectedDeviceId || d.id !== selectedDeviceId)
              );

              if (unlinkedDevice) {
                setDetectedUsbDevice(unlinkedDevice);
                setNewUsbModalOpen(true);
                addLog(`Detected USB device: ${unlinkedDevice.model || unlinkedDevice.id}. Prompting to create link tab...`);
              } else if (newDevices.length > 0 && !selectedDeviceId) {
                setDetectedUsbDevice(newDevices[0]);
                setNewUsbModalOpen(true);
              } else if (newDevices.length > 0) {
                // If all are already selected, allow re-linking current device or inform user
                setDetectedUsbDevice(newDevices[0]);
                setNewUsbModalOpen(true);
              } else {
                addLog('No USB devices detected. Connect a phone via USB with USB debugging enabled.');
              }
            } else {
              // Automatic initial selection
              if (newDevices.length > 0 && !selectedDeviceId) {
                const readyDev = newDevices.find((d: DeviceInfo) => d.status === 'device');
                setSelectedDeviceId(readyDev ? readyDev.id : newDevices[0].id);
              }
            }
            break;

          case 'meta':
            if (!msg.deviceId || msg.deviceId === selectedDeviceId) {
              setStreamMeta({
                codec: msg.codec,
                width: msg.width,
                height: msg.height,
                physicalWidth: msg.physicalWidth,
                physicalHeight: msg.physicalHeight,
                deviceId: msg.deviceId,
              });
              setIsStreaming(true);
              setStreamingDeviceIds((prev) => new Set(prev).add(msg.deviceId || selectedDeviceId));
            }
            break;

          case 'stream-stopped':
            if (!msg.deviceId || msg.deviceId === selectedDeviceId) {
              setIsStreaming(false);
              setStreamMeta(null);
              setFps(0);
              resetDecoder();
            }
            if (msg.deviceId) {
              setStreamingDeviceIds((prev) => {
                const next = new Set(prev);
                next.delete(msg.deviceId);
                return next;
              });
            }
            break;

          case 'privacy-mode-status':
            if (msg.deviceId === selectedDeviceId) {
              setPrivacyMode(msg.enabled);
            }
            break;

          case 'game-mode-status':
            if (msg.deviceId === selectedDeviceId) {
              setIsGameActive(msg.isGame);
              setActivePackage(msg.package);
            }
            break;

          case 'log':
            addLog(msg.message);
            break;
        }
      } catch (e) {
        console.warn('Non-JSON message received:', event.data);
      }
    };

    ws.onerror = () => {
      addLog('[Error] WebSocket error encountered.');
    };

    ws.onclose = () => {
      addLog('[System] Connection to server lost. Reconnecting in 3s...');
      setIsStreaming(false);
    };

    return () => {
      ws.close();
    };
  }, [addLog, decodeChunk, resetDecoder, selectedDeviceId]);

  // Periodic device scanning when not streaming
  useEffect(() => {
    if (isStreaming) return;

    const timer = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'get-devices' }));
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [isStreaming]);

  // Feature #3: Periodic foreground game detection (every 3.5s while streaming)
  useEffect(() => {
    if (!isStreaming || !selectedDeviceId) return;

    const gameCheckTimer = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'check-game-mode',
            deviceId: selectedDeviceId,
          })
        );
      }
    }, 3500);

    return () => clearInterval(gameCheckTimer);
  }, [isStreaming, selectedDeviceId]);

  // Manual Refresh Button Action -> Requests devices and sets flag for pop-up
  const handleManualRefresh = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsScanning(true);
      isManualRefreshRef.current = true;
      addLog('Scanning for connected USB devices...');
      wsRef.current.send(JSON.stringify({ type: 'get-devices' }));
    }
  }, [addLog]);

  const startStream = useCallback(
    (targetId?: string) => {
      const devId = targetId || selectedDeviceId;
      if (!devId || !wsRef.current) return;
      resetDecoder();
      setIsStreaming(true);
      wsRef.current.send(
        JSON.stringify({
          type: 'start-stream',
          deviceId: devId,
        })
      );
    },
    [selectedDeviceId, resetDecoder]
  );

  const stopStream = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'stop-stream', deviceId: selectedDeviceId }));
    setIsStreaming(false);
    setFps(0);
  }, [selectedDeviceId]);

  // Handle Dropdown Device Selection: Spawns tab and auto-runs mirroring
  const handleSelectDeviceFromDropdown = useCallback(
    (deviceId: string) => {
      if (!deviceId) return;
      setSelectedDeviceId(deviceId);
      resetDecoder();

      const targetDev = devices.find((d) => d.id === deviceId);
      const brand = targetDev?.model || targetDev?.product || deviceId;

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'select-device',
            deviceId,
          })
        );

        // Automatically spawn/activate tab and start mirror
        setIsStreaming(true);
        wsRef.current.send(
          JSON.stringify({
            type: 'start-stream',
            deviceId,
          })
        );
        addLog(`✔ Spawning Tab for ${brand} and initializing mirror...`);
      }
    },
    [devices, resetDecoder, addLog]
  );

  // Handle Tab Click in top tab bar
  const handleSelectTab = useCallback(
    (newDeviceId: string) => {
      if (newDeviceId === selectedDeviceId) return;
      setSelectedDeviceId(newDeviceId);
      resetDecoder();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'select-device',
            deviceId: newDeviceId,
          })
        );

        if (!streamingDeviceIds.has(newDeviceId)) {
          startStream(newDeviceId);
        }
      }
    },
    [selectedDeviceId, streamingDeviceIds, resetDecoder, startStream]
  );

  // Confirm Pop-up: Spawn New USB Link Tab & Automatically Start Mirroring
  const handleConfirmNewUsbLink = useCallback(() => {
    if (!detectedUsbDevice) return;
    const targetId = detectedUsbDevice.id;
    const brand = detectedUsbDevice.model || detectedUsbDevice.product || targetId;
    setNewUsbModalOpen(false);

    // Switch to this device tab
    setSelectedDeviceId(targetId);
    resetDecoder();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'select-device',
          deviceId: targetId,
        })
      );

      // Automatically spawn tab and start mirroring
      setIsStreaming(true);
      wsRef.current.send(
        JSON.stringify({
          type: 'start-stream',
          deviceId: targetId,
        })
      );
    }

    addLog(`✔ Created new USB link tab for ${brand} and started mirroring!`);
    setDetectedUsbDevice(null);
  }, [detectedUsbDevice, resetDecoder, addLog]);

  // Feature #10: Toggle Quick-Draw Privacy Mode
  const togglePrivacyMode = useCallback(() => {
    if (!wsRef.current || !selectedDeviceId) return;
    const nextState = !privacyMode;
    setPrivacyMode(nextState);
    wsRef.current.send(
      JSON.stringify({
        type: 'set-privacy-mode',
        deviceId: selectedDeviceId,
        enabled: nextState,
      })
    );
  }, [privacyMode, selectedDeviceId]);

  // Feature #6: Clipboard paste handler
  const handleClipboardPaste = useCallback(
    (text: string) => {
      if (!wsRef.current || !selectedDeviceId) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'clipboard-paste',
          deviceId: selectedDeviceId,
          text,
        })
      );
    },
    [selectedDeviceId]
  );

  // Compute tab number for modal
  const targetTabNumber = detectedUsbDevice
    ? devices.findIndex((d) => d.id === detectedUsbDevice.id) + 1 || devices.length + 1
    : 1;

  return (
    <main className="relative flex h-screen w-screen bg-[#04060c] overflow-hidden text-slate-100 font-sans select-none">
      {/* Lightweight, GPU-friendly Cursor Trail */}
      <CursorTrail />

      {/* Pop-up: Create New Link via USB Modal */}
      <NewUsbDeviceModal
        isOpen={newUsbModalOpen}
        device={detectedUsbDevice}
        targetTabNumber={targetTabNumber}
        onConfirm={handleConfirmNewUsbLink}
        onCancel={() => {
          setNewUsbModalOpen(false);
          setDetectedUsbDevice(null);
        }}
      />

      {/* Static 3D Ambient Mesh Glow (Zero CPU/Compositor Load) */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(circle 800px at 25% 15%, rgba(99, 102, 241, 0.12) 0%, transparent 70%), radial-gradient(circle 700px at 80% 85%, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Left Frosted Glass Sidebar */}
      <aside className="w-[360px] flex-shrink-0 ultra-glass p-5 flex flex-col gap-4 overflow-y-auto z-10 border-r border-white/10">
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 pb-3 border-b border-white/10">
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.35)]">
            <Cast className="w-5 h-5 text-white drop-shadow-md" />
            <div className="absolute inset-0 rounded-2xl bg-white/20 blur-[2px] pointer-events-none" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
                Aether Mirror
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                PRO 60 FPS
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Ultra Glass • Pure WebCodecs
            </p>
          </div>
        </div>

        {/* Device Manager Glass Card with Dropdown and Refresh */}
        <DeviceManager
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          streamingDeviceIds={streamingDeviceIds}
          onSelectDevice={handleSelectDeviceFromDropdown}
          onRefresh={handleManualRefresh}
          isScanning={isScanning}
          isStreaming={isStreaming}
          onStartStream={() => startStream()}
          onStopStream={stopStream}
        />

        {/* Live Diagnostics Glass Card */}
        <DiagnosticsPanel fps={fps} meta={streamMeta} isStreaming={isStreaming} />

        {/* Feature #8: Macro Timeline Automator */}
        <MacroEditor
          isRecording={macroRecorder.isRecording}
          isPlaying={macroRecorder.isPlaying}
          steps={macroRecorder.steps}
          currentStepIndex={macroRecorder.currentStepIndex}
          speedMultiplier={macroRecorder.speedMultiplier}
          loopCount={macroRecorder.loopCount}
          onStartRecording={macroRecorder.startRecording}
          onStopRecording={macroRecorder.stopRecording}
          onPlay={() => macroRecorder.playWorkflow()}
          onStopPlayback={macroRecorder.stopPlayback}
          onSetSpeed={macroRecorder.setSpeedMultiplier}
          onSetLoop={macroRecorder.setLoopCount}
          onDeleteStep={(id) => macroRecorder.setSteps((prev) => prev.filter((s) => s.id !== id))}
          onClearSteps={() => macroRecorder.setSteps([])}
          onImportSteps={(imported) => macroRecorder.setSteps(imported)}
        />
      </aside>

      {/* Main Viewport: Multi-Device Numbered Tabs & 3D Perspective Stage */}
      <section className="flex-1 flex flex-col items-center justify-between p-4 relative overflow-hidden z-10">
        {/* Feature #4: Multi-Device Numbered Tabs (Oppo = 1, Vivo = 2, etc.) */}
        <DeviceTabBar
          devices={devices}
          activeDeviceId={selectedDeviceId}
          streamingDeviceIds={streamingDeviceIds}
          syncAll={syncAll}
          privacyMode={privacyMode}
          onSelectTab={handleSelectTab}
          onToggleSync={() => setSyncAll(!syncAll)}
          onTogglePrivacy={togglePrivacyMode}
        />

        {/* Active Smartphone Display Stage with Drag & Drop Sideloading + Gamepad HUD */}
        <div className="flex-1 flex items-center justify-center w-full">
          <ScreenViewer
            canvasRef={canvasRef}
            isStreaming={isStreaming}
            meta={streamMeta}
            activeDeviceId={selectedDeviceId}
            isGameActive={isGameActive}
            activePackage={activePackage}
            onTap={handleTap}
            onSwipe={handleSwipe}
            onSendKey={sendKey}
            onSendText={sendText}
            onCloseGamepad={() => setIsGameActive(false)}
            onNotifyLog={addLog}
          />
        </div>

        {/* Bottom Status Pill */}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400 ultra-glass px-4 py-1.5 rounded-full border border-white/5">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>Drag &amp; Drop .APK to install &amp; auto-launch</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>Drop Photos/Videos to push to /sdcard/Download/</span>
          </span>
        </div>
      </section>

      {/* Right Frosted Glass Sidebar */}
      <aside className="w-[360px] flex-shrink-0 ultra-glass p-5 flex flex-col gap-4 overflow-y-auto z-10 border-l border-white/10">
        {/* Hardware & Navigation Controls with Clipboard & Gamepad toggles */}
        <ControlsSidebar
          isStreaming={isStreaming}
          isGameActive={isGameActive}
          privacyMode={privacyMode}
          onSendKey={sendKey}
          onSendText={sendText}
          onClipboardPaste={handleClipboardPaste}
          onToggleGamepad={() => setIsGameActive(!isGameActive)}
          onTogglePrivacy={togglePrivacyMode}
        />

        {/* Cyberpunk Glass Console */}
        <LogsConsole logs={logs} onClearLogs={() => setLogs([])} />
      </aside>
    </main>
  );
}
