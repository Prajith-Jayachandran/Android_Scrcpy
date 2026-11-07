import React from 'react';
import { DeviceInfo } from '../lib/types';
import { Smartphone, RefreshCw, Play, Square, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

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
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-300">
            Device Manager
          </h2>
        </div>
        <button
          onClick={onRefresh}
          disabled={isScanning || isStreaming}
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 hover:text-slate-100 transition disabled:opacity-40"
          title="Refresh ADB Devices"
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>

      {/* Device Selector */}
      <div className="flex flex-col gap-2">
        <select
          value={selectedDeviceId}
          onChange={(e) => onSelectDevice(e.target.value)}
          disabled={isStreaming || devices.length === 0}
          className="w-full bg-slate-950/80 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 transition disabled:opacity-50 cursor-pointer"
        >
          {devices.length === 0 ? (
            <option value="">No devices connected</option>
          ) : (
            devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.model || device.product || device.id} ({device.status})
              </option>
            ))
          )}
        </select>

        {/* Status Badge */}
        <div className="flex items-center gap-2 text-xs pt-1">
          {selectedDevice ? (
            selectedDevice.status === 'device' ? (
              <div className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-full">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Authorized & Ready</span>
              </div>
            ) : selectedDevice.status === 'unauthorized' ? (
              <div className="inline-flex items-center gap-1.5 text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2.5 py-1 rounded-full">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Authorize on Device Screen</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-slate-400 bg-slate-800/40 border border-slate-700/40 px-2.5 py-1 rounded-full">
                <XCircle className="w-3.5 h-3.5" />
                <span>Offline</span>
              </div>
            )
          ) : (
            <div className="inline-flex items-center gap-1.5 text-slate-500 bg-slate-800/30 px-2.5 py-1 rounded-full">
              <span>No device selected</span>
            </div>
          )}
        </div>
      </div>

      {/* Streaming Action Controls */}
      <div className="grid grid-cols-2 gap-2.5 pt-2">
        <button
          onClick={onStartStream}
          disabled={isStreaming || !selectedDeviceId || selectedDevice?.status !== 'device'}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/25 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Start Mirror</span>
        </button>

        <button
          onClick={onStopStream}
          disabled={!isStreaming}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Square className="w-4 h-4 fill-current" />
          <span>Stop</span>
        </button>
      </div>
    </div>
  );
};
