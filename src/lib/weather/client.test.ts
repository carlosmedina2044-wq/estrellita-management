import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchForecastFor, geocodeUsZip, installWeatherIOForTests, WeatherKitProvider } from "@/lib/weather/client";
import { MockWeatherProvider, weatherLine, type WeatherForecast } from "@/lib/weather/provider";

test.afterEach(() => {
  installWeatherIOForTests(null);
});

test("geocodes a US ZIP through the WeatherKit plugin and rounds coordinates", async () => {
  installWeatherIOForTests({
    geocodeZip: async (postalCode) => {
      assert.equal(postalCode, "85701");
      return { lat: 32.22174, lng: -110.92648, placeName: "Tucson" };
    },
  });
  const place = await geocodeUsZip("85701");
  assert.deepEqual(place, { lat: 32.22, lng: -110.93, placeName: "Tucson" });
});

test("WeatherKit provider returns the native forecast payload", async () => {
  const forecast: WeatherForecast = {
    fetchedAt: "2026-08-24T00:00:00.000Z",
    days: [{ date: "2026-08-24", tempMinF: 72, tempMaxF: 104, windMph: 8, precipIn: 0 }],
  };
  const provider = new WeatherKitProvider(async (lat, lng) => {
    assert.equal(lat, 32.22);
    assert.equal(lng, -110.97);
    return forecast;
  });
  const result = await provider.fetchForecast(32.22, -110.97);
  assert.equal(result.days[0]?.tempMaxF, 104);
  assert.equal(weatherLine(result).includes("poor air"), false);
  assert.equal(weatherLine(result).includes("dust"), false);
});

test("MockWeatherProvider stands in for unit tests without WeatherKit", async () => {
  const mock = new MockWeatherProvider({
    fetchedAt: "2026-08-24T00:00:00.000Z",
    days: [{ date: "2026-08-24", tempMinF: 50, tempMaxF: 70, windMph: 5, precipIn: 0.1 }],
  });
  const result = await mock.fetchForecast(0, 0);
  assert.equal(result.days.length, 1);
});

test("fetchForecastFor geocodes a ZIP then fetches WeatherKit", async () => {
  installWeatherIOForTests({
    geocodeZip: async () => ({ lat: 32.22174, lng: -110.92648, placeName: "Tucson" }),
    fetchForecast: async (lat, lng) => {
      assert.equal(lat, 32.22);
      assert.equal(lng, -110.93);
      return {
        fetchedAt: "2026-08-24T00:00:00.000Z",
        days: [{ date: "2026-08-24", tempMinF: 72, tempMaxF: 101, windMph: 6, precipIn: 0 }],
      };
    },
  });
  const result = await fetchForecastFor({ postalCode: "85701" });
  assert.equal(result?.placeName, "Tucson");
  assert.equal(result?.days[0]?.tempMaxF, 101);
});
