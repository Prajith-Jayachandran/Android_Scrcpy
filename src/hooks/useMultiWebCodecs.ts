import { useRef, useEffect, useState, useCallback } from 'react';
import { StreamMeta } from '../lib/types';

interface DeviceDecoderEntry {
  decoder: VideoDecoder | null;
  canvas: HTMLCanvasElement | null;
  currentCodec: string;
  spsPps: Uint8Array | null;
  hasKeyframe: boolean;
  frameCount: number;
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
          const profile = payload[nalStart + 1].toString(16).padStart(2, '0');
          const constraint = payload[nalStart + 2].toString(16).padStart(2, '0');
          const level = payload[nalStart + 3].toString(16).padStart(2, '0');
          return `avc1.${profile}${constraint}${level}`;
        }
      }
    }
  }
  return 'avc1.64002a';
}

export function useMultiWebCodecs() {
  const devicesRef = useRef<Map<string, DeviceDecoderEntry>>(new Map());
  const [fpsMap, setFpsMap] = useState<Record<string, number>>({});
  const lastFpsTimeRef = useRef(Date.now());

  // Per-device FPS calculator interval
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const deltaSec = (now - lastFpsTimeRef.current) / 1000;
      if (deltaSec >= 1) {
        const newFpsMap: Record<string, number> = {};
        devicesRef.current.forEach((entry, id) => {
          newFpsMap[id] = Math.round(entry.frameCount / deltaSec);
          entry.frameCount = 0;
        });
        setFpsMap(newFpsMap);
        lastFpsTimeRef.current = now;
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getOrCreateDeviceEntry = useCallback((deviceId: string): DeviceDecoderEntry => {
    let entry = devicesRef.current.get(deviceId);
    if (!entry) {
      entry = {
        decoder: null,
        canvas: null,
        currentCodec: 'avc1.64002a',
        spsPps: null,
        hasKeyframe: false,
        frameCount: 0,
      };
      devicesRef.current.set(deviceId, entry);
    }
    return entry;
  }, []);

  const configureDeviceDecoder = useCallback((deviceId: string, codecString: string) => {
    if (typeof window === 'undefined' || !('VideoDecoder' in window)) {
      return;
    }

    const entry = getOrCreateDeviceEntry(deviceId);
    try {
      if (entry.decoder && entry.decoder.state !== 'closed') {
        entry.decoder.close();
      }

      entry.hasKeyframe = false;
      entry.currentCodec = codecString;

      const decoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          const canvas = entry.canvas;
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
          entry.frameCount++;
          frame.close();
        },
        error: (e) => {
          console.warn(`[WebCodecs Error - ${deviceId}]:`, e);
        },
      });

      decoder.configure({
        codec: codecString,
        optimizeForLatency: true,
        // @ts-ignore - avc annexb format spec
        avc: { format: 'annexb' },
      });

      entry.decoder = decoder;
    } catch (err: any) {
      console.error(`Failed to configure decoder for ${deviceId}:`, err);
    }
  }, [getOrCreateDeviceEntry]);

  const registerCanvas = useCallback(
    (deviceId: string, canvas: HTMLCanvasElement | null) => {
      const entry = getOrCreateDeviceEntry(deviceId);
      entry.canvas = canvas;
      if (canvas && (!entry.decoder || entry.decoder.state === 'closed')) {
        configureDeviceDecoder(deviceId, entry.currentCodec);
      }
    },
    [getOrCreateDeviceEntry, configureDeviceDecoder]
  );

  const unregisterCanvas = useCallback((deviceId: string) => {
    const entry = devicesRef.current.get(deviceId);
    if (entry) {
      entry.canvas = null;
    }
  }, []);

  const decodeChunk = useCallback(
    (
      deviceId: string,
      payload: Uint8Array,
      isKeyFrame: boolean,
      isConfig: boolean,
      ptsMicros: number
    ) => {
      const entry = getOrCreateDeviceEntry(deviceId);

      // 1. Handle SPS/PPS configuration packet
      if (isConfig) {
        entry.spsPps = payload;
        const detectedCodec = extractH264Codec(payload);
        if (detectedCodec !== entry.currentCodec || !entry.decoder || entry.decoder.state === 'closed') {
          configureDeviceDecoder(deviceId, detectedCodec);
        }
        return;
      }

      if (!entry.decoder || entry.decoder.state !== 'configured') {
        return;
      }

      // 2. Handle Keyframe
      if (isKeyFrame) {
        try {
          let chunkData = payload;
          if (entry.spsPps) {
            const combined = new Uint8Array(entry.spsPps.length + payload.length);
            combined.set(entry.spsPps, 0);
            combined.set(payload, entry.spsPps.length);
            chunkData = combined;
          }

          const chunk = new EncodedVideoChunk({
            type: 'key',
            timestamp: ptsMicros,
            data: chunkData,
          });

          entry.decoder.decode(chunk);
          entry.hasKeyframe = true;
        } catch (err) {
          console.warn(`Keyframe decode error on ${deviceId}:`, err);
        }
        return;
      }

      // 3. Handle Delta Frame (only after receiving first keyframe)
      if (entry.hasKeyframe) {
        try {
          const chunk = new EncodedVideoChunk({
            type: 'delta',
            timestamp: ptsMicros,
            data: payload,
          });
          entry.decoder.decode(chunk);
        } catch (err) {
          console.warn(`Delta decode error on ${deviceId}:`, err);
        }
      }
    },
    [getOrCreateDeviceEntry, configureDeviceDecoder]
  );

  const resetDecoder = useCallback((deviceId?: string) => {
    if (deviceId) {
      const entry = devicesRef.current.get(deviceId);
      if (entry && entry.decoder && entry.decoder.state !== 'closed') {
        try {
          entry.decoder.close();
        } catch (e) {}
        entry.decoder = null;
        entry.hasKeyframe = false;
        configureDeviceDecoder(deviceId, entry.currentCodec);
      }
    } else {
      devicesRef.current.forEach((entry, id) => {
        if (entry.decoder && entry.decoder.state !== 'closed') {
          try {
            entry.decoder.close();
          } catch (e) {}
          entry.decoder = null;
          entry.hasKeyframe = false;
        }
      });
    }
  }, [configureDeviceDecoder]);

  // Clean up all decoders on unmount
  useEffect(() => {
    return () => {
      devicesRef.current.forEach((entry) => {
        if (entry.decoder && entry.decoder.state !== 'closed') {
          try {
            entry.decoder.close();
          } catch (e) {}
        }
      });
      devicesRef.current.clear();
    };
  }, []);

  return {
    registerCanvas,
    unregisterCanvas,
    decodeChunk,
    resetDecoder,
    fpsMap,
  };
}
