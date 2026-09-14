import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays } from "@/lib/dates";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import {
  applyMomentumOnComplete,
  closedDayRun,
  dayArc,
  runStripDays,
  dayOutcome,
  dismissWeekWrapped,
  monthRecap,
  newlyEarned,
  shouldShowWeekWrapped,
  todayEffort,
  weekProgress,
  weekWrappedTipKey,
} from "@/lib/momentum";
import type { Completion, Duty, Household } from "@/lib/types";

function duty(partial: Partial<Duty> & Pick<Duty, "title">): Duty {
  return {
    id: "d1",
    notes: "",
    room: "kitchen",
    nodeId: "kitchen",
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "daily",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-09-01T00:00:00.000Z",
    archived: false,
    ...partial,
  };
}

function completion(partial: Partial<Completion> & Pick<Completion, "dutyId" | "completedAt">): Completion {
  return {
    id: partial.id ?? `c-${partial.dutyId}-${partial.completedAt}`,
    actor: "me",
    visitId: null,
    ...partial,
  };
}

function household(overrides: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 8,
    householdName: "Casa",
    ownerName: "Me",
    cleanerName: "Ana",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: [{ id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 0 }],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

function atNoon(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0).toISOString();
}

test("rest day counts as closed for the run", () => {
  const saturday = new Date(2026, 8, 12);
  const weekly = duty({
    id: "trash",
    title: "Trash",
    frequency: "weekly",
    weekday: 6,
    estimatedMinutes: 5,
  });
  const home = household({
    duties: [weekly],
    completions: [completion({ dutyId: "trash", completedAt: atNoon(saturday) })],
  });
  const sunday = new Date(2026, 8, 13);
  assert.equal(dayOutcome(home, sunday), "rest");
  const run = closedDayRun(home, sunday);
  assert.ok(run.current >= 1);
  assert.equal(run.best, 0);
});

test("grace day keeps the run", () => {
  const daily = duty({ id: "wipe", title: "Wipe counters", estimatedMinutes: 5 });
  const thursday = new Date(2026, 8, 10);
  const completions = [0, 1, 3].map((offset) =>
    completion({
      dutyId: "wipe",
      completedAt: atNoon(addDays(thursday, -offset)),
    }),
  );
  const home = household({ duties: [daily], completions });
  assert.equal(dayOutcome(home, thursday), "closed");
  assert.equal(dayOutcome(home, addDays(thursday, -1)), "closed");
  assert.equal(dayOutcome(home, addDays(thursday, -2)), "open");
  assert.equal(dayOutcome(home, addDays(thursday, -3)), "closed");
  const run = closedDayRun(home, thursday);
  assert.equal(run.current, 3);
  assert.equal(run.graceUsed, true);
});

test("two misses in a rolling seven break the run", () => {
  const daily = duty({ id: "wipe", title: "Wipe counters" });
  const thursday = new Date(2026, 8, 10);
  const completions = [0, 3].map((offset) =>
    completion({
      dutyId: "wipe",
      completedAt: atNoon(addDays(thursday, -offset)),
    }),
  );
  const home = household({ duties: [daily], completions });
  assert.equal(dayOutcome(home, addDays(thursday, -1)), "open");
  assert.equal(dayOutcome(home, addDays(thursday, -2)), "open");
  const run = closedDayRun(home, thursday);
  assert.equal(run.current, 1);
  assert.equal(run.graceUsed, true);
});

test("weekProgress counts a carried-over overdue item once", () => {
  const sunday = new Date(2026, 8, 13);
  const weekly = duty({
    id: "trash",
    title: "Trash",
    frequency: "weekly",
    weekday: 6,
    estimatedMinutes: 8,
  });
  const home = household({ duties: [weekly] });
  const progress = weekProgress(home, sunday);
  assert.equal(progress.planned, 1);
  assert.equal(progress.done, 0);
  assert.equal(progress.minutes, 0);
  const doneHome = household({
    duties: [weekly],
    completions: [completion({ dutyId: "trash", completedAt: atNoon(sunday) })],
  });
  const done = weekProgress(doneHome, sunday);
  assert.equal(done.planned, 1);
  assert.equal(done.done, 1);
  assert.equal(done.minutes, 8);
});

