import assert from "node:assert/strict";
import { test } from "node:test";
import {
  expectedArrivalFor,
  isAwaitingArrival,
  isReorderReminderActive,
  markAutomationOrdered,
  reconcileAutomation,
  reminderDateFor,
} from "@/lib/supply";
import type { SupplyAutomation } from "@/lib/types";

function item(partial: Partial<SupplyAutomation> = {}): SupplyAutomation {
  return {
    id: "s1",
    dutyId: "d1",
    room: "kitchen",
    nodeId: "kitchen",
    nodeType: "room",
    itemName: "Filter",
    sku: "",
    asin: "",
    amazonOneClick: false,
    amazonNotes: "",
    amazonProductUrl: "",
    leadTimeDays: 7,
    quantity: 1,
    installedAt: "2026-06-01",
    lifespanValue: 3,
    lifespanUnit: "months",
    orderByDate: "2026-09-01",
    nextOrderDate: "2026-09-01",
    orderInFlight: false,
    expectedArrivalDate: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...partial,
  };
}

test("reminder fires at need-by minus lead time", () => {
  assert.equal(reminderDateFor(item({ orderByDate: "2026-09-01", leadTimeDays: 7 })), "2026-08-25");
  assert.equal(reminderDateFor(item({ orderByDate: "2026-09-01", leadTimeDays: 0 })), "2026-09-01");
});

test("reminder is active on the lead-time date, not before", () => {
  const supply = item({ orderByDate: "2026-09-01", leadTimeDays: 7 });
  assert.equal(isReorderReminderActive(supply, new Date(2026, 7, 24)), false);
  assert.equal(isReorderReminderActive(supply, new Date(2026, 7, 25)), true);
});

test("marking ordered sets arrival and suppresses the reminder", () => {
  const now = new Date(2026, 7, 25);
  const ordered = markAutomationOrdered(item(), now);
  assert.equal(ordered.orderInFlight, true);
  assert.equal(ordered.expectedArrivalDate, expectedArrivalFor(now, 7));
  assert.equal(isAwaitingArrival(ordered, now), true);
  assert.equal(isReorderReminderActive(ordered, now), false);
});

test("after expected arrival the ordered state clears and the next cycle is later", () => {
  const now = new Date(2026, 7, 25);
  const ordered = markAutomationOrdered(item({ lifespanValue: 3, lifespanUnit: "months" }), now);
  const arrived = reconcileAutomation(ordered, new Date(2026, 8, 2));
  assert.equal(arrived.orderInFlight, false);
  assert.equal(arrived.expectedArrivalDate, null);
  assert.equal(isReorderReminderActive(arrived, new Date(2026, 8, 2)), false);
  assert.ok(arrived.orderByDate > "2026-09-02");
});
