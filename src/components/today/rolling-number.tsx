"use client";

import { motion, useReducedMotion } from "motion/react";
import { SPRING_SETTLE } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function RollingNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const text = String(Math.max(0, Math.round(value)));

  if (reduceMotion) {
    return <span className={cn("num tabular-nums", className)}>{text}</span>;
  }

  return (
    <span className={cn("inline-flex num tabular-nums", className)}>
      {text.split("").map((digit, index) => (
        <span key={`${index}-${text.length}`} className="relative inline-block h-[1em] overflow-hidden">
          <motion.span
            key={`${digit}-${index}-${value}`}
            className="block"
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            transition={SPRING_SETTLE}
          >
            {digit}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
