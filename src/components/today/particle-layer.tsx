"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { PARTICLE_CAP, prefersReducedMotion } from "@/lib/motion";

const COLORS = ["#2f5d8a", "#8fb6e0", "#f5ebd8"] as const;
/** Fireflies are light, not confetti, so they keep their own warm set. */
const EMBER_COLORS = ["#ffd9a0", "#ffc27a", "#f5ebd8"] as const;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  born: number;
  life: number;
  /** A burst pops outward and fades linearly. A drifting ember rises, wanders
   * sideways and fades in as well as out, so it reads as something alive
   * rather than as debris thrown from a point. */
  drift?: { amp: number; hz: number; phase: number; baseX: number };
};

export type ParticleLayerHandle = {
  burst: (opts: { x: number; y: number; count: number }) => void;
  /** Embers rising from a band (the house's footprint), for the long tail of
   * the closing ceremony. */
  drift: (opts: { x: number; y: number; width: number; count: number }) => void;
};

export const ParticleLayer = forwardRef<ParticleLayerHandle>(function ParticleLayer(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

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
    drift({ x, y, width, count }) {
      if (prefersReducedMotion() || document.hidden) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const now = performance.now();
      const n = Math.min(Math.max(count, 1), PARTICLE_CAP);
      for (let i = 0; i < n; i++) {
        if (particlesRef.current.length >= PARTICLE_CAP) break;
        const localX = x - rect.left + (Math.random() - 0.5) * width;
        const localY = y - rect.top + Math.random() * 12;
        particlesRef.current.push({
          x: localX,
          y: localY,
          vx: 0,
          // Slow: 8-18px/s upward over a ~2.4s life is about a third of the
          // scene's height, so they leave the frame rather than piling up.
          vy: -(8 + Math.random() * 10),
          r: 1.6 + Math.random() * 1.6,
          color: EMBER_COLORS[i % EMBER_COLORS.length],
          born: now + Math.random() * 900,
          life: 2400,
          drift: {
            amp: 4 + Math.random() * 7,
            hz: 0.25 + Math.random() * 0.25,
            phase: Math.random() * Math.PI * 2,
            baseX: localX,
          },
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
      // Delta-timed, not a fixed 16ms-per-frame assumption: a ProMotion
      // display fires requestAnimationFrame at ~8ms, which previously moved
      // every particle roughly twice as far as intended and turned a tight
      // pop into a wide scatter. Clamped so a stalled frame (e.g. a tab
      // switch) doesn't teleport a particle across the screen on return.
      const dt = Math.min(1 / 20, (now - lastRef.current) / 1000);
      lastRef.current = now;
      const next: Particle[] = [];
      for (const p of particlesRef.current) {
        const age = now - p.born;
        if (age >= p.life) continue;
        // A staggered ember is not born yet: keep it, but do not draw it.
        if (age < 0) {
          next.push(p);
          continue;
        }
        const t = age / p.life;
        p.y += p.vy * dt;
        if (p.drift) {
          // Integrated from its own base rather than accumulated onto x, so a
          // dropped frame shifts the phase rather than the whole path.
          p.drift.phase += dt * p.drift.hz * Math.PI * 2;
          p.x = p.drift.baseX + Math.sin(p.drift.phase) * p.drift.amp;
          // Fade in over the first fifth, out over the last two fifths, so an
          // ember never appears or vanishes mid-air at full brightness.
          ctx.globalAlpha = Math.min(1, t / 0.2, (1 - t) / 0.4);
        } else {
          p.x += p.vx * dt;
          ctx.globalAlpha = 1 - t;
        }
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (p.drift ? 1 : 1 - t * 0.3), 0, Math.PI * 2);
        ctx.fill();
        next.push(p);
      }
      ctx.globalAlpha = 1;
      particlesRef.current = next;
      if (next.length > 0) rafRef.current = window.requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    lastRef.current = performance.now();
    rafRef.current = window.requestAnimationFrame(tick);
  }

  useEffect(() => {
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // `.app-shell-roots` has `will-change: transform`, so it is the containing
  // block for anything `fixed` inside it: this canvas was sized and stacked
  // against that pane rather than the viewport, and painted under the tab bar.
  if (typeof document === "undefined") return null;
  return createPortal(
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden
    />,
    document.body,
  );
});