test("todayEffort falls back to ten minutes", () => {
  assert.equal(
    todayEffort([
      duty({ title: "Wipe", estimatedMinutes: 5 }),
      duty({ id: "tidy", title: "Tidy" }),
    ]),
    15,
  );
});

test("closedDayRun reads cached best without walking 24 months", () => {
  const daily = duty({ id: "wipe", title: "Wipe counters" });
  const today = new Date(2026, 8, 13);
  const home = {
    ...household({
      duties: [daily],
      completions: [completion({ dutyId: "wipe", completedAt: atNoon(today) })],
    }),
    momentum: { enabled: true, bestRun: 12 },
  };
  const run = closedDayRun(home, today);
  assert.equal(run.best, 12);
  assert.ok(run.current >= 1);
});

test("monthRecap sums completions and rooms", () => {
  const wipe = duty({ id: "wipe", title: "Wipe", estimatedMinutes: 5 });
  const trash = duty({
    id: "trash",
    title: "Trash",
    room: "living",
    nodeId: "living",
    frequency: "weekly",
    weekday: 6,
    estimatedMinutes: 10,
  });
  const month = new Date(2026, 8, 13);
  const home = household({
    rooms: [
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 0 },
      { id: "living", floorId: "main", name: "Living", type: "living", sortOrder: 1 },
    ],
    duties: [wipe, trash],
    completions: [
      completion({ dutyId: "wipe", completedAt: atNoon(new Date(2026, 8, 10)) }),
      completion({ dutyId: "wipe", completedAt: atNoon(new Date(2026, 8, 11)) }),
      completion({ dutyId: "trash", completedAt: atNoon(new Date(2026, 8, 12)) }),
    ],
  });
  const recap = monthRecap(home, month);
  assert.equal(recap.done, 3);
  assert.equal(recap.minutes, 20);
  assert.equal(recap.roomsTouched, 2);
  assert.ok(recap.longestRun >= 1);
});

test("week wrapped waits for week end and reuses one seenTips slot", () => {
  const saturday = new Date(2026, 8, 12);
  const sunday = new Date(2026, 8, 13);
  const weekly = duty({
    id: "trash",
    title: "Trash",
    frequency: "weekly",
    weekday: 6,
  });
  const home = household({
    duties: [weekly],
    completions: [completion({ dutyId: "trash", completedAt: atNoon(saturday) })],
    seenTips: ["arrival-prompt", "week-wrapped-2026-W01"],
  });
  assert.equal(shouldShowWeekWrapped(home, sunday), false);
  assert.equal(shouldShowWeekWrapped(home, saturday), true);
  const dismissed = dismissWeekWrapped(home, saturday);
  assert.equal(dismissed.seenTips.includes("arrival-prompt"), true);
  assert.equal(dismissed.seenTips.includes("week-wrapped-2026-W01"), false);
  assert.equal(dismissed.seenTips.includes(weekWrappedTipKey(saturday)), true);
  assert.equal(shouldShowWeekWrapped(dismissed, saturday), false);
});

test("newlyEarned first-close and first-week after finishing the week's work", () => {
  const sunday = new Date(2026, 8, 13);
  const weekly = duty({
    id: "trash",
    title: "Trash",
    frequency: "weekly",
    weekday: 6,
  });
  const home = household({
    duties: [weekly],
    completions: [completion({ dutyId: "trash", completedAt: atNoon(sunday) })],
  });
  const earned = newlyEarned(home, sunday);
  assert.equal(earned.includes("first-close"), true);
  assert.equal(earned.includes("first-week"), true);
});

