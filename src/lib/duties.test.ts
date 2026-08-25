import assert from "node:assert/strict";
import { test } from "node:test";
import { dutySubtitle } from "@/lib/duties";
import { todayGreeting } from "@/lib/greeting";
import { statusText } from "@/lib/node-status";
import { climateLabel } from "@/lib/climate";
import { weatherCaption } from "@/lib/weather/provider";
import type { Duty } from "@/lib/types";

function duty(partial: Partial<Duty> & Pick<Duty, "title">): Duty {
  return {
    id: "d1",
    notes: "",
    room: "kitchen",
    nodeId: "kitchen",
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "monthly",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate: "2026-08-01",
    priority: "medium",
    createdAt: "2026-01-01T00:00:00.000Z",
    archived: false,
    ...partial,
  };
}

test("dutySubtitle is place and cadence without day-of-month or Me", () => {
  const text = dutySubtitle(duty({ title: "Wipe counters" }), [], new Date(2026, 7, 24), null, undefined, false);
  assert.equal(text, "kitchen · Monthly");
  assert.equal(text.includes("1st"), false);
  assert.equal(text.includes("Me"), false);
});

test("dutySubtitle overdue uses was due", () => {
  const text = dutySubtitle(
    duty({ title: "Wipe counters", dueDate: "2026-08-01", frequency: "monthly" }),
    [],
    new Date(2026, 7, 24),
    null,
    undefined,
    true,
  );
  assert.match(text, /^kitchen · Was due Aug 1/);
});

test("dutySubtitle appends Cleaner only for cleaner audience", () => {
  const text = dutySubtitle(
    duty({ title: "Clean bathrooms", frequency: "weekly", audience: "cleaner", room: "bathroom" }),
    [],
    new Date(2026, 7, 24),
  );
  assert.ok(text.endsWith("· Cleaner"));
  assert.equal(text.includes("Me"), false);
});

test("todayGreeting hides Me and empty names", () => {
  assert.equal(todayGreeting("Me", 9), "Good morning");
  assert.equal(todayGreeting("me ", 9), "Good morning");
  assert.equal(todayGreeting("", 9), "Good morning");
  assert.equal(todayGreeting("Carlos", 9), "Good morning, Carlos");
  assert.equal(todayGreeting("Carlos", 15), "Good afternoon, Carlos");
  assert.equal(todayGreeting("Carlos", 20), "Good evening, Carlos");
});

test("statusText joins non-zero parts", () => {
  assert.equal(statusText({ overdue: 0, dueSoon: 0, total: 0, reorderPending: 0 }), "All caught up");
  assert.equal(
    statusText({ overdue: 11, dueSoon: 2, total: 13, reorderPending: 4 }),
    "11 overdue · 2 due soon · 4 to reorder",
  );
  assert.equal(statusText({ overdue: 11, dueSoon: 0, total: 11, reorderPending: 0 }), "11 overdue");
});

test("climateLabel uses homeowner names", () => {
  assert.equal(climateLabel("hot-arid"), "Desert");
  assert.equal(climateLabel("marine"), "Marine");
  assert.equal(climateLabel("humid-subtropical"), "Humid");
  assert.equal(climateLabel("cold"), "Cold");
  assert.equal(climateLabel("mixed"), "Mixed");
});

test("weatherCaption never includes ZIP", () => {
  const named = weatherCaption(null, { placeName: "Everett", postalCode: "98201", climateZone: "marine" });
  const zipOnly = weatherCaption(null, { postalCode: "98201", climateZone: "marine" });
  assert.equal(named.text.includes("ZIP"), false);
  assert.equal(zipOnly.text.includes("ZIP"), false);
  assert.equal(named.text, "Everett");
  assert.equal(zipOnly.text, "Marine");
});
