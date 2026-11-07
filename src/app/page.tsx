'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DeviceManager } from '@/components/DeviceManager';
import { ControlsSidebar } from '@/components/ControlsSidebar';
import { ScreenViewer } from '@/components/ScreenViewer';
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';
import { LogsConsole } from '@/components/LogsConsole';
import { CursorTrail } from '@/components/CursorTrail';
import { useWebCodecs } from '@/hooks/useWebCodecs';
import { DeviceInfo, StreamMeta, LogMessage } from '@/lib/types';
import { Cast, Sparkles, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamMeta, setStreamMeta] = useState<StreamMeta | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [logs, setLogs] = useState<LogMessage[]>([]);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev.slice(-150), // Keep last 150 log entries
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
          // Video packet
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
            setDevices(msg.devices || []);
            if (msg.devices && msg.devices.length > 0 && !selectedDeviceId) {
              const readyDev = msg.devices.find((d: DeviceInfo) => d.status === 'device');
              setSelectedDeviceId(readyDev ? readyDev.id : msg.devices[0].id);
            }
            break;

          case 'meta':
            setStreamMeta({
              codec: msg.codec,
              width: msg.width,
              height: msg.height,
              physicalWidth: msg.physicalWidth,
              physicalHeight: msg.physicalHeight,
            });
            setIsStreaming(true);
            break;

          case 'stream-stopped':
            setIsStreaming(false);
            setStreamMeta(null);
            setFps(0);
            resetDecoder();
            break;

          case 'log':
            addLog(msg.message);
            break;
        }
      } catch (e) {
        console.warn('Non-JSON message received:', event.data);
      }
    };

    ws.onerror = (e) => {
      addLog('[Error] WebSocket error encountered.');
    };

    ws.onclose = () => {
      addLog('[System] Connection to server lost. Reconnecting in 3s...');
      setIsStreaming(false);
    };

    return () => {
      ws.close();
    };
  }, [addLog, decodeChunk, resetDecoder]);

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

  // Command Dispatches
  const refreshDevices = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsScanning(true);
      wsRef.current.send(JSON.stringify({ type: 'get-devices' }));
    }
  };

  const startStream = () => {
    if (!selectedDeviceId || !wsRef.current) return;
    resetDecoder();
    setIsStreaming(true);
    wsRef.current.send(
      JSON.stringify({
        type: 'start-stream',
        deviceId: selectedDeviceId,
      })
    );
  };

  const stopStream = () => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'stop-stream' }));
    setIsStreaming(false);
    setFps(0);
  };

  const sendKey = (code: number) => {
    if (!wsRef.current || !selectedDeviceId) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'key',
        deviceId: selectedDeviceId,
        code,
      })
    );
  };

  const sendText = (text: string) => {
    if (!wsRef.current || !selectedDeviceId) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'text',
        deviceId: selectedDeviceId,
        text,
      })
    );
  };

  const handleTap = (x: number, y: number) => {
    if (!wsRef.current || !selectedDeviceId) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'tap',
        deviceId: selectedDeviceId,
        x,
        y,
      })
    );
  };

  const handleSwipe = (x1: number, y1: number, x2: number, y2: number, duration: number) => {
    if (!wsRef.current || !selectedDeviceId) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'swipe',
        deviceId: selectedDeviceId,
        x1,
        y1,
        x2,
        y2,
        duration,
      })
    );
  };

  return (
    <main className="relative flex h-screen w-screen bg-[#04060c] overflow-hidden text-slate-100 font-sans select-none">
      {/* Interactive Glowing Cursor Trail & Spotlight Canvas */}
      <CursorTrail />

      {/* 3D Ambient Glowing Mesh Background Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Orb 1: Violet/Indigo Top-Center */}
        <div className="absolute -top-32 left-1/3 w-[550px] h-[550px] rounded-full bg-gradient-to-br from-indigo-600/20 via-purple-600/15 to-transparent blur-[120px] animate-float-1" />
        {/* Orb 2: Cyan/Emerald Bottom-Right */}
        <div className="absolute -bottom-40 right-10 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-600/15 via-indigo-600/10 to-transparent blur-[140px] animate-float-2" />
        {/* Orb 3: Deep Magenta Bottom-Left */}
        <div className="absolute -bottom-20 -left-20 w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-fuchsia-600/15 to-transparent blur-[100px] animate-float-3" />

        {/* Subtle Spatial Cyber Grid Lines */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Left Frosted Glass Sidebar */}
      <aside className="w-[360px] flex-shrink-0 ultra-glass p-5 flex flex-col gap-4 overflow-y-auto z-10 border-r border-white/10">
        {/* Futuristic Brand Header */}
        <div className="flex items-center gap-3.5 pb-3 border-b border-white/10">
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.4)]">
            <Cast className="w-5 h-5 text-white drop-shadow-md" />
            <div className="absolute inset-0 rounded-2xl bg-white/20 blur-[2px] pointer-events-none" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-300">
                Aether Mirror
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                3D PRO
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Ultra-Realistic Glassmorphic Engine
            </p>
          </div>
        </div>

        {/* Device Manager Glass Card */}
        <DeviceManager
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          onSelectDevice={setSelectedDeviceId}
          onRefresh={refreshDevices}
          isScanning={isScanning}
          isStreaming={isStreaming}
          onStartStream={startStream}
          onStopStream={stopStream}
        />

        {/* Live Diagnostics Glass Card */}
        <DiagnosticsPanel fps={fps} meta={streamMeta} isStreaming={isStreaming} />

        {/* Interactive Gesture Guide */}
        <div className="mt-auto ultra-glass-card rounded-2xl p-4 text-xs text-slate-300">
          <div className="flex items-center gap-1.5 font-bold text-white mb-2 text-[11px] tracking-wide uppercase">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Interactive Controls</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-400">
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-indigo-400" />
              <span>Two-finger trackpad swipe scrolls smoothly</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-cyan-400" />
              <span>Click & drag across screen to fling</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-purple-400" />
              <span>Right click triggers Back button</span>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main Viewport: 3D Perspective Stage */}
      <section className="flex-1 flex items-center justify-center p-6 relative overflow-hidden z-10">
        <ScreenViewer
          canvasRef={canvasRef}
          isStreaming={isStreaming}
          meta={streamMeta}
          onTap={handleTap}
          onSwipe={handleSwipe}
          onSendKey={sendKey}
          onSendText={sendText}
        />
      </section>

      {/* Right Frosted Glass Sidebar */}
      <aside className="w-[360px] flex-shrink-0 ultra-glass p-5 flex flex-col gap-4 overflow-y-auto z-10 border-l border-white/10">
        {/* Hardware & Navigation Controls */}
        <ControlsSidebar
          isStreaming={isStreaming}
          onSendKey={sendKey}
          onSendText={sendText}
        />

        {/* Cyberpunk Glass Console */}
        <LogsConsole logs={logs} onClearLogs={() => setLogs([])} />
      </aside>
    </main>
  );
}
