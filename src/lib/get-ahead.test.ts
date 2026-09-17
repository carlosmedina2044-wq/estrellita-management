import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, toISODate } from "@/lib/dates";
import { dismissGetAhead, getAheadCandidate, getAheadTipKey, isGetAheadDismissed } from "@/lib/get-ahead";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { Duty, Household } from "@/lib/types";

// Wednesday 16 September 2026.
const NOW = new Date(2026, 8, 16, 10);

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
    weekday: 5, // Friday
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-01-01T00:00:00.000Z",
    archived: false,
    estimatedMinutes: 15,
    ...partial,
  };
}

function home(duties: Duty[]): Household {
  return withHouseholdDefaults({
    version: 8,
    householdName: "Casa",
    ownerName: "",
    cleanerName: "",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [],
    rooms: [{ id: "kitchen", floorId: null, name: "Kitchen", type: "kitchen", sortOrder: 0 }],
    assets: [],
    duties,
    completions: [],
    visits: [],
    supplyAutomations: [],
  });
}

test("picks the quickest weekly chore that is not due today", () => {
  const household = home([
    duty({ id: "long", title: "Mop floors", estimatedMinutes: 30 }),
    duty({ id: "short", title: "Wipe the fridge shelves", estimatedMinutes: 5 }),
    duty({ id: "today", title: "Take out trash", weekday: NOW.getDay(), estimatedMinutes: 2 }),
  ]);
  assert.equal(getAheadCandidate(household, NOW)?.id, "short");
});

test("skips snoozed, weather-added and cautioned chores, and falls back to the month", () => {
  const household = home([
    duty({ id: "snoozed", title: "Snoozed", estimatedMinutes: 3, snoozedUntil: toISODate(addDays(NOW, 3)) }),
    duty({ id: "weather", title: "Cover faucets", estimatedMinutes: 3, weatherTriggerId: "hard-freeze" }),
    duty({ id: "ladder", title: "Clean gutters", estimatedMinutes: 3, caution: "ladder" }),
    duty({ id: "monthly", title: "Descale the kettle", frequency: "monthly", monthDay: 28, estimatedMinutes: 10 }),
  ]);
  assert.equal(getAheadCandidate(household, NOW)?.id, "monthly");
});

test("returns null when there is nothing to pull forward", () => {
  assert.equal(getAheadCandidate(home([]), NOW), null);
});

test("dismissing hides the card for the day and prunes older keys", () => {
  const household = { ...home([]), seenTips: [`get-ahead-${toISODate(addDays(NOW, -1))}`, "other-tip"] };
  assert.equal(isGetAheadDismissed(household, NOW), false);
  const dismissed = dismissGetAhead(household, NOW);
  assert.equal(isGetAheadDismissed(dismissed, NOW), true);
  assert.deepEqual(dismissed.seenTips, ["other-tip", getAheadTipKey(NOW)]);
  assert.equal(isGetAheadDismissed(dismissed, addDays(NOW, 1)), false);
});
