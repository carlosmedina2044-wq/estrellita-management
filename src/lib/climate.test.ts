import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPostalCode, deriveClimate, isValidUsZip, normalizeUsZip, roundCoord } from "@/lib/climate";

test("accepts a 5-digit US ZIP and rejects partials", () => {
  assert.equal(normalizeUsZip("85701-1234"), "85701");
  assert.equal(isValidUsZip("85701"), true);
  assert.equal(isValidUsZip("8570"), false);
  assert.equal(isValidUsZip(""), false);
});

test("saving a ZIP overwrites a stale mixed climate zone", () => {
  const next = applyPostalCode({ climateZone: "mixed" }, "85701");
  assert.equal(next.postalCode, "85701");
  assert.equal(next.climateZone, "hot-arid");
  assert.equal(deriveClimate(next), "hot-arid");
});

test("ZIP prefix beats a stored climate zone on later reads", () => {
  assert.equal(deriveClimate({ postalCode: "55401", climateZone: "mixed" }), "cold");
});

test("coordinates are rounded to two decimals before they are stored or sent", () => {
  assert.equal(roundCoord(32.2226066), 32.22);
  assert.equal(roundCoord(-110.9747108), -110.97);
  const next = applyPostalCode({}, "85701", { lat: 32.2226066, lng: -110.9747108 });
  assert.equal(next.lat, 32.22);
  assert.equal(next.lng, -110.97);
});

test("ZIP-3 table maps the review cities, including Flagstaff vs Tucson", () => {
  const cases: Array<[string, string, ReturnType<typeof deriveClimate>]> = [
    ["Phoenix", "85004", "hot-arid"],
    ["Tucson", "85701", "hot-arid"],
    ["Yuma", "85364", "hot-arid"],
    ["Las Vegas", "89101", "hot-arid"],
    ["El Paso", "79901", "hot-arid"],
    ["Albuquerque", "87102", "hot-arid"],
    ["Flagstaff", "86001", "cold"],
    ["Denver", "80202", "cold"],
    ["Minneapolis", "55401", "cold"],
    ["Boston", "02108", "cold"],
    ["Chicago", "60601", "cold"],
    ["Spokane", "99201", "cold"],
    ["Houston", "77002", "humid-subtropical"],
    ["Austin", "78701", "humid-subtropical"],
    ["Atlanta", "30303", "humid-subtropical"],
    ["Miami", "33101", "humid-subtropical"],
    ["New Orleans", "70112", "humid-subtropical"],
    ["Charlotte", "28202", "humid-subtropical"],
    ["Seattle", "98101", "marine"],
    ["Portland", "97201", "marine"],
    ["San Francisco", "94102", "marine"],
    ["Nashville", "37201", "mixed"],
    ["St. Louis", "63101", "mixed"],
    ["Kansas City", "64101", "mixed"],
    ["Louisville", "40202", "mixed"],
    ["Honolulu", "96813", "humid-subtropical"],
    ["Anchorage", "99501", "cold"],
  ];
  const misses: string[] = [];
  for (const [city, zip, expected] of cases) {
    const zone = deriveClimate({ postalCode: zip });
    if (zone !== expected) misses.push(`${city} ${zip} got ${zone} want ${expected}`);
  }
  assert.equal(misses.length, 0, misses.join("; "));
});

test("climate zone override beats ZIP", () => {
  assert.equal(
    deriveClimate({ postalCode: "85701", climateZoneOverride: "cold" }),
    "cold",
  );
});
