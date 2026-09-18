import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CARE_DECOR_AT,
  CARE_DECOR_KINDS,
  careDecor,
  careDecorAnchor,
  careDecorKinds,
  levelForDecor,
} from "@/lib/scene/care-decor";
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

test("every level's decoration is unique and every kind is reachable", () => {
  const assigned = CARE_LEVELS.map((level) => CARE_DECOR_AT[level]).filter(Boolean);
  assert.equal(new Set(assigned).size, assigned.length);
  for (const kind of CARE_DECOR_KINDS) {
    assert.ok(assigned.includes(kind), `${kind} is never earned`);
    assert.equal(CARE_DECOR_AT[levelForDecor(kind)], kind);
  }
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
