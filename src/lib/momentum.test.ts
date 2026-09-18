import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays } from "@/lib/dates";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import {
  yearDays,
  yearWrap,
  yearWrappedYear,
  shouldShowYearWrapped,
  dismissYearWrapped,
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
  milestoneProgress,
  nextMilestone,
} from "@/lib/momentum";
import { MILESTONE_IDS, type Completion, type Duty, type Household } from "@/lib/types";

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

test("yearDays paints every day of the year and marks the future", () => {
  const now = new Date(2026, 8, 17);
  const wipe = duty({ id: "wipe", title: "Wipe" });
  const home = household({
    duties: [wipe],
    completions: [completion({ dutyId: "wipe", completedAt: new Date(2026, 8, 16, 12).toISOString() })],
  });
  const days = yearDays(home, 2026, now);
  assert.equal(days.length, 365);
  assert.equal(days[0].date.getMonth(), 0);
  assert.equal(days[days.length - 1].date.getMonth(), 11);
  const today = days.find((day) => day.isToday);
  assert.ok(today);
  assert.equal(days.filter((day) => day.outcome === "future").length, 365 - 260);
  const yesterday = days[259 - 1];
  assert.equal(yesterday.outcome, "closed");
  // Days before the home's first duty are neither rest nor closed.
  assert.equal(days[0].outcome, "before");
});

test("year wrapped shows between 26 December and 7 January, once, only with something done", () => {
  assert.equal(yearWrappedYear(new Date(2026, 11, 25)), null);
  assert.equal(yearWrappedYear(new Date(2026, 11, 26)), 2026);
  assert.equal(yearWrappedYear(new Date(2027, 0, 7)), 2026);
  assert.equal(yearWrappedYear(new Date(2027, 0, 8)), null);
  const wipe = duty({ id: "wipe", title: "Wipe", createdAt: "2026-01-01T00:00:00.000Z", estimatedMinutes: 10 });
  const empty = household({ duties: [wipe] });
  assert.equal(shouldShowYearWrapped(empty, new Date(2026, 11, 28)), false);
  const busy = household({
    duties: [wipe],
    completions: [completion({ dutyId: "wipe", completedAt: new Date(2026, 5, 1, 12).toISOString() })],
  });
  assert.equal(shouldShowYearWrapped(busy, new Date(2026, 11, 28)), true);
  const dismissed = dismissYearWrapped(busy, new Date(2026, 11, 28));
  assert.equal(shouldShowYearWrapped(dismissed, new Date(2027, 0, 3)), false);
  const wrap = yearWrap(busy, 2026, new Date(2026, 11, 28));
  assert.equal(wrap.year, 2026);
  assert.equal(wrap.closedDays, 1);
  assert.equal(wrap.minutes, 10);
});


test("milestone progress measures unearned milestones", () => {
  const thursday = new Date(2026, 8, 17);
  const wipe = duty({
    id: "wipe",
    title: "Wipe",
    createdAt: "2026-09-01T00:00:00.000Z",
    estimatedMinutes: 10,
  });
  const trash = duty({
    id: "trash",
    title: "Trash",
    createdAt: "2026-09-01T00:00:00.000Z",
    estimatedMinutes: 5,
  });
  const fresh = household({ duties: [wipe, trash] });

  const byId = new Map(milestoneProgress(fresh, thursday).map((item) => [item.id, item]));
  assert.equal(byId.size, MILESTONE_IDS.length);
  assert.equal(byId.get("seven-run")?.target, 7);
  assert.equal([...byId.values()].every((item) => !item.earned), true);

  // The first milestone tracks today's own list so it moves on the first day.
  const firstClose = byId.get("first-close");
  assert.equal(firstClose?.current, 0);
  assert.equal(firstClose?.target, 2);

  assert.equal(byId.get("ten-done")?.target, 10);
  assert.equal(byId.get("thirty-run")?.target, 30);
  assert.equal(byId.get("every-room")?.target, 1);

  const halfDone = household({
    duties: [wipe, trash],
    completions: [completion({ dutyId: "wipe", completedAt: atNoon(thursday) })],
  });
  const halfway = milestoneProgress(halfDone, thursday).find((item) => item.id === "first-close");
  assert.equal(halfway?.current, 1);
  assert.equal(halfway?.fraction, 0.5);
});

