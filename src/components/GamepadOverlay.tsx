'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Crosshair, Move, Settings2, X, Lock, Unlock, Play } from 'lucide-react';
import { GamepadButtonConfig } from '@/lib/types';

interface GamepadOverlayProps {
  isVisible: boolean;
  activePackage?: string;
  onSendKey: (keyCode: number) => void;
  onTap: (x: number, y: number) => void;
  onSwipe: (x1: number, y1: number, x2: number, y2: number, duration: number) => void;
  onClose: () => void;
}

const DEFAULT_BUTTONS: GamepadButtonConfig[] = [
  { id: 'jump', label: 'SPACE', key: ' ', xPercent: 88, yPercent: 78, type: 'button' },
  { id: 'reload', label: 'R', key: 'r', xPercent: 88, yPercent: 62, type: 'button' },
  { id: 'crouch', label: 'C', key: 'c', xPercent: 78, yPercent: 88, type: 'button' },
  { id: 'fire', label: 'FIRE', key: 'f', xPercent: 76, yPercent: 65, type: 'button' },
];

export const GamepadOverlay: React.FC<GamepadOverlayProps> = ({
  isVisible,
  activePackage,
  onSendKey,
  onTap,
  onSwipe,
  onClose,
}) => {
  const [isAimLocked, setIsAimLocked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [buttons, setButtons] = useState<GamepadButtonConfig[]>(DEFAULT_BUTTONS);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  const overlayRef = useRef<HTMLDivElement>(null);

  // Load custom layout from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aether_gamepad_layout');
      if (saved) {
        setButtons(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  const saveLayout = (newButtons: GamepadButtonConfig[]) => {
    setButtons(newButtons);
    try {
      localStorage.setItem('aether_gamepad_layout', JSON.stringify(newButtons));
    } catch (e) {}
  };

  // Keyboard handler for WASD joystick and action buttons
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle aim lock with F1 or ~
      if (e.key === 'F1' || e.key === '`') {
        e.preventDefault();
        togglePointerLock();
        return;
      }

      const key = e.key.toLowerCase();
      setActiveKeys((prev) => new Set(prev).add(key));

      // Check configured buttons
      const btn = buttons.find((b) => b.key.toLowerCase() === key);
      if (btn) {
        // Trigger tap at mapped percentage
        const screenW = 1080;
        const screenH = 2373;
        const targetX = (btn.xPercent / 100) * screenW;
        const targetY = (btn.yPercent / 100) * screenH;
        onTap(targetX, targetY);
      }

      // WASD Directional Touch Movement
      if (key === 'w') {
        onSwipe(250, 1800, 250, 1600, 120); // Move Up
      } else if (key === 's') {
        onSwipe(250, 1600, 250, 1800, 120); // Move Down
      } else if (key === 'a') {
        onSwipe(250, 1700, 150, 1700, 120); // Move Left
      } else if (key === 'd') {
        onSwipe(150, 1700, 250, 1700, 120); // Move Right
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isVisible, buttons, onTap, onSwipe]);

  // Mouse Aim Lock (Pointer Lock API)
  const togglePointerLock = () => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
      setIsAimLocked(false);
    } else {
      overlayRef.current?.requestPointerLock();
      setIsAimLocked(true);
    }
  };

  useEffect(() => {
    const handlePointerLockChange = () => {
      setIsAimLocked(!!document.pointerLockElement);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;

      // Mouse movements in pointer lock translate into camera swipes in the aim area
      const dx = e.movementX;
      const dy = e.movementY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        const screenW = 1080;
        const screenH = 2373;
        // Camera swipe centered in right half of screen
        const centerX = Math.round(screenW * 0.72);
        const centerY = Math.round(screenH * 0.52);
        onSwipe(
          centerX,
          centerY,
          centerX + Math.round(dx * 2.2),
          centerY + Math.round(dy * 2.2),
          40
        );
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [onSwipe]);

  // Don't render anything if game is not active
  if (!isVisible) return null;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none z-30 select-none overflow-hidden rounded-[2.6rem]"
    >
      {/* Game HUD Top Bar */}
      <div className="absolute top-8 left-4 right-4 flex items-center justify-between pointer-events-auto bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-2xl border border-white/10 shadow-lg text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-300 tracking-wider uppercase text-[11px]">
            Game Mode Active
          </span>
          {activePackage && (
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              ({activePackage})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Aim Lock Toggle */}
          <button
            onClick={togglePointerLock}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-semibold text-[11px] transition-all ${
              isAimLocked
                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/20'
            }`}
            title="Press F1 to lock mouse aim"
          >
            <Crosshair className="w-3 h-3 text-cyan-400" />
            <span>{isAimLocked ? 'Aim Locked (ESC)' : 'Aim Mode (F1)'}</span>
          </button>

          {/* Edit Layout */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`p-1.5 rounded-xl transition-all ${
              isEditing ? 'bg-indigo-500/30 text-indigo-300' : 'text-slate-400 hover:text-white'
            }`}
            title="Customize on-screen buttons"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>

          {/* Close HUD */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white transition-all"
            title="Hide Gamepad HUD"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Virtual Left Analog Joystick (WASD Indicator) */}
      <div className="absolute left-6 bottom-16 w-28 h-28 rounded-full border-2 border-indigo-400/40 bg-indigo-950/20 backdrop-blur-sm flex items-center justify-center pointer-events-none shadow-[0_0_20px_rgba(99,102,241,0.2)]">
        {/* Direction indicators */}
        <span
          className={`absolute top-2 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
            activeKeys.has('w') ? 'bg-indigo-500 text-white shadow-lg' : 'text-indigo-300/70'
          }`}
        >
          W
        </span>
        <span
          className={`absolute bottom-2 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
            activeKeys.has('s') ? 'bg-indigo-500 text-white shadow-lg' : 'text-indigo-300/70'
          }`}
        >
          S
        </span>
        <span
          className={`absolute left-2 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
            activeKeys.has('a') ? 'bg-indigo-500 text-white shadow-lg' : 'text-indigo-300/70'
          }`}
        >
          A
        </span>
        <span
          className={`absolute right-2 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
            activeKeys.has('d') ? 'bg-indigo-500 text-white shadow-lg' : 'text-indigo-300/70'
          }`}
        >
          D
        </span>
        <div className="w-10 h-10 rounded-full bg-indigo-500/30 border border-indigo-400 flex items-center justify-center text-[10px] font-bold text-white shadow-inner">
          <Move className="w-4 h-4 text-indigo-300 opacity-80" />
        </div>
      </div>

      {/* Action Buttons mapped on screen */}
      {buttons.map((btn) => {
        const isPressed = activeKeys.has(btn.key.toLowerCase());
        return (
          <div
            key={btn.id}
            style={{
              position: 'absolute',
              left: `${btn.xPercent}%`,
              top: `${btn.yPercent}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center border font-bold transition-all pointer-events-auto cursor-pointer ${
              isPressed
                ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white border-white shadow-[0_0_20px_rgba(99,102,241,0.8)] scale-95'
                : 'bg-black/50 backdrop-blur-md text-slate-200 border-white/20 hover:border-indigo-400 hover:text-white'
            }`}
            onClick={() => {
              const screenW = 1080;
              const screenH = 2373;
              onTap((btn.xPercent / 100) * screenW, (btn.yPercent / 100) * screenH);
            }}
          >
            <span className="text-[10px] font-mono leading-none">{btn.label}</span>
            <span className="text-[8px] opacity-60 font-mono mt-0.5">[{btn.key.toUpperCase()}]</span>
          </div>
        );
      })}
    </div>
  );
};
