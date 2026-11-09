'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  Menu,
  X,
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

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

  // Count active persistent background modes
  const activeFeaturesCount =
    (syncAll ? 1 : 0) +
    (privacyMode ? 1 : 0) +
    (isAudioToPc ? 1 : 0) +
    (isPipActive ? 1 : 0) +
    (viewMode === 'split' ? 1 : 0);

  return (
    <div className="relative flex items-center justify-between gap-3 px-4 py-2 mb-3 rounded-2xl ultra-glass border border-white/10 w-full max-w-5xl mx-auto shadow-2xl backdrop-blur-xl">
      {/* Primary Bar: Only Device Tabs Visible */}
      <div className="flex-1 flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
        {devices.map((device, index) => {
          const tabNumber = index + 1;
          const isActive = device.id === activeDeviceId;
          const isStreaming = streamingDeviceIds.has(device.id);
          const brand =
            device.model ||
            device.product ||
            (device.status === 'unauthorized' ? `Device (${device.id.substring(0, 8)})` : 'Android Device');

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

              {/* Unauthorized warning or Streaming indicator */}
              {device.status === 'unauthorized' ? (
                <span
                  className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse"
                  title="Unauthorized: Accept USB debugging on phone screen"
                />
              ) : isStreaming ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* 3-Line Picker Menu Container (Anchor for absolute dropdown) */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
            isMenuOpen
              ? 'bg-indigo-600/40 text-white border-indigo-400/60 shadow-[0_0_20px_rgba(99,102,241,0.4)]'
              : activeFeaturesCount > 0
              ? 'bg-white/10 text-slate-100 hover:text-white border-white/20 hover:bg-white/15'
              : 'bg-white/5 text-slate-300 hover:text-white border-white/10 hover:bg-white/10'
          }`}
          title="Workspace Controls & Features"
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? (
            <X className="w-4 h-4 text-indigo-300" />
          ) : (
            <Menu className="w-4 h-4 text-slate-200" />
          )}

          <span className="hidden sm:inline font-mono tracking-tight text-[11px]">
            Controls
          </span>

          {/* Active Features Glow Indicator / Badge */}
          {activeFeaturesCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
              <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-bold border border-emerald-500/30">
                {activeFeaturesCount}
              </span>
            </span>
          )}
        </button>

        {/* 3-Line Picker Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl ultra-glass-card border border-white/15 p-3.5 shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_35px_rgba(99,102,241,0.2)] backdrop-blur-2xl flex flex-col gap-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            {/* Dropdown Header & Telemetry */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Workspace Controls
                </span>
              </div>

              {/* Latency & Quality Indicator Pill */}
              {typeof latencyMs === 'number' && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-mono bg-white/5 border border-white/10 text-slate-300"
                  title={`Adaptive Bitrate & Latency: ${latencyMs}ms RTT (${qualityTier || 'auto'})`}
                >
                  <Activity className="w-3 h-3 text-indigo-400" />
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      latencyMs < 35
                        ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                        : latencyMs < 75
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                  />
                  <span>{latencyMs}ms</span>
                  {qualityTier && (
                    <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">
                      {qualityTier}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Menu Items Container */}
            <div className="flex flex-col gap-1.5">
              {/* Feature 1: Audio Route Switch */}
              {onToggleAudio && (
                <button
                  onClick={onToggleAudio}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isAudioToPc
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                      : 'bg-white/5 text-slate-300 hover:text-white border border-white/5 hover:bg-white/10'
                  }`}
                  title="Toggle audio output: PC speakers via Web Audio API or Physical Phone Speaker"
                >
                  <div className="flex items-center gap-2.5">
                    {isAudioToPc ? (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-400" />
                    )}
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-white">Audio Destination</span>
                      <span className="text-[10px] text-slate-400">
                        {isAudioToPc ? 'Routed to PC Web Audio' : 'Playing on Phone Speaker'}
                      </span>
                    </div>
                  </div>

                  {isAudioToPc ? (
                    <div className="flex items-center gap-1.5">
                      {audioLevel > 0 && (
                        <span className="flex items-center gap-0.5 mr-1">
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
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-200 text-[10px] font-bold font-mono">
                        PC
                      </span>
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-mono">
                      Phone
                    </span>
                  )}
                </button>
              )}

              {/* Feature 2: Picture-in-Picture (PiP) */}
              {onOpenPip && isPipSupported && (
                <button
                  onClick={onOpenPip}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isPipActive
                      ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                      : 'bg-white/5 text-slate-300 hover:text-white border border-white/5 hover:bg-white/10'
                  }`}
                  title="Pop out floating Document Picture-in-Picture window with live 60 FPS mirror and controls"
                >
                  <div className="flex items-center gap-2.5">
                    <PictureInPicture2
                      className={`w-4 h-4 ${isPipActive ? 'text-indigo-300' : 'text-slate-400'}`}
                    />
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-white">Picture-in-Picture</span>
                      <span className="text-[10px] text-slate-400">
                        {isPipActive ? 'Floating window active' : 'Pop out live 60 FPS window'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                      isPipActive ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPipActive ? 'ACTIVE' : 'POP-OUT'}
                  </span>
                </button>
              )}

              {/* Feature 3: Parallel Split View (When > 1 device) */}
              {devices.length > 1 && (
                <button
                  onClick={onToggleViewMode}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    viewMode === 'split'
                      ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                      : 'bg-white/5 text-slate-300 hover:text-white border border-white/5 hover:bg-white/10'
                  }`}
                  title="Toggle between Single Tab View and Parallel Side-by-Side View"
                >
                  <div className="flex items-center gap-2.5">
                    <LayoutGrid
                      className={`w-4 h-4 ${viewMode === 'split' ? 'text-cyan-300' : 'text-slate-400'}`}
                    />
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-white">Parallel Split View</span>
                      <span className="text-[10px] text-slate-400">
                        {viewMode === 'split' ? 'Displaying 2 devices side-by-side' : 'Displaying single active tab'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                      viewMode === 'split' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {viewMode === 'split' ? 'SPLIT' : 'TABS'}
                  </span>
                </button>
              )}

              {/* Feature 4: Synchronized Multi-Boxing */}
              <button
                onClick={onToggleSync}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  syncAll
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                    : 'bg-white/5 text-slate-300 hover:text-white border border-white/5 hover:bg-white/10'
                }`}
                title="Synchronized Multi-Boxing: Replicates touch, swipe, and key gestures proportionally across all devices simultaneously"
              >
                <div className="flex items-center gap-2.5">
                  <Layers
                    className={`w-4 h-4 ${syncAll ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}
                  />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-white">Synchronized Multi-Box</span>
                    <span className="text-[10px] text-slate-400">
                      {syncAll ? 'Replicating inputs on all devices' : 'Input targeted to active tab'}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    syncAll ? 'bg-amber-500/30 text-amber-200 animate-pulse' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {syncAll ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Feature 5: Quick-Draw Privacy Mode */}
              <button
                onClick={onTogglePrivacy}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  privacyMode
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                    : 'bg-white/5 text-slate-300 hover:text-white border border-white/5 hover:bg-white/10'
                }`}
                title="Turn off physical phone display while PC 60 FPS mirror and controls remain 100% active"
              >
                <div className="flex items-center gap-2.5">
                  {privacyMode ? (
                    <EyeOff className="w-4 h-4 text-purple-300" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-400" />
                  )}
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-white">Quick-Draw Privacy</span>
                    <span className="text-[10px] text-slate-400">
                      {privacyMode ? 'Phone display blacked out' : 'Physical screen active'}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    privacyMode ? 'bg-purple-500/30 text-purple-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {privacyMode ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
