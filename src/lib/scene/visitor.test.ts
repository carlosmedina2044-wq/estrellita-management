import assert from "node:assert/strict";
import { test } from "node:test";
import { VISITOR_KINDS, VISITOR_ODDS, visitorAnchor, visitorFor, type VisitorSignals } from "@/lib/scene/visitor";
import type { SceneWeather } from "@/lib/scene/weather";

const clear: SceneWeather = { kind: "clear", cloudCover: 0.1, precipIntensity: 0, source: "derived" };
const rain: SceneWeather = { kind: "rain", cloudCover: 0.9, precipIntensity: 0.6, source: "native" };

function signals(overrides: Partial<VisitorSignals> = {}): VisitorSignals {
  return {
    closedToday: true,
    phase: "day",
    season: "summer",
    weather: clear,
    dateKey: "2026-09-17",
    seed: 12345,
    ...overrides,
  };
}

test("an open day never gets a visitor", () => {
  for (let day = 1; day <= 28; day += 1) {
    const s = signals({ closedToday: false, dateKey: `2026-09-${String(day).padStart(2, "0")}` });
    assert.equal(visitorFor(s), null);
  }
});

test("the same day gives the same answer however often it is asked", () => {
  const s = signals();
  const first = visitorFor(s);
  for (let i = 0; i < 20; i += 1) assert.equal(visitorFor(signals()), first);
});

test("two homes do not share a day's visitor by construction", () => {
  const a = Array.from({ length: 60 }, (_, day) =>
    visitorFor(signals({ dateKey: `2026-10-${String((day % 28) + 1).padStart(2, "0")}`, seed: 1 })),
  );
  const b = Array.from({ length: 60 }, (_, day) =>
    visitorFor(signals({ dateKey: `2026-10-${String((day % 28) + 1).padStart(2, "0")}`, seed: 2 })),
  );
  assert.notDeepEqual(a, b);
});

test("visits are rare but real over a year of closed days", () => {
  let visits = 0;
  const days = 365;
  for (let day = 0; day < days; day += 1) {
    const date = new Date(2026, 0, 1 + day);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (visitorFor(signals({ dateKey: key }))) visits += 1;
  }
  const rate = visits / days;
  assert.ok(rate > 0.1, `too rare to be worth opening for: ${rate}`);
  assert.ok(rate < 1 / (VISITOR_ODDS - 1), `too common to stay a surprise: ${rate}`);
});

test("a visitor always suits the hour, the season and the sky", () => {
  for (let day = 0; day < 200; day += 1) {
    const date = new Date(2026, 0, 1 + day);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    assert.notEqual(visitorFor(signals({ dateKey: key, phase: "night" })), "butterfly");
    assert.notEqual(visitorFor(signals({ dateKey: key, season: "winter" })), "birds");
    assert.notEqual(visitorFor(signals({ dateKey: key, weather: clear })), "rainbow");
    assert.notEqual(visitorFor(signals({ dateKey: key, phase: "day", weather: rain })), "birds");
  }
});

test("a rainbow only ever comes with sun and rain together", () => {
  let seen = false;
  for (let day = 0; day < 200 && !seen; day += 1) {
    const date = new Date(2026, 3, 1 + day);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    if (visitorFor(signals({ dateKey: key, phase: "day", weather: rain })) === "rainbow") seen = true;
  }
  assert.ok(seen, "a rainy closed day never produced a rainbow");
});

test("every kind has an anchor inside the frame", () => {
  for (const kind of VISITOR_KINDS) {
    const { x, y } = visitorAnchor(kind);
    assert.ok(x > 0 && x < 100, `${kind} x out of frame`);
    assert.ok(y > 0 && y < 100, `${kind} y out of frame`);
  }
});
