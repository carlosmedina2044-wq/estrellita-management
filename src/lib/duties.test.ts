import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTime, setActiveDateLocale, toISODate } from "@/lib/dates";
import {
  completionDays,
  completionsInRange,
  doneOnDay,
  doneThisWeek,
  doneToday,
  dutySubtitle,
  isOverdue,
  lastDoneInRoom,
  nextDueDate,
  relativeDayLabel,
  shareDoneText,
} from "@/lib/duties";
import { todayGreeting } from "@/lib/greeting";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { statusText } from "@/lib/node-status";
import { climateLabel } from "@/lib/climate";
import { weatherCaption } from "@/lib/weather/provider";
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
    rooms: [
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 0 },
      { id: "living", floorId: "main", name: "Living", type: "living", sortOrder: 1 },
    ],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
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

test("formatTime uses numeric hour and two-digit minute", () => {
  setActiveDateLocale("en-US");
  assert.equal(formatTime(new Date(2026, 8, 9, 8, 5, 0)), "8:05 AM");
});

test("completionsInRange keeps inclusive calendar days", () => {
  const items = [
    completion({ id: "before", completedAt: new Date(2026, 8, 5, 12, 0, 0).toISOString() }),
    completion({ id: "start", completedAt: new Date(2026, 8, 6, 0, 30, 0).toISOString() }),
    completion({ id: "end", completedAt: new Date(2026, 8, 9, 23, 0, 0).toISOString() }),
    completion({ id: "after", completedAt: new Date(2026, 8, 10, 8, 0, 0).toISOString() }),
  ];
  const inRange = completionsInRange(items, new Date(2026, 8, 6), new Date(2026, 8, 9));
  assert.deepEqual(inRange.map((item) => item.id), ["start", "end"]);
});

test("doneOnDay keeps latest completion per duty and sorts newest first", () => {
  const wipe = duty({ id: "wipe", title: "Wipe counters" });
  const trash = duty({ id: "trash", title: "Take out trash", room: "living", nodeId: "living" });
  const home = household({
    duties: [wipe, trash],
    completions: [
      completion({
        id: "early",
        dutyId: "wipe",
        completedAt: new Date(2026, 8, 9, 8, 0, 0).toISOString(),
      }),
      completion({
        id: "late",
        dutyId: "wipe",
        completedAt: new Date(2026, 8, 9, 16, 0, 0).toISOString(),
      }),
      completion({
        id: "trash",
        dutyId: "trash",
        actor: "cleaner",
        completedAt: new Date(2026, 8, 9, 10, 0, 0).toISOString(),
      }),
      completion({
        id: "yesterday",
        dutyId: "wipe",
        completedAt: new Date(2026, 8, 8, 12, 0, 0).toISOString(),
      }),
    ],
  });
  const done = doneOnDay(home, new Date(2026, 8, 9));
  assert.deepEqual(
    done.map((entry) => entry.completion.id),
    ["late", "trash"],
  );
  assert.equal(doneToday(home, new Date(2026, 8, 9))[0]?.completion.id, "late");
});

test("doneThisWeek groups by day desc and clips to today", () => {
  const wipe = duty({ id: "wipe", title: "Wipe counters" });
  const trash = duty({ id: "trash", title: "Take out trash" });
  const floors = duty({ id: "floors", title: "Vacuum floors" });
  const now = new Date(2026, 8, 9, 15, 0, 0); // Wednesday
  const home = household({
    duties: [wipe, trash, floors],
    completions: [
      completion({
        id: "wed",
        dutyId: "wipe",
        completedAt: new Date(2026, 8, 9, 8, 0, 0).toISOString(),
      }),
      completion({
        id: "sun",
        dutyId: "trash",
        completedAt: new Date(2026, 8, 6, 9, 0, 0).toISOString(),
      }),
      completion({
        id: "sat",
        dutyId: "floors",
        completedAt: new Date(2026, 8, 5, 9, 0, 0).toISOString(),
      }),
      completion({
        id: "thu",
        dutyId: "floors",
        completedAt: new Date(2026, 8, 10, 9, 0, 0).toISOString(),
      }),
    ],
  });
  const groups = doneThisWeek(home, now);
  assert.deepEqual(
    groups.map((group) => toISODate(group.date)),
    ["2026-09-09", "2026-09-06"],
  );
  assert.equal(groups[0]?.entries[0]?.duty.id, "wipe");
  assert.equal(groups[1]?.entries[0]?.duty.id, "trash");
});

test("completionDays returns ISO days in range", () => {
  const home = household({
    duties: [duty({ title: "Wipe counters" })],
    completions: [
      completion({ completedAt: new Date(2026, 8, 6, 9, 0, 0).toISOString() }),
      completion({
        id: "c2",
        completedAt: new Date(2026, 8, 9, 9, 0, 0).toISOString(),
      }),
      completion({
        id: "c3",
        completedAt: new Date(2026, 8, 12, 9, 0, 0).toISOString(),
      }),
    ],
  });
  const days = completionDays(home, new Date(2026, 8, 6), new Date(2026, 8, 9));
  assert.deepEqual([...days].sort(), ["2026-09-06", "2026-09-09"]);
});

test("lastDoneInRoom returns the latest completion for that room", () => {
  const kitchen = duty({ id: "wipe", title: "Wipe counters", room: "kitchen" });
  const living = duty({ id: "tidy", title: "Tidy living", room: "living", nodeId: "living" });
  const home = household({
    duties: [kitchen, living],
    completions: [
      completion({
        id: "old-kitchen",
        dutyId: "wipe",
        completedAt: new Date(2026, 8, 1, 9, 0, 0).toISOString(),
      }),
      completion({
        id: "new-kitchen",
        dutyId: "wipe",
        completedAt: new Date(2026, 8, 8, 9, 0, 0).toISOString(),
      }),
      completion({
        id: "living",
        dutyId: "tidy",
        completedAt: new Date(2026, 8, 9, 9, 0, 0).toISOString(),
      }),
    ],
  });
  assert.equal(lastDoneInRoom(home, "kitchen")?.id, "new-kitchen");
  assert.equal(lastDoneInRoom(home, "living")?.id, "living");
  assert.equal(lastDoneInRoom(home, "bath"), null);
});

test("relativeDayLabel uses today yesterday and daysAgo", () => {
  const now = new Date(2026, 8, 9, 15, 0, 0);
  assert.equal(relativeDayLabel(new Date(2026, 8, 9, 8, 0, 0), now), "Today");
  assert.equal(relativeDayLabel(new Date(2026, 8, 8, 8, 0, 0), now), "Yesterday");
  assert.equal(relativeDayLabel(new Date(2026, 8, 6, 8, 0, 0), now), "3 days ago");
});

test("shareDoneText lists checked titles or the empty line", () => {
  setActiveDateLocale("en-US");
  const wipe = duty({ id: "wipe", title: "Wipe counters" });
  const home = household({ duties: [wipe] });
  assert.equal(shareDoneText(home, []), "Casa: what's done\n\nNothing completed yet");
  const completedAt = new Date(2026, 8, 9, 8, 5, 0);
  const text = shareDoneText(home, [
    {
      duty: wipe,
      completion: completion({
        dutyId: "wipe",
        actor: "cleaner",
        completedAt: completedAt.toISOString(),
      }),
    },
  ]);
  assert.equal(text, `Casa: what's done\n\n- [x] Wipe counters · Ana · ${formatTime(completedAt)}`);
});
