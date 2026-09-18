import { doorAnchor, type PortraitKitEntry, type PortraitWindowRect } from "@/lib/scene/portrait";
import { CARE_LEVELS, type CareLevelId } from "@/lib/types";

/** Earned by holding a care level. */
export const LEVEL_DECOR_KINDS = ["planter", "window-box", "bench", "wreath"] as const;
export type LevelDecorKind = (typeof LEVEL_DECOR_KINDS)[number];

/** Earned by the week's quest, and gone again when the next week opens. */
export const WEEK_DECOR_KINDS = ["bunting"] as const;

export const CARE_DECOR_KINDS = [...LEVEL_DECOR_KINDS, ...WEEK_DECOR_KINDS] as const;
export type CareDecorKind = (typeof CARE_DECOR_KINDS)[number];

/** A decoration and where it sits, as percentages of the house stack's box. */
export type CareDecor = { kind: CareDecorKind; x: number; y: number };

/**
 * What each care level adds to the house, on top of everything the levels
 * below it earned. One thing per level, four in all: the house has to read as
 * lived in, not decorated. `settling-in` is deliberately bare — it is the
 * baseline the others are measured against, and a house that starts full has
 * nothing to give.
 */
export const CARE_DECOR_AT: Record<CareLevelId, LevelDecorKind | null> = {
  "settling-in": null,
  kept: "planter",
  "well-kept": "window-box",
  "cared-for": "bench",
  loved: "wreath",
};

/** Everything a house at `level` shows, earned level by level. */
export function careDecorKinds(level: CareLevelId): LevelDecorKind[] {
  const reached = CARE_LEVELS.indexOf(level);
  if (reached < 0) return [];
  const out: LevelDecorKind[] = [];
  for (let index = 0; index <= reached; index += 1) {
    const kind = CARE_DECOR_AT[CARE_LEVELS[index]];
    if (kind) out.push(kind);
  }
  return out;
}

/** The level a decoration arrives at, for naming it before it is earned. */
export function levelForDecor(kind: LevelDecorKind): CareLevelId {
  for (const level of CARE_LEVELS) {
    if (CARE_DECOR_AT[level] === kind) return level;
  }
  return "settling-in";
}

function pct(value: number, of: number): number {
  return Math.round((value / of) * 1000) / 10;
}

/**
 * The front window a box belongs under: the lowest one, and among equally low
 * ones the furthest from the door, so the box is not stacked on whatever the
 * porch already carries. Kits hold between one and six windows, so this never
 * assumes an upper storey exists.
 */
function boxWindow(kit: PortraitKitEntry) {
  if (kit.windows.length === 0) return null;
  const b = kit.houseBounds;
  const doorX = doorAnchor(kit).x;
  const lowest = kit.windows.reduce((best, window) =>
    window.y + window.h > best.y + best.h ? window : best,
  );
  const band = b.h * 0.12;
  const baseY = b.y + b.h * 0.93;
  const level = kit.windows.filter((window) => window.y + window.h >= lowest.y + lowest.h - band);
  // A sill sitting right on the porch puts the box among whatever stands
  // there; prefer one with air under it when the kit offers one.
  const clearOfGround = level.filter((window) => baseY - (window.y + window.h) > b.h * 0.22);
  const pool = clearOfGround.length > 0 ? clearOfGround : level;
  // Furthest from the door and from whatever stands on the ground below it.
  const crowd = [doorX, b.x + b.w * 0.16, doorX + b.w * 0.09];
  const clearance = (window: PortraitWindowRect) => {
    const cx = window.x + window.w / 2;
    return Math.min(...crowd.map((at) => Math.abs(cx - at)));
  };
  return pool.reduce((best, window) => (clearance(window) > clearance(best) ? window : best));
}

/**
 * The spot on the ground line furthest from everything already standing there.
 *
 * A fixed fraction cannot work. The door sits anywhere from a third to two
 * thirds across depending on the kit, and the porch the companion stands on
 * moves with it, so any constant put the planter on the companion on 13 of the
 * 21 kits. Picking the middle of the widest gap was no better: a narrow gap's
 * midpoint is close to both of its own edges. Scanning the front and taking
 * the point of greatest clearance is the only version that holds on every kit.
 */
