import assert from "node:assert/strict";
import { test } from "node:test";
import {
  expectedArrivalFor,
  isAwaitingArrival,
  isReorderReminderActive,
  isWithinArrivalHold,
  markAutomationOrdered,
  reminderDateFor,
} from "@/lib/supply";
import type { SupplyAutomation } from "@/lib/types";

function item(partial: Partial<SupplyAutomation> = {}): SupplyAutomation {
  return {
    id: "s1",
    dutyId: "d1",
    linkedDutyIds: ["d1"],
    room: "kitchen",
    nodeId: "kitchen",
    nodeType: "room",
    itemName: "Filter",
    sku: "",
    retailerUrl: "",
    leadTimeDays: 14,
    quantity: 1,
    onHand: 0,
    qtyPerOrder: 1,
    reorderAt: 0,
    installedAt: "2026-06-01",
    lifespanValue: 3,
    lifespanUnit: "months",
    orderByDate: "2026-09-01",
    nextOrderDate: "2026-09-01",
    orderInFlight: false,
    state: "stocked",
    expectedArrivalDate: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...partial,
  };
}

test("reminder fires at need-by minus lead time", () => {
  assert.equal(reminderDateFor(item({ orderByDate: "2026-09-01", leadTimeDays: 14 })), "2026-08-18");
  assert.equal(reminderDateFor(item({ orderByDate: "2026-09-01", leadTimeDays: 0 })), "2026-09-01");
});

test("reminder is active on the lead-time date, not before", () => {
  const supply = item({ orderByDate: "2026-09-01", leadTimeDays: 14 });
  assert.equal(isReorderReminderActive(supply, new Date(2026, 7, 17)), false);
  assert.equal(isReorderReminderActive(supply, new Date(2026, 7, 18)), true);
});

test("marking ordered sets arrival and holds the reminder through grace", () => {
  const now = new Date(2026, 7, 23);
  const ordered = markAutomationOrdered(item({ leadTimeDays: 14 }), now);
  assert.equal(ordered.orderInFlight, true);
  assert.equal(ordered.state, "ordered");
  assert.equal(ordered.expectedArrivalDate, expectedArrivalFor(now, 14));
  assert.equal(isAwaitingArrival(ordered, now), true);
  assert.equal(isReorderReminderActive(ordered, now), false);
  assert.equal(isWithinArrivalHold(ordered, new Date(2026, 8, 9)), true);
  assert.equal(isWithinArrivalHold(ordered, new Date(2026, 8, 10)), false);
});
