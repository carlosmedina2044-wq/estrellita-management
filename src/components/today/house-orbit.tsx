"use client";

import { motion } from "motion/react";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { houseMomentFor } from "@/lib/care-level";
import { EASE_OUT, SPRING_SETTLE } from "@/lib/motion";
import type { DayArc } from "@/lib/momentum";
import type { CareLevelId } from "@/lib/types";
import { cn } from "@/lib/utils";

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

export function HouseOrbit({
  arc,
  level,
  dimmed,
  ceremony,
  label,
  className,
}: {
  arc: DayArc;
  level: CareLevelId;
  dimmed: boolean;
  ceremony: boolean;
  label: string;
  className?: string;
}) {
  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const r = 72;
  const continuous = arc.total > 12;
  const segments = continuous ? 1 : Math.max(arc.total, 1);
  const gap = continuous ? 0 : 6;
  const sweep = continuous ? 360 : 360 / segments - gap;
  const filledCount = continuous
    ? 0
    : ceremony && arc.state === "closed"
      ? segments
      : Math.min(segments, arc.done);
  const fraction = continuous
    ? ceremony && arc.state === "closed"
      ? 1
      : arc.fraction
    : filledCount / segments;
  const headAngle = fraction * 360;

  return (
    <div
      className={cn(
        "relative size-[168px] shrink-0",
        dimmed && "saturate-[0.85]",
        className,
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <IllustratedMoment
          kind={houseMomentFor(level)}
          size={120}
          loop
          autoplay={!dimmed}
          playing={!dimmed}
          label={label}
        />
      </div>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        {continuous ? (
          <>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="var(--border)"
              strokeWidth={5}
              strokeDasharray="4 6"
              strokeLinecap="round"
            />
            <motion.circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="var(--done)"
              strokeWidth={5}
              strokeLinecap="round"
              pathLength={1}
              initial={false}
              animate={{ pathLength: fraction }}
              transition={{ duration: 0.26, ease: EASE_OUT }}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ strokeDasharray: "1 1" }}
            />
          </>
        ) : (
          Array.from({ length: segments }, (_, index) => {
            const start = index * (360 / segments);
            const end = start + sweep;
            const filled = index < filledCount;
            return (
              <motion.path
                key={index}
                d={describeArc(cx, cy, r, start, end)}
                fill="none"
                stroke={filled ? "var(--done)" : "var(--border)"}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={filled ? undefined : "4 6"}
                pathLength={1}
                initial={filled ? { pathLength: 0 } : false}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.26, ease: EASE_OUT }}
              />
            );
          })
        )}
        <motion.circle
          r={3}
          fill="var(--brand-cream)"
          initial={false}
          animate={{
            cx: polar(cx, cy, r, headAngle).x,
            cy: polar(cx, cy, r, headAngle).y,
          }}
          transition={SPRING_SETTLE}
        />
      </svg>
    </div>
  );
}
