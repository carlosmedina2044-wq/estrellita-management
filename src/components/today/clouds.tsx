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
        // Two elements, not one: a CSS `animation` overrides the whole
        // `transform` property for as long as it runs, so a per-cloud
        // `scale()` set inline on the same element that drifts was silently
        // discarded the instant the drift keyframe (which only writes
        // `translateX`) started — every cloud rendered at 1x regardless of
        // `c.scale`. Splitting position/animation (outer) from the static
        // scale (inner) keeps both.
        <div
          key={c.id}
          className={cn("absolute", !reduce && "portrait-cloud")}
          style={{
            top: c.top,
            left: "-30%",
            opacity: c.opacity,
            animationDuration: reduce ? undefined : `${c.duration}s`,
            animationDelay: reduce ? undefined : `${c.delay}s`,
          }}
        >
          <div
            className="h-11 w-28 rounded-[50%] bg-white/75 blur-[0.5px]"
            style={{ transform: `scale(${c.scale})` }}
          />
        </div>
      ))}
    </div>
  );
}
