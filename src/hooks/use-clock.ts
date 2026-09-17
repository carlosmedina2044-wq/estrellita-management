"use client";

import { useEffect, useState } from "react";
import { isNative } from "@/lib/native/platform";

/** The sky and the greeting cannot change faster than this, so neither can a render. */
export const QUARTER_HOUR_MS = 15 * 60_000;

/** Floor `ms` to the start of its `stepMs` slot. */
export function quantize(ms: number, stepMs: number): number {
  return Math.floor(ms / stepMs) * stepMs;
}

/**
 * Dev-only `?at=` override so any hour can be rendered on demand — `?at=14:30`
 * for today at half two, or a full ISO timestamp for a specific date. The
 * static export the app ships is built with NODE_ENV=production, so this is
 * compiled out of the bundle that reaches a device.
 */
function devOverride(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("at");
  if (!raw) return null;
  const hourMinute = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (hourMinute) {
    const at = new Date();
    at.setHours(Number(hourMinute[1]), Number(hourMinute[2]), 0, 0);
    return at.getTime();
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Wall-clock time, for everything that tracks the hour: the sky phase, the sun
 * position, the greeting.
 *
 * Deliberately separate from `useNow()`, which pins to local midnight so date
 * comparisons stay stable and the duty list does not re-render every minute.
 * Passing `useNow()` into `skyPhase()` is what froze the scene at midnight —
 * `minutesOfDay` was always 0, so the phase was always `night`, so
 * `.today-night` was always on and Light Mode was unreachable.
 *
 * The value is quantised to `stepMs` and the timer wakes on that boundary, so
 * a render only happens when something downstream can actually change.
 */
export function useClock(stepMs: number = QUARTER_HOUR_MS): Date {
  const [stamp, setStamp] = useState(() => devOverride() ?? quantize(Date.now(), stepMs));

  useEffect(() => {
    if (devOverride() != null) return;

    let timer = 0;

    const sync = () => {
      setStamp((current) => {
        const next = quantize(Date.now(), stepMs);
        return current === next ? current : next;
      });
    };

    // Wake just after the next boundary rather than polling every minute.
    const schedule = () => {
      const wait = stepMs - (Date.now() % stepMs);
      timer = window.setTimeout(() => {
        sync();
        schedule();
      }, wait + 250);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    document.addEventListener("visibilitychange", onVisible);
    schedule();

    let removeResume: (() => void) | undefined;
    if (isNative()) {
      void import("@capacitor/app")
        .then(async ({ App }) => {
          const handle = await App.addListener("resume", sync);
          removeResume = () => {
            void handle.remove();
          };
        })
        .catch(() => {});
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer);
      removeResume?.();
    };
  }, [stepMs]);

  return new Date(stamp);
}
