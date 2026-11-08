'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Smartphone, Sparkles, UploadCloud, FileCheck, AlertCircle, PackageCheck, Loader2 } from 'lucide-react';
import { StreamMeta } from '../lib/types';
import { GamepadOverlay } from './GamepadOverlay';

interface ScreenViewerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  meta: StreamMeta | null;
  activeDeviceId: string;
  isGameActive?: boolean;
  activePackage?: string;
  onTap: (x: number, y: number) => void;
  onSwipe: (x1: number, y1: number, x2: number, y2: number, duration: number) => void;
  onSendKey: (keyCode: number) => void;
  onSendText: (text: string) => void;
  onCloseGamepad?: () => void;
  onNotifyLog?: (msg: string) => void;
}

export const ScreenViewer: React.FC<ScreenViewerProps> = ({
  canvasRef,
  isStreaming,
  meta,
  activeDeviceId,
  isGameActive = false,
  activePackage,
  onTap,
  onSwipe,
  onSendKey,
  onSendText,
  onCloseGamepad,
  onNotifyLog,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Feature #2: Drag & Drop File Sideloading State
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  const metaRef = useRef(meta);
  metaRef.current = meta;

  const lastWheelTimeRef = useRef<number>(0);
  const wheelAccumulatorRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const wheelResetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Exact 1:1 mapping from canvas click coordinates to physical device screen resolution
  const mapCoordinates = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const currentMeta = metaRef.current;
    const targetWidth = currentMeta?.physicalWidth || currentMeta?.width || 1080;
    const targetHeight = currentMeta?.physicalHeight || currentMeta?.height || 2373;

    return {
      x: Math.round(relX * targetWidth),
      y: Math.round(relY * targetHeight),
    };
  };

  // Two-finger mousepad / trackpad swipe support via non-passive wheel event
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isStreaming) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();

      const now = Date.now();
      if (now - lastWheelTimeRef.current < 160) return;

      wheelAccumulatorRef.current.dx += e.deltaX;
      wheelAccumulatorRef.current.dy += e.deltaY;

      if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current);
      wheelResetTimerRef.current = setTimeout(() => {
        wheelAccumulatorRef.current = { dx: 0, dy: 0 };
      }, 150);

      const { dx, dy } = wheelAccumulatorRef.current;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX < 20 && absY < 20) return;

      lastWheelTimeRef.current = now;
      wheelAccumulatorRef.current = { dx: 0, dy: 0 };

      const coords = mapCoordinates(e.clientX, e.clientY);
      const currentMeta = metaRef.current;
      const targetW = currentMeta?.physicalWidth || currentMeta?.width || 1080;
      const targetH = currentMeta?.physicalHeight || currentMeta?.height || 2373;
      const cx = Math.max(150, Math.min(targetW - 150, coords.x || targetW / 2));
      const cy = Math.max(350, Math.min(targetH - 350, coords.y || targetH / 2));

      if (absY >= absX) {
        // Vertical swipe (Up / Down)
        const swipeDist = Math.round(targetH * 0.28);
        if (dy > 0) {
          // Swiped UP on trackpad -> Scroll DOWN on phone
          const startY = Math.min(targetH - 180, cy + Math.round(swipeDist / 2));
          const endY = Math.max(180, cy - Math.round(swipeDist / 2));
          onSwipeRef.current(cx, startY, cx, endY, 150);
        } else {
          // Swiped DOWN on trackpad -> Scroll UP on phone
          const startY = Math.max(180, cy - Math.round(swipeDist / 2));
          const endY = Math.min(targetH - 180, cy + Math.round(swipeDist / 2));
          onSwipeRef.current(cx, startY, cx, endY, 150);
        }
      } else {
        // Horizontal swipe (Left / Right)
        const swipeDistX = Math.round(targetW * 0.50);
        if (dx > 0) {
          // Swiped LEFT on trackpad -> Scroll RIGHT on phone
          const startX = Math.min(targetW - 80, cx + Math.round(swipeDistX / 2));
          const endX = Math.max(80, cx - Math.round(swipeDistX / 2));
          onSwipeRef.current(startX, cy, endX, cy, 150);
        } else {
          // Swiped RIGHT on trackpad -> Scroll LEFT on phone
          const startX = Math.max(80, cx - Math.round(swipeDistX / 2));
          const endX = Math.min(targetW - 80, cx + Math.round(swipeDistX / 2));
          onSwipeRef.current(startX, cy, endX, cy, 150);
        }
      }
    };

    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelNative);
    };
  }, [isStreaming]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isStreaming) return;

    // Right Click -> Back
    if (e.button === 2) {
      onSendKey(4);
      return;
    }
    // Middle Click -> Home
    if (e.button === 1) {
      onSendKey(3);
      return;
    }
    if (e.button !== 0) return; // Only track primary click

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    const coords = mapCoordinates(e.clientX, e.clientY);
    dragStartRef.current = {
      x: coords.x,
      y: coords.y,
      time: Date.now(),
    };
    lastCoordsRef.current = coords;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isStreaming || !dragStartRef.current) return;
    lastCoordsRef.current = mapCoordinates(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isStreaming || !dragStartRef.current) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    const start = dragStartRef.current;
    const end = lastCoordsRef.current || mapCoordinates(e.clientX, e.clientY);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Deadzone: under 30 physical pixels is a clean TAP.
    if (distance < 30) {
      onTap(start.x, start.y);
    } else {
      // Clean 150ms swipe gesture recognized by Android WindowManager as a fast scroll fling
      onSwipe(start.x, start.y, end.x, end.y, 150);
    }

    dragStartRef.current = null;
    lastCoordsRef.current = null;
  };

  // Keyboard forwarding when canvas container is focused
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isStreaming) return;

    if (e.key === 'Backspace') {
      onSendKey(67); // KEYCODE_DEL
      e.preventDefault();
    } else if (e.key === 'Enter') {
      onSendKey(66); // KEYCODE_ENTER
      e.preventDefault();
    } else if (e.key === 'Escape') {
      onSendKey(4); // KEYCODE_BACK
      e.preventDefault();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      onSendText(e.key);
      e.preventDefault();
    }
  };

  // --------------------------------------------------------------------------
  // Feature #2: Drag & Drop APK Sideloading & Media Push Handler
  // --------------------------------------------------------------------------
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0 || !activeDeviceId) return;

    const file = files[0];
    const isApk = file.name.toLowerCase().endsWith('.apk');

    setIsUploading(true);
    setUploadStatus(isApk ? `Sideloading ${file.name}...` : `Pushing ${file.name}...`);
    onNotifyLog?.(`Uploading ${file.name} to device ${activeDeviceId}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('deviceId', activeDeviceId);

      const resp = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const res = await resp.json();
      if (res.success) {
        setUploadStatus(
          isApk
            ? `✔ Installed & Launched ${file.name}!`
            : `✔ Pushed ${file.name} to /sdcard/Download/`
        );
        onNotifyLog?.(res.message);
      } else {
        setUploadStatus(`✖ Failed: ${res.message}`);
        onNotifyLog?.(`[Error] ${res.message}`);
      }
    } catch (err: any) {
      setUploadStatus(`✖ Error: ${err.message}`);
      onNotifyLog?.(`[Upload Error]: ${err.message}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadStatus(null), 4000);
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex items-center justify-center p-4 outline-none transition-all duration-300 ${
        isFocused ? 'ring-2 ring-indigo-500/40 rounded-[3.5rem]' : ''
      }`}
    >
      {/* 3D Floating Ground Reflection / Ambient Glow */}
      <div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[70%] h-14 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.1) 40%, transparent 70%)',
          filter: 'blur(16px)',
        }}
      />

      {/* 3D Smartphone Chassis Mockup with Titanium Chamfered Bezel */}
      <div className="relative rounded-[3.4rem] p-3.5 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 border-[5px] border-slate-600/70 shadow-[0_35px_90px_-15px_rgba(0,0,0,0.95),0_0_50px_rgba(99,102,241,0.18)] flex flex-col items-center justify-center chassis-titanium-3d">
        {/* Antenna Lines on Frame */}
        <div className="absolute -left-1.5 top-20 w-1.5 h-3 bg-slate-500/80 rounded-l" />
        <div className="absolute -left-1.5 bottom-20 w-1.5 h-3 bg-slate-500/80 rounded-l" />
        <div className="absolute -right-1.5 top-20 w-1.5 h-3 bg-slate-500/80 rounded-r" />
        <div className="absolute -right-1.5 bottom-20 w-1.5 h-3 bg-slate-500/80 rounded-r" />

        {/* Physical 3D Protruding Volume Buttons */}
        <div className="absolute -left-[10px] top-28 w-2 h-11 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-700 rounded-l-md shadow-lg" />
        <div className="absolute -left-[10px] top-42 w-2 h-11 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-700 rounded-l-md shadow-lg" />

        {/* Physical 3D Protruding Power Button */}
        <div className="absolute -right-[10px] top-32 w-2 h-14 bg-gradient-to-b from-slate-500 via-slate-600 to-slate-700 rounded-r-md shadow-lg" />

        {/* Top Speaker & Dynamic Island Camera with Sapphire Reflection */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2.5 z-30 pointer-events-none">
          {/* Micro-mesh speaker grill */}
          <div className="w-12 h-1 bg-slate-800 rounded-full border border-slate-700/60 shadow-inner" />

          {/* Front Camera Island */}
          <div className="relative px-2 py-0.5 bg-black/90 rounded-full border border-slate-800/90 flex items-center gap-1.5 shadow-md backdrop-blur-md">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center relative">
              <div className="w-1 h-1 rounded-full bg-indigo-500/80" />
              <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-white/90 rounded-full" />
            </div>
            {isStreaming && (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            )}
          </div>
        </div>

        {/* Screen Display Container */}
        <div
          className="relative rounded-[2.6rem] bg-black overflow-hidden flex items-center justify-center shadow-inner border border-slate-800/80 transition-all"
          style={{
            height: 'min(76vh, 740px)',
            aspectRatio: meta
              ? `${meta.physicalWidth || meta.width} / ${meta.physicalHeight || meta.height}`
              : '9 / 19.5',
            maxWidth: '100%',
          }}
        >
          {/* Static Specular Glass Glare (pointer-events-none, 0% CPU cost) */}
          <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              background:
                'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.01) 30%, transparent 60%)',
              mixBlendMode: 'screen',
            }}
          />

          {/* Active WebCodecs Video Canvas */}
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={(e) => e.preventDefault()}
            className={`w-full h-full cursor-pointer touch-none transition-opacity duration-200 ${
              isStreaming ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
            }`}
          />

          {/* Feature #3: Context-Aware Gamepad Overlay (Renders ONLY when game is active) */}
          <GamepadOverlay
            isVisible={isGameActive}
            activePackage={activePackage}
            onSendKey={onSendKey}
            onTap={onTap}
            onSwipe={onSwipe}
            onClose={() => onCloseGamepad?.()}
          />

          {/* Feature #2: Drag & Drop Sideloading Target Overlay */}
          {isDragOver && (
            <div className="absolute inset-0 z-40 bg-indigo-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center border-4 border-dashed border-indigo-400 rounded-[2.6rem] animate-in fade-in duration-150">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/30 border border-indigo-400/50 flex items-center justify-center text-indigo-300 mb-3 shadow-[0_0_30px_rgba(99,102,241,0.5)] animate-bounce">
                <UploadCloud className="w-9 h-9" />
              </div>
              <h3 className="text-base font-extrabold text-white tracking-wide">
                Drop to Transfer
              </h3>
              <p className="text-xs text-indigo-200 mt-1 max-w-[220px]">
                • <strong className="text-white">.apk</strong>: Auto-install &amp; launch
                <br />
                • <strong className="text-white">Media/Files</strong>: Push to /sdcard/Download/
              </p>
            </div>
          )}

          {/* Sideload / Uploading Progress Toast */}
          {(isUploading || uploadStatus) && (
            <div className="absolute bottom-6 left-4 right-4 z-40 px-3.5 py-2.5 rounded-2xl bg-slate-900/90 border border-white/20 text-xs text-white backdrop-blur-md shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom duration-200">
              {isUploading ? (
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              ) : uploadStatus?.includes('✔') ? (
                <FileCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="font-semibold truncate">{uploadStatus}</span>
            </div>
          )}

          {/* Disconnected / Ready State Placeholder */}
          {!isStreaming && (
            <div className="flex flex-col items-center justify-center text-center p-6 gap-4 select-none z-10">
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.25)]">
                <Smartphone className="w-10 h-10 opacity-90 drop-shadow-[0_0_12px_rgba(99,102,241,0.6)]" />
                <Sparkles className="w-4 h-4 absolute top-2 right-2 text-indigo-300 animate-pulse" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-indigo-300">
                  Ready to Mirror
                </h3>
                <p className="text-xs text-slate-400 max-w-[250px] leading-relaxed">
                  Select your device and click <strong className="text-indigo-400 font-semibold">Start Mirror</strong> for 60 FPS hardware streaming.
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-300 bg-slate-900/80 px-3.5 py-1.5 rounded-full border border-slate-700/70 shadow-lg backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span>Zero-Latency WebCodecs Ready</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
