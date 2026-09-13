import assert from "node:assert/strict";
import { test } from "node:test";
import { toISODate } from "@/lib/dates";
import { dutySubtitle, isOverdue, nextDueDate } from "@/lib/duties";
import { todayGreeting } from "@/lib/greeting";
import { statusText } from "@/lib/node-status";
import { climateLabel } from "@/lib/climate";
import { weatherCaption } from "@/lib/weather/provider";
import type { Completion, Duty } from "@/lib/types";

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

test("nextDueDate floors first monthly due on or after createdAt", () => {
  const now = new Date(2026, 8, 13); // Sep 13
  const d = duty({
    title: "Change filter",
    frequency: "monthly",
    monthDay: 1,
    createdAt: "2026-09-13T12:00:00.000Z",
  });
  const next = nextDueDate(d, [], now);
  assert.ok(next);
  assert.equal(next!.getFullYear(), 2026);
  assert.equal(next!.getMonth(), 9); // Oct
  assert.equal(next!.getDate(), 1);
  assert.equal(isOverdue(d, [], now), false);
});

test("nextDueDate floors first weekly due on or after createdAt", () => {
  const sunday = new Date(2026, 8, 13); // Sep 13 2026 is a Sunday
  assert.equal(sunday.getDay(), 0);
  const d = duty({
    title: "Weekend tidy",
    frequency: "weekly",
    weekday: 6,
    createdAt: sunday.toISOString(),
  });
  const next = nextDueDate(d, [], sunday);
  assert.ok(next);
  assert.equal(next!.getDay(), 6);
  assert.equal(next!.getDate(), 19); // coming Saturday
  assert.equal(isOverdue(d, [], sunday), false);
});

function completion(partial: Partial<Completion> = {}): Completion {
  return {
    id: "c1",
    dutyId: "d1",
    actor: "me",
    visitId: null,
    completedAt: "2026-08-01T12:00:00.000Z",
    ...partial,
  };
}

test("nextDueDate uses dueDate as first-due for quarterly without completion", () => {
  const now = new Date(2026, 8, 13);
  const d = duty({
    title: "HVAC filter",
    frequency: "quarterly",
    dueDate: "2026-10-04",
    createdAt: "2026-09-13T12:00:00.000Z",
  });
  const next = nextDueDate(d, [], now);
  assert.ok(next);
  assert.equal(toISODate(next!), "2026-10-04");
  assert.equal(isOverdue(d, [], now), false);
});

test("nextDueDate installedAt beats dueDate for quarterly", () => {
  const now = new Date(2026, 8, 13);
  const d = duty({
    title: "HVAC filter",
    frequency: "quarterly",
    dueDate: "2026-10-04",
    createdAt: "2026-09-13T12:00:00.000Z",
  });
  const next = nextDueDate(d, [], now, "2026-06-01");
  assert.ok(next);
  assert.equal(toISODate(next!), "2026-09-01");
});

test("nextDueDate completion beats installedAt and dueDate for quarterly", () => {
  const now = new Date(2026, 8, 13);
  const d = duty({
    title: "HVAC filter",
    frequency: "quarterly",
    dueDate: "2026-10-04",
    createdAt: "2026-09-13T12:00:00.000Z",
  });
  const next = nextDueDate(d, [completion({ completedAt: "2026-08-01T12:00:00.000Z" })], now, "2026-06-01");
  assert.ok(next);
  assert.equal(toISODate(next!), "2026-11-01");
});

test("nextDueDate yearly is not overdue before dueDate", () => {
  const now = new Date(2026, 8, 13);
  const d = duty({
    title: "Water heater flush",
    frequency: "yearly",
    dueDate: "2027-03-13",
    createdAt: "2026-09-13T12:00:00.000Z",
  });
  const next = nextDueDate(d, [], now);
  assert.ok(next);
  assert.equal(toISODate(next!), "2027-03-13");
  assert.equal(isOverdue(d, [], now), false);
});

test("dutySubtitle is place and cadence without day-of-month or Me", () => {
  const text = dutySubtitle(duty({ title: "Wipe counters" }), [], new Date(2026, 7, 24), null, undefined, false);
  assert.equal(text, "kitchen · Monthly");
  assert.equal(text.includes("1st"), false);
  assert.equal(text.includes("Me"), false);
});

test("dutySubtitle overdue uses was due", () => {
  const text = dutySubtitle(
    duty({ title: "Wipe counters", dueDate: "2026-08-01", frequency: "once" }),
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
  assert.equal(zipOnly.text, "98201");
});
