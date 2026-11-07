'use client';

import React from 'react';
import { Activity, Gauge, Cpu, Monitor, Zap } from 'lucide-react';
import { StreamMeta } from '../lib/types';

interface DiagnosticsPanelProps {
  fps: number;
  meta: StreamMeta | null;
  isStreaming: boolean;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  fps,
  meta,
  isStreaming,
}) => {
  return (
    <div className="ultra-glass-card rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
          <h3 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Hardware Telemetry
          </h3>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
          <Zap className="w-2.5 h-2.5" />
          <span>GPU ACCEL</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {/* FPS Counter */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-1 shadow-inner relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Framerate</span>
            <Gauge className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-lg font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
            {isStreaming ? `${fps} FPS` : '-- FPS'}
          </div>
          {isStreaming && (
            <div className="w-full bg-slate-800/50 h-1 rounded-full overflow-hidden mt-0.5">
              <div
                className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, (fps / 60) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Estimated Latency */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-1 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Est. Latency</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg font-black font-mono tracking-tight text-cyan-400">
            {isStreaming ? '~25 ms' : '-- ms'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {isStreaming ? 'Direct IPC' : 'Standby'}
          </div>
        </div>

        {/* Resolution */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-1 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Resolution</span>
            <Monitor className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xs font-mono font-bold text-slate-200 mt-1">
            {isStreaming && meta ? `${meta.width} × ${meta.height}` : '1080 × 2373'}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Native MediaTek MB
          </div>
        </div>

        {/* Decoder Architecture */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-1 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Pipeline</span>
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xs font-mono font-bold text-purple-300 mt-1">
            Annex-B VideoDecoder
          </div>
          <div className="text-[10px] text-purple-400/80 font-mono">
            Zero Nagle TCP
          </div>
        </div>
      </div>
    </div>
  );
};