function clearestGroundX(kit: PortraitKitEntry, avoid: number[]): number {
  const b = kit.houseBounds;
  // The search runs a little onto the lawn at either end: on a narrow kit the
  // house front alone has no point that clears everything standing on it.
  const from = b.x - b.w * 0.08;
  const to = b.x + b.w * 0.98;
  const step = b.w / 100;
  let best = { at: from, clearance: -1 };
  for (let at = from; at <= to; at += step) {
    const clearance = Math.min(...avoid.map((other) => Math.abs(at - other)));
    if (clearance > best.clearance) best = { at, clearance };
  }
  return best.at;
}

/** How far past the house's right edge the bench stands, as a fraction of its width. */
const BENCH_OFFSET = 1.05;

/** Where `scene/details.ts` already stands things on the ground line. */
function groundTaken(kit: PortraitKitEntry): number[] {
  const b = kit.houseBounds;
  const doorX = doorAnchor(kit).x;
  return [b.x + b.w * 0.16, doorX + b.w * 0.09];
}

function planterX(kit: PortraitKitEntry): number {
  const b = kit.houseBounds;
  const box = boxWindow(kit);
  // The box is pinned to a real sill and the bench stands off the right
  // corner, so the one thing that can move dodges both.
  const taken = [...groundTaken(kit), b.x + b.w * BENCH_OFFSET];
  if (box) taken.push(box.x + box.w / 2);
  return clearestGroundX(kit, taken);
}

/**
 * Where each decoration lands on this kit, from the geometry the manifest
 * already carries.
 *
 * These share a small house with the seven anchors in `scene/details.ts`. The
 * first pass put the wreath on top of the porch lantern on all 21 kits and the
 * planter on the sprinkler on 12 of them, so the crowded places — the ground
 * line and the roof — are measured per kit rather than guessed at with a
 * constant. `care-decor.test.ts` checks every pair on every kit and fails if
 * one is nudged into another.
 */
export function careDecorAnchor(kind: CareDecorKind, kit: PortraitKitEntry): { x: number; y: number } {
  const { frame, houseBounds: b } = kit;
  const door = doorAnchor(kit);
  const baseY = b.y + b.h * 0.93;
  switch (kind) {
    case "planter":
      return { x: pct(planterX(kit), frame.w), y: pct(baseY, frame.h) };
    case "window-box": {
      const window = boxWindow(kit);
      if (!window) return { x: pct(b.x + b.w * 0.3, frame.w), y: pct(b.y + b.h * 0.6, frame.h) };
      return { x: pct(window.x + window.w / 2, frame.w), y: pct(window.y + window.h, frame.h) };
    }
    case "bench":
      // On the lawn beside the house rather than along its front. The front
      // ground line already carries the sprinkler, the porch companion, the
      // planter and whatever sill the box takes; on a narrow kit there is
      // simply no fifth place along it that clears the rest.
      return { x: pct(b.x + b.w * BENCH_OFFSET, frame.w), y: pct(baseY, frame.h) };
    case "wreath":
      // On the door face, below the lantern and the string lights above it.
      // Off the door's own height, not a fraction of the frame: kits vary
      // enough that a constant put it on the step on some and the lintel on
      // others.
      return { x: pct(door.x, frame.w), y: pct(door.y - door.h * 0.12, frame.h) };
    case "bunting": {
      // Under the eaves, strung away from the chimney the smoke rises out of.
      const chimneyX = kit.chimney?.x ?? b.x + b.w * 0.7;
      const side = chimneyX > b.x + b.w / 2 ? 0.3 : 0.7;
      return { x: pct(b.x + b.w * side, frame.w), y: pct(b.y + b.h * 0.1, frame.h) };
    }
  }
}

/**
 * Everything the house shows, placed on this kit: what the care level has
 * earned, plus the week's bunting once its quest is met.
 */
export function careDecor(
  level: CareLevelId,
  kit: PortraitKitEntry,
  opts: { questDone?: boolean } = {},
): CareDecor[] {
  const kinds: CareDecorKind[] = [...careDecorKinds(level)];
  if (opts.questDone) kinds.push("bunting");
  return kinds.map((kind) => ({ kind, ...careDecorAnchor(kind, kit) }));
}

/** Placed decorations for an explicit list — the dev portrait page. */
export function decorFor(kinds: CareDecorKind[], kit: PortraitKitEntry): CareDecor[] {
  return kinds.map((kind) => ({ kind, ...careDecorAnchor(kind, kit) }));
}
