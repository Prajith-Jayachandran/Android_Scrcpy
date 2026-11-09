'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { MacroStep, MacroErrorPolicy } from '@/lib/types';

interface UseMacroRecorderProps {
  deviceId: string;
  onDispatchTap: (x: number, y: number) => void;
  onDispatchSwipe: (x1: number, y1: number, x2: number, y2: number, duration: number) => void;
  onDispatchKey: (keyCode: number) => void;
  onDispatchText: (text: string) => void;
  onVerifyText?: (targetText: string, timeoutMs?: number) => Promise<boolean>;
  onLog?: (msg: string) => void;
}

export function useMacroRecorder({
  deviceId,
  onDispatchTap,
  onDispatchSwipe,
  onDispatchKey,
  onDispatchText,
  onVerifyText,
  onLog,
}: UseMacroRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Store macros per deviceId: { "CASS9H89QWFUUGLJ": [...], "ZD222RGKJ2": [...] }
  const [deviceStepsMap, setDeviceStepsMap] = useState<Record<string, MacroStep[]>>({});

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [loopCount, setLoopCount] = useState<number>(1); // 0 = infinite

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

  // Stop active playback
  const stopPlayback = useCallback(() => {
    abortReplayRef.current = true;
    setIsPlaying(false);
    setCurrentStepIndex(-1);
  }, []);

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

            // Dispatch standard input steps
            switch (step.type) {
              case 'tap':
                if (typeof step.x === 'number' && typeof step.y === 'number') {
                  onDispatchTap(step.x, step.y);
                }
                break;
              case 'swipe':
                if (
                  typeof step.x1 === 'number' &&
                  typeof step.y1 === 'number' &&
                  typeof step.x2 === 'number' &&
                  typeof step.y2 === 'number'
                ) {
                  onDispatchSwipe(
                    step.x1,
                    step.y1,
                    step.x2,
                    step.y2,
                    Math.round((step.duration || 150) / speedMultiplier)
                  );
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
      }
    },
    [
      deviceStepsMap,
      isPlaying,
      loopCount,
      speedMultiplier,
      errorPolicy,
      onDispatchTap,
      onDispatchSwipe,
      onDispatchKey,
      onDispatchText,
      onVerifyText,
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
    setErrorPolicy,
    setSpeedMultiplier,
    setLoopCount,
    startRecording,
    stopRecording,
    playWorkflow,
    stopPlayback,
    recordAction,
    addVisionTriggerStep,
    deleteStep,
    clearSteps,
    importSteps,
  };
}
