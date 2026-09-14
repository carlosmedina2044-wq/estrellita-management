import assert from "node:assert/strict";
import { test } from "node:test";
import { kindFromCondition, sceneWeather } from "@/lib/scene/weather";
import type { WeatherForecast } from "@/lib/weather/provider";

const today = "2026-09-13";

function forecast(partial: Partial<WeatherForecast> & Pick<WeatherForecast, "days">): WeatherForecast {
  return { fetchedAt: "2026-09-13T16:00:00.000Z", ...partial };
}

test("derived path: rain, snow, and clear", () => {
  const rain = sceneWeather(
    forecast({
      days: [{ date: today, tempMinF: 60, tempMaxF: 78, windMph: 6, precipIn: 0.2 }],
    }),
    today,
  );
  assert.equal(rain.source, "derived");
  assert.equal(rain.kind, "rain");
  assert.ok(rain.cloudCover > 0);
  assert.ok(rain.precipIntensity > 0);

  const snow = sceneWeather(
    forecast({
      days: [{ date: today, tempMinF: 20, tempMaxF: 32, windMph: 8, precipIn: 0.2 }],
    }),
    today,
  );
  assert.equal(snow.kind, "snow");

  const clear = sceneWeather(
    forecast({
      days: [{ date: today, tempMinF: 60, tempMaxF: 82, windMph: 4, precipIn: 0 }],
    }),
    today,
  );
  assert.equal(clear.kind, "clear");
  assert.equal(clear.cloudCover, 0);
});

test("native path uses current condition and cloudCover", () => {
  const native = sceneWeather(
    forecast({
      days: [{ date: today, tempMinF: 50, tempMaxF: 60, windMph: 5, precipIn: 0, condition: "cloudy" }],
      current: { condition: "foggy", cloudCover: 0.82, isDaylight: true },
    }),
    today,
  );
  assert.equal(native.source, "native");
  assert.equal(native.kind, "fog");
  assert.equal(native.cloudCover, 0.82);
});

test("kindFromCondition mapping", () => {
  assert.equal(kindFromCondition("haze"), "fog");
  assert.equal(kindFromCondition("flurries"), "snow");
  assert.equal(kindFromCondition("thunderstorms"), "rain");
  assert.equal(kindFromCondition("mostlyCloudy"), "cloudy");
  assert.equal(kindFromCondition("clear"), "clear");
});
