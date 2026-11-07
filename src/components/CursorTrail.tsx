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
  decay: number;
}

export const CursorTrail: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<{ x: number; y: number; time: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef<{ x: number; y: number; lastX: number; lastY: number; moved: boolean }>({
    x: -100,
    y: -100,
    lastX: -100,
    lastY: -100,
    moved: false,
  });
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
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
      'rgba(236, 72, 153, ', // Pink
    ];

    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;

      document.documentElement.style.setProperty('--cursor-x', `${x}px`);
      document.documentElement.style.setProperty('--cursor-y', `${y}px`);

      const dx = x - mouseRef.current.lastX;
      const dy = y - mouseRef.current.lastY;
      const speed = Math.sqrt(dx * dx + dy * dy);

      mouseRef.current.lastX = mouseRef.current.x;
      mouseRef.current.lastY = mouseRef.current.y;
      mouseRef.current.x = x;
      mouseRef.current.y = y;
      mouseRef.current.moved = true;

      pointsRef.current.push({ x, y, time: Date.now() });
      if (pointsRef.current.length > 25) {
        pointsRef.current.shift();
      }

      // Spawn glowing ethereal particles on cursor movement
      if (speed > 2) {
        const count = Math.min(3, Math.floor(speed / 8) + 1);
        for (let i = 0; i < count; i++) {
          const colorBase = colors[Math.floor(Math.random() * colors.length)];
          const angle = Math.random() * Math.PI * 2;
          const particleSpeed = Math.random() * 1.5 + 0.5;
          particlesRef.current.push({
            x: x + (Math.random() - 0.5) * 8,
            y: y + (Math.random() - 0.5) * 8,
            vx: Math.cos(angle) * particleSpeed + dx * 0.05,
            vy: Math.sin(angle) * particleSpeed + dy * 0.05,
            size: Math.random() * 3.5 + 1.5,
            color: colorBase,
            alpha: 0.85,
            decay: Math.random() * 0.03 + 0.02,
          });
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = Date.now();
      // Filter out points older than 350ms
      pointsRef.current = pointsRef.current.filter((p) => now - p.time < 350);

      // 1. Draw glowing neon ribbon trail
      if (pointsRef.current.length > 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < pointsRef.current.length; i++) {
          const p1 = pointsRef.current[i - 1];
          const p2 = pointsRef.current[i];
          const ageRatio = (now - p2.time) / 350; // 0 (new) to 1 (old)
          const alpha = Math.max(0, 1 - ageRatio);
          const width = Math.max(1, (1 - ageRatio) * 6);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);

          // Glowing multi-layer stroke
          ctx.strokeStyle = `rgba(129, 140, 248, ${alpha * 0.45})`;
          ctx.lineWidth = width * 1.8;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#6366f1';
          ctx.stroke();

          ctx.strokeStyle = `rgba(216, 180, 254, ${alpha * 0.8})`;
          ctx.lineWidth = width * 0.8;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 2. Draw glowing ambient particle sparks
      ctx.save();
      ctx.globalCompositeOperation = 'screen';

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.size *= 0.96;

        if (p.alpha <= 0 || p.size <= 0.2) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color + '1)';
        ctx.fill();
      }
      ctx.restore();

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 transition-opacity duration-300"
    />
  );
};
