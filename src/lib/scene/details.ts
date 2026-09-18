import type { HouseLight } from "@/lib/scene/light";
import { doorAnchor, type PortraitKitEntry } from "@/lib/scene/portrait";
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

/** `inset` in from whichever end of the house is further from the door. */
function awayFromDoor(
  b: { x: number; w: number },
  doorX: number,
  inset: number,
): number {
  const fromLeft = doorX - b.x;
  const fromRight = b.x + b.w - doorX;
  return fromLeft >= fromRight ? b.x + b.w * inset : b.x + b.w * (1 - inset);
}

/** Where each kind lands on this kit, from the geometry the manifest already carries. */
export function anchorFor(kind: SceneDetailKind, kit: PortraitKitEntry): { x: number; y: number } {
  const { frame, houseBounds: b } = kit;
  const door = doorAnchor(kit);
  const chimney = kit.chimney ?? { x: b.x + b.w * 0.7, y: b.y + b.h * 0.1 };
  const baseY = b.y + b.h * 0.93;
  switch (kind) {
    case "smoke":
      return { x: pct(chimney.x, frame.w), y: pct(chimney.y - frame.h * 0.03, frame.h) };
    case "lantern":
      // Mounted on the wall beside the door head, where a porch light actually
      // hangs. Measured off the door's own height: a fraction of the frame put
      // it on the lintel of a tall kit and halfway up the roof of a short one.
      return { x: pct(door.x + door.w * 0.9, frame.w), y: pct(door.y - door.h * 0.42, frame.h) };
    case "string-lights":
      return { x: pct(door.x, frame.w), y: pct(door.y - door.h * 0.85, frame.h) };
    case "companion": {
      // Curled up on the porch beside the door, on whichever side has house
      // left. A fixed offset to the right walked the cat off the corner and
      // onto the lawn on the kits whose door sits at the right-hand end.
      const room = b.x + b.w - door.x;
      const side = room > b.w * 0.2 ? 1 : -1;
      return { x: pct(door.x + side * b.w * 0.09, frame.w), y: pct(baseY, frame.h) };
    }
    case "leaves":
      return { x: pct(b.x + b.w * 0.82, frame.w), y: pct(b.y + b.h * 0.3, frame.h) };
    case "laundry":
      // A washing line and a sprinkler belong on the side of the house the
      // front path does not use, so both take the end furthest from the door.
      // They used to sit at a fixed left-hand offset, which put them across
      // the porch on the kits whose door is at that end.
      return { x: pct(awayFromDoor(b, door.x, 0.06), frame.w), y: pct(b.y + b.h * 0.72, frame.h) };
    case "sprinkler":
      return { x: pct(awayFromDoor(b, door.x, 0.16), frame.w), y: pct(baseY, frame.h) };
  }
}

export function sceneDetails(signals: DetailSignals, kit: PortraitKitEntry): SceneDetail[] {
  return detailKinds(signals).map((kind) => ({ kind, ...anchorFor(kind, kit) }));
}

export function detailsFor(kinds: SceneDetailKind[], kit: PortraitKitEntry): SceneDetail[] {
  return kinds.slice(0, MAX_DETAILS).map((kind) => ({ kind, ...anchorFor(kind, kit) }));
}
