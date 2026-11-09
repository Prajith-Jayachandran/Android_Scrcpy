'use client';

import React from 'react';
import {
  Smartphone,
  Usb,
  Layers,
  Eye,
  EyeOff,
  LayoutGrid,
  Volume2,
  VolumeX,
  PictureInPicture2,
  Activity,
} from 'lucide-react';
import { DeviceInfo } from '@/lib/types';

interface DeviceTabBarProps {
  devices: DeviceInfo[];
  activeDeviceId: string;
  streamingDeviceIds: Set<string>;
  syncAll: boolean;
  privacyMode: boolean;
  viewMode: 'tabs' | 'split';
  isAudioToPc?: boolean;
  audioLevel?: number;
  isPipActive?: boolean;
  isPipSupported?: boolean;
  latencyMs?: number;
  qualityTier?: string;
  onSelectTab: (deviceId: string) => void;
  onToggleSync: () => void;
  onTogglePrivacy: () => void;
  onToggleViewMode: () => void;
  onToggleAudio?: () => void;
  onOpenPip?: () => void;
}

export const DeviceTabBar: React.FC<DeviceTabBarProps> = ({
  devices,
  activeDeviceId,
  streamingDeviceIds,
  syncAll,
  privacyMode,
  viewMode,
  isAudioToPc = false,
  audioLevel = 0,
  isPipActive = false,
  isPipSupported = true,
  latencyMs,
  qualityTier,
  onSelectTab,
  onToggleSync,
  onTogglePrivacy,
  onToggleViewMode,
  onToggleAudio,
  onOpenPip,
}) => {
  // If no devices connected, show a clean placeholder
  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-between px-4 py-2 mb-3 rounded-2xl ultra-glass border border-white/10 w-full max-w-5xl mx-auto text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>No USB devices connected. Plug in a phone with USB debugging enabled.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 mb-3 rounded-2xl ultra-glass border border-white/10 w-full max-w-5xl mx-auto shadow-2xl backdrop-blur-xl">
      {/* Device Tabs (Oppo = Tab 1, Vivo = Tab 2, etc.) */}
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
        {devices.map((device, index) => {
          const tabNumber = index + 1;
          const isActive = device.id === activeDeviceId;
          const isStreaming = streamingDeviceIds.has(device.id);
          const brand = device.model || device.product || 'Android Device';

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

              {/* USB Hardware Icon */}
              <Usb className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`} />

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
      </div>

      {/* Global Toolbar: Multi-View Toggle, Audio, PiP, Multi-Box & Privacy Mode */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Latency & Quality Indicator Pill */}
        {typeof latencyMs === 'number' && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono bg-white/5 border border-white/10 text-slate-300"
            title={`Adaptive Bitrate & Latency Monitor: ${latencyMs}ms RTT (${qualityTier || 'auto'})`}
          >
            <Activity className="w-3 h-3 text-indigo-400" />
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                latencyMs < 35
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : latencyMs < 75
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
            />
            <span className="font-semibold">{latencyMs}ms</span>
            {qualityTier && (
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold hidden sm:inline">
                {qualityTier}
              </span>
            )}
          </div>
        )}

        {/* Feature: Audio Destination Switch (PC Speaker vs Physical Phone Speaker) */}
        {onToggleAudio && (
          <button
            onClick={onToggleAudio}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isAudioToPc
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-white/10 hover:bg-white/10'
            }`}
            title="Toggle audio output: PC speakers via Web Audio API or Physical Phone Speaker"
          >
            {isAudioToPc ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">Audio: PC</span>
                {audioLevel > 0 && (
                  <span className="flex items-center gap-0.5 ml-1">
                    <span
                      className="w-1 bg-emerald-400 rounded-full animate-pulse"
                      style={{ height: `${Math.max(4, Math.min(12, (audioLevel / 100) * 12))}px` }}
                    />
                    <span
                      className="w-1 bg-emerald-400 rounded-full animate-pulse delay-75"
                      style={{ height: `${Math.max(4, Math.min(10, (audioLevel / 100) * 10))}px` }}
                    />
                    <span
                      className="w-1 bg-emerald-400 rounded-full animate-pulse delay-150"
                      style={{ height: `${Math.max(4, Math.min(14, (audioLevel / 100) * 14))}px` }}
                    />
                  </span>
                )}
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Audio: Phone</span>
              </>
            )}
          </button>
        )}

        {/* Feature: Picture-in-Picture (PiP) Pop-Out Mode */}
        {onOpenPip && isPipSupported && (
          <button
            onClick={onOpenPip}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isPipActive
                ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/60 shadow-[0_0_20px_rgba(99,102,241,0.4)]'
                : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-white/10 hover:bg-white/10'
            }`}
            title="Pop out floating Document Picture-in-Picture window with live 60 FPS mirror and controls"
          >
            <PictureInPicture2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isPipActive ? 'PiP Active' : 'PiP'}</span>
          </button>
        )}

        {/* Parallel Multi-View / Side-by-Side Toggle */}
        {devices.length > 1 && (
          <button
            onClick={onToggleViewMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewMode === 'split'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-white/10 hover:bg-white/10'
            }`}
            title="Toggle between Single Tab View and Parallel Side-by-Side View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {viewMode === 'split' ? 'Side-by-Side (2 Active)' : 'Split View'}
            </span>
          </button>
        )}

        {/* Synchronized Multi-Boxing (Replicate inputs proportionally across all devices) */}
        <button
          onClick={onToggleSync}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            syncAll
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse'
              : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-white/10 hover:bg-white/10'
          }`}
          title="Synchronized Multi-Boxing: Replicates touch, swipe, and key gestures proportionally across all devices simultaneously"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{syncAll ? 'Multi-Box: ON' : 'Multi-Box'}</span>
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
