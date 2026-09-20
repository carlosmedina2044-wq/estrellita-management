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
    <span className={cn("inline-flex align-baseline num tabular-nums", className)}>
      {/* The digits are separate boxes so each can slide on its own, which
          means assistive tech would otherwise read 30 as "three zero". The
          real number is announced once, here, and the moving parts are
          hidden. Today's own cards mostly sit inside buttons with their own
          aria-label, but this component is used well beyond them. */}
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex align-baseline">
        {text.split("").map((digit, index) => (
          // Keyed by position only — the digit itself keys the child below, so
          // a position whose digit is unchanged (19 -> 29's ones place) never
          // remounts and never re-plays its enter animation. It previously kept
          // `value` in the key too, which retriggered every digit on every
          // change regardless of whether that digit actually moved.
          <span
            key={index}
            className="relative inline-block w-[1ch] overflow-hidden text-center align-baseline leading-none"
          >
            {/* Invisible strut sizes the slot to a real digit's metrics.
                A fixed `h-[1lh]` plus `overflow-hidden` remaps the CSS
                baseline to the box bottom, so absolute digits sat above
                adjacent plain text ("4 of 5"). */}
            <span className="invisible">0</span>
            <AnimatePresence initial={false} mode="popLayout">
              {/* `absolute inset-0`, not `block`: with normal flow, the entering
                digit would stack below the exiting one (the box only gets its
                size from the strut / `1ch`, not from an in-flow child) rather
                than sliding directly over it. `tabular-nums` on `.num`
                guarantees every digit is exactly `1ch` wide, so nothing
                shifts horizontally as digits change. Match the strut's
                `leading-none` text flow (not flex-center) so the resting
                glyph shares the same metrics as adjacent plain digits. */}
              <motion.span
                key={digit}
                className="absolute inset-0 text-center leading-none"
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
    </span>
  );
}
