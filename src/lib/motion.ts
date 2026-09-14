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
export const EASE_OUT = [0.32, 0.72, 0, 1] as const;
export const COMPLETE_HOLD_MS = 320;
export const CEREMONY_MS = 1200;
export const PARTICLE_CAP = 24;
