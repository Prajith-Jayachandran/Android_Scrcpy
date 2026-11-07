import { useRef, useEffect, useState, useCallback } from 'react';
import { StreamMeta } from '../lib/types';

interface UseWebCodecsOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  meta: StreamMeta | null;
  onFpsUpdate?: (fps: number) => void;
}

// Helper: Extract AVC profile from SPS NAL unit (type 7)
function extractH264Codec(payload: Uint8Array): string {
  for (let i = 0; i < payload.length - 4; i++) {
    if (payload[i] === 0 && payload[i + 1] === 0) {
      let nalStart = -1;
      if (payload[i + 2] === 1) {
        nalStart = i + 3;
      } else if (payload[i + 2] === 0 && payload[i + 3] === 1) {
        nalStart = i + 4;
      }

      if (nalStart !== -1 && nalStart + 3 < payload.length) {
        const nalType = payload[nalStart] & 0x1f;
        if (nalType === 7) {
          // SPS NAL unit found
          const profile = payload[nalStart + 1].toString(16).padStart(2, '0');
          const constraint = payload[nalStart + 2].toString(16).padStart(2, '0');
          const level = payload[nalStart + 3].toString(16).padStart(2, '0');
          return `avc1.${profile}${constraint}${level}`;
        }
      }
    }
  }
  // High Profile Level 4.2 default fallback (supports 1080p 60fps)
  return 'avc1.64002a';
}

export function useWebCodecs({ canvasRef, meta, onFpsUpdate }: UseWebCodecsOptions) {
  const decoderRef = useRef<VideoDecoder | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasKeyframeRef = useRef(false);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());
  const spsPpsRef = useRef<Uint8Array | null>(null);
  const currentCodecRef = useRef<string>('avc1.64002a');

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

  const configureDecoder = useCallback((codecString: string) => {
    if (typeof window === 'undefined' || !('VideoDecoder' in window)) {
      setError('WebCodecs API is not supported in this browser.');
      return;
    }

    try {
      if (decoderRef.current && decoderRef.current.state !== 'closed') {
        decoderRef.current.close();
      }

      hasKeyframeRef.current = false;
      currentCodecRef.current = codecString;

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
          frame.close(); // Crucial: free GPU hardware buffer
        },
        error: (e) => {
          console.warn('[WebCodecs Decoder error]:', e);
        }
      });

      // Configure decoder with Annex B format
      decoder.configure({
        codec: codecString,
        optimizeForLatency: true,
        // @ts-ignore - avc annexb format spec
        avc: { format: 'annexb' }
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
    configureDecoder('avc1.64002a');
    return () => {
      if (decoderRef.current && decoderRef.current.state !== 'closed') {
        decoderRef.current.close();
      }
    };
  }, [configureDecoder]);

  const decodeChunk = useCallback(
    (payload: Uint8Array, isKeyFrame: boolean, isConfig: boolean, ptsMicros: number) => {
      // 1. Handle SPS/PPS configuration packet
      if (isConfig) {
        spsPpsRef.current = payload;
        const detectedCodec = extractH264Codec(payload);
        if (detectedCodec !== currentCodecRef.current) {
          configureDecoder(detectedCodec);
        }
        return; // Don't decode config packets standalone
      }

      if (!decoderRef.current || decoderRef.current.state !== 'configured') {
        return;
      }

      // 2. Handle Keyframe
      if (isKeyFrame) {
        try {
          // Prepend SPS/PPS to the keyframe so VideoDecoder has parameter sets
          let chunkData = payload;
          if (spsPpsRef.current) {
            const combined = new Uint8Array(spsPpsRef.current.length + payload.length);
            combined.set(spsPpsRef.current, 0);
            combined.set(payload, spsPpsRef.current.length);
            chunkData = combined;
          }

          const chunk = new EncodedVideoChunk({
            type: 'key',
            timestamp: ptsMicros,
            data: chunkData
          });
          decoderRef.current.decode(chunk);
          hasKeyframeRef.current = true;
        } catch (err) {
          console.warn('Keyframe decode error:', err);
        }
        return;
      }

      // 3. Handle Delta Frame (only decode if initial keyframe was processed)
      if (hasKeyframeRef.current) {
        // Ultra-low latency enforcement:
        // If hardware decoder queue backs up (> 2 frames), skip delta frames to stay pinned to real-time live
        if (decoderRef.current.decodeQueueSize > 2) {
          return;
        }

        try {
          const chunk = new EncodedVideoChunk({
            type: 'delta',
            timestamp: ptsMicros,
            data: payload
          });
          decoderRef.current.decode(chunk);
        } catch (err) {
          console.warn('Delta frame decode error:', err);
        }
      }
    },
    [configureDecoder]
  );

  const resetDecoder = useCallback(() => {
    spsPpsRef.current = null;
    hasKeyframeRef.current = false;
    configureDecoder('avc1.64002a');
  }, [configureDecoder]);

  return { isReady, error, decodeChunk, resetDecoder };
}
