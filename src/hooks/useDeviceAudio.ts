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
  const nextPlayTimeRef = useRef<number>(0);

  const isAudioToPcRef = useRef<boolean>(false);
  isAudioToPcRef.current = isAudioToPc;

  const deviceIdRef = useRef<string>(deviceId);
  deviceIdRef.current = deviceId;

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
          if (analyserRef.current && isAudioToPcRef.current) {
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const avg = sum / bufferLength;
            setAudioLevel(Math.min(100, Math.round((avg / 255) * 100)));
          } else {
            setAudioLevel(0);
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

  // Feed raw PCM chunks (interleaved 16-bit LE stereo 48000Hz) from WebSocket
  const feedAudioChunk = useCallback((targetDeviceId: string, pcmBytes: Uint8Array) => {
    if (!isAudioToPcRef.current || targetDeviceId !== deviceIdRef.current) return;
    if (pcmBytes.byteLength < 4) return;

    let ctx = audioContextRef.current;
    if (!ctx) {
      initAudio();
      ctx = audioContextRef.current;
    }
    if (!ctx || ctx.state !== 'running') return;

    // Convert interleaved 16-bit PCM to 2 planar Float32 channels
    const numSamples = Math.floor(pcmBytes.byteLength / 2);
    const numFrames = Math.floor(numSamples / 2); // stereo
    if (numFrames <= 0) return;

    // Align with DataView to safely handle unaligned byte offsets
    const dataView = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);
    const audioBuffer = ctx.createBuffer(2, numFrames, 48000);
    const leftData = audioBuffer.getChannelData(0);
    const rightData = audioBuffer.getChannelData(1);

    for (let i = 0; i < numFrames; i++) {
      const leftInt16 = dataView.getInt16(i * 4, true);
      const rightInt16 = dataView.getInt16(i * 4 + 2, true);
      leftData[i] = leftInt16 / 32768;
      rightData[i] = rightInt16 / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    if (gainNodeRef.current) {
      source.connect(gainNodeRef.current);
    } else {
      source.connect(ctx.destination);
    }

    const currentTime = ctx.currentTime;
    // Jitter buffer resync: if nextPlayTime is behind currentTime, or drifted too far (>150ms)
    if (nextPlayTimeRef.current < currentTime || nextPlayTimeRef.current > currentTime + 0.15) {
      nextPlayTimeRef.current = currentTime + 0.025;
    }

    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;
  }, [initAudio]);

  // Toggle Audio Destination: PC Speaker vs Phone Speaker
  const toggleAudioDestination = useCallback(() => {
    const nextState = !isAudioToPc;
    setIsAudioToPc(nextState);
    isAudioToPcRef.current = nextState;

    if (nextState) {
      initAudio();
      nextPlayTimeRef.current = 0;
      onLog?.(`[Audio]: Routing device audio to PC (Web Audio API active).`);
    } else {
      if (audioContextRef.current && audioContextRef.current.state === 'running') {
        audioContextRef.current.suspend();
      }
      setAudioLevel(0);
      nextPlayTimeRef.current = 0;
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

  // Sync on device change when audio to PC is active
  const prevDeviceIdRef = useRef<string>(deviceId);
  useEffect(() => {
    if (prevDeviceIdRef.current !== deviceId) {
      if (isAudioToPcRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        if (prevDeviceIdRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: 'set-audio-stream',
              deviceId: prevDeviceIdRef.current,
              enabled: false,
            })
          );
        }
        if (deviceId) {
          wsRef.current.send(
            JSON.stringify({
              type: 'set-audio-stream',
              deviceId,
              enabled: true,
            })
          );
        }
      }
      nextPlayTimeRef.current = 0;
      prevDeviceIdRef.current = deviceId;
    }
  }, [deviceId, wsRef]);

  // Cleanup on unmount
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
    feedAudioChunk,
  };
}
