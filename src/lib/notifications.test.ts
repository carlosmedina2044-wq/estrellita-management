import assert from "node:assert/strict";
import { test } from "node:test";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { arrivalCheckAt, capacitorWeekday, itemReminderCap, plannedNotifications } from "@/lib/notifications";
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
    morningBrief: { enabled: false, hour: 8, weekdaysOnly: false },
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
  assert.equal(arrival?.body, "Tap to mark it received. The install chore is waiting on it.");
  assert.equal(arrival?.extra?.tab, "restock");
  assert.equal(arrival?.extra?.itemId, "s1");
  assert.ok(arrival && "at" in arrival.schedule);
  assert.equal(arrival && "at" in arrival.schedule ? arrival.schedule.at.getDate() : 0, 26);
  assert.equal(arrival && "at" in arrival.schedule ? arrival.schedule.at.getHours() : 0, 18);
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

test("weekly digest repeats on weekday and hour, not a single at date", () => {
  const notices = plannedNotifications(
    household({
      restockDigest: { enabled: true, weekday: 0, hour: 9, lastSentOn: null, permissionAsked: true },
      supplyAutomations: [item({ onHand: 0, orderByDate: "2026-08-20", nextOrderDate: "2026-08-20", state: "stocked" })],
    }),
    now,
  );
  const digest = notices.find((notice) => notice.id === 1);
  assert.ok(digest);
  assert.equal("repeats" in digest!.schedule && digest!.schedule.repeats, true);
  assert.ok("on" in digest!.schedule);
  if ("on" in digest!.schedule) {
    assert.equal(digest.schedule.on.weekday, capacitorWeekday(0));
    assert.equal(digest.schedule.on.hour, 9);
  }
});

test("weekly digest includes overdue chores even with nothing to order", () => {
  const overdueDuty = duty({
    id: "overdue-1",
    title: "Clean gutters",
    frequency: "once",
    dueDate: "2026-08-01",
  });
  const notices = plannedNotifications(
    household({
      restockDigest: { enabled: true, weekday: 0, hour: 9, lastSentOn: null, permissionAsked: true },
      duties: [overdueDuty],
      supplyAutomations: [],
    }),
    now,
  );
  const digest = notices.find((notice) => notice.id === 1);
  assert.ok(digest);
  assert.match(digest!.title, /chore still open/);
  assert.equal(digest!.extra?.tab, "today");
  assert.equal("repeats" in digest!.schedule && digest!.schedule.repeats, true);
});

test("unanswered order reminder gets a still-to-order follow-up", () => {
  const notices = plannedNotifications(
    household({
      supplyAutomations: [
        item({
          onHand: 0,
          orderByDate: "2026-08-25",
          nextOrderDate: "2026-08-25",
          state: "stocked",
          leadTimeDays: 0,
          dutyId: "",
          linkedDutyIds: [],
          installedAt: "",
          lifespanValue: 0,
        }),
      ],
    }),
    now,
  );
  const follow = notices.find((notice) => notice.extra?.action === "followup");
  assert.ok(follow);
  assert.match(follow!.title, /Still to order/);
  assert.ok("at" in follow!.schedule);
  if ("at" in follow!.schedule) {
    assert.equal(follow.schedule.at.getDate(), 28);
  }
});

