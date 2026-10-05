"use client";

import { useMemo } from "react";
import { useTheme } from "next-themes";
import { useClock } from "@/hooks/use-clock";
import { toISODate } from "@/lib/dates";
import { skyPhase, sunTimes, type SkyPhase } from "@/lib/scene/sun";
import { sceneWeather, type SceneWeather } from "@/lib/scene/weather";
import type { Household } from "@/lib/types";
import type { WeatherForecast } from "@/lib/weather/provider";

export type SceneSky = {
  /** Wall clock, quantised; the greeting and the sky both read it. */
  clock: Date;
  clockMs: number;
  /** The sun's real phase here, whatever Settings says. */
  scenePhase: { phase: SkyPhase; t: number };
  /** The phase the scene paints: the sun's, unless Settings pinned light or dark. */
  scenePhaseEffective: { phase: SkyPhase; t: number };
  weather: SceneWeather;
  /** ISO date of `now`, the key the weather and the visitor read. */
  todayIso: string;
};

/**
 * The one sky rule, shared by Today and Home so two tabs can never show two
 * different hours.
 *
 * The sky reads the wall `clock`, never `now`: `now` is local midnight by
 * design (see `useNow`), and `skyPhase` reads `getHours()`, so feeding it `now`
 * pinned every sky to "night". When Settings fixed an appearance
 * (`nightFollowsSky === false`), the scene follows that appearance instead of
 * the real sun, so a fixed light look never sits under a night sky.
 */
export function useSceneSky(
  household: Household,
  forecast: WeatherForecast | null,
  now: Date,
): SceneSky {
  const clock = useClock();
  const clockMs = clock.getTime();
  const todayIso = toISODate(now);
  const weather = useMemo(() => sceneWeather(forecast, todayIso), [forecast, todayIso]);
  const { lat, lng } = household.location;
  const times = useMemo(
    () => (lat != null && lng != null ? sunTimes(lat, lng, new Date(clockMs)) : null),
    [lat, lng, clockMs],
  );
  const scenePhase = useMemo(() => skyPhase(new Date(clockMs), times), [clockMs, times]);
  const { resolvedTheme } = useTheme();
  const scenePhaseEffective = useMemo(
    () =>
      household.momentum.nightFollowsSky === false
        ? { phase: (resolvedTheme === "dark" ? "night" : "day") as SkyPhase, t: 0.5 }
        : scenePhase,
    [household.momentum.nightFollowsSky, resolvedTheme, scenePhase],
  );
  return { clock, clockMs, scenePhase, scenePhaseEffective, weather, todayIso };
}
