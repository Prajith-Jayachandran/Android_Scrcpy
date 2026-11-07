'use client';

import React from 'react';
import { DeviceInfo } from '../lib/types';
import { Smartphone, RefreshCw, Play, Square, CheckCircle, AlertTriangle, XCircle, Cpu } from 'lucide-react';

interface DeviceManagerProps {
  devices: DeviceInfo[];
  selectedDeviceId: string;
  onSelectDevice: (id: string) => void;
  onRefresh: () => void;
  isScanning: boolean;
  isStreaming: boolean;
  onStartStream: () => void;
  onStopStream: () => void;
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onRefresh,
  isScanning,
  isStreaming,
  onStartStream,
  onStopStream,
}) => {
  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);

  return (
    <div className="ultra-glass-card rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden group">
      {/* Decorative ambient top glow line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-wider uppercase text-slate-200">
              Target Device
            </h2>
            <p className="text-[10px] text-slate-400">USB / Wi-Fi ADB Link</p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isScanning || isStreaming}
          className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/60 text-slate-300 hover:text-white transition-all disabled:opacity-40 shadow-sm"
          title="Refresh ADB Devices"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>

      {/* Device Selector */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <select
            value={selectedDeviceId}
            onChange={(e) => onSelectDevice(e.target.value)}
            disabled={isStreaming || devices.length === 0}
            className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50 cursor-pointer appearance-none"
          >
            {devices.length === 0 ? (
              <option value="">No devices connected</option>
            ) : (
              devices.map((device) => (
                <option key={device.id} value={device.id} className="bg-slate-900 text-slate-100">
                  {device.model || device.product || device.id} ({device.status})
                </option>
              ))
            )}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
            ▼
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 pt-0.5">
          {selectedDevice ? (
            selectedDevice.status === 'device' ? (
              <div className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-full text-[11px] shadow-[0_0_12px_rgba(16,185,129,0.15)] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Ready • ColorOS 16 Link</span>
              </div>
            ) : selectedDevice.status === 'unauthorized' ? (
              <div className="inline-flex items-center gap-1.5 text-amber-400 bg-amber-950/40 border border-amber-500/30 px-3 py-1 rounded-full text-[11px] font-medium">
                <AlertTriangle className="w-3 h-3" />
                <span>Confirm RSA Popup on Phone</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-slate-400 bg-slate-800/40 border border-slate-700/40 px-3 py-1 rounded-full text-[11px]">
                <XCircle className="w-3 h-3" />
                <span>Device Offline</span>
              </div>
            )
          ) : (
            <div className="inline-flex items-center gap-1.5 text-slate-500 bg-slate-900/40 px-3 py-1 rounded-full text-[11px]">
              <span>Waiting for connection...</span>
            </div>
          )}
        </div>
      </div>

      {/* Streaming Action Controls */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <button
          onClick={onStartStream}
          disabled={isStreaming || !selectedDeviceId || selectedDevice?.status !== 'device'}
          className="relative group/btn flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs transition-all shadow-[0_4px_20px_rgba(99,102,241,0.35)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none overflow-hidden"
        >
          {/* Glass sheen on button hover */}
          <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover/btn:translate-x-[300%] transition-transform duration-1000 ease-in-out pointer-events-none" />
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Start Mirror</span>
        </button>

        <button
          onClick={onStopStream}
          disabled={!isStreaming}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/80 hover:bg-rose-950/40 border border-slate-700/80 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 font-semibold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop Stream</span>
        </button>
      </div>
    </div>
  );
};
