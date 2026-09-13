import assert from "node:assert/strict";
import { test } from "node:test";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { briefCopy } from "@/lib/morning-brief";
import { closedDayRun } from "@/lib/momentum";
import type { Duty, Household } from "@/lib/types";

function duty(partial: Partial<Duty> & Pick<Duty, "id" | "title">): Duty {
  return {
    notes: "",
    room: "kitchen",
    nodeId: "kitchen",
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "weekly",
    kind: "chore",
    weekday: 1,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-09-10T00:00:00.000Z",
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
    rooms: [{ id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 0 }],
    assets: [],
    duties: [duty({ id: "d1", title: "Wipe counters" })],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

const now = new Date(2026, 8, 13, 8, 0, 0);

test("briefCopy prefixes a run of two or more when momentum is on", () => {
  const home = household();
  const { current } = closedDayRun(home, now);
  assert.ok(current >= 2);
  const copy = briefCopy([{ title: "Wipe counters" }], false, home, now);
  assert.equal(copy.title, `Day ${current} · 1 chore today`);
  assert.equal(copy.body, "Wipe counters");
});

test("briefCopy omits the run prefix when momentum is off", () => {
  const copy = briefCopy(
    [{ title: "Wipe counters" }],
    false,
    household({ momentum: { enabled: false, bestRun: 4 } }),
    now,
  );
  assert.equal(copy.title, "1 chore today");
});

test("briefCopy private mode keeps counts and hides duty titles", () => {
  const home = household();
  const { current } = closedDayRun(home, now);
  const copy = briefCopy([{ title: "Secret HVAC filter" }], true, home, now);
  assert.equal(copy.title, `Day ${current} · 1 chore today`);
  assert.equal(copy.body, "Open Cuidala for details.");
  assert.equal(copy.body.includes("Secret HVAC filter"), false);
});
