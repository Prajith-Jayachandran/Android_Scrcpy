'use client';

import React, { useRef, useState } from 'react';
import {
  Play,
  Square,
  Circle,
  FastForward,
  Repeat,
  Trash2,
  Download,
  Upload,
  Clock,
  MousePointer,
  Move,
  KeyRound,
  Type,
  Eye,
  ShieldAlert,
  Crosshair,
  GitBranch,
  Layers,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import { MacroStep, MacroErrorPolicy, MacroCondition } from '@/lib/types';

interface MacroEditorProps {
  isRecording: boolean;
  isPlaying: boolean;
  steps: MacroStep[];
  currentStepIndex: number;
  speedMultiplier: number;
  loopCount: number;
  targetDeviceName?: string;
  errorPolicy?: MacroErrorPolicy;
  failedStepId?: string | null;
  lastErrorMessage?: string | null;
  isInspectMode?: boolean;
  hasMultipleDevices?: boolean;
  syncAllMacroDevices?: boolean;
  isRecordingClip?: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlay: () => void;
  onStopPlayback: () => void;
  onSetSpeed: (speed: number) => void;
  onSetLoop: (loop: number) => void;
  onSetErrorPolicy?: (policy: MacroErrorPolicy) => void;
  onAddVisionTrigger?: (targetText: string) => void;
  onAddConditionStep?: (condition: MacroCondition) => void;
  onAddVisualDiffStep?: () => void;
  onToggleInspectMode?: () => void;
  onToggleSyncAllMacroDevices?: () => void;
  onCaptureInstantClip?: () => void;
  onDeleteStep: (id: string) => void;
  onClearSteps: () => void;
  onImportSteps: (steps: MacroStep[]) => void;
}

export const MacroEditor: React.FC<MacroEditorProps> = ({
  isRecording,
  isPlaying,
  steps,
  currentStepIndex,
  speedMultiplier,
  loopCount,
  targetDeviceName,
  errorPolicy = 'abort_and_home',
  failedStepId,
  lastErrorMessage,
  isInspectMode = false,
  hasMultipleDevices = false,
  syncAllMacroDevices = false,
  isRecordingClip = false,
  onStartRecording,
  onStopRecording,
  onPlay,
  onStopPlayback,
  onSetSpeed,
  onSetLoop,
  onSetErrorPolicy,
  onAddVisionTrigger,
  onAddConditionStep,
  onAddVisualDiffStep,
  onToggleInspectMode,
  onToggleSyncAllMacroDevices,
  onCaptureInstantClip,
  onDeleteStep,
  onClearSteps,
  onImportSteps,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [visionText, setVisionText] = useState('');

  // Feature #2: If/Else Modal State
  const [showIfModal, setShowIfModal] = useState(false);
  const [conditionTarget, setConditionTarget] = useState('Allow');
  const [conditionAction, setConditionAction] = useState<'tap_home' | 'tap_back' | 'skip'>('tap_back');

  const handleExportJson = () => {
    if (steps.length === 0) return;
    const blob = new Blob([JSON.stringify(steps, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanName = (targetDeviceName || 'device').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `aether_macro_${cleanName}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          onImportSteps(imported);
        }
      } catch (err) {}
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getStepIcon = (type: MacroStep['type']) => {
    switch (type) {
      case 'tap':
        return <MousePointer className="w-3.5 h-3.5 text-cyan-400" />;
      case 'swipe':
        return <Move className="w-3.5 h-3.5 text-indigo-400" />;
      case 'key':
        return <KeyRound className="w-3.5 h-3.5 text-amber-400" />;
      case 'text':
        return <Type className="w-3.5 h-3.5 text-emerald-400" />;
      case 'wait_for_text':
        return <Eye className="w-3.5 h-3.5 text-purple-400" />;
      case 'condition':
        return <GitBranch className="w-3.5 h-3.5 text-indigo-400" />;
      case 'visual_diff':
        return <ImageIcon className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="ultra-glass-card rounded-2xl p-4 flex flex-col gap-3.5 relative overflow-hidden">
      {/* Decorative ambient glow */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Workflow Automator
          </h3>
          {targetDeviceName && (
            <span
              className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded-md font-mono truncate max-w-[140px]"
              title={targetDeviceName}
            >
              {targetDeviceName}
            </span>
          )}
          <span className="text-[10px] text-slate-400 font-mono">Macro</span>
        </div>

        {isRecording && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span>RECORDING</span>
          </div>
        )}

        {isPlaying && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>REPLAYING ({currentStepIndex + 1}/{steps.length})</span>
          </div>
        )}
      </div>

      {/* Fail-Safe Alert Banner */}
      {lastErrorMessage && (
        <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 text-[11px] flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>{lastErrorMessage}</span>
          </div>
          <span className="text-[9px] bg-red-950/80 px-2 py-0.5 rounded text-red-300 font-mono font-bold">
            SAFE HOME RESET
          </span>
        </div>
      )}

      {/* Primary Action Controls */}
      <div className="grid grid-cols-2 gap-2">
        {/* Record Button */}
        {!isRecording ? (
          <button
            onClick={onStartRecording}
            disabled={isPlaying}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 font-semibold text-xs transition-all disabled:opacity-40"
          >
            <Circle className="w-3.5 h-3.5 fill-red-400 text-red-400" />
            <span>Record Macro</span>
          </button>
        ) : (
          <button
            onClick={onStopRecording}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition-all shadow-lg shadow-red-600/30 animate-pulse"
          >
            <Square className="w-3.5 h-3.5 fill-white text-white" />
            <span>Stop Recording</span>
          </button>
        )}

        {/* Play Button */}
        {!isPlaying ? (
          <button
            onClick={onPlay}
            disabled={isRecording || steps.length === 0}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold text-xs transition-all disabled:opacity-40 shadow-md shadow-emerald-600/20"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Replay ({steps.length})</span>
          </button>
        ) : (
          <button
            onClick={onStopPlayback}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-all shadow-md shadow-amber-600/30"
          >
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>Abort Replay</span>
          </button>
        )}
      </div>

      {/* Speed, Loop & Error Policy Controls */}
      <div className="flex flex-col gap-2 p-2 rounded-xl bg-black/40 border border-white/5 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          {/* Speed Multiplier */}
          <div className="flex items-center gap-1 text-slate-400">
            <FastForward className="w-3.5 h-3.5 text-cyan-400" />
            <div className="flex items-center gap-1">
              {[0.5, 1.0, 2.0, 4.0].map((s) => (
                <button
                  key={s}
                  onClick={() => onSetSpeed(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                    speedMultiplier === s
                      ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-500/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Loop Count */}
          <div className="flex items-center gap-1 text-slate-400">
            <Repeat className="w-3.5 h-3.5 text-indigo-400" />
            <div className="flex items-center gap-1">
              {[1, 3, 5, 0].map((l) => (
                <button
                  key={l}
                  onClick={() => onSetLoop(l)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                    loopCount === l
                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {l === 0 ? '∞' : `${l}x`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Self-Healing Fail-Safe Policy Selector */}
        {onSetErrorPolicy && (
          <div className="flex items-center justify-between pt-1.5 border-t border-white/5 text-[10px]">
            <span className="text-slate-400 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-emerald-400" />
              <span>On Error:</span>
            </span>
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'abort_and_home', label: 'Home Reset' },
                  { id: 'skip', label: 'Skip' },
                  { id: 'pause_prompt', label: 'Pause' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSetErrorPolicy(p.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    errorPolicy === p.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Step Timeline List */}
      <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {steps.length === 0 ? (
          <div className="py-4 text-center text-[11px] text-slate-500">
            No actions recorded yet. Click <span className="text-red-400 font-semibold">Record Macro</span> or add a <span className="text-purple-400 font-semibold">Vision Guard</span>.
          </div>
        ) : (
          steps.map((step, idx) => {
            const isCurrent = currentStepIndex === idx;
            const isFailed = failedStepId === step.id;

            return (
              <div
                key={step.id}
                className={`flex items-center justify-between p-2 rounded-xl text-[11px] border transition-all ${
                  isFailed
                    ? 'bg-red-500/30 border-red-500 text-red-100 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse'
                    : isCurrent
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                    : 'bg-white/5 border-white/5 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-slate-500 w-4">{idx + 1}.</span>
                  {getStepIcon(step.type)}
                  <span className="font-semibold capitalize">
                    {step.type === 'wait_for_text' ? 'Vision Guard' : step.type}
                  </span>
                  {step.type === 'tap' && (
                    <span className="text-[10px] font-mono text-slate-400">
                      ({step.x}, {step.y})
                    </span>
                  )}
                  {step.type === 'swipe' && (
                    <span className="text-[10px] font-mono text-slate-400">
                      ({step.x1},{step.y1}) &rarr; ({step.x2},{step.y2})
                    </span>
                  )}
                  {step.type === 'key' && (
                    <span className="text-[10px] font-mono text-slate-400">
                      Code: {step.keyCode}
                    </span>
                  )}
                  {step.type === 'text' && (
                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-[90px]">
                      &quot;{step.text}&quot;
                    </span>
                  )}
                  {step.type === 'wait_for_text' && (
                    <span className="text-[10px] font-mono text-purple-300 truncate max-w-[100px]" title={step.targetText}>
                      Wait: &quot;{step.targetText}&quot;
                    </span>
                  )}
                  {step.type === 'condition' && (
                    <span className="text-[10px] font-mono text-indigo-300 truncate max-w-[110px]" title={`If "${step.condition?.targetText}" present`}>
                      If: &quot;{step.condition?.targetText}&quot; &rarr; Branch
                    </span>
                  )}
                  {step.type === 'visual_diff' && (
                    <span className="text-[10px] font-mono text-rose-300 truncate max-w-[100px]">
                      Diff Check (&le;{step.diffThresholdPercent || 5}%)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-indigo-300 bg-indigo-950/40 px-1 py-0.5 rounded border border-indigo-800/40">
                    +{step.delayMs}ms
                  </span>
                  <button
                    onClick={() => onDeleteStep(step.id)}
                    className="p-1 text-slate-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Vision Trigger Modal Prompt */}
      {showVisionModal && (
        <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between text-purple-200 font-semibold">
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-purple-400" />
              <span>Add Vision Guard (OCR)</span>
            </span>
            <button
              onClick={() => setShowVisionModal(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <input
            type="text"
            placeholder='e.g. "Instagram", "Confirm", "Search"'
            value={visionText}
            onChange={(e) => setVisionText(e.target.value)}
            className="w-full px-2 py-1 rounded bg-black/60 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
          />
          <button
            onClick={() => {
              if (visionText.trim() && onAddVisionTrigger) {
                onAddVisionTrigger(visionText);
                setVisionText('');
                setShowVisionModal(false);
              }
            }}
            className="w-full py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all"
          >
            Insert Vision Step
          </button>
        </div>
      )}

      {/* Feature #2: If / Else Branching Modal Prompt */}
      {showIfModal && (
        <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between text-indigo-200 font-semibold">
            <span className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
              <span>If / Else Popup Recovery Branch</span>
            </span>
            <button
              onClick={() => setShowIfModal(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400">If on-screen text matches:</span>
            <input
              type="text"
              placeholder='e.g. "Allow", "Update", "Later", "Cancel"'
              value={conditionTarget}
              onChange={(e) => setConditionTarget(e.target.value)}
              className="w-full px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-400">Then execute auto-recovery action:</span>
            <select
              value={conditionAction}
              onChange={(e) => setConditionAction(e.target.value as any)}
              className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-indigo-400"
            >
              <option value="tap_back">Dismiss via Back Button (KEYCODE_BACK)</option>
              <option value="tap_home">Reset to Home Screen (KEYCODE_HOME)</option>
              <option value="skip">Ignore &amp; Proceed</option>
            </select>
          </div>
          <button
            onClick={() => {
              if (conditionTarget.trim() && onAddConditionStep) {
                const onTrueSteps: MacroStep[] = [];
                if (conditionAction === 'tap_back') {
                  onTrueSteps.push({
                    id: Math.random().toString(36).substring(2, 9),
                    delayMs: 200,
                    type: 'key',
                    keyCode: 4,
                  });
                } else if (conditionAction === 'tap_home') {
                  onTrueSteps.push({
                    id: Math.random().toString(36).substring(2, 9),
                    delayMs: 200,
                    type: 'key',
                    keyCode: 3,
                  });
                }
                onAddConditionStep({
                  conditionType: 'text_present',
                  targetText: conditionTarget.trim(),
                  onTrue: onTrueSteps,
                });
                setShowIfModal(false);
              }
            }}
            className="w-full py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs transition-all shadow"
          >
            Insert If/Else Branch
          </button>
        </div>
      )}

      {/* Advanced Automation Actions Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 border-t border-white/10 text-[11px]">
        {/* Feature #1: Point-and-Click Inspector HUD Toggle */}
        {onToggleInspectMode && (
          <button
            type="button"
            onClick={onToggleInspectMode}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-all border whitespace-nowrap ${
              isInspectMode
                ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)] animate-pulse'
                : 'bg-white/5 text-slate-300 hover:text-white border-white/10'
            }`}
            title="Inspect Mode: Click screen to auto-create tap coordinate"
          >
            <Crosshair className="w-3 h-3 text-cyan-400" />
            <span>{isInspectMode ? 'Inspect: ON' : 'Inspect HUD'}</span>
          </button>
        )}

        {/* Feature #2: If/Else Branching */}
        {onAddConditionStep && (
          <button
            type="button"
            onClick={() => setShowIfModal(!showIfModal)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-all whitespace-nowrap"
            title="Add If/Else Branching step"
          >
            <GitBranch className="w-3 h-3 text-indigo-400" />
            <span>+ If/Else</span>
          </button>
        )}

        {/* Feature #10: Visual Diff Snapshot Step */}
        {onAddVisualDiffStep && (
          <button
            type="button"
            onClick={onAddVisualDiffStep}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all whitespace-nowrap"
            title="Add Visual Diff Baseline Check"
          >
            <ImageIcon className="w-3 h-3 text-rose-400" />
            <span>+ Diff Step</span>
          </button>
        )}

        {/* Feature #9: Multi-Device Sync Macro Toggle */}
        {hasMultipleDevices && onToggleSyncAllMacroDevices && (
          <button
            type="button"
            onClick={onToggleSyncAllMacroDevices}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-all border whitespace-nowrap ${
              syncAllMacroDevices
                ? 'bg-amber-500/30 text-amber-200 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)] animate-pulse'
                : 'bg-white/5 text-slate-400 hover:text-white border-white/10'
            }`}
            title="Execute Macro Workflow Synchronously Across All Connected Phones"
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>{syncAllMacroDevices ? 'Sync All: ON' : 'Sync All'}</span>
          </button>
        )}

        {/* Feature #3: Instant Screen-to-GIF / Clip */}
        {onCaptureInstantClip && (
          <button
            type="button"
            onClick={onCaptureInstantClip}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-all border whitespace-nowrap ml-auto ${
              isRecordingClip
                ? 'bg-rose-600 text-white border-rose-400 animate-pulse shadow-md'
                : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border-emerald-500/30'
            }`}
            title="Record 5s Video Clip / GIF"
          >
            <Video className="w-3 h-3" />
            <span>{isRecordingClip ? 'Recording...' : 'Instant Clip'}</span>
          </button>
        )}
      </div>

      {/* Export / Import & Vision Add Bar */}
      <div className="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
        <div className="flex gap-1.5">
          <button
            onClick={handleExportJson}
            disabled={steps.length === 0}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all text-[11px] disabled:opacity-40"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all text-[11px]"
          >
            <Upload className="w-3 h-3" />
            <span>Import</span>
          </button>
          {onAddVisionTrigger && (
            <button
              onClick={() => setShowVisionModal(!showVisionModal)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-all text-[11px]"
            >
              <Eye className="w-3 h-3" />
              <span>+ Vision</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJson}
            className="hidden"
          />
        </div>

        {steps.length > 0 && (
          <button
            onClick={onClearSteps}
            className="text-[11px] text-slate-500 hover:text-red-400 transition-all"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
};
