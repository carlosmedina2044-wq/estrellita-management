import assert from "node:assert/strict";
import { test } from "node:test";
import { FALLBACK_SUN, skyPhase, sunPosition, sunTimes } from "@/lib/scene/sun";

function atMinutes(minutes: number): Date {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return new Date(2026, 8, 13, h, m, 0, 0);
}

test("fallback sun is 06:30 / 19:30", () => {
  assert.equal(FALLBACK_SUN.sunriseMinutes, 390);
  assert.equal(FALLBACK_SUN.sunsetMinutes, 1170);
});

test("skyPhase uses fallback times when sun times are null", () => {
  assert.equal(skyPhase(atMinutes(349), null).phase, "night");
  assert.equal(skyPhase(atMinutes(390 - 40), null).phase, "dawn");
  assert.equal(skyPhase(atMinutes(390 + 24), null).phase, "dawn");
  assert.equal(skyPhase(atMinutes(390 + 25), null).phase, "day");
  assert.equal(skyPhase(atMinutes(1170 - 60), null).phase, "golden");
  assert.equal(skyPhase(atMinutes(1170 - 11), null).phase, "golden");
  assert.equal(skyPhase(atMinutes(1170 - 10), null).phase, "dusk");
  assert.equal(skyPhase(atMinutes(1170 + 34), null).phase, "dusk");
  assert.equal(skyPhase(atMinutes(1170 + 35), null).phase, "night");
});

test("phase boundaries flip at ±1 min", () => {
  const times = {
    sunrise: atMinutes(390),
    sunset: atMinutes(1170),
    solarNoon: atMinutes(780),
  };
  assert.equal(skyPhase(atMinutes(349), times).phase, "night");
  assert.equal(skyPhase(atMinutes(350), times).phase, "dawn");
  assert.equal(skyPhase(atMinutes(414), times).phase, "dawn");
  assert.equal(skyPhase(atMinutes(415), times).phase, "day");
  assert.equal(skyPhase(atMinutes(1109), times).phase, "day");
  assert.equal(skyPhase(atMinutes(1110), times).phase, "golden");
  assert.equal(skyPhase(atMinutes(1159), times).phase, "golden");
  assert.equal(skyPhase(atMinutes(1160), times).phase, "dusk");
  assert.equal(skyPhase(atMinutes(1204), times).phase, "dusk");
  assert.equal(skyPhase(atMinutes(1205), times).phase, "night");
});

test("sunTimes returns sunrise before noon and sunset after for Phoenix", () => {
  const times = sunTimes(33.45, -112.07, new Date(2026, 5, 21, 12, 0, 0));
  assert.ok(times.sunrise < times.solarNoon);
  assert.ok(times.solarNoon < times.sunset);
  const riseMin = times.sunrise.getHours() * 60 + times.sunrise.getMinutes();
  const setMin = times.sunset.getHours() * 60 + times.sunset.getMinutes();
  assert.ok(riseMin >= 4 * 60 && riseMin <= 7 * 60, `sunrise ${riseMin}`);
  assert.ok(setMin >= 18 * 60 && setMin <= 21 * 60, `sunset ${setMin}`);
});

test("sunPosition at solar noon is high and southward", () => {
  const date = new Date(2026, 5, 21, 12, 0, 0);
  const times = sunTimes(33.45, -112.07, date);
  const pos = sunPosition(33.45, -112.07, times.solarNoon);
  assert.ok(pos.altitudeDeg > 40);
  assert.ok(pos.azimuthDeg > 160 && pos.azimuthDeg < 220);
});
