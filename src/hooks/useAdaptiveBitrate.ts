'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type QualityTier = 'ultra' | 'high' | 'balanced' | 'low';

export interface QualityProfile {
  id: QualityTier;
  label: string;
  bitRate: number; // bps
  maxFps: number;
  maxLatencyMs: number;
  color: string;
}

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  ultra: {
    id: 'ultra',
    label: 'Ultra (1080p @ 60 FPS • 8M)',
    bitRate: 8000000,
    maxFps: 60,
    maxLatencyMs: 30,
    color: '#22c55e', // Green
  },
  high: {
    id: 'high',
    label: 'High (1080p @ 60 FPS • 5M)',
    bitRate: 5000000,
    maxFps: 60,
    maxLatencyMs: 55,
    color: '#06b6d4', // Cyan
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced (900p @ 45 FPS • 3M)',
    bitRate: 3000000,
    maxFps: 45,
    maxLatencyMs: 90,
    color: '#f59e0b', // Amber
  },
  low: {
    id: 'low',
    label: 'Low / Jitter Guard (720p @ 30 FPS • 1.5M)',
    bitRate: 1500000,
    maxFps: 30,
    maxLatencyMs: 9999,
    color: '#ef4444', // Red
  },
};

interface UseAdaptiveBitrateProps {
  deviceId: string;
  wsRef: React.RefObject<WebSocket | null>;
  onLog?: (msg: string) => void;
}

export function useAdaptiveBitrate({ deviceId, wsRef, onLog }: UseAdaptiveBitrateProps) {
  const [currentTier, setCurrentTier] = useState<QualityTier>('ultra');
  const [isAutoAbr, setIsAutoAbr] = useState<boolean>(true);
  const [latencyMs, setLatencyMs] = useState<number>(18);
  const pingStartRef = useRef<number>(0);

  // Ping handler
  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && deviceId) {
      pingStartRef.current = Date.now();
      wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: pingStartRef.current }));
    }
  }, [wsRef, deviceId]);

  // Called when Pong arrives from server
  const handlePong = useCallback(
    (sentTimestamp: number) => {
      const now = Date.now();
      const rtt = Math.max(1, now - sentTimestamp);
      setLatencyMs(rtt);

      if (!isAutoAbr) return;

      // Select tier based on latency
      let nextTier: QualityTier = 'ultra';
      if (rtt > 90) {
        nextTier = 'low';
      } else if (rtt > 55) {
        nextTier = 'balanced';
      } else if (rtt > 30) {
        nextTier = 'high';
      }

      if (nextTier !== currentTier) {
        setCurrentTier(nextTier);
        const profile = QUALITY_PROFILES[nextTier];
        onLog?.(`[ABR]: Latency ${rtt}ms. Dynamically scaled to ${profile.label}`);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'set-bitrate',
              deviceId,
              bitRate: profile.bitRate,
              maxFps: profile.maxFps,
            })
          );
        }
      }
    },
    [currentTier, isAutoAbr, onLog, wsRef, deviceId]
  );

  // Periodic latency measurement loop
  useEffect(() => {
    const timer = setInterval(() => {
      sendPing();
    }, 2500);

    return () => clearInterval(timer);
  }, [sendPing]);

  const setManualTier = useCallback(
    (tier: QualityTier) => {
      setIsAutoAbr(false);
      setCurrentTier(tier);
      const profile = QUALITY_PROFILES[tier];
      onLog?.(`[ABR]: Manual Quality Profile locked to ${profile.label}`);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'set-bitrate',
            deviceId,
            bitRate: profile.bitRate,
            maxFps: profile.maxFps,
          })
        );
      }
    },
    [wsRef, deviceId, onLog]
  );

  return {
    currentTier,
    profile: QUALITY_PROFILES[currentTier],
    isAutoAbr,
    latencyMs,
    setIsAutoAbr,
    setManualTier,
    handlePong,
  };
}
