import assert from "node:assert/strict";
import { test } from "node:test";
import { seasonFor } from "@/lib/scene/season";

test("northern hemisphere months", () => {
  assert.equal(seasonFor(new Date(2026, 5, 21), 33), "summer");
  assert.equal(seasonFor(new Date(2026, 11, 21), 33), "winter");
  assert.equal(seasonFor(new Date(2026, 2, 21), 33), "spring");
  assert.equal(seasonFor(new Date(2026, 8, 21), 33), "autumn");
});

test("southern hemisphere flips", () => {
  assert.equal(seasonFor(new Date(2026, 5, 21), -33), "winter");
  assert.equal(seasonFor(new Date(2026, 11, 21), -33), "summer");
  assert.equal(seasonFor(new Date(2026, 2, 21), -33), "autumn");
  assert.equal(seasonFor(new Date(2026, 8, 21), -33), "spring");
});

test("null latitude stays northern", () => {
  assert.equal(seasonFor(new Date(2026, 5, 21), null), "summer");
});
