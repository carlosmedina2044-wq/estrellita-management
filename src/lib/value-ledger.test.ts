import assert from "node:assert/strict";
import { test } from "node:test";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { handledYourselfAmount, valueLedger } from "@/lib/value-ledger";
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
    frequency: "quarterly",
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
  return { id: "c1", actor: "me", visitId: null, ...partial };
}

test("handledYourselfAmount excludes actualCost diy false and short frequencies", () => {
  const d = duty({ title: "Water heater flush", estimatedCost: 150 });
  assert.equal(handledYourselfAmount(d, completion({ dutyId: "d1", completedAt: "2026-09-01T00:00:00.000Z", actualCost: 10 })), 0);
  assert.equal(handledYourselfAmount({ ...d, isDiy: false }, completion({ dutyId: "d1", completedAt: "2026-09-01T00:00:00.000Z" })), 0);
  assert.equal(handledYourselfAmount({ ...d, frequency: "weekly" }, completion({ dutyId: "d1", completedAt: "2026-09-01T00:00:00.000Z" })), 0);
  assert.equal(handledYourselfAmount(d, completion({ dutyId: "d1", completedAt: "2026-09-01T00:00:00.000Z" })), 150);
});

test("valueLedger hours round to half and amount threshold", () => {
  const home = withHouseholdDefaults({
    version: 8,
    householdName: "Casa",
    ownerName: "Me",
    cleanerName: "",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [],
    rooms: [],
    assets: [],
    duties: [duty({ id: "d1", title: "Flush", estimatedMinutes: 30, estimatedCost: 25 })],
    completions: [completion({ dutyId: "d1", completedAt: "2026-09-10T12:00:00.000Z" })],
    visits: [],
    supplyAutomations: [],
  }) as Household;
  const ledger = valueLedger(home, new Date(2026, 8, 1), new Date(2026, 8, 30));
  assert.equal(ledger.minutes, 30);
  assert.equal(ledger.hours, 0.5);
  assert.equal(ledger.showAmount, true);
});
