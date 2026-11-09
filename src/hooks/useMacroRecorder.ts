'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { MacroStep, MacroErrorPolicy, MacroCondition } from '@/lib/types';

interface UseMacroRecorderProps {
  deviceId: string;
  onDispatchTap: (x: number, y: number) => void;
  onDispatchSwipe: (x1: number, y1: number, x2: number, y2: number, duration: number) => void;
  onDispatchKey: (keyCode: number) => void;
  onDispatchText: (text: string) => void;
  onVerifyText?: (targetText: string, timeoutMs?: number) => Promise<boolean>;
  onCompareCanvas?: (baselineDataUrl?: string) => Promise<number>;
  onTriggerRipple?: (x: number, y: number, isSwipe?: boolean, x2?: number, y2?: number) => void;
  onWakeDevice?: () => void;
  onSetKeepAwake?: (stayAwake: boolean) => void;
  onDispatchTapAll?: (normX: number, normY: number) => void;
  onDispatchSwipeAll?: (
    normX1: number,
    normY1: number,
    normX2: number,
    normY2: number,
    duration: number
  ) => void;
  onLog?: (msg: string) => void;
}

export function useMacroRecorder({
  deviceId,
  onDispatchTap,
  onDispatchSwipe,
  onDispatchKey,
  onDispatchText,
  onVerifyText,
  onCompareCanvas,
  onTriggerRipple,
  onWakeDevice,
  onSetKeepAwake,
  onDispatchTapAll,
  onDispatchSwipeAll,
  onLog,
}: UseMacroRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Store macros per deviceId: { "CASS9H89QWFUUGLJ": [...], "ZD222RGKJ2": [...] }
  const [deviceStepsMap, setDeviceStepsMap] = useState<Record<string, MacroStep[]>>({});

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [loopCount, setLoopCount] = useState<number>(1); // 0 = infinite

  // Multi-Device Synchronized Dispatch Toggle (Feature #9)
  const [syncAllMacroDevices, setSyncAllMacroDevices] = useState(false);

  // Fail-Safe & Self-Healing Error Policy
  const [errorPolicy, setErrorPolicy] = useState<MacroErrorPolicy>('abort_and_home');
  const [failedStepId, setFailedStepId] = useState<string | null>(null);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);

  const lastEventTimeRef = useRef<number>(0);
  const abortReplayRef = useRef<boolean>(false);
  const deviceIdRef = useRef<string>(deviceId);

  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  // Load saved macros for this device from localStorage on mount or deviceId change
  useEffect(() => {
    if (!deviceId) return;

    // Abort active replay or recording when switching device tabs
    abortReplayRef.current = true;
    setIsPlaying(false);
    setIsRecording(false);
    setCurrentStepIndex(-1);
    setFailedStepId(null);
    setLastErrorMessage(null);

    // If already in memory, keep it
    if (deviceStepsMap[deviceId]) {
      return;
    }

    try {
      const saved = localStorage.getItem(`aether_macro_${deviceId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setDeviceStepsMap((prev) => ({
            ...prev,
            [deviceId]: parsed,
          }));
        }
      }
    } catch (e) {}
  }, [deviceId]);

  // Active steps for the currently selected device (isolated per device)
  const currentSteps = deviceId ? deviceStepsMap[deviceId] || [] : [];

  // Helper to persist steps for a device
  const updateDeviceSteps = useCallback((targetDeviceId: string, newSteps: MacroStep[]) => {
    setDeviceStepsMap((prev) => ({
      ...prev,
      [targetDeviceId]: newSteps,
    }));
    try {
      localStorage.setItem(`aether_macro_${targetDeviceId}`, JSON.stringify(newSteps));
    } catch (e) {}
  }, []);

  // Start recording on current device
  const startRecording = useCallback(() => {
    if (!deviceIdRef.current) return;
    updateDeviceSteps(deviceIdRef.current, []);
    setIsRecording(true);
    setFailedStepId(null);
    setLastErrorMessage(null);
    lastEventTimeRef.current = Date.now();
  }, [updateDeviceSteps]);

  // Stop recording
  const stopRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  // Record an action into current device's macro
  const recordAction = useCallback(
    (action: Omit<MacroStep, 'id' | 'delayMs'>) => {
      const activeId = deviceIdRef.current;
      if (!isRecording || !activeId) return;

      const now = Date.now();
      const delay = Math.max(50, Math.min(5000, now - lastEventTimeRef.current));
      lastEventTimeRef.current = now;

      const newStep: MacroStep = {
        id: Math.random().toString(36).substring(2, 9),
        delayMs: delay,
        ...action,
      };

      setDeviceStepsMap((prev) => {
        const existing = prev[activeId] || [];
        const updated = [...existing, newStep];
        try {
          localStorage.setItem(`aether_macro_${activeId}`, JSON.stringify(updated));
        } catch (e) {}
        return {
          ...prev,
          [activeId]: updated,
        };
      });
    },
    [isRecording]
  );

  // Add a Vision Trigger step (wait for on-screen text/button)
  const addVisionTriggerStep = useCallback(
    (targetText: string, timeoutMs: number = 5000) => {
      const activeId = deviceIdRef.current;
      if (!activeId || !targetText.trim()) return;

      const newStep: MacroStep = {
        id: Math.random().toString(36).substring(2, 9),
        delayMs: 300,
        type: 'wait_for_text',
        targetText: targetText.trim(),
        timeoutMs,
      };

      setDeviceStepsMap((prev) => {
        const existing = prev[activeId] || [];
        const updated = [...existing, newStep];
        try {
          localStorage.setItem(`aether_macro_${activeId}`, JSON.stringify(updated));
        } catch (e) {}
        return {
          ...prev,
          [activeId]: updated,
        };
      });
    },
    []
  );

  // Add an If / Else Conditional Branching step (Feature #2)
  const addConditionStep = useCallback((condition: MacroCondition) => {
    const activeId = deviceIdRef.current;
    if (!activeId) return;

    const newStep: MacroStep = {
      id: Math.random().toString(36).substring(2, 9),
      delayMs: 300,
      type: 'condition',
      condition,
    };

    setDeviceStepsMap((prev) => {
      const existing = prev[activeId] || [];
      const updated = [...existing, newStep];
      try {
        localStorage.setItem(`aether_macro_${activeId}`, JSON.stringify(updated));
      } catch (e) {}
      return {
        ...prev,
        [activeId]: updated,
      };
    });
  }, []);

  // Add an Automated Visual Diff Regression step (Feature #10)
  const addVisualDiffStep = useCallback(
    (baselineImageData: string, diffThresholdPercent: number = 5) => {
      const activeId = deviceIdRef.current;
      if (!activeId) return;

      const newStep: MacroStep = {
        id: Math.random().toString(36).substring(2, 9),
        delayMs: 400,
        type: 'visual_diff',
        baselineImageData,
        diffThresholdPercent,
      };

      setDeviceStepsMap((prev) => {
        const existing = prev[activeId] || [];
        const updated = [...existing, newStep];
        try {
          localStorage.setItem(`aether_macro_${activeId}`, JSON.stringify(updated));
        } catch (e) {}
        return {
          ...prev,
          [activeId]: updated,
        };
      });
    },
    []
  );

  // Stop active playback
  const stopPlayback = useCallback(() => {
    abortReplayRef.current = true;
    setIsPlaying(false);
    setCurrentStepIndex(-1);
    onSetKeepAwake?.(false);
  }, [onSetKeepAwake]);

  // Replay macro workflow with Closed-Loop Self-Healing & Fail-Safe Recovery
  const playWorkflow = useCallback(
    async (customSteps?: MacroStep[]) => {
      const activeId = deviceIdRef.current;
      const sequence = customSteps || (activeId ? deviceStepsMap[activeId] || [] : []);
      if (sequence.length === 0 || isPlaying) return;

      setIsPlaying(true);
      abortReplayRef.current = false;
      setFailedStepId(null);
      setLastErrorMessage(null);

      // Feature #7: Auto-Wake & Keep-Awake Guard on Replay Start
      onWakeDevice?.();
      onSetKeepAwake?.(true);

      let currentLoop = 0;
      const targetLoops = loopCount;

      try {
        while (!abortReplayRef.current && (targetLoops === 0 || currentLoop < targetLoops)) {
          currentLoop++;

          for (let i = 0; i < sequence.length; i++) {
            if (abortReplayRef.current) break;
            setCurrentStepIndex(i);

            const step = sequence[i];
            const waitTime = Math.max(20, Math.round(step.delayMs / speedMultiplier));

            await new Promise((resolve) => setTimeout(resolve, waitTime));
            if (abortReplayRef.current) break;

            // Handle Vision Trigger step
            if (step.type === 'wait_for_text') {
              const target = step.targetText || '';
              const timeout = step.timeoutMs || 5000;
              onLog?.(`[Vision Guard]: Checking for target text "${target}" on screen...`);

              let found = false;
              if (onVerifyText) {
                found = await onVerifyText(target, timeout);
              } else {
                found = true; // Fallback if OCR is not wired
              }

              if (!found) {
                const errMsg = `Target "${target}" not detected within ${timeout}ms.`;
                onLog?.(`[Vision Guard Alert]: ${errMsg}`);
                setFailedStepId(step.id);
                setLastErrorMessage(errMsg);

                if (errorPolicy === 'abort_and_home') {
                  onLog?.(`[Fail-Safe Reset]: Returning device to clean Home screen (KEYCODE_HOME)...`);
                  onDispatchKey(3); // KEYCODE_HOME
                  abortReplayRef.current = true;
                  break;
                } else if (errorPolicy === 'skip') {
                  onLog?.(`[Policy Skip]: Skipping step "${target}" and proceeding.`);
                  continue;
                } else {
                  // Pause and prompt
                  abortReplayRef.current = true;
                  break;
                }
              } else {
                onLog?.(`[Vision Guard]: Verified "${target}" on screen. Proceeding.`);
              }
              continue;
            }

            // Feature #2: Handle If / Else Conditional Branching
            if (step.type === 'condition' && step.condition) {
              const { conditionType, targetText, onTrue, onFalse } = step.condition;
              onLog?.(`[If/Else Branch]: Checking if "${targetText}" is ${conditionType === 'text_present' ? 'present' : 'absent'}...`);

              let exists = false;
              if (onVerifyText) {
                exists = await onVerifyText(targetText, 2500);
              }
              const isMatch = conditionType === 'text_present' ? exists : !exists;
              onLog?.(`[If/Else Branch]: Condition is ${isMatch ? 'TRUE' : 'FALSE'}. Executing corresponding actions.`);

              const branch = isMatch ? onTrue : (onFalse || []);
              for (const bStep of branch) {
                if (abortReplayRef.current) break;
                if (bStep.type === 'tap' && typeof bStep.x === 'number' && typeof bStep.y === 'number') {
                  onTriggerRipple?.(bStep.x, bStep.y);
                  onDispatchTap(bStep.x, bStep.y);
                } else if (bStep.type === 'key' && typeof bStep.keyCode === 'number') {
                  onDispatchKey(bStep.keyCode);
                } else if (bStep.type === 'text' && bStep.text) {
                  onDispatchText(bStep.text);
                }
                await new Promise((r) => setTimeout(r, Math.max(50, Math.round((bStep.delayMs || 250) / speedMultiplier))));
              }
              continue;
            }

            // Feature #10: Handle Visual Diff Screen Regression
            if (step.type === 'visual_diff' && step.baselineImageData) {
              onLog?.(`[Visual Diff]: Comparing current screen with baseline image...`);
              if (onCompareCanvas) {
                const diffPercent = await onCompareCanvas(step.baselineImageData);
                const threshold = step.diffThresholdPercent ?? 5;
                if (diffPercent > threshold) {
                  const errMsg = `Visual Diff Failed: ${diffPercent.toFixed(1)}% mismatch (threshold: ${threshold}%)`;
                  onLog?.(`[Visual Diff Alert]: ${errMsg}`);
                  setFailedStepId(step.id);
                  setLastErrorMessage(errMsg);

                  if (errorPolicy === 'abort_and_home') {
                    onLog?.(`[Visual Diff Reset]: Aborting and returning Home.`);
                    onDispatchKey(3);
                    abortReplayRef.current = true;
                    break;
                  } else if (errorPolicy === 'skip') {
                    continue;
                  } else {
                    abortReplayRef.current = true;
                    break;
                  }
                } else {
                  onLog?.(`[Visual Diff]: Screen verified cleanly (${(100 - diffPercent).toFixed(1)}% match).`);
                }
              }
              continue;
            }

            // Dispatch standard input steps
            switch (step.type) {
              case 'tap':
                if (typeof step.x === 'number' && typeof step.y === 'number') {
                  // Feature #8: Live Visual Touch Ripple
                  onTriggerRipple?.(step.x, step.y);

                  // Feature #9: Multi-Device Sync Macro Dispatch
                  if (syncAllMacroDevices && onDispatchTapAll) {
                    onDispatchTapAll(step.x / 1080, step.y / 2400);
                  } else {
                    onDispatchTap(step.x, step.y);
                  }
                }
                break;
              case 'swipe':
                if (
                  typeof step.x1 === 'number' &&
                  typeof step.y1 === 'number' &&
                  typeof step.x2 === 'number' &&
                  typeof step.y2 === 'number'
                ) {
                  const duration = Math.round((step.duration || 150) / speedMultiplier);
                  // Feature #8: Live Visual Touch Ripple / Swipe Vector
                  onTriggerRipple?.(step.x1, step.y1, true, step.x2, step.y2);

                  // Feature #9: Multi-Device Sync Macro Dispatch
                  if (syncAllMacroDevices && onDispatchSwipeAll) {
                    onDispatchSwipeAll(
                      step.x1 / 1080,
                      step.y1 / 2400,
                      step.x2 / 1080,
                      step.y2 / 2400,
                      duration
                    );
                  } else {
                    onDispatchSwipe(step.x1, step.y1, step.x2, step.y2, duration);
                  }
                }
                break;
              case 'key':
                if (typeof step.keyCode === 'number') {
                  onDispatchKey(step.keyCode);
                }
                break;
              case 'text':
                if (step.text) {
                  onDispatchText(step.text);
                }
                break;
            }
          }

          // Inter-loop delay
          if (!abortReplayRef.current && (targetLoops === 0 || currentLoop < targetLoops)) {
            await new Promise((resolve) => setTimeout(resolve, Math.round(500 / speedMultiplier)));
          }
        }
      } finally {
        setIsPlaying(false);
        setCurrentStepIndex(-1);
        // Feature #7: Restore normal screen sleep timeout after macro completes
        onSetKeepAwake?.(false);
      }
    },
    [
      deviceStepsMap,
      isPlaying,
      loopCount,
      speedMultiplier,
      errorPolicy,
      syncAllMacroDevices,
      onDispatchTap,
      onDispatchSwipe,
      onDispatchKey,
      onDispatchText,
      onVerifyText,
      onCompareCanvas,
      onTriggerRipple,
      onWakeDevice,
      onSetKeepAwake,
      onDispatchTapAll,
      onDispatchSwipeAll,
      onLog,
    ]
  );

  const deleteStep = useCallback((stepId: string) => {
    const activeId = deviceIdRef.current;
    if (!activeId) return;
    setDeviceStepsMap((prev) => {
      const existing = prev[activeId] || [];
      const updated = existing.filter((s) => s.id !== stepId);
      try {
        localStorage.setItem(`aether_macro_${activeId}`, JSON.stringify(updated));
      } catch (e) {}
      return {
        ...prev,
        [activeId]: updated,
      };
    });
  }, []);

  const clearSteps = useCallback(() => {
    const activeId = deviceIdRef.current;
    if (!activeId) return;
    updateDeviceSteps(activeId, []);
    setFailedStepId(null);
    setLastErrorMessage(null);
  }, [updateDeviceSteps]);

  const importSteps = useCallback((newSteps: MacroStep[]) => {
    const activeId = deviceIdRef.current;
    if (!activeId) return;
    updateDeviceSteps(activeId, newSteps);
  }, [updateDeviceSteps]);

  return {
    isRecording,
    isPlaying,
    steps: currentSteps,
    currentStepIndex,
    speedMultiplier,
    loopCount,
    errorPolicy,
    failedStepId,
    lastErrorMessage,
    syncAllMacroDevices,
    setSyncAllMacroDevices,
    setErrorPolicy,
    setSpeedMultiplier,
    setLoopCount,
    startRecording,
    stopRecording,
    playWorkflow,
    stopPlayback,
    recordAction,
    addVisionTriggerStep,
    addConditionStep,
    addVisualDiffStep,
    deleteStep,
    clearSteps,
    importSteps,
  };
}
