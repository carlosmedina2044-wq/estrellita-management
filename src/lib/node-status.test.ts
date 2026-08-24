import assert from "node:assert/strict";
import { test } from "node:test";
import { homeSummary, nodeStatus, statusTone } from "@/lib/node-status";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { Duty, Household, SupplyAutomation } from "@/lib/types";

function duty(partial: Partial<Duty> & Pick<Duty, "id" | "title" | "room">): Duty {
  return {
    notes: "",
    nodeId: partial.nodeId ?? partial.room,
    nodeType: partial.nodeType ?? "room",
    audience: "me",
    effort: "small",
    frequency: "once",
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
    householdName: "Test",
    ownerName: "Me",
    cleanerName: "Cleaner",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: [
      { id: "whole-home", floorId: null, name: "Whole Home", type: "other", sortOrder: 0, system: "whole-home" },
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 1 },
      { id: "bath", floorId: "main", name: "Bath", type: "bathroom", sortOrder: 2 },
    ],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

const now = new Date(2026, 7, 23);

test("overdue task marks the room red", () => {
  const home = household({
    duties: [duty({ id: "d1", title: "Wipe", room: "kitchen", dueDate: "2026-08-01" })],
  });
  const status = nodeStatus(home, "kitchen", "room", now);
  assert.equal(status.overdue, 1);
  assert.equal(status.total, 1);
  assert.equal(statusTone(status), "red");
});

test("task due within 7 days is amber and not overdue", () => {
  const home = household({
    duties: [duty({ id: "d2", title: "Mop", room: "bath", dueDate: "2026-08-26" })],
  });
  const status = nodeStatus(home, "bath", "room", now);
  assert.equal(status.overdue, 0);
  assert.equal(status.dueSoon, 1);
  assert.equal(statusTone(status), "amber");
});

test("clear room is green", () => {
  const status = nodeStatus(household(), "kitchen", "room", now);
  assert.deepEqual(status, { overdue: 0, dueSoon: 0, total: 0, reorderPending: 0 });
  assert.equal(statusTone(status), "green");
});

test("home summary aggregates rooms without double counting", () => {
  const home = household({
    duties: [
      duty({ id: "d1", title: "Wipe", room: "kitchen", dueDate: "2026-08-01" }),
      duty({ id: "d2", title: "Mop", room: "bath", dueDate: "2026-08-26" }),
    ],
  });
  const summary = homeSummary(home, now);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.dueSoon, 1);
  assert.equal(summary.total, 2);
});

test("reorder pending flags a consumable that needs ordering", () => {
  const automation: SupplyAutomation = {
    id: "s1",
    dutyId: "d1",
    linkedDutyIds: ["d1"],
    room: "kitchen",
    nodeId: "kitchen",
    nodeType: "room",
    itemName: "Filter",
    sku: "F1",
    retailerUrl: "",
    quantity: 1,
    onHand: 0,
    qtyPerOrder: 1,
    reorderAt: 0,
    leadTimeDays: 14,
    installedAt: "2025-01-01",
    lifespanValue: 1,
    lifespanUnit: "months",
    orderByDate: "2026-08-01",
    nextOrderDate: "2026-08-01",
    orderInFlight: false,
    state: "stocked",
    expectedArrivalDate: null,
    createdAt: "2025-01-01T00:00:00.000Z",
  };
  const home = household({
    duties: [duty({ id: "d1", title: "Replace filter", room: "kitchen", kind: "replacement", dueDate: null, frequency: "yearly" })],
    supplyAutomations: [automation],
  });
  const status = nodeStatus(home, "kitchen", "room", now);
  assert.ok(status.reorderPending >= 1);
});
