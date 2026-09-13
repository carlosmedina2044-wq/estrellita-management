import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchWeatherAttribution,
  installWeatherAttributionForTests,
} from "@/lib/native/weatherkit";
import { parseStored } from "@/lib/storage";
import type { WeatherStatus } from "@/lib/types";

test.afterEach(() => {
  installWeatherAttributionForTests(null);
});

test("fetchWeatherAttribution resolves a fixture via the test hook", async () => {
  const fixture: NonNullable<WeatherStatus["attribution"]> = {
    legalPageURL: "https://weatherkit.apple.com/legal-attribution.html",
    legalText: "Apple Weather",
    markLight: "data:image/png;base64,LIGHT",
    markDark: "data:image/png;base64,DARK",
  };
  installWeatherAttributionForTests(async () => fixture);
  assert.deepEqual(await fetchWeatherAttribution(), fixture);
});

test("attribution survives a failed weather status lastError update", () => {
  const attribution = {
    legalPageURL: "https://weatherkit.apple.com/legal-attribution.html",
    legalText: "Apple Weather",
    markLight: "data:image/png;base64,LIGHT",
    markDark: "data:image/png;base64,DARK",
  };
  const success: WeatherStatus = {
    lastSuccessAt: "2026-09-12T00:00:00.000Z",
    lastError: null,
    attribution,
  };
  const afterFail: WeatherStatus = { ...success, lastError: "Weather provider failed" };
  assert.deepEqual(afterFail.attribution, attribution);
});

test("household without weatherStatus.attribution still loads", () => {
  const household = parseStored(
    JSON.stringify({
      version: 8,
      onboarded: true,
      householdName: "Home",
      weatherStatus: { lastSuccessAt: null, lastError: null },
    }),
  );
  assert.equal(household.weatherStatus.attribution, undefined);
});
