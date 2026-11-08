'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Circle,
  Square,
  Volume2,
  Volume1,
  Send,
  Camera,
  Sun,
  Sparkles,
  Clipboard,
  Gamepad2,
  Eye,
  EyeOff
} from 'lucide-react';

interface ControlsSidebarProps {
  isStreaming: boolean;
  isGameActive?: boolean;
  privacyMode?: boolean;
  onSendKey: (keyCode: number) => void;
  onSendText: (text: string) => void;
  onClipboardPaste?: (text: string) => void;
  onToggleGamepad?: () => void;
  onTogglePrivacy?: () => void;
}

export const ControlsSidebar: React.FC<ControlsSidebarProps> = ({
  isStreaming,
  isGameActive = false,
  privacyMode = false,
  onSendKey,
  onSendText,
  onClipboardPaste,
  onToggleGamepad,
  onTogglePrivacy,
}) => {
  const [inputText, setInputText] = useState('');
  const [clipboardToast, setClipboardToast] = useState(false);

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText);
    setInputText('');
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && onClipboardPaste) {
        onClipboardPaste(text);
        setClipboardToast(true);
        setTimeout(() => setClipboardToast(false), 2000);
      }
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  };

  return (
    <div className="ultra-glass-card rounded-2xl p-5 flex flex-col gap-5 relative overflow-hidden">
      {/* Decorative ambient top glow */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

      {/* Navigation Buttons */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            System Navigation
          </h3>
          <span className="text-[10px] text-indigo-400 font-mono">1:1 ADB</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => onSendKey(4)}
            disabled={!isStreaming}
            className="btn-3d-hardware flex flex-col items-center gap-1.5 p-3 rounded-xl text-slate-300 hover:text-indigo-300 transition-all disabled:opacity-40"
            title="Back (ESC / Keycode 4)"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-semibold">Back</span>
          </button>

          <button
            onClick={() => onSendKey(3)}
            disabled={!isStreaming}
            className="btn-3d-hardware flex flex-col items-center gap-1.5 p-3 rounded-xl text-slate-300 hover:text-cyan-300 transition-all disabled:opacity-40"
            title="Home (Keycode 3)"
          >
            <Circle className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] font-semibold">Home</span>
          </button>

          <button
            onClick={() => onSendKey(187)}
            disabled={!isStreaming}
            className="btn-3d-hardware flex flex-col items-center gap-1.5 p-3 rounded-xl text-slate-300 hover:text-purple-300 transition-all disabled:opacity-40"
            title="App Switcher (Keycode 187)"
          >
            <Square className="w-4 h-4 text-purple-400" />
            <span className="text-[11px] font-semibold">Recents</span>
          </button>
        </div>
      </div>

      {/* Hardware Triggers */}
      <div>
        <h3 className="text-xs font-bold tracking-wider uppercase text-slate-200 mb-3">
          Hardware Triggers
        </h3>
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => onSendKey(224)}
            disabled={!isStreaming}
            className="btn-3d-hardware flex flex-col items-center gap-1.5 p-3 rounded-xl text-slate-300 hover:text-amber-300 transition-all disabled:opacity-40"
            title="Wake Screen (Keycode 224)"
          >
            <Sun className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-semibold">Wake</span>
          </button>

          <button
            onClick={() => onSendKey(24)}
            disabled={!isStreaming}
            className="btn-3d-hardware flex flex-col items-center gap-1.5 p-3 rounded-xl text-slate-300 hover:text-indigo-300 transition-all disabled:opacity-40"
            title="Volume Up (Keycode 24)"
          >
            <Volume2 className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-semibold">Vol +</span>
          </button>

          <button
            onClick={() => onSendKey(25)}
            disabled={!isStreaming}
            className="btn-3d-hardware flex flex-col items-center gap-1.5 p-3 rounded-xl text-slate-300 hover:text-indigo-300 transition-all disabled:opacity-40"
            title="Volume Down (Keycode 25)"
          >
            <Volume1 className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px] font-semibold">Vol -</span>
          </button>
        </div>
      </div>

      {/* Feature #6: Smart Clipboard & Fast Text Injection */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Smart Clipboard &amp; Typing
          </h3>
          <button
            onClick={handlePasteClipboard}
            disabled={!isStreaming}
            className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold transition-all disabled:opacity-40"
            title="Paste PC Clipboard Directly Into Active Field"
          >
            <Clipboard className="w-3 h-3" />
            <span>{clipboardToast ? 'Pasted!' : 'Paste from PC'}</span>
          </button>
        </div>

        <form onSubmit={handleSendText} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={!isStreaming}
            placeholder="Type text for device..."
            className="flex-1 bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!isStreaming || !inputText.trim()}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all disabled:opacity-40 flex items-center justify-center shadow-md shadow-indigo-600/30"
            title="Send Text"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>Or focus phone screen and type directly on physical keyboard.</span>
        </p>
      </div>

      {/* Quick Utilities: Gamepad HUD, Privacy Mode, Snapshot */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
        {/* Toggle Gamepad HUD */}
        <button
          onClick={onToggleGamepad}
          disabled={!isStreaming}
          className={`btn-3d-hardware flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-xs transition-all disabled:opacity-40 ${
            isGameActive
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : 'text-slate-300 hover:text-emerald-300'
          }`}
          title="Toggle Contextual Gamepad Overlay"
        >
          <Gamepad2 className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-[10px]">Gamepad</span>
        </button>

        {/* Feature #10: Privacy Mode */}
        <button
          onClick={onTogglePrivacy}
          disabled={!isStreaming}
          className={`btn-3d-hardware flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-xs transition-all disabled:opacity-40 ${
            privacyMode
              ? 'bg-purple-500/25 text-purple-200 border border-purple-400/60 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
              : 'text-slate-300 hover:text-purple-300'
          }`}
          title="Blank physical phone screen while PC stream stays active"
        >
          {privacyMode ? (
            <EyeOff className="w-4 h-4 text-purple-400" />
          ) : (
            <Eye className="w-4 h-4 text-purple-400" />
          )}
          <span className="font-semibold text-[10px]">Privacy</span>
        </button>

        {/* Snapshot */}
        <button
          onClick={() => onSendKey(120)}
          disabled={!isStreaming}
          className="btn-3d-hardware flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-slate-300 hover:text-cyan-300 text-xs transition-all disabled:opacity-40"
          title="Take Screenshot"
        >
          <Camera className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-[10px]">Snapshot</span>
        </button>
      </div>
    </div>
  );
};