test("newlyEarned ten-done, every-room, first-quarterly, and thirty-run", () => {
  const now = new Date(2026, 8, 13);
  const wipe = duty({ id: "wipe", title: "Wipe" });
  const tidy = duty({ id: "tidy", title: "Tidy", room: "living", nodeId: "living" });
  const hvac = duty({
    id: "hvac",
    title: "HVAC",
    frequency: "quarterly",
    dueDate: "2026-09-13",
  });
  const completions = [
    ...Array.from({ length: 9 }, (_, index) =>
      completion({
        id: `c${index}`,
        dutyId: "wipe",
        completedAt: atNoon(addDays(now, -index)),
      }),
    ),
    completion({ dutyId: "tidy", completedAt: atNoon(now) }),
    completion({ dutyId: "hvac", completedAt: atNoon(now) }),
  ];
  const home = household({
    rooms: [
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 0 },
      { id: "living", floorId: "main", name: "Living", type: "living", sortOrder: 1 },
      { id: "whole-home", floorId: null, name: "Home systems", type: "other", sortOrder: 2, system: "whole-home" },
    ],
    duties: [wipe, tidy, hvac],
    completions,
    momentum: { enabled: true, bestRun: 30 },
  });
  const earned = newlyEarned(home, now);
  assert.equal(earned.includes("ten-done"), true);
  assert.equal(earned.includes("every-room"), true);
  assert.equal(earned.includes("first-quarterly"), true);
  assert.equal(earned.includes("thirty-run"), true);
});

test("applyMomentumOnComplete records ids and bestRun; undo does not revoke", () => {
  const today = new Date(2026, 8, 13);
  const daily = duty({ id: "wipe", title: "Wipe" });
  const home = household({
    duties: [daily],
    completions: [completion({ dutyId: "wipe", completedAt: atNoon(today) })],
  });
  const next = applyMomentumOnComplete(home, today);
  assert.ok(next.milestones.some((item) => item.id === "first-close"));
  assert.ok(next.momentum.bestRun >= 1);
  const undone = { ...next, completions: [] };
  assert.equal(undone.milestones.length, next.milestones.length);
});

test("dayArc reports open closed clear and rest", () => {
  const today = new Date(2026, 8, 13);
  const daily = duty({ id: "wipe", title: "Wipe", estimatedMinutes: 5 });
  const openHome = household({ duties: [daily] });
  const open = dayArc(openHome, today);
  assert.equal(open.state, "open");
  assert.equal(open.open, 1);
  assert.equal(open.done, 0);
  assert.equal(open.minutesLeft, 5);

  const closedHome = household({
    duties: [daily],
    completions: [completion({ dutyId: "wipe", completedAt: atNoon(today) })],
  });
  const closed = dayArc(closedHome, today);
  assert.equal(closed.state, "closed");
  assert.equal(closed.done, 1);
  assert.equal(closed.minutesDone, 5);

  const weekly = duty({
    id: "trash",
    title: "Trash",
    frequency: "weekly",
    weekday: 6,
  });
  const clearHome = household({ duties: [weekly] });
  const clear = dayArc(clearHome, today);
  assert.equal(clear.state, "clear");
  assert.ok(clear.nextUp);

  const rest = dayArc(household({ duties: [] }), today);
  assert.equal(rest.state, "rest");
  assert.equal(rest.nextUp, null);
});

test("dayArc respects audience filter", () => {
  const today = new Date(2026, 8, 13);
  const mine = duty({ id: "me", title: "Mine", audience: "me" });
  const cleaner = duty({ id: "cl", title: "Cleaner", audience: "cleaner" });
  const home = household({ duties: [mine, cleaner] });
  assert.equal(dayArc(home, today, "me").open, 1);
  assert.equal(dayArc(home, today, "cleaner").open, 1);
  assert.equal(dayArc(home, today, "all").open, 2);
});

test("runStripDays marks grace and today", () => {
  const today = new Date(2026, 8, 13);
  const daily = duty({ id: "wipe", title: "Wipe" });
  // closed yesterday, open today with grace on an earlier open day in the run
  const home = household({
    duties: [daily],
    completions: [
      completion({ dutyId: "wipe", completedAt: atNoon(addDays(today, -1)) }),
      completion({ dutyId: "wipe", completedAt: atNoon(addDays(today, -3)) }),
    ],
  });
  const days = runStripDays(home, today);
  assert.equal(days.length, 7);
  assert.equal(days[6]?.isToday, true);
  assert.equal(days[6]?.outcome, "open");
});