test("two colliding hashes produce distinct IDs and keep both notifications", () => {
  const first = item({
    id: "item-aan",
    itemName: "Alpha filters",
    onHand: 3,
    orderByDate: "2026-10-01",
    nextOrderDate: "2026-10-01",
    dutyId: "d1",
    linkedDutyIds: ["d1"],
  });
  const second = item({
    id: "item-ac0",
    itemName: "Bravo filters",
    onHand: 3,
    orderByDate: "2026-10-02",
    nextOrderDate: "2026-10-02",
    dutyId: "d2",
    linkedDutyIds: ["d2"],
  });
  const notices = plannedNotifications(
    household({
      duties: [duty({ id: "d1", title: "Alpha" }), duty({ id: "d2", title: "Bravo" })],
      supplyAutomations: [first, second],
    }),
    now,
  );
  const reminders = notices.filter((notice) => notice.title.startsWith("Order "));
  assert.equal(reminders.length, 2);
  assert.notEqual(reminders[0]?.id, reminders[1]?.id);
  const ids = notices.map((notice) => notice.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("morning brief schedules one-shot notices for the next seven days with open work", () => {
  const notices = plannedNotifications(
    household({
      morningBrief: { enabled: true, hour: 8, weekdaysOnly: false },
      duties: [duty({ id: "daily-1", title: "Tidy the living room", frequency: "daily" })],
    }),
    new Date(2026, 7, 23, 7, 0, 0),
  );
  const briefs = notices.filter((notice) => notice.extra?.tab === "today");
  assert.equal(briefs.length, 7);
  assert.deepEqual(
    briefs.map((notice) => notice.id),
    [10, 11, 12, 13, 14, 15, 16],
  );
  for (const brief of briefs) {
    assert.equal(brief.title, "1 chore today");
    assert.equal(brief.body, "Tidy the living room");
    assert.equal("repeats" in brief.schedule, false);
    assert.ok("at" in brief.schedule);
    if ("at" in brief.schedule) {
      assert.equal(brief.schedule.at.getHours(), 8);
    }
  }
});

test("morning brief skips weekends, past hours, and empty days", () => {
  const notices = plannedNotifications(
    household({
      morningBrief: { enabled: true, hour: 8, weekdaysOnly: true },
      duties: [
        duty({
          id: "weekly-1",
          title: "Take out trash",
          frequency: "weekly",
          weekday: 3,
          createdAt: "2026-08-23T00:00:00.000Z",
        }),
      ],
    }),
    now,
  );
  const briefs = notices.filter((notice) => notice.id >= 10 && notice.id <= 16);
  assert.equal(briefs.length, 1);
  assert.equal(briefs[0]?.id, 13);
  assert.ok(briefs[0] && "at" in briefs[0].schedule);
  if (briefs[0] && "at" in briefs[0].schedule) {
    assert.equal(briefs[0].schedule.at.getDay(), 3);
    assert.equal(briefs[0].schedule.at.getHours(), 8);
  }
});

test("morning brief lists the first three titles and a more count", () => {
  const notices = plannedNotifications(
    household({
      morningBrief: { enabled: true, hour: 8, weekdaysOnly: false },
      duties: [
        duty({ id: "d1", title: "Alpha", frequency: "daily" }),
        duty({ id: "d2", title: "Bravo", frequency: "daily" }),
        duty({ id: "d3", title: "Charlie", frequency: "daily" }),
        duty({ id: "d4", title: "Delta", frequency: "daily" }),
      ],
    }),
    new Date(2026, 7, 23, 7, 0, 0),
  );
  const brief = notices.find((notice) => notice.id === 10);
  assert.equal(brief?.title, "4 chores today");
  assert.equal(brief?.body, "Alpha · Bravo · Charlie · +1 more");
});

test("morning brief private mode keeps counts and hides duty titles", () => {
  const notices = plannedNotifications(
    household({
      morningBrief: { enabled: true, hour: 8, weekdaysOnly: false },
      restockDigest: {
        enabled: false,
        weekday: 0,
        hour: 9,
        lastSentOn: null,
        permissionAsked: true,
        privateNotifications: true,
      },
      duties: [duty({ id: "secret-duty", title: "Secret HVAC filter", frequency: "daily" })],
    }),
    new Date(2026, 7, 23, 7, 0, 0),
  );
  const brief = notices.find((notice) => notice.id === 10);
  assert.equal(brief?.title, "1 chore today");
  assert.equal(brief?.body, "Open Cuidala for details.");
  assert.equal(brief?.body.includes("Secret HVAC filter"), false);
});

test("morning briefs sit after the digest and before arrivals", () => {
  const ordered = markConsumableOrdered(
    item(),
    { expectedArrivalDate: "2026-08-25", qty: 1 },
    now,
  );
  const notices = plannedNotifications(
    household({
      morningBrief: { enabled: true, hour: 8, weekdaysOnly: false },
      restockDigest: { enabled: true, weekday: 0, hour: 9, lastSentOn: null, permissionAsked: true },
      duties: [duty({ id: "daily-1", title: "Tidy the living room", frequency: "daily" })],
      supplyAutomations: [
        ordered,
        item({ onHand: 0, orderByDate: "2026-08-20", nextOrderDate: "2026-08-20", state: "stocked" }),
      ],
    }),
    new Date(2026, 7, 23, 7, 0, 0),
  );
  const digestIndex = notices.findIndex((notice) => notice.id === 1);
  const firstBrief = notices.findIndex((notice) => notice.id === 10);
  const arrivalIndex = notices.findIndex((notice) => notice.extra?.action === "receive");
  assert.ok(digestIndex >= 0);
  assert.ok(firstBrief > digestIndex);
  assert.ok(arrivalIndex > firstBrief);
  assert.equal(notices[digestIndex]?.extra?.tab, "restock");
});

test("privateNotifications titles and bodies never include the item name", () => {
  const stocked = item({
    itemName: "Secret HVAC filter",
    onHand: 3,
    orderByDate: "2026-10-01",
    nextOrderDate: "2026-10-01",
  });
  const notices = plannedNotifications(
    household({
      restockDigest: {
        enabled: true,
        weekday: 0,
        hour: 9,
        lastSentOn: null,
        permissionAsked: true,
        privateNotifications: true,
      },
      supplyAutomations: [stocked],
      assets: [{ id: "a1", name: "Secret Fridge", roomId: "kitchen", type: "appliance", installDate: "2024-01-01", warrantyUntil: "2027-10-01" } as never],
    }),
    now,
  );
  assert.ok(notices.length > 0);
  for (const notice of notices) {
    assert.equal(notice.title.includes("Secret HVAC filter"), false);
    assert.equal(notice.body.includes("Secret HVAC filter"), false);
    assert.equal(notice.title.includes("Secret Fridge"), false);
    assert.equal(notice.body.includes("Secret Fridge"), false);
  }
});
