import assert from "node:assert/strict";
import { test } from "node:test";
import { anchorFor, DETAIL_KINDS, detailKinds, MAX_DETAILS, sceneDetails, type DetailSignals } from "@/lib/scene/details";
import type { HouseLight } from "@/lib/scene/light";
import { PORTRAIT_MANIFEST } from "@/lib/scene/portrait";

const quiet: HouseLight = { windowsLit: 0, lanternOn: false, smoke: false, stringLights: false, companion: "hidden" };

function signals(partial: Partial<DetailSignals> = {}): DetailSignals {
  return {
    light: quiet,
    phase: "day",
    season: "spring",
    weather: { kind: "clear", cloudCover: 0, precipIntensity: 0 } as DetailSignals["weather"],
    careLevel: "kept",
    laundryFresh: false,
    guttersOverdue: false,
    irrigationRecent: false,
    ...partial,
  };
}

test("a closed winter night shows the lantern and the smoke, and never more than two", () => {
  const closedNight: HouseLight = { windowsLit: 3, lanternOn: true, smoke: true, stringLights: true, companion: "asleep" };
  const kinds = detailKinds(signals({ light: closedNight, phase: "night", season: "winter", careLevel: "loved" }));
  assert.deepEqual(kinds, ["lantern", "smoke"]);
  assert.equal(kinds.length, MAX_DETAILS);
});

test("the companion needs a cared-for home; string lights need the top level", () => {
  const porch: HouseLight = { ...quiet, companion: "porch" };
  assert.deepEqual(detailKinds(signals({ light: porch, careLevel: "kept" })), []);
  assert.deepEqual(detailKinds(signals({ light: porch, careLevel: "cared-for" })), ["companion"]);
  assert.deepEqual(detailKinds(signals({ light: { ...quiet, stringLights: true }, careLevel: "loved" })), ["string-lights"]);
});

test("leaves need autumn and an overdue gutter job; laundry and sprinklers need a dry day", () => {
  assert.deepEqual(detailKinds(signals({ season: "autumn", guttersOverdue: true })), ["leaves"]);
  assert.deepEqual(detailKinds(signals({ season: "summer", guttersOverdue: true })), []);
  assert.deepEqual(detailKinds(signals({ laundryFresh: true })), ["laundry"]);
  assert.deepEqual(detailKinds(signals({ laundryFresh: true, phase: "night" })), []);
  const rainy = { kind: "rain", cloudCover: 1, precipIntensity: 0.8 } as DetailSignals["weather"];
  assert.deepEqual(detailKinds(signals({ laundryFresh: true, weather: rainy })), []);
  assert.deepEqual(detailKinds(signals({ season: "summer", irrigationRecent: true })), ["sprinkler"]);
  assert.deepEqual(detailKinds(signals({ season: "winter", irrigationRecent: true })), []);
});

test("every kind anchors inside the frame on every kit", () => {
  for (const kit of Object.values(PORTRAIT_MANIFEST)) {
    for (const kind of DETAIL_KINDS) {
      const at = anchorFor(kind, kit);
      assert.ok(at.x > 0 && at.x < 100, `${kind} x ${at.x}`);
      assert.ok(at.y > 0 && at.y < 100, `${kind} y ${at.y}`);
    }
  }
  const details = sceneDetails(signals({ light: { ...quiet, lanternOn: true }, phase: "dusk" }), PORTRAIT_MANIFEST.a);
  assert.equal(details[0].kind, "lantern");
});
