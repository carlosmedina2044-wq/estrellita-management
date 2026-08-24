import assert from "node:assert/strict";
import { test } from "node:test";
import { geocodeUsZip } from "@/lib/weather/client";

test("geocodes a US ZIP through Open-Meteo and rounds coordinates", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    assert.match(url, /geocoding-api\.open-meteo\.com/);
    assert.match(url, /85701/);
    assert.doesNotMatch(url, /zippopotam/);
    return new Response(
      JSON.stringify({
        results: [{ name: "Tucson", latitude: 32.22174, longitude: -110.92648, admin1: "Arizona" }],
      }),
      { status: 200 },
    );
  };
  const place = await geocodeUsZip("85701", fetchImpl);
  assert.deepEqual(place, { lat: 32.22, lng: -110.93, placeName: "Tucson" });
});
