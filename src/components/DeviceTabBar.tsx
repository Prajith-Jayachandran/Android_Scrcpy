'use client';

import React from 'react';
import { Smartphone, Wifi, Usb, Layers, Check, Plus, Eye, EyeOff } from 'lucide-react';
import { DeviceInfo } from '@/lib/types';

interface DeviceTabBarProps {
  devices: DeviceInfo[];
  activeDeviceId: string;
  streamingDeviceIds: Set<string>;
  syncAll: boolean;
  privacyMode: boolean;
  onSelectTab: (deviceId: string) => void;
  onToggleSync: () => void;
  onTogglePrivacy: () => void;
  onOpenWirelessModal: () => void;
}

export const DeviceTabBar: React.FC<DeviceTabBarProps> = ({
  devices,
  activeDeviceId,
  streamingDeviceIds,
  syncAll,
  privacyMode,
  onSelectTab,
  onToggleSync,
  onTogglePrivacy,
  onOpenWirelessModal,
}) => {
  // If no devices connected, show a placeholder
  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-between px-4 py-2 mb-3 rounded-2xl ultra-glass border border-white/10 w-full max-w-4xl mx-auto text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>No devices linked. Connect via USB or Wi-Fi to start.</span>
        </div>
        <button
          onClick={onOpenWirelessModal}
          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs transition-all"
        >
          <Wifi className="w-3.5 h-3.5" />
          <span>Connect Wi-Fi</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 mb-3 rounded-2xl ultra-glass border border-white/10 w-full max-w-4xl mx-auto shadow-2xl backdrop-blur-xl">
      {/* Device Tabs (Oppo = 1, Vivo = 2, etc.) */}
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
        {devices.map((device, index) => {
          const tabNumber = index + 1;
          const isActive = device.id === activeDeviceId;
          const isStreaming = streamingDeviceIds.has(device.id);
          const isWireless = device.id.includes(':') || device.id.includes('.');
          const brand = device.model || device.product || (isWireless ? 'Wireless Device' : 'Android Device');

          return (
            <button
              key={device.id}
              onClick={() => onSelectTab(device.id)}
              className={`group relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600/90 to-purple-600/90 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-indigo-400/50'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
              }`}
            >
              {/* Tab Number Badge (e.g. 1, 2) */}
              <span
                className={`w-5 h-5 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold ${
                  isActive ? 'bg-white/25 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {tabNumber}
              </span>

              {/* Connection Type Icon */}
              {isWireless ? (
                <Wifi className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-200' : 'text-cyan-400'}`} />
              ) : (
                <Usb className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`} />
              )}

              {/* Device Brand & Model Name */}
              <span className="font-semibold tracking-tight whitespace-nowrap">
                {brand}
              </span>

              {/* Streaming Online Indicator */}
              {isStreaming && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              )}
            </button>
          );
        })}

        {/* Add Wireless Device Tab Button */}
        <button
          onClick={onOpenWirelessModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-dashed border-white/20 text-xs font-semibold transition-all whitespace-nowrap"
          title="Add Device via Wi-Fi Pairing / IP"
        >
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          <span>New Link</span>
        </button>
      </div>

      {/* Global Toolbar: Mirror Sync & Quick Privacy Mode */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Mirror Sync (Broadcast inputs to all tabs) */}
        <button
          onClick={onToggleSync}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            syncAll
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse'
              : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-white/10 hover:bg-white/10'
          }`}
          title="Synchronize all touch, swipe, and keyboard inputs across every open device tab"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sync Input</span>
        </button>

        {/* Feature #10: Quick-Draw Privacy Mode */}
        <button
          onClick={onTogglePrivacy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            privacyMode
              ? 'bg-purple-500/25 text-purple-200 border border-purple-400/60 shadow-[0_0_20px_rgba(168,85,247,0.4)]'
              : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-white/10 hover:bg-white/10'
          }`}
          title="Turn off physical phone display while PC 60 FPS mirror and controls remain 100% active"
        >
          {privacyMode ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-purple-300" />
              <span className="text-[11px] text-purple-200 font-bold">Privacy ON</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Privacy Mode</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
