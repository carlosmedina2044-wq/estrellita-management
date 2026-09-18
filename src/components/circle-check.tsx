"use client";

import { AnimatePresence, motion } from "motion/react";
import { DUR_QUICK, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Tinted circle-check used in walk / onboarding lists. The tick draws itself
 * the same way the chore row's does, so the app has one check rather than two
 * that behave differently depending on which list you are in — this one used
 * to swap a static glyph on a colour transition.
 */
export function CircleCheck({
  checked,
  disabled,
  className,
}: {
  checked: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-foreground/25 bg-transparent text-transparent",
        disabled && "opacity-60",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {checked ? (
          <motion.svg
            key="tick"
            viewBox="0 0 24 24"
            className="size-3.5"
            aria-hidden
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: DUR_QUICK, ease: EASE_OUT }}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              exit={{ pathLength: 0 }}
              transition={{ duration: DUR_QUICK, ease: EASE_OUT }}
            />
          </motion.svg>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
