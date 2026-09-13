import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchWeatherAttribution,
  installWeatherAttributionForTests,
  type WeatherAttribution,
} from "@/lib/native/weatherkit";
import { parseStored } from "@/lib/storage";

test.afterEach(() => {
  installWeatherAttributionForTests(null);
});

test("fetchWeatherAttribution resolves a fixture via the test hook", async () => {
  const fixture: WeatherAttribution = {
    legalPageURL: "https://weatherkit.apple.com/legal-attribution.html",
    legalText: "Apple Weather",
    markLight: "data:image/png;base64,LIGHT",
    markDark: "data:image/png;base64,DARK",
  };
  installWeatherAttributionForTests(async () => fixture);
  assert.deepEqual(await fetchWeatherAttribution(), fixture);
});

test("migrate drops weatherStatus.attribution so marks never persist", () => {
  const household = parseStored(
    JSON.stringify({
      version: 8,
      onboarded: true,
      householdName: "Home",
      weatherStatus: {
        lastSuccessAt: "2026-09-12T00:00:00.000Z",
        lastError: null,
        attribution: {
          legalPageURL: "https://weatherkit.apple.com/legal-attribution.html",
          legalText: "Apple Weather",
          markLight: "data:image/png;base64,LIGHT",
          markDark: "data:image/png;base64,DARK",
        },
      },
    }),
  );
  assert.equal("attribution" in household.weatherStatus, false);
});
