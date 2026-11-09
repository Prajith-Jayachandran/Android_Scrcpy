'use client';

import { useState, useCallback, useRef } from 'react';
import { createWorker } from 'tesseract.js';

interface UseCanvasOcrProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onLog?: (msg: string) => void;
}

export function useCanvasOcr({ canvasRef, onLog }: UseCanvasOcrProps) {
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isSnipping, setIsSnipping] = useState<boolean>(false);
  const workerRef = useRef<any>(null);

  // Lazy-initialize Tesseract worker
  const getWorker = useCallback(async () => {
    if (!workerRef.current) {
      onLog?.('Initializing OCR engine worker...');
      const worker = await createWorker('eng');
      workerRef.current = worker;
      onLog?.('OCR engine worker ready.');
    }
    return workerRef.current;
  }, [onLog]);

  // Extract text from the full canvas or a specified ROI
  const recognizeCanvasText = useCallback(
    async (roi?: { x: number; y: number; width: number; height: number }): Promise<string> => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0) return '';

      setIsOcrProcessing(true);
      try {
        let sourceCanvas = canvas;

        // If ROI is provided, crop region to a temporary canvas
        if (roi && roi.width > 0 && roi.height > 0) {
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = roi.width;
          cropCanvas.height = roi.height;
          const cropCtx = cropCanvas.getContext('2d');
          if (cropCtx) {
            cropCtx.drawImage(canvas, roi.x, roi.y, roi.width, roi.height, 0, 0, roi.width, roi.height);
            sourceCanvas = cropCanvas;
          }
        }

        const dataUrl = sourceCanvas.toDataURL('image/png');
        const worker = await getWorker();
        const ret = await worker.recognize(dataUrl);
        const text = ret.data.text.trim();
        setExtractedText(text);
        onLog?.(`[OCR Result]: "${text.replace(/\n/g, ' ')}"`);
        return text;
      } catch (err: any) {
        console.error('OCR Recognition error:', err);
        return '';
      } finally {
        setIsOcrProcessing(false);
      }
    },
    [canvasRef, getWorker, onLog]
  );

  // Check if a target text appears on the canvas within timeoutMs
  const waitForTextOnCanvas = useCallback(
    async (targetText: string, timeoutMs: number = 5000): Promise<boolean> => {
      const startTime = Date.now();
      const cleanTarget = targetText.trim().toLowerCase();

      while (Date.now() - startTime < timeoutMs) {
        const text = await recognizeCanvasText();
        if (text.toLowerCase().includes(cleanTarget)) {
          return true;
        }
        await new Promise((r) => setTimeout(r, 600));
      }

      return false;
    },
    [recognizeCanvasText]
  );

  return {
    isOcrProcessing,
    extractedText,
    isSnipping,
    setIsSnipping,
    recognizeCanvasText,
    waitForTextOnCanvas,
  };
}
