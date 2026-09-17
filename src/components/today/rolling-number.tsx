"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  const rounded = Math.max(0, Math.round(value));
  const text = String(rounded);

  // Tracks direction across renders, not identity: whichever digit changed
  // should slide the way the number as a whole moved (up when it rose, down
  // when it fell), not always upward regardless. Adjusted during render
  // rather than in an effect or a ref write — the sanctioned way to derive
  // "did this prop change since last render" (react.dev, "Adjusting state
  // when a prop changes"); an effect would run a frame late, after the digits
  // had already committed in the wrong direction.
  const [previous, setPrevious] = useState(rounded);
  const [rising, setRising] = useState(true);
  if (rounded !== previous) {
    setRising(rounded > previous);
    setPrevious(rounded);
  }

  if (reduceMotion) {
    return <span className={cn("num tabular-nums", className)}>{text}</span>;
  }

  return (
    <span className={cn("inline-flex num tabular-nums", className)}>
      {text.split("").map((digit, index) => (
        // Keyed by position only — the digit itself keys the child below, so
        // a position whose digit is unchanged (19 -> 29's ones place) never
        // remounts and never re-plays its enter animation. It previously kept
        // `value` in the key too, which retriggered every digit on every
        // change regardless of whether that digit actually moved.
        <span key={index} className="relative inline-block h-[1lh] w-[1ch] overflow-hidden text-center">
          <AnimatePresence initial={false} mode="popLayout">
            {/* `absolute inset-0`, not `block`: with normal flow, the entering
                digit would stack below the exiting one (the box only gets its
                width/height from the `1ch`/`1lh` on the wrapper, not from an
                in-flow child) rather than sliding directly over it. `tabular-
                nums` on `.num` guarantees every digit is exactly `1ch` wide,
                so nothing shifts horizontally as digits change. */}
            <motion.span
              key={digit}
              className="absolute inset-0"
              initial={{ y: rising ? "100%" : "-100%" }}
              animate={{ y: "0%" }}
              exit={{ y: rising ? "-100%" : "100%" }}
              transition={SPRING_SETTLE}
            >
              {digit}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
