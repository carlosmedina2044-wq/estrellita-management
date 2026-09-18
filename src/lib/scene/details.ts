import type { HouseLight } from "@/lib/scene/light";
import type { PortraitKitEntry } from "@/lib/scene/portrait";
import type { Season } from "@/lib/scene/season";
import type { SkyPhase } from "@/lib/scene/sun";
import type { SceneWeather } from "@/lib/scene/weather";
import type { CareLevelId } from "@/lib/types";

export const DETAIL_KINDS = [
  "lantern",
  "smoke",
  "companion",
  "string-lights",
  "leaves",
  "laundry",
  "sprinkler",
] as const;
export type SceneDetailKind = (typeof DETAIL_KINDS)[number];

/** A detail and where it sits, as percentages of the house stack's box. */
export type SceneDetail = { kind: SceneDetailKind; x: number; y: number };

/** Two at most: the house should look inhabited, not busy. */
export const MAX_DETAILS = 2;

export type DetailSignals = {
  light: HouseLight;
  phase: SkyPhase;
  season: Season;
  weather: SceneWeather;
  careLevel: CareLevelId;
  laundryFresh: boolean;
  guttersOverdue: boolean;
  irrigationRecent: boolean;
};

/**
 * Which small living details the house shows right now, best first.
 * `houseLight` already decides the lantern, the smoke, the string lights and
 * the companion; the rest come from the rooms and the season. Leaves at the
 * gutter are the only negative state, and they are only ever leaves.
 */
export function detailKinds(signals: DetailSignals): SceneDetailKind[] {
  const evening = signals.phase === "dusk" || signals.phase === "night";
  const wet = signals.weather.kind === "rain" || signals.weather.kind === "snow";
  const out: SceneDetailKind[] = [];
  if (signals.light.lanternOn) out.push("lantern");
  if (signals.light.smoke) out.push("smoke");
  if (
    signals.light.companion !== "hidden" &&
    (signals.careLevel === "cared-for" || signals.careLevel === "loved")
  ) {
    out.push("companion");
  }
  if (signals.light.stringLights) out.push("string-lights");
  if (signals.season === "autumn" && signals.guttersOverdue) out.push("leaves");
  if (!evening && !wet && signals.laundryFresh) out.push("laundry");
  if (signals.season === "summer" && !evening && !wet && signals.irrigationRecent) out.push("sprinkler");
  return out.slice(0, MAX_DETAILS);
}

function pct(value: number, of: number): number {
  return Math.round((value / of) * 1000) / 10;
}

/** Where each kind lands on this kit, from the geometry the manifest already carries. */
export function anchorFor(kind: SceneDetailKind, kit: PortraitKitEntry): { x: number; y: number } {
  const { frame, houseBounds: b } = kit;
  const door = kit.door ?? { x: b.x + b.w / 2, y: b.y + b.h * 0.8 };
  const chimney = kit.chimney ?? { x: b.x + b.w * 0.7, y: b.y + b.h * 0.1 };
  const baseY = b.y + b.h * 0.93;
  switch (kind) {
    case "smoke":
      return { x: pct(chimney.x, frame.w), y: pct(chimney.y - frame.h * 0.03, frame.h) };
    case "lantern":
      return { x: pct(door.x, frame.w), y: pct(door.y - frame.h * 0.05, frame.h) };
    case "string-lights":
      return { x: pct(door.x, frame.w), y: pct(door.y - frame.h * 0.09, frame.h) };
    case "companion":
      return { x: pct(door.x + b.w * 0.09, frame.w), y: pct(baseY, frame.h) };
    case "leaves":
      return { x: pct(b.x + b.w * 0.82, frame.w), y: pct(b.y + b.h * 0.3, frame.h) };
    case "laundry":
      return { x: pct(b.x + b.w * 0.06, frame.w), y: pct(b.y + b.h * 0.72, frame.h) };
    case "sprinkler":
      return { x: pct(b.x + b.w * 0.16, frame.w), y: pct(baseY, frame.h) };
  }
}

export function sceneDetails(signals: DetailSignals, kit: PortraitKitEntry): SceneDetail[] {
  return detailKinds(signals).map((kind) => ({ kind, ...anchorFor(kind, kit) }));
}

export function detailsFor(kinds: SceneDetailKind[], kit: PortraitKitEntry): SceneDetail[] {
  return kinds.slice(0, MAX_DETAILS).map((kind) => ({ kind, ...anchorFor(kind, kit) }));
}
