"use client";

import { useTheme } from "next-themes";
import { useMemo } from "react";
import { PortraitStack } from "@/components/today/portrait-stack";
import { useClock } from "@/hooks/use-clock";
import { nodeStatus } from "@/lib/node-status";
import { dayOpacityForPhase, portraitKit, resolveHomeSpec } from "@/lib/scene/portrait";
import { seasonFor } from "@/lib/scene/season";
import { skyPhase, sunTimes } from "@/lib/scene/sun";
import type { Household } from "@/lib/types";

/**
 * The house on the Home tab. Today's scene is the day's picture; this is the
 * home's: a small, still version of the same house whose windows are lit for
 * each room that has nothing waiting, so a glance says how the house is doing
 * before any row is read. Decorative, so it is hidden from VoiceOver; the rows
 * below carry the same facts in words.
 */
export function HomeHouse({ household, now }: { household: Household; now: Date }) {
  const { resolvedTheme } = useTheme();
  const clock = useClock();
  // The same sky rule as Today: it follows the sun where this home is, unless
  // Settings pinned an appearance, in which case it follows that. Two screens
  // with two skies read as a bug, not a choice.
  const { lat, lng } = household.location;
  const times = useMemo(
    () => (lat != null && lng != null ? sunTimes(lat, lng, clock) : null),
    [lat, lng, clock],
  );
  const { phase, t: phaseT } = useMemo(() => {
    if (household.momentum.nightFollowsSky === false) {
      return { phase: resolvedTheme === "dark" ? "night" : "day", t: 0.5 };
    }
    return skyPhase(clock, times);
  }, [household.momentum.nightFollowsSky, resolvedTheme, clock, times]);
  const dayOpacity = dayOpacityForPhase(phase, phaseT);
  const spec = resolveHomeSpec(household);
  const kit = portraitKit(spec.kitType);

  const caughtUp = useMemo(
    () =>
      household.rooms.filter((room) => {
        const status = nodeStatus(household, room.id, "room", now);
        return status.overdue + status.dueSoon + status.reorderPending === 0;
      }).length,
    [household, now],
  );
  const lit = Math.min(caughtUp, kit.windows.length);

  return (
    <div
      aria-hidden
      className="relative flex items-end justify-center overflow-hidden rounded-[var(--r-container)] border border-border"
      style={{
        height: 148,
        background: "linear-gradient(#1b2740, #2f3b57 70%, #3a4660)",
      }}
    >
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: dayOpacity,
          background: "linear-gradient(#a9c8ee, #d6e5f5 70%, #e9f0f7)",
        }}
      />
      <PortraitStack
        kitType={spec.kitType}
        palette={spec.palette}
        season={seasonFor(now, null)}
        dayOpacity={dayOpacity}
        litCount={lit}
        showSnow={false}
        widthPx={200}
        className="relative -mb-3"
      />
    </div>
  );
}
