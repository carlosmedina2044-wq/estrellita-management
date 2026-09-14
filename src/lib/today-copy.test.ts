import assert from "node:assert/strict";
import { test } from "node:test";
import en from "@/i18n/messages/en.json";
import { dayOfYear, heroCopyKey } from "@/lib/today-copy";

test("heroCopyKey returns catalog keys and is day-stable", () => {
  const keys = new Set(Object.keys(en));
  for (const state of ["open", "closed", "clear", "rest"] as const) {
    for (let day = 0; day < 20; day++) {
      const key = heroCopyKey(state, day, { hasName: false, count: 3 });
      assert.ok(keys.has(key), `missing ${key}`);
      assert.equal(heroCopyKey(state, day, { hasName: false, count: 3 }), key);
    }
  }
});

test("heroCopyKey never returns named key without a name", () => {
  for (let day = 0; day < 40; day++) {
    const key = heroCopyKey("open", day, { hasName: false, count: 4 });
    assert.notEqual(key, "today.heroOpenNamed");
  }
  const named = new Set(
    Array.from({ length: 40 }, (_, day) =>
      heroCopyKey("open", day, { hasName: true, count: 4 }),
    ),
  );
  assert.ok(named.has("today.heroOpenNamed"));
});

test("heroCopyKey uses headlineOne for a single open duty", () => {
  assert.equal(
    heroCopyKey("open", 12, { hasName: true, count: 1 }),
    "today.headlineOne",
  );
});

test("dayOfYear is stable for a calendar day", () => {
  assert.equal(dayOfYear(new Date(2026, 0, 1)), 1);
  assert.equal(dayOfYear(new Date(2026, 0, 1, 23)), 1);
});
