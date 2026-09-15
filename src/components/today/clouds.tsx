"use client";

import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type CloudsProps = {
  cover: number;
  className?: string;
};

type Cloud = {
  id: number;
  top: string;
  scale: number;
  opacity: number;
  duration: number;
  delay: number;
};

function buildClouds(cover: number): Cloud[] {
  const n = Math.min(3, Math.max(0, Math.round(cover * 3)));
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    top: `${10 + i * 12}%`,
    scale: 0.75 + (i % 2) * 0.3,
    opacity: 0.28 + cover * 0.32,
    duration: 52 + i * 14,
    delay: i * -11,
  }));
}

export function Clouds({ cover, className }: CloudsProps) {
  const reduce = useReducedMotion();
  const clouds = useMemo(() => buildClouds(cover), [cover]);

  if (cover < 0.08) return null;

  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {clouds.map((c) => (
        <div
          key={c.id}
          className={cn("absolute h-11 w-28 rounded-[50%] bg-white/75 blur-[0.5px]", !reduce && "portrait-cloud")}
          style={{
            top: c.top,
            left: "-30%",
            opacity: c.opacity,
            transform: `scale(${c.scale})`,
            animationDuration: reduce ? undefined : `${c.duration}s`,
            animationDelay: reduce ? undefined : `${c.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
