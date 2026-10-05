"use client";

import { useTheme } from "next-themes";
import { useMemo } from "react";
import { PortraitStack } from "@/components/today/portrait-stack";
import { useClock } from "@/hooks/use-clock";
import { nodeStatus } from "@/lib/node-status";
import { dayOpacityForPhase, portraitKit, resolveHomeSpec } from "@/lib/scene/portrait";
import { seasonFor } from "@/lib/scene/season";
import { sceneCssVars } from "@/lib/scene/css";
import { skyGradient } from "@/lib/scene/sky";
import { skyPhase, sunTimes, type SkyPhase } from "@/lib/scene/sun";
import type { Household } from "@/lib/types";

/**
 * The house on the Home tab. Today's scene is the day's picture; this is the
 * home's: the same house, still, whose windows are lit for
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
  const { phase, t: phaseT } = useMemo((): { phase: SkyPhase; t: number } => {
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

  // Same sky Today paints, minus the weather: the stops come from the same
  // phase rule, so the two tabs can never show two different hours.
  const skyVars = sceneCssVars(skyGradient(phase, phaseT, "clear", 0.2));

  return (
    <section
      aria-hidden
      data-home-scene
      className="relative -mx-4 -mt-[max(0.75rem,env(safe-area-inset-top))] flex items-end justify-center overflow-hidden"
      style={{
        ...skyVars,
        height: "calc(env(safe-area-inset-top) + min(clamp(220px, 13rem, 320px), 38dvh))",
        background: "linear-gradient(var(--sky-top), var(--sky-mid) 55%, var(--sky-horizon))",
      }}
    >
      <PortraitStack
        kitType={spec.kitType}
        palette={spec.palette}
        season={seasonFor(now, null)}
        dayOpacity={dayOpacity}
        litCount={lit}
        showSnow={false}
        widthPx={250}
        className="relative mb-9"
      />
      {/* The sheet below rounds over the scene, so no frame is needed: the
          picture simply ends where the page begins. */}
    </section>
  );
}
