import assert from "node:assert/strict";
import { test } from "node:test";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { arrivalCheckAt, itemReminderCap, plannedNotifications } from "@/lib/notifications";
import { markConsumableOrdered, receiveConsumable } from "@/lib/restock";
import type { Duty, Household, SupplyAutomation } from "@/lib/types";

function duty(partial: Partial<Duty> & Pick<Duty, "id" | "title">): Duty {
  return {
    notes: "",
    room: "hvac",
    nodeId: "hvac",
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "quarterly",
    kind: "replacement",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-01-01T00:00:00.000Z",
    archived: false,
    ...partial,
  };
}

function item(partial: Partial<SupplyAutomation> = {}): SupplyAutomation {
  return {
    id: "s1",
    dutyId: "d1",
    linkedDutyIds: ["d1"],
    room: "hvac",
    nodeId: "hvac",
    nodeType: "room",
    itemName: "HVAC filter",
    sku: "",
    retailerUrl: "",
    quantity: 1,
    onHand: 0,
    qtyPerOrder: 1,
    reorderAt: 0,
    leadTimeDays: 14,
    installedAt: "2026-01-01",
    lifespanValue: 3,
    lifespanUnit: "months",
    orderByDate: "2026-09-01",
    nextOrderDate: "2026-09-01",
    orderInFlight: false,
    state: "stocked",
    expectedArrivalDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
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
      { id: "hvac", floorId: "main", name: "HVAC", type: "other", sortOrder: 1 },
    ],
    assets: [],
    duties: [duty({ id: "d1", title: "Change HVAC filter" })],
    completions: [],
    visits: [],
    supplyAutomations: [],
    restockDigest: { enabled: false, weekday: 0, hour: 9, lastSentOn: null, permissionAsked: true },
    ...overrides,
  });
}

const now = new Date(2026, 7, 23, 10, 0, 0);

test("arrival check is the day after expected arrival at 18:00 local", () => {
  const at = arrivalCheckAt("2026-08-25");
  assert.equal(at.getFullYear(), 2026);
  assert.equal(at.getMonth(), 7);
  assert.equal(at.getDate(), 26);
  assert.equal(at.getHours(), 18);
  assert.equal(at.getMinutes(), 0);
});

test("item reminder cap shrinks by the number of arrival notices", () => {
  assert.equal(itemReminderCap(0), 50);
  assert.equal(itemReminderCap(7), 43);
  assert.equal(itemReminderCap(50), 0);
  assert.equal(itemReminderCap(80), 0);
});

test("ordered items schedule Did it arrive? before order-by reminders", () => {
  const ordered = markConsumableOrdered(
    item(),
    { expectedArrivalDate: "2026-08-25", qty: 1 },
    now,
  );
  const stocked = item({
    id: "s2",
    itemName: "Batteries",
    onHand: 3,
    orderByDate: "2026-10-01",
    nextOrderDate: "2026-10-01",
    state: "stocked",
    expectedArrivalDate: null,
    dutyId: "d2",
    linkedDutyIds: ["d2"],
  });
  const notices = plannedNotifications(household({ supplyAutomations: [ordered, stocked] }), now);
  const arrival = notices.find((notice) => notice.extra?.action === "receive");
  const orderBy = notices.find((notice) => notice.title.startsWith("Order "));
  assert.ok(arrival);
  assert.equal(arrival?.title, "Did the HVAC filter arrive?");
  assert.equal(arrival?.body, "Tap to mark it received — the install chore is waiting on it.");
  assert.equal(arrival?.extra?.tab, "restock");
  assert.equal(arrival?.extra?.itemId, "s1");
  assert.equal(arrival?.schedule.at.getDate(), 26);
  assert.equal(arrival?.schedule.at.getHours(), 18);
  assert.ok(orderBy);
  assert.ok(notices.indexOf(arrival!) < notices.indexOf(orderBy!));
});

test("arrival copy drops the install line when no linked duty exists", () => {
  const ordered = markConsumableOrdered(
    item({ dutyId: "", linkedDutyIds: [] }),
    { expectedArrivalDate: "2026-08-25", qty: 1 },
    now,
  );
  const notices = plannedNotifications(household({ duties: [], supplyAutomations: [ordered] }), now);
  const arrival = notices.find((notice) => notice.extra?.action === "receive");
  assert.equal(arrival?.body, "Tap to mark it received.");
});

test("a past arrival check is not re-scheduled", () => {
  const ordered = markConsumableOrdered(
    item(),
    { expectedArrivalDate: "2026-08-20", qty: 1 },
    new Date(2026, 7, 10, 10, 0, 0),
  );
  const notices = plannedNotifications(household({ supplyAutomations: [ordered] }), now);
  assert.equal(
    notices.some((notice) => notice.extra?.action === "receive"),
    false,
  );
});

test("received items leave the arrival bucket so the notice cannot re-fire", () => {
  const ordered = markConsumableOrdered(
    item(),
    { expectedArrivalDate: "2026-08-25", qty: 1 },
    now,
  );
  const received = receiveConsumable(ordered, 1, new Date(2026, 7, 26, 12, 0, 0));
  const notices = plannedNotifications(household({ supplyAutomations: [received] }), now);
  assert.equal(
    notices.some((notice) => notice.extra?.action === "receive"),
    false,
  );
});
