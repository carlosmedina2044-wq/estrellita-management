import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPostalCode, deriveClimate, isValidUsZip, normalizeUsZip } from "@/lib/climate";

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
