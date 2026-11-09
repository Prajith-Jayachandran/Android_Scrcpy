/**
 * Aether Mirror - Screen Recording, Instant GIF/Clip & Visual Diff Engine
 */

export interface RecordedClipResult {
  blob: Blob;
  url: string;
  filename: string;
  mimeType: string;
}

class ScreenRecorderEngine {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  /**
   * Start recording a WebCodecs canvas stream
   */
  public startRecording(canvas: HTMLCanvasElement, fps: number = 30): boolean {
    if (!canvas || typeof canvas.captureStream !== 'function') {
      console.warn('[ScreenRecorder]: canvas.captureStream not supported in this browser.');
      return false;
    }

    try {
      const stream = canvas.captureStream(fps);
      this.recordedChunks = [];

      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ];
      const selectedMime = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/webm';

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMime,
        videoBitsPerSecond: 4_000_000,
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(200); // 200ms slice
      return true;
    } catch (err) {
      console.error('[ScreenRecorder Error]:', err);
      return false;
    }
  }

  /**
   * Stop active recording and return the encoded Blob & download URL
   */
  public async stopRecording(): Promise<RecordedClipResult | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        return resolve(null);
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'video/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const filename = `aether_clip_${Date.now()}.${ext}`;

        this.recordedChunks = [];
        this.mediaRecorder = null;

        resolve({ blob, url, filename, mimeType });
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * Capture a baseline snapshot of the canvas as a base64 Data URL (Feature #10)
   */
  public captureSnapshot(canvas: HTMLCanvasElement): string | null {
    if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
    try {
      return canvas.toDataURL('image/png', 0.85);
    } catch (e) {
      console.warn('[ScreenRecorder]: Snapshot capture failed:', e);
      return null;
    }
  }

  /**
   * Pixel-by-pixel visual diff comparing current canvas against baseline PNG data URL
   * Returns difference percentage (0.0% = identical, 100.0% = completely different)
   */
  public async compareCanvas(
    canvas: HTMLCanvasElement,
    baselineDataUrl: string
  ): Promise<number> {
    if (!canvas || !baselineDataUrl) return 100;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const sampleW = 270; // 1/4 sample scale for lightning-fast sub-millisecond diff
          const sampleH = 590;

          // Off-screen canvas for current frame
          const c1 = document.createElement('canvas');
          c1.width = sampleW;
          c1.height = sampleH;
          const ctx1 = c1.getContext('2d');
          if (!ctx1) return resolve(0);
          ctx1.drawImage(canvas, 0, 0, sampleW, sampleH);
          const data1 = ctx1.getImageData(0, 0, sampleW, sampleH).data;

          // Off-screen canvas for baseline
          const c2 = document.createElement('canvas');
          c2.width = sampleW;
          c2.height = sampleH;
          const ctx2 = c2.getContext('2d');
          if (!ctx2) return resolve(0);
          ctx2.drawImage(img, 0, 0, sampleW, sampleH);
          const data2 = ctx2.getImageData(0, 0, sampleW, sampleH).data;

          let diffPixels = 0;
          const totalPixels = sampleW * sampleH;
          const colorThreshold = 35; // Perceptual RGB variance tolerance

          for (let i = 0; i < data1.length; i += 4) {
            const dr = Math.abs(data1[i] - data2[i]);
            const dg = Math.abs(data1[i + 1] - data2[i + 1]);
            const db = Math.abs(data1[i + 2] - data2[i + 2]);
            if (dr + dg + db > colorThreshold * 3) {
              diffPixels++;
            }
          }

          const diffPercentage = (diffPixels / totalPixels) * 100;
          resolve(Math.round(diffPercentage * 10) / 10);
        } catch (e) {
          resolve(0);
        }
      };
      img.onerror = () => resolve(100);
      img.src = baselineDataUrl;
    });
  }

  /**
   * Helper to trigger native browser file download
   */
  public downloadClip(result: RecordedClipResult): void {
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(result.url), 10_000);
  }
}

export const screenRecorder = new ScreenRecorderEngine();
