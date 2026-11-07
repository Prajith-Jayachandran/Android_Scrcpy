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
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col flex-1 min-h-[180px]">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            System Logs
          </h3>
        </div>
        <button
          onClick={onClearLogs}
          className="text-xs text-slate-500 hover:text-slate-300 transition flex items-center gap-1"
          title="Clear Console"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-1 pr-1 max-h-[220px]"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">No logs recorded yet.</div>
        ) : (
          logs.map((log) => {
            const isError = log.message.toLowerCase().includes('error') || log.message.toLowerCase().includes('fail');
            const isSystem = log.message.toLowerCase().includes('ready') || log.message.toLowerCase().includes('connected') || log.message.toLowerCase().includes('stream');

            return (
              <div
                key={log.id}
                className={`break-all ${
                  isError
                    ? 'text-red-400'
                    : isSystem
                    ? 'text-indigo-400'
                    : 'text-slate-400'
                }`}
              >
                <span className="text-slate-600 mr-1.5">
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