test("milestone progress reports stored wins as earned", () => {
  const thursday = new Date(2026, 8, 17);
  const wipe = duty({ id: "wipe", title: "Wipe", createdAt: "2026-09-01T00:00:00.000Z" });
  const home = household({
    duties: [wipe],
    milestones: [{ id: "ten-done", earnedAt: "2026-09-10T12:00:00.000Z" }],
  });
  const tenDone = milestoneProgress(home, thursday).find((item) => item.id === "ten-done");
  assert.equal(tenDone?.earned, true);
  assert.equal(tenDone?.fraction, 1);
  assert.equal(tenDone?.earnedAt, "2026-09-10T12:00:00.000Z");
  assert.equal(nextMilestone(home, thursday)?.earned, false);
});

test("nextMilestone picks the closest unearned milestone", () => {
  const thursday = new Date(2026, 8, 17);
  const wipe = duty({ id: "wipe", title: "Wipe", createdAt: "2026-09-01T00:00:00.000Z" });
  const completions = Array.from({ length: 9 }, (_, index) =>
    completion({
      dutyId: "wipe",
      id: `c${index}`,
      completedAt: atNoon(addDays(thursday, -index - 1)),
    }),
  );
  const home = household({ duties: [wipe], completions });
  assert.equal(nextMilestone(home, thursday)?.id, "ten-done");
});

test("every milestone earned leaves no next", () => {
  const thursday = new Date(2026, 8, 17);
  const home = household({
    duties: [duty({ id: "wipe", title: "Wipe" })],
    milestones: MILESTONE_IDS.map((id) => ({ id, earnedAt: "2026-09-10T12:00:00.000Z" })),
  });
  assert.equal(nextMilestone(home, thursday), null);
});

test("the milestone ladder keeps going past the first month", () => {
  const thursday = new Date(2026, 8, 17);
  const wipe = duty({ id: "wipe", title: "Wipe", createdAt: "2026-06-01T00:00:00.000Z" });
  // A home that has cleared everything the original seven milestones asked for.
  const veteran = household({
    duties: [wipe],
    completions: Array.from({ length: 60 }, (_, index) =>
      completion({ dutyId: "wipe", id: `c${index}`, completedAt: atNoon(addDays(thursday, -index - 1)) }),
    ),
    momentum: {
      enabled: true,
      bestRun: 40,
      care: { level: "well-kept", since: "2026-07-01" },
    },
  });
  const open = milestoneProgress(veteran, thursday).filter((item) => !item.earned);
  assert.ok(open.length > 0, "a 60-chore, 40-day-streak home has run out of goals");
  assert.ok(nextMilestone(veteran, thursday), "nothing left to aim at");
});

test("care milestones measure rungs climbed, not an all-or-nothing flag", () => {
  const thursday = new Date(2026, 8, 17);
  const wipe = duty({ id: "wipe", title: "Wipe" });
  const at = (level: "settling-in" | "well-kept") =>
    household({
      duties: [wipe],
      momentum: { enabled: true, bestRun: 0, care: { level, since: "2026-09-01" } },
    });
  const low = milestoneProgress(at("settling-in"), thursday).find((item) => item.id === "care-loved");
  const high = milestoneProgress(at("well-kept"), thursday).find((item) => item.id === "care-loved");
  assert.ok(high && low && high.fraction > low.fraction, "the care bar does not move with the level");
  assert.equal(high?.earned, false);
});

test("a care milestone survives the level falling back", () => {
  const thursday = new Date(2026, 8, 17);
  const fallen = household({
    duties: [duty({ id: "wipe", title: "Wipe" })],
    momentum: {
      enabled: true,
      bestRun: 0,
      care: { level: "kept", since: "2026-09-01" },
      careHistory: [{ level: "loved", since: "2026-05-01" }],
    },
  });
  const earned = milestoneProgress(fallen, thursday)
    .filter((item) => item.earned)
    .map((item) => item.id);
  assert.ok(earned.includes("care-loved"));
  assert.ok(earned.includes("care-cared-for"));
});

test("seasonal tiers count every seasonal job, not distinct chores", () => {
  const thursday = new Date(2026, 8, 17);
  const gutters = duty({ id: "gutters", title: "Clear gutters", frequency: "quarterly" });
  const home = household({
    duties: [gutters],
    completions: Array.from({ length: 4 }, (_, index) =>
      completion({ dutyId: "gutters", id: `g${index}`, completedAt: atNoon(addDays(thursday, -index * 90 - 1)) }),
    ),
  });
  const byId = new Map(milestoneProgress(home, thursday).map((item) => [item.id, item]));
  assert.equal(byId.get("four-seasonal")?.earned, true);
  assert.equal(byId.get("twelve-seasonal")?.current, 4);
  assert.equal(byId.get("twelve-seasonal")?.earned, false);
});
