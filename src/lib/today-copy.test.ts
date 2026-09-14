import assert from "node:assert/strict";
import { test } from "node:test";
import en from "@/i18n/messages/en.json";
import { dayOfYear, heroCopyKey, nextUpDayLabel } from "@/lib/today-copy";

test("heroCopyKey returns catalog keys and is day-stable", () => {
  const keys = new Set(Object.keys(en));
  for (const state of ["open", "closed", "clear", "rest"] as const) {
    for (let day = 0; day < 20; day++) {
      const key = heroCopyKey(state, day, {
        hasName: false,
        count: 3,
        nextUp: state === "clear" ? "2026-09-15" : null,
      });
      assert.ok(keys.has(key), `missing ${key}`);
      assert.equal(
        heroCopyKey(state, day, {
          hasName: false,
          count: 3,
          nextUp: state === "clear" ? "2026-09-15" : null,
        }),
        key,
      );
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

test("heroCopyKey uses heroClear3 when clear with no next-up", () => {
  assert.equal(
    heroCopyKey("clear", 3, { hasName: false, count: 0, nextUp: null }),
    "today.heroClear3",
  );
  assert.equal(
    heroCopyKey("clear", 3, { hasName: false, count: 0, nextUp: "" }),
    "today.heroClear3",
  );
  assert.notEqual(
    heroCopyKey("clear", 3, {
      hasName: false,
      count: 0,
      nextUp: "2026-09-20",
    }),
    "today.heroClear3",
  );
});

test("nextUpDayLabel formats or returns empty", () => {
  assert.equal(nextUpDayLabel(null), "");
  assert.equal(nextUpDayLabel(undefined), "");
  assert.ok(nextUpDayLabel("2026-09-15").length > 0);
});

test("dayOfYear is stable for a calendar day", () => {
  assert.equal(dayOfYear(new Date(2026, 0, 1)), 1);
  assert.equal(dayOfYear(new Date(2026, 0, 1, 23)), 1);
});
