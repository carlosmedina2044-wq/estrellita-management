import assert from "node:assert/strict";
import { test } from "node:test";
import { QUARTER_HOUR_MS, quantize } from "@/hooks/use-clock";
import { parseISODate, toISODate } from "@/lib/dates";
import { skyGradient } from "@/lib/scene/sky";
import { skyPhase, sunTimes } from "@/lib/scene/sun";

/** Seattle, the fixture location used throughout the scene work. */
const LAT = 47.6;
const LNG = -122.33;

function phaseAt(hour: number): string {
  const at = new Date(2026, 8, 14, hour, 0, 0);
  return skyPhase(at, sunTimes(LAT, LNG, at)).phase;
}

/** Exactly what `useNow()` returns: the calendar day, pinned to local midnight. */
function calendarDayFor(hour: number): Date {
  return new Date(parseISODate(toISODate(new Date(2026, 8, 14, hour, 0, 0))));
}

test("quantize floors to the start of the step", () => {
  const base = new Date(2026, 8, 14, 13, 0, 0).getTime();
  assert.equal(quantize(base, QUARTER_HOUR_MS), base);
  assert.equal(quantize(base + 60_000, QUARTER_HOUR_MS), base);
  assert.equal(quantize(base + 14 * 60_000, QUARTER_HOUR_MS), base);
  assert.equal(quantize(base + 15 * 60_000, QUARTER_HOUR_MS), base + QUARTER_HOUR_MS);
});

test("quarter-hour steps align to local quarter hours in this timezone", () => {
  const stamped = new Date(quantize(new Date(2026, 8, 14, 9, 37, 42).getTime(), QUARTER_HOUR_MS));
  assert.equal(stamped.getMinutes() % 15, 0);
  assert.equal(stamped.getSeconds(), 0);
});

test("a wall clock moves the sky through every phase across a day", () => {
  // Sampled on the quarter hour, the granularity `useClock` actually ticks at.
  // Dawn, golden and dusk are 45–65 minute windows, so a coarser sample can
  // miss them and pass a broken wiring.
  const phases = new Set<string>();
  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    const at = new Date(2026, 8, 14, 0, minutes, 0);
    phases.add(skyPhase(at, sunTimes(LAT, LNG, at)).phase);
  }
  assert.deepEqual(
    [...phases].sort(),
    ["dawn", "day", "dusk", "golden", "night"],
    `sky did not reach every phase, saw ${[...phases].join(", ")}`,
  );
});

test("the sky phase tracks the hour it is given", () => {
  assert.equal(phaseAt(12), "day");
  assert.equal(phaseAt(0), "night");
  assert.notEqual(phaseAt(12), phaseAt(0));
});

test("the calendar day is stuck at night at every hour — why the two clocks differ", () => {
  // Regression guard for the frozen-scene bug: `useNow()` is local midnight by
  // design, so feeding it to `skyPhase` pins every user's sky to night forever.
  // `useClock()` exists so nothing does that again.
  const phases = new Set(
    [0, 6, 9, 12, 15, 18, 22].map((hour) => {
      const day = calendarDayFor(hour);
      return skyPhase(day, sunTimes(LAT, LNG, day)).phase;
    }),
  );
  assert.deepEqual([...phases], ["night"]);
});

test("the evening look only applies when the sky is actually dusk or night", () => {
  const nightFollows = (hour: number) => {
    const phase = phaseAt(hour);
    return phase === "dusk" || phase === "night";
  };
  assert.equal(nightFollows(12), false, "noon must not darken the app");
  assert.equal(nightFollows(9), false, "morning must not darken the app");
  assert.equal(nightFollows(23), true, "late night should darken the app");
});

test("midday and midnight produce different sky gradients and text tones", () => {
  const noon = new Date(2026, 8, 14, 12, 0, 0);
  const midnight = new Date(2026, 8, 14, 0, 0, 0);
  const noonPhase = skyPhase(noon, sunTimes(LAT, LNG, noon));
  const midnightPhase = skyPhase(midnight, sunTimes(LAT, LNG, midnight));
  const day = skyGradient(noonPhase.phase, noonPhase.t, "clear", 0);
  const night = skyGradient(midnightPhase.phase, midnightPhase.t, "clear", 0);
  assert.notEqual(day.top, night.top);
  assert.equal(day.textTone, "ink");
  assert.equal(night.textTone, "cream");
});
