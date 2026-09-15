"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";
import type { WeatherKind } from "@/lib/scene/sky";

type WeatherLayerProps = {
  kind: WeatherKind;
  intensity: number;
  className?: string;
};

type Drop = {
  x: number;
  y: number;
  len: number;
  speed: number;
  drift: number;
  r: number;
};

export function WeatherLayer({ kind, intensity, className }: WeatherLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<Drop[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (prefersReducedMotion() || kind === "clear" || intensity <= 0) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      dropsRef.current = [];
      return;
    }

    const isSnow = kind === "snow";
    const isRain = kind === "rain";
    if (!isSnow && !isRain) return;

    const target = Math.min(
      120,
      Math.floor((isSnow ? 40 : 70) * Math.max(0.2, Math.min(1, intensity))),
    );

    const ensure = (w: number, h: number) => {
      while (dropsRef.current.length < target) {
        dropsRef.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          len: isSnow ? 0 : 8 + Math.random() * 10,
          speed: isSnow ? 20 + Math.random() * 30 : 280 + Math.random() * 220,
          drift: (Math.random() - 0.5) * (isSnow ? 24 : 12),
          r: isSnow ? 1.2 + Math.random() * 2.2 : 1,
        });
      }
      if (dropsRef.current.length > target) {
        dropsRef.current.length = target;
      }
    };

    let last = performance.now();
    const tick = (now: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = null;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 0 || h <= 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ensure(w, h);

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (isRain) {
        ctx.strokeStyle = "rgba(180, 210, 240, 0.45)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const d of dropsRef.current) {
          d.y += d.speed * dt;
          d.x += d.drift * dt;
          if (d.y > h + 20) {
            d.y = -20;
            d.x = Math.random() * w;
          }
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + d.drift * 0.02, d.y + d.len);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        for (const d of dropsRef.current) {
          d.y += d.speed * dt;
          d.x += Math.sin(now / 700 + d.x) * 8 * dt + d.drift * dt * 0.2;
          if (d.y > h + 10) {
            d.y = -10;
            d.x = Math.random() * w;
          }
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [kind, intensity]);

  if (kind === "clear" || intensity <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className ?? "pointer-events-none absolute inset-0 h-full w-full"}
    />
  );
}
