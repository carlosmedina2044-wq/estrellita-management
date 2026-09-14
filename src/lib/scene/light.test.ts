import assert from "node:assert/strict";
import { test } from "node:test";
import { houseLight } from "@/lib/scene/light";
import type { DayArc } from "@/lib/momentum";

const openArc: DayArc = {
  total: 4,
  done: 1,
  open: 3,
  fraction: 0.25,
  minutesLeft: 30,
  minutesDone: 10,
  state: "open",
  nextUp: null,
};

const closedArc: DayArc = { ...openArc, done: 4, open: 0, fraction: 1, state: "closed" };

test("windowsLit rounds fraction and closed lights all", () => {
  assert.equal(houseLight(openArc, "day", false, "summer", 1, 6).windowsLit, 2);
  assert.equal(houseLight(closedArc, "day", true, "summer", 1, 6).windowsLit, 6);
});

test("lantern, smoke, string lights, companion", () => {
  const duskOpen = houseLight(openArc, "dusk", false, "summer", 4, 6);
  assert.equal(duskOpen.lanternOn, true);
  assert.equal(duskOpen.stringLights, true);
  assert.equal(duskOpen.companion, "hidden");

  const closedNight = houseLight(closedArc, "night", true, "summer", 2, 6);
  assert.equal(closedNight.lanternOn, true);
  assert.equal(closedNight.smoke, true);
  assert.equal(closedNight.companion, "asleep");

  const closedWinter = houseLight(closedArc, "day", true, "winter", 0, 6);
  assert.equal(closedWinter.smoke, true);
  assert.equal(closedWinter.companion, "porch");
});
