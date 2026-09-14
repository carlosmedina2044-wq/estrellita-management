"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { PARTICLE_CAP, prefersReducedMotion } from "@/lib/motion";

const COLORS = ["#9a5a35", "#e0662b", "#f5ebd8"] as const;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  born: number;
  life: number;
};

export type ParticleLayerHandle = {
  burst: (opts: { x: number; y: number; count: number }) => void;
};

export const ParticleLayer = forwardRef<ParticleLayerHandle>(function ParticleLayer(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    burst({ x, y, count }) {
      if (prefersReducedMotion() || document.hidden) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const localX = x - rect.left;
      const localY = y - rect.top;
      const n = Math.min(Math.max(count, 1), PARTICLE_CAP);
      const now = performance.now();
      for (let i = 0; i < n; i++) {
        if (particlesRef.current.length >= PARTICLE_CAP) break;
        const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const speed = 40 + Math.random() * 50;
        particlesRef.current.push({
          x: localX,
          y: localY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 5 + Math.random() * 4,
          color: COLORS[i % COLORS.length],
          born: now,
          life: 600,
        });
      }
      start();
    },
  }));

  function start() {
    if (rafRef.current != null) return;
    const tick = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = null;
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = null;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.clearRect(0, 0, w, h);
      const next: Particle[] = [];
      for (const p of particlesRef.current) {
        const age = now - p.born;
        if (age >= p.life) continue;
        const t = age / p.life;
        p.x += (p.vx * 16) / 1000;
        p.y += (p.vy * 16) / 1000;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - t * 0.3), 0, Math.PI * 2);
        ctx.fill();
        next.push(p);
      }
      ctx.globalAlpha = 1;
      particlesRef.current = next;
      if (next.length > 0) rafRef.current = window.requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current = window.requestAnimationFrame(tick);
  }

  useEffect(() => {
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden
    />
  );
});
