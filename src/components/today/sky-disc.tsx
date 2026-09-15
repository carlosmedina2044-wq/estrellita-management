"use client";

import { useReducedMotion } from "motion/react";
import type { SkyPhase } from "@/lib/scene/sun";
import { cn } from "@/lib/utils";

type SkyDiscProps = {
  phase: SkyPhase;
  /** 0–1 along current phase. */
  t: number;
  sun?: { altitudeDeg: number; azimuthDeg: number } | null;
  className?: string;
};

function discStyle(
  phase: SkyPhase,
  t: number,
  sun?: { altitudeDeg: number; azimuthDeg: number } | null,
): React.CSSProperties {
  let progress: number;
  if (sun && Number.isFinite(sun.azimuthDeg)) {
    progress = Math.min(1, Math.max(0, (sun.azimuthDeg - 90) / 180));
  } else {
    progress =
      phase === "dawn"
        ? 0.15 + t * 0.2
        : phase === "day"
          ? 0.35 + t * 0.3
          : phase === "golden"
            ? 0.65 + t * 0.1
            : phase === "dusk"
              ? 0.75 + t * 0.15
              : 0.85;
  }

  const altitude =
    sun && Number.isFinite(sun.altitudeDeg)
      ? Math.min(1, Math.max(0, (sun.altitudeDeg + 4) / 74))
      : phase === "day"
        ? 0.7
        : phase === "night"
          ? 0.55
          : 0.45;

  const x = `${8 + progress * 72}%`;
  const y = `${8 + (1 - altitude) * 28}%`;

  const isMoon = phase === "night" || (phase === "dusk" && t > 0.7);
  const size = isMoon ? 28 : phase === "golden" ? 42 : 36;
  const color = isMoon
    ? "color-mix(in oklab, #e8eef8 90%, white)"
    : phase === "golden" || phase === "dusk"
      ? "#ffb45a"
      : phase === "dawn"
        ? "#ffd090"
        : "#ffe9a8";
  const glow = isMoon
    ? "0 0 28px rgba(200, 220, 255, 0.4)"
    : `radial-gradient(circle, ${color} 0%, transparent 70%)`;

  return {
    left: x,
    top: y,
    width: size,
    height: size,
    background: isMoon
      ? color
      : `radial-gradient(circle at 35% 35%, #fff6d8 0%, ${color} 45%, transparent 70%)`,
    boxShadow: isMoon ? glow : `0 0 40px rgba(255, 180, 80, 0.45)`,
    opacity: phase === "day" && t > 0.15 && t < 0.85 ? 0.9 : 1,
  };
}

export function SkyDisc({ phase, t, sun, className }: SkyDiscProps) {
  const reduce = useReducedMotion();
  const style = discStyle(phase, t, sun);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
        !reduce && "transition-[left,top,opacity] duration-1000 ease-out",
        className,
      )}
      style={style}
    />
  );
}
