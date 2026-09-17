"use client";

import { motion } from "motion/react";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { DUR_QUICK, DUR_SCREEN, EASE_OUT } from "@/lib/motion";
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

const CREAM: Record<CareLevelId, number> = {
  "settling-in": 0,
  kept: 0.25,
  "well-kept": 0.3,
  "cared-for": 0.35,
  loved: 0.35,
};

export function HouseOrbit({
  arc,
  level,
  dimmed,
  ceremony,
  label,
  size = 116,
  className,
}: {
  arc: DayArc;
  level: CareLevelId;
  dimmed: boolean;
  ceremony: boolean;
  label: string;
  size?: number;
  className?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 6;
  const closed = arc.state === "closed";
  const segments = Math.max(arc.total, 1);
  const gap = 3;
  const sweep = 360 / segments - gap;
  const filledCount = closed ? 0 : Math.min(segments, arc.done);
  const creamOpacity = Math.min(CREAM[level], 0.35) * (dimmed ? 0.6 : 1);
  const art = Math.round(size * 0.72);

  return (
    <div
      className={cn("relative shrink-0", dimmed && "saturate-[0.85]", className)}
      style={{ width: size, height: size }}
    >
      <motion.div
        className="pointer-events-none absolute inset-[8%] rounded-full"
        style={{
          background: "radial-gradient(closest-side, var(--brand-cream), transparent)",
        }}
        animate={{ opacity: creamOpacity }}
        transition={{ duration: DUR_SCREEN }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <IllustratedMoment
          kind="living-house"
          size={art}
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
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={3.5}
        />
        {closed ? (
          <motion.circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--done)"
            strokeWidth={3.5}
            strokeLinecap="round"
            pathLength={1}
            initial={{ pathLength: ceremony ? 0 : 1 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: DUR_SCREEN, ease: EASE_OUT }}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ strokeDasharray: "1 1" }}
          />
        ) : (
          Array.from({ length: filledCount }, (_, index) => {
            const start = index * (360 / segments);
            const end = start + sweep;
            return (
              <motion.path
                key={index}
                d={describeArc(cx, cy, r, start, end)}
                fill="none"
                stroke="var(--done)"
                strokeWidth={3.5}
                strokeLinecap="round"
                pathLength={1}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: DUR_QUICK, ease: EASE_OUT }}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
