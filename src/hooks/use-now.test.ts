import assert from "node:assert/strict";
import { test } from "node:test";
import { toISODate } from "@/lib/dates";

test("useNow day-change detection compares ISO date strings", () => {
  const morning = toISODate(new Date(2026, 8, 13, 9, 0, 0));
  const evening = toISODate(new Date(2026, 8, 13, 23, 59, 0));
  const nextDay = toISODate(new Date(2026, 8, 14, 0, 1, 0));
  assert.equal(morning, evening);
  assert.notEqual(morning, nextDay);
  assert.equal(morning, "2026-09-13");
  assert.equal(nextDay, "2026-09-14");
});
