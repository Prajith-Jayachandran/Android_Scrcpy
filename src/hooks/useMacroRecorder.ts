'use client';

import { useState, useRef, useCallback } from 'react';
import { MacroStep, MacroWorkflow } from '@/lib/types';

interface UseMacroRecorderProps {
  onDispatchTap: (x: number, y: number) => void;
  onDispatchSwipe: (x1: number, y1: number, x2: number, y2: number, duration: number) => void;
  onDispatchKey: (keyCode: number) => void;
  onDispatchText: (text: string) => void;
}

export function useMacroRecorder({
  onDispatchTap,
  onDispatchSwipe,
  onDispatchKey,
  onDispatchText,
}: UseMacroRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [steps, setSteps] = useState<MacroStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [loopCount, setLoopCount] = useState<number>(1); // 0 = infinite

  const lastEventTimeRef = useRef<number>(0);
  const abortReplayRef = useRef<boolean>(false);

  // Start recording
  const startRecording = useCallback(() => {
    setSteps([]);
    setIsRecording(true);
    lastEventTimeRef.current = Date.now();
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  // Record an action
  const recordAction = useCallback(
    (action: Omit<MacroStep, 'id' | 'delayMs'>) => {
      if (!isRecording) return;

      const now = Date.now();
      const delay = Math.max(50, Math.min(5000, now - lastEventTimeRef.current));
      lastEventTimeRef.current = now;

      const newStep: MacroStep = {
        id: Math.random().toString(36).substring(2, 9),
        delayMs: delay,
        ...action,
      };

      setSteps((prev) => [...prev, newStep]);
    },
    [isRecording]
  );

  // Stop active playback
  const stopPlayback = useCallback(() => {
    abortReplayRef.current = true;
    setIsPlaying(false);
    setCurrentStepIndex(-1);
  }, []);

  // Replay macro workflow
  const playWorkflow = useCallback(
    async (customSteps?: MacroStep[]) => {
      const sequence = customSteps || steps;
      if (sequence.length === 0 || isPlaying) return;

      setIsPlaying(true);
      abortReplayRef.current = false;

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

            // Dispatch step
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

          // Loop delay
          if (!abortReplayRef.current && (targetLoops === 0 || currentLoop < targetLoops)) {
            await new Promise((resolve) => setTimeout(resolve, Math.round(500 / speedMultiplier)));
          }
        }
      } finally {
        setIsPlaying(false);
        setCurrentStepIndex(-1);
      }
    },
    [steps, isPlaying, loopCount, speedMultiplier, onDispatchTap, onDispatchSwipe, onDispatchKey, onDispatchText]
  );

  return {
    isRecording,
    isPlaying,
    steps,
    currentStepIndex,
    speedMultiplier,
    loopCount,
    setSpeedMultiplier,
    setLoopCount,
    startRecording,
    stopRecording,
    playWorkflow,
    stopPlayback,
    recordAction,
    setSteps,
  };
}
