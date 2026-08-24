import { useRef } from "react";

const GHOST_MS = 400;

/** Ignore the click that falls through when a bottom sheet closes onto a button below. */
export function useSheetOpenGuard() {
  const closedAt = useRef(0);

  function markClosed() {
    closedAt.current = Date.now();
  }

  function tryOpen(open: () => void) {
    if (Date.now() - closedAt.current < GHOST_MS) return;
    open();
  }

  return { markClosed, tryOpen };
}
