"use client";

import { useState } from "react";

// Module-level, not component state: Today's tab pane is kept mounted and
// merely hidden when the user switches tabs (see `.app-keep-alive[hidden]`
// in globals.css), so a plain `useState(true)` on first mount would replay
// on every remount instead of firing exactly once per app launch. A real
// page reload re-evaluates this module from scratch, which is the only time
// it should reset.
let arrived = false;

/**
 * True for the first component that calls it after a page load, false for
 * every call after that (including remounts). Call it once, at the top of
 * whichever component owns "has Today arrived yet", and thread the result
 * down as a prop — calling it from more than one component would race for
 * the single `true`.
 */
export function useSessionArrival(): boolean {
  const [isFirstArrival] = useState(() => {
    if (arrived) return false;
    arrived = true;
    return true;
  });
  return isFirstArrival;
}
