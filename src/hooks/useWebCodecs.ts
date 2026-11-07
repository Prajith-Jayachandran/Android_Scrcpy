import { useRef, useEffect, useState, useCallback } from 'react';
import { StreamMeta } from '../lib/types';

interface UseWebCodecsOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  meta: StreamMeta | null;
  onFpsUpdate?: (fps: number) => void;
}

export function useWebCodecs({ canvasRef, meta, onFpsUpdate }: UseWebCodecsOptions) {
  const decoderRef = useRef<VideoDecoder | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasKeyframeRef = useRef(false);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());

  // FPS calculation interval
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const deltaSec = (now - lastFpsTimeRef.current) / 1000;
      if (deltaSec >= 1) {
        const fps = Math.round(frameCountRef.current / deltaSec);
        if (onFpsUpdate) onFpsUpdate(fps);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [onFpsUpdate]);

  const initDecoder = useCallback(() => {
    if (typeof window === 'undefined' || !('VideoDecoder' in window)) {
      setError('WebCodecs API is not supported in this browser.');
      return;
    }

    try {
      if (decoderRef.current && decoderRef.current.state !== 'closed') {
        decoderRef.current.close();
      }

      hasKeyframeRef.current = false;

      const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          const canvas = canvasRef.current;
          if (canvas) {
            if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
              canvas.width = frame.displayWidth;
              canvas.height = frame.displayHeight;
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(frame, 0, 0);
            }
          }
          frameCountRef.current++;
          frame.close(); // Free hardware buffer
        },
        error: (e) => {
          console.warn('[WebCodecs Decoder warning/error]:', e);
        }
      });

      // Configure decoder for H.264 Annex B stream
      decoder.configure({
        codec: 'avc1.42001f', // H.264 Baseline Profile Level 3.1
        optimizeForLatency: true
      });

      decoderRef.current = decoder;
      setIsReady(true);
      setError(null);
    } catch (err: any) {
      console.error('Failed to configure VideoDecoder:', err);
      setError(err.message || 'Decoder init failed');
    }
  }, [canvasRef]);

  useEffect(() => {
    initDecoder();
    return () => {
      if (decoderRef.current && decoderRef.current.state !== 'closed') {
        decoderRef.current.close();
      }
    };
  }, [initDecoder]);

  const decodeChunk = useCallback((payload: Uint8Array, isKeyFrame: boolean, ptsMicros: number) => {
    if (!decoderRef.current || decoderRef.current.state !== 'configured') {
      return;
    }

    // Must wait for the initial keyframe containing SPS/PPS
    if (!hasKeyframeRef.current) {
      if (!isKeyFrame) {
        return;
      }
      hasKeyframeRef.current = true;
    }

    try {
      const chunk = new EncodedVideoChunk({
        type: isKeyFrame ? 'key' : 'delta',
        timestamp: ptsMicros,
        data: payload
      });
      decoderRef.current.decode(chunk);
    } catch (err) {
      console.warn('Decode chunk dropped:', err);
    }
  }, []);

  const resetDecoder = useCallback(() => {
    initDecoder();
  }, [initDecoder]);

  return { isReady, error, decodeChunk, resetDecoder };
}
