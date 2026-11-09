'use client';

import React from 'react';
import { Usb, Smartphone, Check, X, ShieldCheck, Sparkles, AlertTriangle } from 'lucide-react';
import { DeviceInfo } from '@/lib/types';

interface NewUsbDeviceModalProps {
  isOpen: boolean;
  device: DeviceInfo | null;
  targetTabNumber: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const NewUsbDeviceModal: React.FC<NewUsbDeviceModalProps> = ({
  isOpen,
  device,
  targetTabNumber,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !device) return null;

  const brand =
    device.model ||
    device.product ||
    (device.status === 'unauthorized' ? `Device (${device.id.substring(0, 10)})` : 'Android Device');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl ultra-glass border border-white/20 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.9),0_0_50px_rgba(99,102,241,0.25)] flex flex-col gap-5 overflow-hidden">
        {/* Glow ambient header accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Usb className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
                <span>Connect New USB Device</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              </h2>
              <p className="text-xs text-slate-400">
                New hardware device detected on USB port
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Device Information Card */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {brand}
                </h3>
                <p className="text-[10px] font-mono text-slate-400">
                  ID: {device.id}
                </p>
              </div>
            </div>

            {/* Destination Tab Badge */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                Target
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 text-xs font-bold font-mono shadow-sm">
                Tab #{targetTabNumber}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Authorization Status:</span>
            </span>
            <span
              className={`font-semibold capitalize ${
                device.status === 'device'
                  ? 'text-emerald-400'
                  : device.status === 'unauthorized'
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }`}
            >
              {device.status === 'device' ? '✔ Authorized & Ready' : device.status === 'unauthorized' ? '⚠️ Unauthorized' : device.status}
            </span>
          </div>

          {/* Prompt banner for unauthorized devices */}
          {device.status === 'unauthorized' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col gap-1 mt-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Phone Screen Confirmation Required</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Unlock your phone and tap <strong>&quot;Allow USB debugging&quot;</strong> (or &quot;Always allow from this computer&quot;) to complete authorization.
              </p>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          {device.status === 'device' ? (
            <>
              Connects <strong className="text-indigo-300">Tab #{targetTabNumber}: {brand}</strong> to the tool and immediately begins low-latency hardware 60 FPS mirroring.
            </>
          ) : (
            <>
              Connects <strong className="text-amber-300">Tab #{targetTabNumber}: {brand}</strong> to the tool. Mirroring will be ready as soon as you confirm the RSA prompt on your phone screen.
            </>
          )}
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={onCancel}
            className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all"
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/35 transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>{device.status === 'device' ? 'OK (Connect & Mirror)' : 'OK (Connect to Tool)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
