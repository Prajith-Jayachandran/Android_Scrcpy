'use client';

import React, { useState } from 'react';
import { Wifi, X, Usb, QrCode, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface WirelessModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDeviceId: string;
  onSwitchTcpip: (deviceId: string) => void;
  onConnectWireless: (ip: string, port?: number) => void;
  onPairWireless: (ip: string, port: number, code: string, connectPort?: number) => void;
}

export const WirelessModal: React.FC<WirelessModalProps> = ({
  isOpen,
  onClose,
  activeDeviceId,
  onSwitchTcpip,
  onConnectWireless,
  onPairWireless,
}) => {
  const [tab, setTab] = useState<'convert' | 'direct' | 'pair'>('convert');
  const [directIp, setDirectIp] = useState('');
  const [directPort, setDirectPort] = useState('5555');

  // Android 11+ Pairing fields
  const [pairIp, setPairIp] = useState('');
  const [pairPort, setPairPort] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [connectPort, setConnectPort] = useState('');

  if (!isOpen) return null;

  const handleDirectConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directIp.trim()) return;
    onConnectWireless(directIp.trim(), parseInt(directPort || '5555', 10));
    onClose();
  };

  const handlePairConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairIp.trim() || !pairPort || !pairCode) return;
    onPairWireless(
      pairIp.trim(),
      parseInt(pairPort, 10),
      pairCode.trim(),
      connectPort ? parseInt(connectPort, 10) : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl ultra-glass border border-white/15 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.8)] flex flex-col gap-5 overflow-hidden">
        {/* Glow ambient header */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Dual Wired & Wireless Link
              </h2>
              <p className="text-xs text-slate-400">
                Seamless USB to 5GHz Wi-Fi switching and Android 11+ pairing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-black/40 rounded-2xl border border-white/5 text-xs font-semibold">
          <button
            onClick={() => setTab('convert')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              tab === 'convert'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Usb className="w-3.5 h-3.5" />
            <span>1-Click Wi-Fi</span>
          </button>
          <button
            onClick={() => setTab('direct')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              tab === 'direct'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Connect IP</span>
          </button>
          <button
            onClick={() => setTab('pair')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              tab === 'pair'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Android 11+</span>
          </button>
        </div>

        {/* Tab 1: 1-Click USB to Wi-Fi */}
        {tab === 'convert' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                <span>Active USB Device:</span>
                <span className="font-mono text-indigo-300 font-bold">
                  {activeDeviceId || 'No device connected'}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automatically enables ADB TCP/IP listening on port 5555, detects your phone&apos;s Wi-Fi network IP, and establishes a wireless bridge. You can safely disconnect your USB cable once connected!
              </p>
            </div>

            <button
              onClick={() => {
                if (activeDeviceId) {
                  onSwitchTcpip(activeDeviceId);
                  onClose();
                }
              }}
              disabled={!activeDeviceId}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Wifi className="w-4 h-4" />
              <span>Switch Active Device to Wi-Fi Mode</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}

        {/* Tab 2: Direct IP Connection */}
        {tab === 'direct' && (
          <form onSubmit={handleDirectConnect} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">
                Device Wi-Fi IP Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={directIp}
                  onChange={(e) => setDirectIp(e.target.value)}
                  placeholder="e.g. 192.168.1.105"
                  className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400 transition-all"
                  required
                />
                <input
                  type="text"
                  value={directPort}
                  onChange={(e) => setDirectPort(e.target.value)}
                  placeholder="5555"
                  className="w-20 bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2.5 text-xs text-center text-slate-100 outline-none focus:border-cyan-400 transition-all font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Wifi className="w-4 h-4" />
              <span>Connect Wirelessly</span>
            </button>
          </form>
        )}

        {/* Tab 3: Android 11+ Pairing Code */}
        {tab === 'pair' && (
          <form onSubmit={handlePairConnect} className="flex flex-col gap-3.5">
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>
                Go to <strong>Settings &gt; Developer Options &gt; Wireless Debugging &gt; Pair device with pairing code</strong>.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-300">Pairing IP</label>
                <input
                  type="text"
                  value={pairIp}
                  onChange={(e) => setPairIp(e.target.value)}
                  placeholder="192.168.1.100"
                  className="bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-300">Pairing Port</label>
                <input
                  type="text"
                  value={pairPort}
                  onChange={(e) => setPairPort(e.target.value)}
                  placeholder="e.g. 37891"
                  className="bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-300">6-Digit Code</label>
                <input
                  type="text"
                  value={pairCode}
                  onChange={(e) => setPairCode(e.target.value)}
                  placeholder="e.g. 849201"
                  className="bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400 font-mono font-bold tracking-widest text-center"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-300">Connect Port (Optional)</label>
                <input
                  type="text"
                  value={connectPort}
                  onChange={(e) => setConnectPort(e.target.value)}
                  placeholder="e.g. 42315"
                  className="bg-slate-950/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 mt-1"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Pair &amp; Connect Device</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
