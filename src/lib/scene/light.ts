import type { DayArc } from "@/lib/momentum";
import type { Season } from "@/lib/scene/season";
import type { SkyPhase } from "@/lib/scene/sun";

export type HouseLight = {
  windowsLit: number;
  lanternOn: boolean;
  smoke: boolean;
  stringLights: boolean;
  companion: "hidden" | "porch" | "asleep";
};

export function houseLight(
  arc: DayArc,
  phase: SkyPhase,
  closedToday: boolean,
  season: Season,
  gardenLevel: 0 | 1 | 2 | 3 | 4,
  windowCount: number,
): HouseLight {
  const windowsLit = closedToday
    ? windowCount
    : Math.round(arc.fraction * windowCount);
  const lanternOn = closedToday || ((phase === "dusk" || phase === "night") && arc.done > 0);
  const smoke = closedToday && (season === "winter" || phase === "night");
  const stringLights = gardenLevel === 4 && (phase === "dusk" || phase === "night");
  const companion = closedToday ? (phase === "night" ? "asleep" : "porch") : "hidden";
  return { windowsLit, lanternOn, smoke, stringLights, companion };
}
