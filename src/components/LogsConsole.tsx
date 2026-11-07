'use client';

import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import { LogMessage } from '../lib/types';

interface LogsConsoleProps {
  logs: LogMessage[];
  onClearLogs: () => void;
}

export const LogsConsole: React.FC<LogsConsoleProps> = ({ logs, onClearLogs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="ultra-glass-card rounded-2xl p-4 flex flex-col flex-1 min-h-[180px] relative overflow-hidden">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <h3 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Console Stream
          </h3>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <button
          onClick={onClearLogs}
          className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-800/60"
          title="Clear Console"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear</span>
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-1 pr-1 max-h-[220px] scrollbar-thin select-text"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">Waiting for pipeline events...</div>
        ) : (
          logs.map((log) => {
            const isError = log.message.toLowerCase().includes('error') || log.message.toLowerCase().includes('fail');
            const isSystem = log.message.toLowerCase().includes('ready') || log.message.toLowerCase().includes('connected') || log.message.toLowerCase().includes('stream');

            return (
              <div
                key={log.id}
                className={`break-all ${
                  isError
                    ? 'text-rose-400'
                    : isSystem
                    ? 'text-cyan-300'
                    : 'text-slate-400'
                }`}
              >
                <span className="text-slate-500 mr-1.5 font-normal">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                {log.message}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
