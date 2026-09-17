import assert from "node:assert/strict";
import { test } from "node:test";
import { costSummary, lastDoneInfo, recentRhythm } from "@/lib/duty-history";
import type { Completion, Duty } from "@/lib/types";

function duty(partial: Partial<Duty> & Pick<Duty, "id" | "title" | "room">): Duty {
  return {
    notes: "",
    nodeId: partial.room,
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "weekly",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-01-01T00:00:00.000Z",
    archived: false,
    ...partial,
  };
}

function completion(dutyId: string, at: string, extra: Partial<Completion> = {}): Completion {
  return { id: `${dutyId}-${at}`, dutyId, actor: "me", visitId: null, completedAt: at, ...extra };
}

test("lastDoneInfo returns the most recent completion, or null if never done", () => {
  const completions = [
    completion("wipe", "2026-09-01T12:00:00.000Z"),
    completion("wipe", "2026-09-10T12:00:00.000Z", { actor: "cleaner" }),
  ];
  assert.deepEqual(lastDoneInfo("wipe", completions), { completedAt: "2026-09-10T12:00:00.000Z", actor: "cleaner" });
  assert.equal(lastDoneInfo("never-done", completions), null);
});

test("recentRhythm is null for a one-time chore", () => {
  const onceChore = duty({ id: "paint", title: "Paint fence", room: "outdoors", frequency: "once" });
  assert.equal(recentRhythm(onceChore, [], new Date("2026-09-16")), null);
});

test("recentRhythm counts hit windows and a streak that stops at the first miss", () => {
  const weekly = duty({ id: "vacuum", title: "Vacuum", room: "living", frequency: "weekly" });
  const now = new Date("2026-09-16T12:00:00.000Z");
  // Done this week and last week, missed the week before that.
  const completions = [
    completion("vacuum", "2026-09-15T12:00:00.000Z"),
    completion("vacuum", "2026-09-08T12:00:00.000Z"),
  ];
  const rhythm = recentRhythm(weekly, completions, now, 4);
  assert.equal(rhythm?.of, 4);
  assert.equal(rhythm?.done, 2);
  assert.equal(rhythm?.streak, 2);
});

test("recentRhythm counts a completion from later today even when `now` is midnight (as `useNow` pins it)", () => {
  const daily = duty({ id: "wipe", title: "Wipe counters", room: "kitchen", frequency: "daily" });
  // Local-time constructors, like `startOfDay`/`useNow` use — a UTC midnight
  // string would land on the wrong local calendar day in most timezones and
  // defeat the point of this test.
  const midnightNow = new Date(2026, 8, 16, 0, 0, 0);
  const completions = [completion("wipe", new Date(2026, 8, 16, 19, 51, 0).toISOString())];
  const rhythm = recentRhythm(daily, completions, midnightNow, 3);
  assert.equal(rhythm?.done, 1);
  assert.equal(rhythm?.streak, 1);
});

test("recentRhythm reports zero done and zero streak with no completions", () => {
  const weekly = duty({ id: "vacuum", title: "Vacuum", room: "living", frequency: "weekly" });
  const rhythm = recentRhythm(weekly, [], new Date("2026-09-16"), 4);
  assert.deepEqual(rhythm, { done: 0, of: 4, streak: 0 });
});

test("costSummary totals every completion that recorded a cost, newest first", () => {
  const completions = [
    completion("filter", "2026-06-01T00:00:00.000Z", { actualCost: 20 }),
    completion("filter", "2026-09-01T00:00:00.000Z", { actualCost: 25 }),
    completion("filter", "2026-09-10T00:00:00.000Z"),
  ];
  const summary = costSummary("filter", completions);
  assert.equal(summary?.total, 45);
  assert.equal(summary?.count, 2);
  assert.equal(summary?.entries[0]?.completedAt, "2026-09-01T00:00:00.000Z");
});

test("costSummary is null when nothing recorded a cost", () => {
  assert.equal(costSummary("filter", [completion("filter", "2026-09-10T00:00:00.000Z")]), null);
});
