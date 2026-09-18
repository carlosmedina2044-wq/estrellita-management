import assert from "node:assert/strict";
import { test } from "node:test";
import { contrastRatio, isHexColor } from "@/lib/scene/color";
import { assertValidStops, skyGradient, warmedStops, type WeatherKind } from "@/lib/scene/sky";
import type { SkyPhase } from "@/lib/scene/sun";

const PHASES: SkyPhase[] = ["night", "dawn", "day", "golden", "dusk"];
const WEATHERS: WeatherKind[] = ["clear", "cloudy", "rain", "snow", "fog"];

test("every phase × weather yields valid hex and 4.5:1 text contrast", () => {
  for (const phase of PHASES) {
    for (const weather of WEATHERS) {
      for (const t of [0, 0.5, 1]) {
        const cover = weather === "clear" ? 0 : 0.7;
        const stops = skyGradient(phase, t, weather, cover);
        assertValidStops(stops);
        assert.ok(isHexColor(stops.top));
        const text = stops.textTone === "ink" ? "#1d1d1f" : "#f7f3ec";
        assert.ok(
          contrastRatio(stops.top, text) >= 4.5,
          `${phase} ${weather} t=${t} contrast ${contrastRatio(stops.top, text)}`,
        );
      }
    }
  }
});

test("day text is ink and night text is cream", () => {
  assert.equal(skyGradient("day", 0.4, "clear", 0).textTone, "ink");
  assert.equal(skyGradient("night", 0.4, "clear", 0).textTone, "cream");
});

test("rain lowers exposure and snow lightens the horizon", () => {
  const clear = skyGradient("day", 0.4, "clear", 0);
  const rain = skyGradient("day", 0.4, "rain", 0.8);
  const snow = skyGradient("day", 0.4, "snow", 0.8);
  assert.ok(rain.exposure < clear.exposure);
  assert.notEqual(snow.horizon, clear.horizon);
});

test("warmedStops leaves the sky alone at zero", () => {
  for (const phase of ["night", "dawn", "day", "golden", "dusk"] as const) {
    const stops = skyGradient(phase, 0.5, "clear", 0);
    assert.deepEqual(warmedStops(stops, 0), stops);
  }
});

test("warmedStops keeps the greeting readable at every hour and in every weather", () => {
  for (const phase of ["night", "dawn", "day", "golden", "dusk"] as const) {
    for (const weather of ["clear", "cloudy", "rain", "snow", "fog"] as const) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        for (const amount of [0.25, 0.5, 0.75, 1]) {
          const warmed = warmedStops(skyGradient(phase, t, weather, 0.5), amount);
          // The same bar `assertValidStops` holds the unwarmed sky to: the
          // greeting is painted straight onto the top stop.
          assertValidStops(warmed);
        }
      }
    }
  }
});

test("warmedStops actually warms the horizon", () => {
  const stops = skyGradient("day", 0.5, "clear", 0);
  const warmed = warmedStops(stops, 1);
  assert.notEqual(warmed.horizon, stops.horizon);
  assert.notEqual(warmed.mid, stops.mid);
});
