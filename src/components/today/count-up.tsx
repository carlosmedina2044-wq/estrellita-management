"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function CountUp({
  to,
  duration = 0.5,
  className,
}: {
  to: number;
  duration?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const value = useMotionValue(reduceMotion ? to : 0);

  useMotionValueEvent(value, "change", (latest) => {
    if (ref.current) ref.current.textContent = String(Math.round(latest));
  });

  useEffect(() => {
    if (reduceMotion) {
      if (ref.current) ref.current.textContent = String(Math.round(to));
      return;
    }
    const controls = animate(value, to, { duration, ease: [0.32, 0.72, 0, 1] });
    return () => controls.stop();
  }, [duration, reduceMotion, to, value]);

  return (
    <span ref={ref} className={cn("num tabular-nums", className)}>
      {Math.round(reduceMotion ? to : 0)}
    </span>
  );
}
