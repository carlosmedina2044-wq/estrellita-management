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
  /** Which silhouette. One lozenge repeated three times read as a pattern
   * rather than as weather — the eye finds the repeat before it finds the
   * sky. Two shapes and a bank of three is enough to break it. */
  shape: 0 | 1 | 2;
  /** A slow vertical wander, so the three do not travel on rails. */
  bob: number;
};

/** Up to five at full cover, not three: an overcast sky with three clouds in
 * it is a sky with three clouds in it. */
function buildClouds(cover: number): Cloud[] {
  const n = Math.min(5, Math.max(0, Math.round(cover * 5)));
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    top: `${8 + i * 9}%`,
    scale: 0.7 + ((i * 7) % 5) * 0.12,
    opacity: 0.24 + cover * 0.3 - (i % 2) * 0.05,
    duration: 52 + i * 11,
    delay: i * -13,
    shape: (i % 3) as 0 | 1 | 2,
    bob: 7 + (i % 3) * 3,
  }));
}

/** Three silhouettes built from overlapping lozenges, so no two clouds in a
 * bank are the same outline. */
function CloudShape({ shape }: { shape: 0 | 1 | 2 }) {
  if (shape === 1) {
    return (
      <span className="relative block h-10 w-32">
        <span className="absolute left-0 top-2 h-8 w-20 rounded-[50%] bg-white/75 blur-[0.5px]" />
        <span className="absolute left-10 top-0 h-9 w-16 rounded-[50%] bg-white/75 blur-[0.5px]" />
      </span>
    );
  }
  if (shape === 2) {
    return (
      <span className="relative block h-9 w-24">
        <span className="absolute left-0 top-1 h-7 w-16 rounded-[50%] bg-white/70 blur-[0.5px]" />
        <span className="absolute left-7 top-3 h-5 w-12 rounded-[50%] bg-white/70 blur-[0.5px]" />
      </span>
    );
  }
  return <span className="block h-11 w-28 rounded-[50%] bg-white/75 blur-[0.5px]" />;
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
            className={cn(!reduce && "portrait-cloud-bob")}
            style={{
              transform: `scale(${c.scale})`,
              animationDuration: reduce ? undefined : `${c.bob}s`,
              animationDelay: reduce ? undefined : `${c.delay}s`,
            }}
          >
            <CloudShape shape={c.shape} />
          </div>
        </div>
      ))}
    </div>
  );
}
