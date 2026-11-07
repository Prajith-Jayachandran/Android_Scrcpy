'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DeviceManager } from '@/components/DeviceManager';
import { ControlsSidebar } from '@/components/ControlsSidebar';
import { ScreenViewer } from '@/components/ScreenViewer';
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';
import { LogsConsole } from '@/components/LogsConsole';
import { useWebCodecs } from '@/hooks/useWebCodecs';
import { DeviceInfo, StreamMeta, LogMessage } from '@/lib/types';
import { Cast, Sparkles } from 'lucide-react';

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
    <main className="flex h-screen w-screen bg-[#07090e] overflow-hidden text-slate-100 font-sans">
      {/* Left Sidebar */}
      <aside className="w-[340px] flex-shrink-0 border-r border-slate-800/80 bg-slate-950/70 p-5 flex flex-col gap-5 overflow-y-auto">
        {/* Brand Header */}
        <div className="flex items-center gap-3 pb-2 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Cast className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Android Mirror</span>
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </h1>
            <p className="text-xs text-slate-400">Pure WebCodecs • 60 FPS</p>
          </div>
        </div>

        {/* Device Manager */}
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

        {/* Live Diagnostics */}
        <DiagnosticsPanel fps={fps} meta={streamMeta} isStreaming={isStreaming} />

        {/* Instructions Card */}
        <div className="mt-auto bg-slate-900/40 border border-slate-800/60 rounded-xl p-3.5 text-xs text-slate-400">
          <p className="font-semibold text-slate-300 mb-1">Quick Note:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Ensure USB Debugging is turned ON.</li>
            <li>Direct clicks emulate accurate physical taps.</li>
            <li>Mouse drag flings and scrolls smoothly.</li>
            <li>Right click triggers the Back button.</li>
          </ul>
        </div>
      </aside>

      {/* Main Viewport: Screen Viewer */}
      <section className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-[#07090e] to-[#040609] overflow-hidden">
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

      {/* Right Sidebar */}
      <aside className="w-[350px] flex-shrink-0 border-l border-slate-800/80 bg-slate-950/70 p-5 flex flex-col gap-5 overflow-y-auto">
        {/* Controls */}
        <ControlsSidebar
          isStreaming={isStreaming}
          onSendKey={sendKey}
          onSendText={sendText}
        />

        {/* System Logs */}
        <LogsConsole logs={logs} onClearLogs={() => setLogs([])} />
      </aside>
    </main>
  );
}
