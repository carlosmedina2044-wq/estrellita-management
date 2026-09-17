"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import { DUR_SCREEN, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function CountUp({
  to,
  duration = DUR_SCREEN,
  delay = 0,
  className,
}: {
  to: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const value = useMotionValue(reduceMotion || duration === 0 ? to : 0);

  useMotionValueEvent(value, "change", (latest) => {
    if (ref.current) ref.current.textContent = String(Math.round(latest));
  });

  useEffect(() => {
    if (reduceMotion || duration === 0) {
      if (ref.current) ref.current.textContent = String(Math.round(to));
      return;
    }
    const controls = animate(value, to, { duration, delay, ease: EASE_OUT });
    return () => controls.stop();
  }, [delay, duration, reduceMotion, to, value]);

  return (
    <span ref={ref} className={cn("num tabular-nums", className)}>
      {Math.round(reduceMotion || duration === 0 ? to : 0)}
    </span>
  );
}
