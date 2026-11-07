import React, { useRef, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { StreamMeta } from '../lib/types';

interface ScreenViewerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  meta: StreamMeta | null;
  onTouch: (action: 'down' | 'move' | 'up', x: number, y: number) => void;
  onScroll: (x: number, y: number, vScroll: number) => void;
  onSendKey: (keyCode: number) => void;
  onSendText: (text: string) => void;
}

export const ScreenViewer: React.FC<ScreenViewerProps> = ({
  canvasRef,
  isStreaming,
  meta,
  onTouch,
  onScroll,
  onSendKey,
  onSendText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isPointerDownRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);

  // Pixel-perfect mapping from canvas client coordinates to stream resolution
  const mapCoordinates = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const relY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const targetWidth = meta?.width || 1080;
    const targetHeight = meta?.height || 2400;

    return {
      x: Math.round(relX * targetWidth),
      y: Math.round(relY * targetHeight),
    };
  };

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
    if (e.button !== 0) return; // Only track primary button

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    isPointerDownRef.current = true;
    const coords = mapCoordinates(e.clientX, e.clientY);
    onTouch('down', coords.x, coords.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isStreaming || !isPointerDownRef.current) return;

    const coords = mapCoordinates(e.clientX, e.clientY);
    onTouch('move', coords.x, coords.y);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isStreaming || !isPointerDownRef.current) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    isPointerDownRef.current = false;
    const coords = mapCoordinates(e.clientX, e.clientY);
    onTouch('up', coords.x, coords.y);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!isStreaming) return;
    const coords = mapCoordinates(e.clientX, e.clientY);
    const vScroll = e.deltaY < 0 ? 1 : -1;
    onScroll(coords.x, coords.y, vScroll);
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

        {/* Screen Display Container - dynamic aspect ratio matching stream */}
        <div
          className="relative rounded-[2.4rem] bg-black overflow-hidden flex items-center justify-center shadow-inner border border-slate-800/80 transition-all"
          style={{
            height: 'min(76vh, 740px)',
            aspectRatio: meta ? `${meta.width} / ${meta.height}` : '9 / 19.5',
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
            onWheel={handleWheel}
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
                  Select an authorized device and click <strong className="text-indigo-400">Start Mirror</strong> to launch the 60 FPS hardware stream.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800/60">
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                <span>Native Control Active</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
