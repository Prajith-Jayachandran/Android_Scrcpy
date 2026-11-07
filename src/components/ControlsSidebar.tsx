import React, { useState } from 'react';
import { ArrowLeft, Circle, Square, Power, Volume2, Volume1, Send, Camera, Sun } from 'lucide-react';

interface ControlsSidebarProps {
  isStreaming: boolean;
  onSendKey: (keyCode: number) => void;
  onSendText: (text: string) => void;
}

export const ControlsSidebar: React.FC<ControlsSidebarProps> = ({
  isStreaming,
  onSendKey,
  onSendText,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText);
    setInputText('');
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
      {/* Navigation Buttons */}
      <div>
        <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-400 mb-3">
          Navigation
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onSendKey(4)}
            disabled={!isStreaming}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 text-slate-300 hover:text-white transition disabled:opacity-40"
            title="Back (ESC / Keycode 4)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[11px] font-medium">Back</span>
          </button>

          <button
            onClick={() => onSendKey(3)}
            disabled={!isStreaming}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 text-slate-300 hover:text-white transition disabled:opacity-40"
            title="Home (Keycode 3)"
          >
            <Circle className="w-4 h-4" />
            <span className="text-[11px] font-medium">Home</span>
          </button>

          <button
            onClick={() => onSendKey(187)}
            disabled={!isStreaming}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 text-slate-300 hover:text-white transition disabled:opacity-40"
            title="App Switcher (Keycode 187)"
          >
            <Square className="w-4 h-4" />
            <span className="text-[11px] font-medium">Recents</span>
          </button>
        </div>
      </div>

      {/* Hardware Buttons */}
      <div>
        <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-400 mb-3">
          Hardware Keys
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onSendKey(26)}
            disabled={!isStreaming}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-red-500/50 hover:bg-slate-800/60 text-slate-300 hover:text-red-400 transition disabled:opacity-40"
            title="Power Key (Keycode 26)"
          >
            <Power className="w-4 h-4" />
            <span className="text-[11px] font-medium">Power</span>
          </button>

          <button
            onClick={() => onSendKey(24)}
            disabled={!isStreaming}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 text-slate-300 hover:text-white transition disabled:opacity-40"
            title="Volume Up (Keycode 24)"
          >
            <Volume2 className="w-4 h-4" />
            <span className="text-[11px] font-medium">Vol +</span>
          </button>

          <button
            onClick={() => onSendKey(25)}
            disabled={!isStreaming}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60 text-slate-300 hover:text-white transition disabled:opacity-40"
            title="Volume Down (Keycode 25)"
          >
            <Volume1 className="w-4 h-4" />
            <span className="text-[11px] font-medium">Vol -</span>
          </button>
        </div>
      </div>

      {/* Text Input Sender */}
      <div>
        <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-400 mb-3">
          Text Input Injection
        </h3>
        <form onSubmit={handleSendText} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={!isStreaming}
            placeholder="Type text to send..."
            className="flex-1 bg-slate-950/80 border border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!isStreaming || !inputText.trim()}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40 flex items-center justify-center"
            title="Send Text"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[11px] text-slate-500 mt-1.5">
          Or click directly inside the screen and type on your keyboard.
        </p>
      </div>

      {/* Extra Utilities */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
        <button
          onClick={() => onSendKey(224)}
          disabled={!isStreaming}
          className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-950/50 border border-slate-800 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 text-xs transition disabled:opacity-40"
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Wake Screen</span>
        </button>

        <button
          onClick={() => onSendKey(120)}
          disabled={!isStreaming}
          className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-950/50 border border-slate-800 hover:bg-slate-800/50 text-slate-400 hover:text-slate-200 text-xs transition disabled:opacity-40"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Screenshot</span>
        </button>
      </div>
    </div>
  );
};
