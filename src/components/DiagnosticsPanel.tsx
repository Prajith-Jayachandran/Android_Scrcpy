import React from 'react';
import { Activity, Gauge, Cpu, Monitor } from 'lucide-react';
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
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-4 h-4 text-emerald-400" />
        <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-300">
          Stream Telemetry
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px]">
            <span>Framerate</span>
            <Gauge className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-lg font-bold font-mono text-slate-100">
            {isStreaming ? `${fps} FPS` : '--'}
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px]">
            <span>Est. Latency</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold font-mono text-emerald-400">
            {isStreaming ? '~25-35 ms' : '--'}
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px]">
            <span>Resolution</span>
            <Monitor className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xs font-mono font-semibold text-slate-200 mt-1">
            {isStreaming && meta ? `${meta.width} × ${meta.height}` : 'Native 1080p'}
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between text-slate-500 text-[11px]">
            <span>Decoder</span>
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xs font-mono font-semibold text-purple-300 mt-1">
            WebCodecs (GPU)
          </div>
        </div>
      </div>
    </div>
  );
};
