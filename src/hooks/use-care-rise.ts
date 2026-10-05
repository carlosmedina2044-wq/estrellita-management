"use client";

import { useEffect, useState } from "react";
import { careLevelIndex } from "@/lib/care-level";
import { CEREMONY_MS } from "@/lib/motion";
import { hapticLevelUp } from "@/lib/native/haptics";
import type { CareLevelId, CareState } from "@/lib/types";

/**
 * The house reaching a new care level, as one moment shared by every screen
 * that draws the house.
 *
 * Seeded from the stored state so a level earned between sessions still gets
 * its moment on the next open, and bumped during render when the level rises
 * while the app is open. Adjusting state during render is the sanctioned way
 * to react to a changed value without waiting a frame.
 *
 * The key is non-zero for the length of the bloom and rises per level-up so a
 * second one in a session plays again. The haptic lives here, once, rather
 * than in each scene: Today and Home are both mounted, and two scenes each
 * buzzing for one level-up would be two level-ups.
 */
export function useCareRise(care: CareState | undefined, todayIso: string): { key: number; level: CareLevelId } {
  const level = care?.level ?? "settling-in";
  const [key, setKey] = useState(() => (care?.direction === "up" && care.since === todayIso ? 1 : 0));
  const [seen, setSeen] = useState(level);
  if (level !== seen) {
    setSeen(level);
    if (careLevelIndex(level) > careLevelIndex(seen)) setKey((value) => value + 1);
  }
  useEffect(() => {
    if (key === 0) return;
    void hapticLevelUp();
    const timer = window.setTimeout(() => setKey(0), CEREMONY_MS);
    return () => window.clearTimeout(timer);
  }, [key]);
  return { key, level };
}
