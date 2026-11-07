'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Smartphone, Sparkles } from 'lucide-react';
import { StreamMeta } from '../lib/types';

interface ScreenViewerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  meta: StreamMeta | null;
  onTap: (x: number, y: number) => void;
  onSwipe: (x1: number, y1: number, x2: number, y2: number, duration: number) => void;
  onSendKey: (keyCode: number) => void;
  onSendText: (text: string) => void;
}

export const ScreenViewer: React.FC<ScreenViewerProps> = ({
  canvasRef,
  isStreaming,
  meta,
  onTap,
  onSwipe,
  onSendKey,
  onSendText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // 3D Parallax Tilt state
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });

  const lastWheelTimeRef = useRef<number>(0);
  const wheelAccumulatorRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const wheelResetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Smooth 3D tilt responding to mouse position
  useEffect(() => {
    let targetRx = 0;
    let targetRy = 0;
    let targetGx = 50;
    let targetGy = 50;
    let currentRx = 0;
    let currentRy = 0;
    let currentGx = 50;
    let currentGy = 50;
    let animId: number;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nx = (e.clientX - w / 2) / (w / 2); // -1 to +1
      const ny = (e.clientY - h / 2) / (h / 2); // -1 to +1

      // Subtle, elegant 3D tilt (max 8.5 degrees)
      targetRy = nx * 7.5;
      targetRx = -ny * 7.5;
      targetGx = 50 + nx * 35;
      targetGy = 50 + ny * 35;
    };

    const loop = () => {
      currentRx += (targetRx - currentRx) * 0.08;
      currentRy += (targetRy - currentRy) * 0.08;
      currentGx += (targetGx - currentGx) * 0.08;
      currentGy += (targetGy - currentGy) * 0.08;

      setTilt({
        rx: Math.round(currentRx * 100) / 100,
        ry: Math.round(currentRy * 100) / 100,
        gx: Math.round(currentGx * 10) / 10,
        gy: Math.round(currentGy * 10) / 10,
      });

      animId = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', handleWindowMouseMove, { passive: true });
    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Exact 1:1 mapping from canvas click coordinates to physical device screen resolution
  const mapCoordinates = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    // Target the phone's physical hardware screen resolution (e.g. 1080x2373)
    const targetWidth = meta?.physicalWidth || 1080;
    const targetHeight = meta?.physicalHeight || 2373;

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
      // Prevent browser page from scrolling while swiping on the phone
      e.preventDefault();

      const now = Date.now();
      // Enforce 160ms cooldown between swipes to allow Android fling animation to run cleanly
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

      // Minimum threshold before triggering swipe
      if (absX < 20 && absY < 20) return;

      lastWheelTimeRef.current = now;
      wheelAccumulatorRef.current = { dx: 0, dy: 0 };

      const coords = mapCoordinates(e.clientX, e.clientY);
      const targetW = meta?.physicalWidth || 1080;
      const targetH = meta?.physicalHeight || 2373;
      const cx = Math.max(150, Math.min(targetW - 150, coords.x || targetW / 2));
      const cy = Math.max(350, Math.min(targetH - 350, coords.y || targetH / 2));

      if (absY >= absX) {
        // Vertical swipe (Up / Down)
        const swipeDist = Math.round(targetH * 0.28);
        if (dy > 0) {
          // Swiped UP on mousepad -> Scroll DOWN on phone
          const startY = Math.min(targetH - 180, cy + Math.round(swipeDist / 2));
          const endY = Math.max(180, cy - Math.round(swipeDist / 2));
          onSwipe(cx, startY, cx, endY, 150);
        } else {
          // Swiped DOWN on mousepad -> Scroll UP on phone
          const startY = Math.max(180, cy - Math.round(swipeDist / 2));
          const endY = Math.min(targetH - 180, cy + Math.round(swipeDist / 2));
          onSwipe(cx, startY, cx, endY, 150);
        }
      } else {
        // Horizontal swipe (Left / Right)
        const swipeDistX = Math.round(targetW * 0.50);
        if (dx > 0) {
          // Swiped LEFT on mousepad -> Scroll RIGHT on phone
          const startX = Math.min(targetW - 80, cx + Math.round(swipeDistX / 2));
          const endX = Math.max(80, cx - Math.round(swipeDistX / 2));
          onSwipe(startX, cy, endX, cy, 150);
        } else {
          // Swiped RIGHT on mousepad -> Scroll LEFT on phone
          const startX = Math.max(80, cx - Math.round(swipeDistX / 2));
          const endX = Math.min(targetW - 80, cx + Math.round(swipeDistX / 2));
          onSwipe(startX, cy, endX, cy, 150);
        }
      }
    };

    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelNative);
    };
  }, [isStreaming, meta, onSwipe]);

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

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onKeyDown={handleKeyDown}
      className={`relative flex items-center justify-center p-4 outline-none transition-all duration-300 ${
        isFocused ? 'ring-2 ring-indigo-500/40 rounded-[3.5rem]' : ''
      }`}
      style={{
        perspective: '1400px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* 3D Floating Ground Reflection / Ambient Glow */}
      <div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[70%] h-14 rounded-full pointer-events-none transition-transform duration-75 ease-out"
        style={{
          background: 'radial-gradient(ellipse, rgba(99, 102, 241, 0.28) 0%, rgba(168, 85, 247, 0.12) 40%, transparent 70%)',
          transform: `translateX(-50%) translateZ(-90px) rotateX(70deg) rotateZ(${-tilt.ry * 0.7}deg) scale(${
            1 + Math.abs(tilt.ry) * 0.01
          })`,
          filter: 'blur(16px)',
        }}
      />

      {/* 3D Smartphone Chassis Mockup with Titanium Chamfered Bezel */}
      <div
        className="relative rounded-[3.4rem] p-3.5 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 border-[5px] border-slate-600/70 shadow-[0_35px_90px_-15px_rgba(0,0,0,0.95),0_0_50px_rgba(99,102,241,0.18)] flex flex-col items-center justify-center transition-transform duration-75 ease-out chassis-titanium-3d"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Antenna Lines on Frame */}
        <div className="absolute -left-1.5 top-20 w-1.5 h-3 bg-slate-500/80 rounded-l" />
        <div className="absolute -left-1.5 bottom-20 w-1.5 h-3 bg-slate-500/80 rounded-l" />
        <div className="absolute -right-1.5 top-20 w-1.5 h-3 bg-slate-500/80 rounded-l" />
        <div className="absolute -right-1.5 bottom-20 w-1.5 h-3 bg-slate-500/80 rounded-l" />

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
            aspectRatio: meta ? `${meta.physicalWidth || meta.width} / ${meta.physicalHeight || meta.height}` : '9 / 19.5',
            maxWidth: '100%',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Dynamic Specular Glass Glare that shifts with mouse 3D tilt */}
          <div
            className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-200"
            style={{
              background: `radial-gradient(circle 500px at ${tilt.gx}% ${tilt.gy}%, rgba(255, 255, 255, 0.08), transparent 70%), linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, transparent 40%)`,
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
