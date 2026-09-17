/** Scroll/animation helpers that respect Reduce Motion. */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

export const SPRING_PRESS = { type: "spring", stiffness: 520, damping: 32, mass: 0.6 } as const;
export const SPRING_SETTLE = { type: "spring", stiffness: 260, damping: 26 } as const;
/** Low-stiffness spring for anything a finger is still touching when it lets go —
 * a sheet rebounding past its dismiss threshold, a swipe action springing back
 * open. Softer than SPRING_SETTLE so a released drag doesn't snap. */
export const SPRING_DRAG = { type: "spring", stiffness: 300, damping: 32, mass: 0.9 } as const;
export const EASE_OUT = [0.32, 0.72, 0, 1] as const;

/**
 * The duration scale. Four steps, each roughly 1.6x the last, cover every
 * interaction in the app — pick the nearest one rather than a bespoke value.
 * A raw numeric `duration:` in `src/components` fails `motion.test.ts`.
 *
 *   DUR_INSTANT  press feedback, a decoy stroke fading, an exit
 *   DUR_QUICK    most micro-transitions: icon swaps, draws, strikethroughs
 *   DUR_BASE     a card or notice appearing, a title change
 *   DUR_SCREEN   sheets, the shell push, ceremony-scale beats
 *
 * `DUR_AMBIENT` is deliberately outside the interaction scale: background art
 * (a seasonal crossfade) reads better slower than anything a finger is
 * waiting on, so it gets its own, longer step instead of being squeezed into
 * DUR_SCREEN.
 */
export const DUR_INSTANT = 0.12;
export const DUR_QUICK = 0.2;
export const DUR_BASE = 0.32;
export const DUR_SCREEN = 0.4;
export const DUR_AMBIENT = 0.6;

/** The one stagger step in use (the run strip's dots). Named so a second use
 * has something to match rather than inventing its own value. */
export const STAGGER_CHILD = 0.07;

export const COMPLETE_HOLD_MS = 320;
export const CEREMONY_MS = 1200;
export const PARTICLE_CAP = 24;
