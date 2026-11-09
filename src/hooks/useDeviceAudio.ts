'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseDeviceAudioProps {
  deviceId: string;
  wsRef: React.RefObject<WebSocket | null>;
  onLog?: (msg: string) => void;
}

export function useDeviceAudio({ deviceId, wsRef, onLog }: UseDeviceAudioProps) {
  const [isAudioToPc, setIsAudioToPc] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize Web Audio Context
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx({ sampleRate: 48000 });
        const gain = ctx.createGain();
        gain.gain.value = volume;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;

        gain.connect(analyser);
        analyser.connect(ctx.destination);

        audioContextRef.current = ctx;
        gainNodeRef.current = gain;
        analyserRef.current = analyser;

        // Visualizer level meter loop
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkLevel = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const avg = sum / bufferLength;
            setAudioLevel(Math.min(100, Math.round((avg / 255) * 100)));
          }
          animFrameRef.current = requestAnimationFrame(checkLevel);
        };
        checkLevel();
      }
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [volume]);

  // Adjust volume
  const handleSetVolume = useCallback((newVol: number) => {
    setVolume(newVol);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVol;
    }
  }, []);

  // Toggle Audio Destination: PC Speaker vs Phone Speaker
  const toggleAudioDestination = useCallback(() => {
    const nextState = !isAudioToPc;
    setIsAudioToPc(nextState);

    if (nextState) {
      initAudio();
      onLog?.(`[Audio]: Routing device audio to PC (Web Audio API active).`);
    } else {
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        audioContextRef.current.suspend();
      }
      setAudioLevel(0);
      onLog?.(`[Audio]: Detached PC audio. Audio is playing through phone speaker.`);
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && deviceId) {
      wsRef.current.send(
        JSON.stringify({
          type: 'set-audio-stream',
          deviceId,
          enabled: nextState,
        })
      );
    }
  }, [isAudioToPc, initAudio, onLog, wsRef, deviceId]);

  // Cleanup on unmount or tab switch
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  return {
    isAudioToPc,
    volume,
    audioLevel,
    setVolume: handleSetVolume,
    toggleAudioDestination,
  };
}
