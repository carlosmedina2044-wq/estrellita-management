import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CARE_DECOR_AT,
  CARE_DECOR_KINDS,
  LEVEL_DECOR_KINDS,
  careDecor,
  careDecorAnchor,
  careDecorKinds,
  levelForDecor,
} from "@/lib/scene/care-decor";
import { DETAIL_KINDS, anchorFor } from "@/lib/scene/details";
import { PORTRAIT_MANIFEST, portraitKit } from "@/lib/scene/portrait";
import { CARE_LEVELS } from "@/lib/types";

test("a settling-in house shows nothing it has not earned", () => {
  assert.deepEqual(careDecorKinds("settling-in"), []);
});

test("decorations accumulate level by level and never shrink", () => {
  let previous = 0;
  for (const level of CARE_LEVELS) {
    const kinds = careDecorKinds(level);
    assert.ok(kinds.length >= previous, `${level} lost a decoration`);
    previous = kinds.length;
  }
  assert.deepEqual(careDecorKinds("loved"), ["planter", "window-box", "bench", "wreath"]);
});

test("every level's decoration is unique and every level kind is reachable", () => {
  const assigned = CARE_LEVELS.map((level) => CARE_DECOR_AT[level]).filter(Boolean);
  assert.equal(new Set(assigned).size, assigned.length);
  for (const kind of LEVEL_DECOR_KINDS) {
    assert.ok(assigned.includes(kind), `${kind} is never earned`);
    assert.equal(CARE_DECOR_AT[levelForDecor(kind)], kind);
  }
});

test("the week's bunting is not a care level's payout", () => {
  const assigned = CARE_LEVELS.map((level) => CARE_DECOR_AT[level]);
  assert.ok(!assigned.includes("bunting" as never));
  assert.ok(!careDecorKinds("loved").includes("bunting" as never));
  const dressed = careDecor("loved", portraitKit("a"), { questDone: true });
  assert.ok(dressed.some((item) => item.kind === "bunting"));
  assert.equal(dressed.length, 5);
});

test("anchors land inside the frame for every kit, including one-window kits", () => {
  for (const kitType of Object.keys(PORTRAIT_MANIFEST)) {
    const kit = portraitKit(kitType as Parameters<typeof portraitKit>[0]);
    for (const kind of CARE_DECOR_KINDS) {
      const { x, y } = careDecorAnchor(kind, kit);
      assert.ok(x > 0 && x < 100, `${kitType}/${kind} x out of frame: ${x}`);
      assert.ok(y > 0 && y < 100, `${kitType}/${kind} y out of frame: ${y}`);
    }
  }
});

test("a loved house places all four without stacking two on one point", () => {
  const placed = careDecor("loved", portraitKit("a"));
  assert.equal(placed.length, 4);
  const points = placed.map((item) => `${item.x},${item.y}`);
  assert.equal(new Set(points).size, points.length);
});

/**
 * Anchors are percentages of the same box, so "too close" is measured on both
 * axes: two things conflict when neither axis separates them.
 */
const MIN_SEPARATION = 8;

function conflicts(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < MIN_SEPARATION && Math.abs(a.y - b.y) < MIN_SEPARATION;
}

const KITS = Object.keys(PORTRAIT_MANIFEST) as Array<Parameters<typeof portraitKit>[0]>;

test("no decoration ever lands on another decoration", () => {
  const clashes: string[] = [];
  for (const kitType of KITS) {
    const kit = portraitKit(kitType);
    for (let i = 0; i < CARE_DECOR_KINDS.length; i += 1) {
      for (let j = i + 1; j < CARE_DECOR_KINDS.length; j += 1) {
        const a = careDecorAnchor(CARE_DECOR_KINDS[i], kit);
        const b = careDecorAnchor(CARE_DECOR_KINDS[j], kit);
        if (conflicts(a, b)) clashes.push(`${kitType}: ${CARE_DECOR_KINDS[i]} on ${CARE_DECOR_KINDS[j]}`);
      }
    }
  }
  assert.deepEqual(clashes, []);
});

test("every decoration the geometry lets us move clears the living details", () => {
  // The window box is excluded deliberately: it is pinned to a real sill, so
  // on a kit whose only low window sits over the porch it cannot be moved
  // without ceasing to be a window box. Everything else is placed by us.
  const clashes: string[] = [];
  for (const kitType of KITS) {
    const kit = portraitKit(kitType);
    for (const decor of CARE_DECOR_KINDS) {
      if (decor === "window-box") continue;
      for (const detail of DETAIL_KINDS) {
        if (conflicts(careDecorAnchor(decor, kit), anchorFor(detail, kit))) {
          clashes.push(`${kitType}: ${decor} on ${detail}`);
        }
      }
    }
  }
  assert.deepEqual(clashes, []);
});

/**
 * Six single-storey kits put their only low window straight over the porch,
 * so the box lands near whatever stands there. Six is the measured floor with
 * the current kit geometry, not a target: this guards the number against
 * creeping up and should be lowered if the placement improves.
 */
const MAX_CROWDED_KITS = 6;

test("the pinned window box crowds a detail on no more kits than it has to", () => {
  const crowded = KITS.filter((kitType) => {
    const kit = portraitKit(kitType);
    const box = careDecorAnchor("window-box", kit);
    return DETAIL_KINDS.some((detail) => conflicts(box, anchorFor(detail, kit)));
  });
  assert.ok(
    crowded.length <= MAX_CROWDED_KITS,
    `the window box crowds a detail on ${crowded.length} of ${KITS.length} kits: ${crowded.join(", ")}`,
  );
});
