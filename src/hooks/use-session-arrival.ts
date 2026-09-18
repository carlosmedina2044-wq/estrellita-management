"use client";

import { useEffect, useState } from "react";

// Module-level, not component state: Today's tab pane is kept mounted and
// merely hidden when the user switches tabs (see `.app-keep-alive[hidden]`
// in globals.css), so a plain `useState(true)` on first mount would replay
// on every remount instead of firing exactly once per app launch. A real
// page reload re-evaluates this module from scratch, which is the only time
// it should reset.
let arrived = false;
/** The same idea per tab: a tab's contents compose themselves the first time
 * that tab is revealed in a launch, and never again. Repeating an entrance on
 * every switch is the fastest way to make an app feel slow. */
const revealed = new Set<string>();

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

/** Long enough for the last staggered section to finish (240ms of delay plus
 * its own 200ms), with headroom. After this the flag drops, so switching away
 * and back does not replay the entrance. */
const REVEAL_MS = 600;

/**
 * True while `key` is playing its one entrance for this launch, false before
 * and after. Unlike `useSessionArrival` there is one flag per key, so each tab
 * gets its own first look.
 *
 * `active` matters twice. A root tab stays mounted and is merely hidden, so
 * without it a background tab would claim its arrival while nobody was looking
 * and then be flat when it was finally opened. And the flag has to drop again
 * once the entrance is over, or coming back to the tab replays it — which is
 * exactly the repeated entrance this is meant to avoid.
 */
export function useFirstReveal(key: string, active: boolean): boolean {
  const [phase, setPhase] = useState<"waiting" | "playing" | "done">(() =>
    revealed.has(key) ? "done" : "waiting",
  );
  if (active && phase === "waiting") {
    revealed.add(key);
    setPhase("playing");
  }
  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setTimeout(() => setPhase("done"), REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);
  return phase === "playing" && active;
}
