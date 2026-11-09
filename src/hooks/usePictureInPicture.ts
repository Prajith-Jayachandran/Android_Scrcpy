'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { StreamMeta } from '@/lib/types';

interface UsePictureInPictureProps {
  deviceId: string;
  meta: StreamMeta | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onTap: (deviceId: string, x: number, y: number) => void;
  onSwipe: (deviceId: string, x1: number, y1: number, x2: number, y2: number, duration: number) => void;
  onSendKey: (code: number) => void;
}

export function usePictureInPicture({
  deviceId,
  meta,
  canvasRef,
  onTap,
  onSwipe,
  onSendKey,
}: UsePictureInPictureProps) {
  const [isPipActive, setIsPipActive] = useState<boolean>(false);
  const pipWindowRef = useRef<any>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const deviceIdRef = useRef(deviceId);
  const metaRef = useRef(meta);
  const onTapRef = useRef(onTap);
  const onSwipeRef = useRef(onSwipe);
  const onSendKeyRef = useRef(onSendKey);

  useEffect(() => {
    deviceIdRef.current = deviceId;
    metaRef.current = meta;
    onTapRef.current = onTap;
    onSwipeRef.current = onSwipe;
    onSendKeyRef.current = onSendKey;
  }, [deviceId, meta, onTap, onSwipe, onSendKey]);

  // Continuously mirror source canvas frames to PiP window canvas
  const startCanvasSync = useCallback((pipCanvas: HTMLCanvasElement) => {
    const pipCtx = pipCanvas.getContext('2d', { alpha: false });
    if (!pipCtx) return;

    const renderLoop = () => {
      const sourceCanvas = canvasRef.current;
      if (sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
        if (pipCanvas.width !== sourceCanvas.width || pipCanvas.height !== sourceCanvas.height) {
          pipCanvas.width = sourceCanvas.width;
          pipCanvas.height = sourceCanvas.height;
        }
        pipCtx.drawImage(sourceCanvas, 0, 0);
      }
      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  }, [canvasRef]);

  const closePip = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    pipCanvasRef.current = null;
    setIsPipActive(false);
  }, []);

  const openPip = useCallback(async () => {
    if (!('documentPictureInPicture' in window)) {
      alert('Document Picture-in-Picture is not supported in this browser. Please use Chrome 116+ or Edge.');
      return;
    }

    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.focus();
      return;
    }

    try {
      const width = metaRef.current?.width || 1080;
      const height = metaRef.current?.height || 2373;
      const aspect = width / height;

      const pipHeight = 720;
      const pipWidth = Math.round(pipHeight * aspect);

      const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
        width: Math.max(320, pipWidth),
        height: pipHeight,
      });

      pipWindowRef.current = pipWindow;
      setIsPipActive(true);

      // Copy CSS stylesheets into PiP window
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          const style = document.createElement('style');
          style.textContent = Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join('');
          pipWindow.document.head.appendChild(style);
        } catch (e) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = (sheet as any).href;
          pipWindow.document.head.appendChild(link);
        }
      });

      // Construct PiP Window DOM
      const body = pipWindow.document.body;
      body.style.margin = '0';
      body.style.padding = '0';
      body.style.background = '#060913';
      body.style.color = '#fff';
      body.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      body.style.display = 'flex';
      body.style.flexDirection = 'column';
      body.style.height = '100vh';
      body.style.overflow = 'hidden';
      body.style.userSelect = 'none';

      // Header Bar
      const header = document.createElement('div');
      header.style.cssText =
        'display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: rgba(15,23,42,0.8); border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 11px; font-weight: 600; color: #94a3b8;';
      header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e;"></span>
          <span style="color: #f1f5f9; letter-spacing: 0.5px;">Aether PiP</span>
        </div>
        <span style="font-family: monospace; font-size: 10px; color: #818cf8;">60 FPS</span>
      `;
      body.appendChild(header);

      // Canvas Container
      const canvasContainer = document.createElement('div');
      canvasContainer.style.cssText =
        'flex: 1; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; background: #000;';

      const pipCanvas = document.createElement('canvas');
      pipCanvas.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain; cursor: crosshair; touch-action: none;';
      canvasContainer.appendChild(pipCanvas);
      body.appendChild(canvasContainer);

      pipCanvasRef.current = pipCanvas;
      startCanvasSync(pipCanvas);

      // Touch / Mouse Gesture Handling on PiP Canvas
      let isDown = false;
      let startX = 0;
      let startY = 0;
      let startTime = 0;

      const getCanvasCoords = (e: MouseEvent) => {
        const rect = pipCanvas.getBoundingClientRect();
        const scaleX = pipCanvas.width / rect.width;
        const scaleY = pipCanvas.height / rect.height;
        return {
          x: Math.round((e.clientX - rect.left) * scaleX),
          y: Math.round((e.clientY - rect.top) * scaleY),
        };
      };

      pipCanvas.addEventListener('mousedown', (e) => {
        isDown = true;
        const coords = getCanvasCoords(e);
        startX = coords.x;
        startY = coords.y;
        startTime = Date.now();
      });

      pipCanvas.addEventListener('mouseup', (e) => {
        if (!isDown) return;
        isDown = false;
        const coords = getCanvasCoords(e);
        const duration = Math.max(50, Date.now() - startTime);
        const dist = Math.hypot(coords.x - startX, coords.y - startY);

        if (dist < 15) {
          onTapRef.current(deviceIdRef.current, startX, startY);
        } else {
          onSwipeRef.current(deviceIdRef.current, startX, startY, coords.x, coords.y, Math.min(500, duration));
        }
      });

      // Bottom Navigation Dock
      const dock = document.createElement('div');
      dock.style.cssText =
        'display: flex; align-items: center; justify-content: space-around; padding: 8px 12px; background: rgba(15,23,42,0.9); border-top: 1px solid rgba(255,255,255,0.1);';

      const buttons = [
        { label: '◀ Back', code: 4 },
        { label: '● Home', code: 3 },
        { label: '■ Recents', code: 187 },
        { label: '⏻ Power', code: 26 },
      ];

      buttons.forEach(({ label, code }) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText =
          'padding: 4px 10px; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s;';
        btn.onmouseenter = () => (btn.style.background = 'rgba(255,255,255,0.16)');
        btn.onmouseleave = () => (btn.style.background = 'rgba(255,255,255,0.08)');
        btn.onclick = () => onSendKeyRef.current(code);
        dock.appendChild(btn);
      });

      body.appendChild(dock);

      // Handle PiP Window Close
      pipWindow.addEventListener('pagehide', () => {
        closePip();
      });
    } catch (err: any) {
      console.error('Failed to open Document PiP:', err);
      setIsPipActive(false);
    }
  }, [closePip, startCanvasSync]);

  useEffect(() => {
    return () => {
      closePip();
    };
  }, [closePip]);

  return {
    isPipSupported: typeof window !== 'undefined' && 'documentPictureInPicture' in window,
    isPipActive,
    openPip,
    closePip,
  };
}
