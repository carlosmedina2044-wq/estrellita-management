import type { PortraitKitEntry } from "@/lib/scene/portrait";
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
 * The lowest window on the front of the house — where a window box belongs.
 * Kits carry between one and six windows, so this never assumes an upper
 * storey exists.
 */
function groundWindow(kit: PortraitKitEntry) {
  if (kit.windows.length === 0) return null;
  return kit.windows.reduce((lowest, window) =>
    window.y + window.h > lowest.y + lowest.h ? window : lowest,
  );
}

/**
 * Where each decoration lands on this kit, from the geometry the manifest
 * already carries. Kept clear of the anchors `scene/details.ts` uses: the
 * companion sits to the right of the door and the sprinkler to the left of
 * the house, so the planter takes the near-left of the door and the bench
 * the far right.
 */
export function careDecorAnchor(kind: CareDecorKind, kit: PortraitKitEntry): { x: number; y: number } {
  const { frame, houseBounds: b } = kit;
  const door = kit.door ?? { x: b.x + b.w / 2, y: b.y + b.h * 0.8 };
  const baseY = b.y + b.h * 0.93;
  switch (kind) {
    case "planter":
      return { x: pct(door.x - b.w * 0.1, frame.w), y: pct(baseY, frame.h) };
    case "window-box": {
      const window = groundWindow(kit);
      if (!window) return { x: pct(b.x + b.w * 0.3, frame.w), y: pct(b.y + b.h * 0.6, frame.h) };
      return { x: pct(window.x + window.w / 2, frame.w), y: pct(window.y + window.h, frame.h) };
    }
    case "bench":
      return { x: pct(b.x + b.w * 0.76, frame.w), y: pct(baseY, frame.h) };
    case "wreath":
      return { x: pct(door.x, frame.w), y: pct(door.y - b.h * 0.04, frame.h) };
    case "bunting":
      // Strung across the front, above the windows and clear of the roofline.
      return { x: pct(b.x + b.w / 2, frame.w), y: pct(b.y + b.h * 0.34, frame.h) };
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
