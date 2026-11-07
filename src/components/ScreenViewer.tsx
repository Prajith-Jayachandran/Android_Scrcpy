import React, { useRef, useState, useEffect } from 'react';
import { Smartphone } from 'lucide-react';
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
      className={`relative flex items-center justify-center p-4 outline-none transition-all ${
        isFocused ? 'ring-2 ring-indigo-500/40 rounded-[3.5rem]' : ''
      }`}
    >
      {/* Smartphone Chassis Mockup */}
      <div className="relative rounded-[3.2rem] p-3.5 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-[6px] border-slate-700/80 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(99,102,241,0.08)] flex flex-col items-center justify-center">
        {/* Top Speaker & Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 z-20 pointer-events-none">
          <div className="w-12 h-1 bg-slate-700/90 rounded-full" />
          <div className="w-3.5 h-3.5 bg-slate-950 border border-slate-700 rounded-full flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
          </div>
        </div>

        {/* Screen Display Container - dynamic aspect ratio matching physical screen */}
        <div
          className="relative rounded-[2.4rem] bg-black overflow-hidden flex items-center justify-center shadow-inner border border-slate-800/80 transition-all"
          style={{
            height: 'min(76vh, 740px)',
            aspectRatio: meta ? `${meta.physicalWidth || meta.width} / ${meta.physicalHeight || meta.height}` : '9 / 19.5',
            maxWidth: '100%',
          }}
        >
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
            <div className="flex flex-col items-center justify-center text-center p-6 gap-4 select-none">
              <div className="w-16 h-16 rounded-full bg-slate-900/90 border border-slate-800 flex items-center justify-center text-slate-500 shadow-lg">
                <Smartphone className="w-8 h-8 opacity-70" />
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-base font-semibold text-slate-200">
                  Ready to Mirror
                </h3>
                <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                  Select an authorized device and click <strong className="text-indigo-400">Start Mirror</strong> to launch the safe 60 FPS stream.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800/60">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Safe Hardware Mode Active</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
