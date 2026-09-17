import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, toISODate } from "@/lib/dates";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import {
  careSignals,
  houseMomentFor,
  nextCareState,
  rawCareLevel,
  reconcileCareLevel,
} from "@/lib/care-level";
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
    createdAt: "2026-01-01T00:00:00.000Z",
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
    cleanerName: "",
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
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).toISOString();
}

function closedFixture(now: Date, days: number, seasonal = false): Household {
  const daily = duty({ id: "wipe", title: "Wipe" });
  const duties = [daily];
  if (seasonal) {
    duties.push(
      duty({
        id: "hvac",
        title: "HVAC filter",
        frequency: "quarterly",
        estimatedMinutes: 20,
      }),
    );
  }
  const completions: Completion[] = [];
  for (let i = 1; i <= days; i++) {
    const day = addDays(now, -i);
    completions.push(completion({ dutyId: "wipe", completedAt: atNoon(day) }));
  }
  if (seasonal) {
    completions.push(
      completion({ dutyId: "hvac", completedAt: atNoon(addDays(now, -30)) }),
    );
  }
  return household({ duties, completions });
}

test("rawCareLevel thresholds and settling window", () => {
  assert.equal(rawCareLevel({ windowDays: 3, closedRatio: 1, seasonalOk: true, openLast7: 0, openPrev7: 0 }), "settling-in");
  assert.equal(rawCareLevel({ windowDays: 30, closedRatio: 0.9, seasonalOk: true, openLast7: 0, openPrev7: 0 }), "loved");
  assert.equal(rawCareLevel({ windowDays: 30, closedRatio: 0.8, seasonalOk: true, openLast7: 0, openPrev7: 0 }), "cared-for");
  assert.equal(rawCareLevel({ windowDays: 30, closedRatio: 0.8, seasonalOk: false, openLast7: 0, openPrev7: 0 }), "well-kept");
  assert.equal(rawCareLevel({ windowDays: 30, closedRatio: 0.65, seasonalOk: true, openLast7: 0, openPrev7: 0 }), "well-kept");
  assert.equal(rawCareLevel({ windowDays: 30, closedRatio: 0.5, seasonalOk: true, openLast7: 0, openPrev7: 0 }), "kept");
  assert.equal(rawCareLevel({ windowDays: 30, closedRatio: 0.4, seasonalOk: true, openLast7: 0, openPrev7: 0 }), "settling-in");
});

test("nextCareState cooldown and one-step rise/drop", () => {
  const now = new Date(2026, 8, 13);
  const signals = { windowDays: 30, closedRatio: 0.95, seasonalOk: true, openLast7: 0, openPrev7: 0 };
  const prev = { level: "kept" as const, since: toISODate(addDays(now, -13)) };
  assert.equal(nextCareState(prev, signals, now).level, "kept");
  const ready = { level: "kept" as const, since: toISODate(addDays(now, -14)) };
  const rose = nextCareState(ready, signals, now);
  assert.equal(rose.level, "well-kept");
  assert.equal(rose.direction, "up");

  const dropSignals = { windowDays: 30, closedRatio: 0.2, seasonalOk: true, openLast7: 4, openPrev7: 4 };
  const drop = nextCareState(
    { level: "well-kept", since: toISODate(addDays(now, -14)) },
    dropSignals,
    now,
  );
  assert.equal(drop.level, "kept");
  assert.equal(drop.direction, "down");
});

test("reconcileCareLevel is a no-op when unchanged and loved uses breathing-loop", () => {
  const now = new Date(2026, 8, 13);
  const loved = closedFixture(now, 30, true);
  const withCare = {
    ...loved,
    momentum: {
      ...loved.momentum,
      care: { level: "loved" as const, since: toISODate(addDays(now, -20)) },
    },
  };
  const same = reconcileCareLevel(withCare, now);
  assert.equal(same, withCare);
  assert.equal(houseMomentFor("loved"), "breathing-loop");
  const fresh = reconcileCareLevel(household({ duties: [duty({ title: "Wipe" })] }), now);
  assert.equal(fresh.momentum.care?.level, "settling-in");
});

test("loved fixture signals", () => {
  const now = new Date(2026, 8, 13);
  const home = closedFixture(now, 30, true);
  const signals = careSignals(home, now);
  assert.ok(signals.windowDays >= 7);
  assert.equal(rawCareLevel(signals), "loved");
});

test("reconcileCareLevel files each replaced state in careHistory, oldest first", () => {
  const now = new Date(2026, 8, 13);
  const strong = closedFixture(now, 30, true);
  const start: Household = {
    ...strong,
    momentum: { ...strong.momentum, care: { level: "kept", since: toISODate(addDays(now, -14)) } },
  };
  const first = reconcileCareLevel(start, now);
  assert.equal(first.momentum.care?.level, "well-kept");
  assert.deepEqual(first.momentum.careHistory, [{ level: "kept", since: toISODate(addDays(now, -14)) }]);

  // Cooldown holds: a same-level pass changes nothing and files nothing.
  assert.equal(reconcileCareLevel(first, now), first);

  const aged: Household = {
    ...first,
    momentum: { ...first.momentum, care: { ...first.momentum.care!, since: toISODate(addDays(now, -14)) } },
  };
  const second = reconcileCareLevel(aged, now);
  assert.equal(second.momentum.care?.level, "cared-for");
  assert.deepEqual(
    second.momentum.careHistory?.map((entry) => entry.level),
    ["kept", "well-kept"],
  );
});

