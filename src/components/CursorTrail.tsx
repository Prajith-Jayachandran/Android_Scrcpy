'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

export const CursorTrail: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameId = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const lastMoveTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const colors = [
      'rgba(99, 102, 241, ', // Indigo
      'rgba(168, 85, 247, ', // Purple
      'rgba(6, 182, 212, ',  // Cyan
    ];

    const startLoop = () => {
      if (!isRunningRef.current) {
        isRunningRef.current = true;
        animFrameId.current = requestAnimationFrame(render);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      const now = Date.now();
      lastMoveTimeRef.current = now;

      pointsRef.current.push({ x, y, time: now });
      if (pointsRef.current.length > 14) {
        pointsRef.current.shift();
      }

      // Spawn 1 lightweight particle every few moves
      if (Math.random() > 0.4 && particlesRef.current.length < 12) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        particlesRef.current.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          size: Math.random() * 2.5 + 1.5,
          color,
          alpha: 0.7,
        });
      }

      startLoop();
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = Date.now();

      // Clean old points (> 200ms)
      pointsRef.current = pointsRef.current.filter((p) => now - p.time < 200);

      // 1. Draw smooth ribbon trail
      if (pointsRef.current.length > 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < pointsRef.current.length; i++) {
          const p1 = pointsRef.current[i - 1];
          const p2 = pointsRef.current[i];
          const ageRatio = (now - p2.time) / 200;
          const alpha = Math.max(0, 1 - ageRatio);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(129, 140, 248, ${alpha * 0.55})`;
          ctx.lineWidth = (1 - ageRatio) * 4 + 1;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Draw active particles
      if (particlesRef.current.length > 0) {
        ctx.save();
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.04;
          p.size *= 0.95;

          if (p.alpha <= 0 || p.size <= 0.4) {
            particlesRef.current.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${p.alpha})`;
          ctx.fill();
        }
        ctx.restore();
      }

      // Stop loop when idle to preserve 100% CPU/GPU for video decoding
      if (pointsRef.current.length === 0 && particlesRef.current.length === 0) {
        isRunningRef.current = false;
        return;
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      isRunningRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
};
