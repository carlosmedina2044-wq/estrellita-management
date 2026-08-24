import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, toISODate } from "@/lib/dates";
import { digestCopy, shouldSendDigest } from "@/lib/digest";
import { expectedArrivalFor } from "@/lib/supply";
import { openBackup, sealBackup } from "@/lib/backup";
import { parseStored } from "@/lib/storage";
import {
  applyCheckin,
  applyLearnedLeadTime,
  changeArrivalDate,
  checkinDue,
  closestArrivalOffset,
  consumeLinkedUnit,
  digestCandidates,
  estimatedLevel,
  groupRestock,
  markConsumableOrdered,
  orderNowCostCaption,
  neverCameConsumable,
  observedLeadTimeDays,
  partStatusForDuty,
  rateBasedOrderByDate,
  ratePerDayFor,
  receiveConsumable,
  restockPlacement,
  runwayDaysFor,
  runwayFor,
  shouldOfferLeadTime,
  stillWaitingConsumable,
  unmarkConsumableOrdered,
} from "@/lib/restock";
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
    itemName: "HVAC filter 16x25x1",
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
    orderByDate: "2026-04-01",
    nextOrderDate: "2026-04-01",
    orderInFlight: false,
    state: "stocked",
    expectedArrivalDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const filterDuty = duty({
  id: "d1",
  title: "Change HVAC filter",
  frequency: "quarterly",
  createdAt: "2026-05-23T00:00:00.000Z",
});

const household: Pick<Household, "duties" | "completions"> = {
  duties: [filterDuty],
  completions: [],
};

const now = new Date(2026, 7, 23);

test("runway uses the (on_hand + 1)-th upcoming linked task", () => {
  const stocked = item({ onHand: 2 });
  const runway = runwayFor(stocked, household, now);
  assert.ok(runway.nextNeedDate);
  assert.ok(runway.orderByDate);
  assert.equal(runway.upcomingDates.length >= 3, true);
  assert.equal(runway.nextNeedDate, runway.upcomingDates[2]);
});

test("order now when order-by is today or earlier", () => {
  const empty = item({ onHand: 0, leadTimeDays: 14 });
  const placement = restockPlacement(empty, household, now);
  assert.equal(placement.bucket, "order_now");
});

test("0 on-hand is Order now even when the next change is months out", () => {
  const later = duty({
    id: "d-far",
    title: "Swap filter",
    frequency: "once",
    dueDate: "2026-12-01",
  });
  const empty = item({
    dutyId: "d-far",
    linkedDutyIds: ["d-far"],
    onHand: 0,
    reorderAt: 0,
    installedAt: "2026-08-23",
    leadTimeDays: 14,
  });
  assert.equal(restockPlacement(empty, { duties: [later], completions: [] }, now).bucket, "order_now");
});

test("reorder threshold: order when on-hand is at or below the number they set", () => {
  const later = duty({
    id: "d-th",
    title: "Swap filter",
    frequency: "once",
    dueDate: "2026-12-01",
  });
  const ctx = { duties: [later], completions: [] };
  assert.equal(
    restockPlacement(item({ dutyId: "d-th", linkedDutyIds: ["d-th"], onHand: 1, reorderAt: 0 }), ctx, now).bucket,
    "stocked",
  );
  assert.equal(
    restockPlacement(item({ dutyId: "d-th", linkedDutyIds: ["d-th"], onHand: 1, reorderAt: 1 }), ctx, now).bucket,
    "order_now",
  );
  assert.equal(
    restockPlacement(item({ dutyId: "d-th", linkedDutyIds: ["d-th"], onHand: 2, reorderAt: 1 }), ctx, now).bucket,
    "stocked",
  );
});

test("coming up when stock is above the threshold but order-by is within 21 days", () => {
  const farTask = duty({
    id: "d2",
    title: "Swap filter",
    frequency: "monthly",
    monthDay: 1,
  });
  const supply = item({ dutyId: "d2", linkedDutyIds: ["d2"], onHand: 1, reorderAt: 0, leadTimeDays: 21 });
  const placement = restockPlacement(supply, { duties: [farTask], completions: [] }, now);
  assert.equal(placement.bucket, "coming_up");
});

test("stocked when above threshold and order-by is more than 21 days out", () => {
  const later = duty({
    id: "d3",
    title: "Swap filter",
    frequency: "once",
    dueDate: "2026-12-01",
  });
  const supply = item({ dutyId: "d3", linkedDutyIds: ["d3"], onHand: 1, reorderAt: 0, leadTimeDays: 14 });
  const placement = restockPlacement(supply, { duties: [later], completions: [] }, now);
  assert.equal(placement.bucket, "stocked");
});

test("completing a linked task decrements on-hand and re-buckets", () => {
  const later = duty({
    id: "d4",
    title: "Swap filter",
    frequency: "once",
    dueDate: "2026-12-01",
  });
  const before = item({ dutyId: "d4", linkedDutyIds: ["d4"], onHand: 1, reorderAt: 0, leadTimeDays: 14 });
  assert.equal(restockPlacement(before, { duties: [later], completions: [] }, now).bucket, "stocked");
  const after = consumeLinkedUnit(before);
  assert.equal(after.onHand, 0);
  assert.equal(restockPlacement(after, { duties: [later], completions: [] }, now).bucket, "order_now");
  const soon = duty({
    id: "d5",
    title: "Swap filter",
    frequency: "once",
    dueDate: "2026-09-01",
  });
  const tight = item({ dutyId: "d5", linkedDutyIds: ["d5"], onHand: 1, leadTimeDays: 14 });
  assert.equal(restockPlacement(tight, { duties: [soon], completions: [] }, now).bucket, "stocked");
  assert.equal(restockPlacement(consumeLinkedUnit(tight), { duties: [soon], completions: [] }, now).bucket, "order_now");
});

test("ordered stays out of Order now until arrival plus 3 days", () => {
  const ordered = markConsumableOrdered(
    item({ onHand: 0 }),
    { expectedArrivalDate: expectedArrivalFor(now, 14), qty: 1 },
    now,
  );
  assert.equal(ordered.state, "ordered");
  assert.equal(ordered.expectedArrivalDate, "2026-09-06");
  assert.equal(ordered.orderedAt, "2026-08-23");
  assert.equal(restockPlacement(ordered, household, now).bucket, "ordered");
  assert.equal(restockPlacement(ordered, household, new Date(2026, 8, 9)).bucket, "ordered");
  const nudged = restockPlacement(ordered, household, new Date(2026, 8, 10));
  assert.equal(nudged.bucket, "order_now");
  assert.equal(nudged.nudgeArrive, true);
});

test("markConsumableOrdered v2 stores arrival date, qty, and retailer", () => {
  const ordered = markConsumableOrdered(
    item({ onHand: 0 }),
    { expectedArrivalDate: "2026-08-25", qty: 2, retailer: "walmart" },
    now,
  );
  assert.equal(ordered.expectedArrivalDate, "2026-08-25");
  assert.equal(ordered.orderedQty, 2);
  assert.equal(ordered.qtyPerOrder, 2);
  assert.equal(ordered.orderedAt, "2026-08-23");
  assert.equal(ordered.preferredRetailer, "walmart");
  assert.equal(restockPlacement(ordered, household, now).bucket, "ordered");
  assert.equal(closestArrivalOffset(14), 10);
  assert.equal(closestArrivalOffset(2), 2);
  assert.equal(closestArrivalOffset(1), 1);
});

test("received adds qty to on-hand and returns to stocked", () => {
  const later = duty({
    id: "d6",
    title: "Swap",
    frequency: "once",
    dueDate: "2026-12-01",
  });
  const ordered = markConsumableOrdered(
    item({ onHand: 0, qtyPerOrder: 2, dutyId: "d6", linkedDutyIds: ["d6"] }),
    { expectedArrivalDate: expectedArrivalFor(now, 14), qty: 2 },
    now,
  );
  const received = receiveConsumable(ordered, 2);
  assert.equal(received.onHand, 2);
  assert.equal(received.qtyPerOrder, 2);
  assert.equal(received.state, "stocked");
  assert.equal(received.expectedArrivalDate, null);
  assert.equal(
    restockPlacement(received, { duties: [later], completions: [] }, now).bucket,
    "stocked",
  );
  const groups = groupRestock([received], { duties: [later], completions: [] }, now);
  assert.equal(groups.order_now.length, 0);
  assert.equal(groups.stocked.length, 1);
});

test("weekly digest copy and send rules", () => {
  const items = [item(), item({ id: "s2", itemName: "Trash bags" })];
  assert.deepEqual(digestCopy(items), {
    title: "2 things to order this week",
    body: "HVAC filter 16x25x1 · Trash bags",
  });
  const sundayMorning = new Date(2026, 7, 23, 9, 5);
  assert.equal(sundayMorning.getDay(), 0);
  assert.equal(
    shouldSendDigest({ enabled: true, weekday: 0, hour: 9, lastSentOn: null, permissionAsked: true }, items, sundayMorning),
    true,
  );
  assert.equal(
    shouldSendDigest({ enabled: true, weekday: 0, hour: 9, lastSentOn: "2026-08-23", permissionAsked: true }, items, sundayMorning),
    false,
  );
  assert.equal(
    shouldSendDigest({ enabled: true, weekday: 0, hour: 9, lastSentOn: null, permissionAsked: true }, items, new Date(2026, 7, 22, 10)),
    false,
  );
  assert.equal(
    shouldSendDigest({ enabled: true, weekday: 0, hour: 9, lastSentOn: null, permissionAsked: true }, [], sundayMorning),
    false,
  );
});

test("digest line renders name plus size", () => {
  assert.deepEqual(digestCopy([item({ itemName: "HVAC filter", sizeSpec: "16x25x1" })]), {
    title: "1 thing to order this week",
    body: "HVAC filter · 16x25x1",
  });
  assert.deepEqual(digestCopy([item({ itemName: "Trash bags" })]), {
    title: "1 thing to order this week",
    body: "Trash bags",
  });
});

test("digest candidates include order now and coming up within 7 days", () => {
  const nowItems = item({ onHand: 0 });
  const soon = item({
    id: "s2",
    dutyId: "d7",
    linkedDutyIds: ["d7"],
    itemName: "Bags",
  });
  const soonDuty = duty({ id: "d7", title: "Replace bags", frequency: "once", dueDate: "2026-09-01" });
  const far = item({
    id: "s3",
    dutyId: "d8",
    linkedDutyIds: ["d8"],
    itemName: "Salt",
    onHand: 2,
    reorderAt: 0,
  });
  const farDuty = duty({ id: "d8", title: "Add salt", frequency: "once", dueDate: "2026-12-01" });
  const found = digestCandidates(
    [nowItems, soon, far],
    { duties: [filterDuty, soonDuty, farDuty], completions: [] },
    now,
  ).map((entry) => entry.id);
  assert.ok(found.includes("s1"));
  assert.ok(found.includes("s2"));
  assert.equal(found.includes("s3"), false);
});

test("still waiting extends the arrival hold; never came returns to order now", () => {
  const ordered = markConsumableOrdered(
    item({ onHand: 0 }),
    { expectedArrivalDate: "2026-08-25", qty: 1, retailer: "walmart" },
    now,
  );
  const waiting = stillWaitingConsumable(ordered, new Date(2026, 7, 28));
  assert.equal(waiting.expectedArrivalDate, "2026-08-31");
  assert.equal(restockPlacement(waiting, household, new Date(2026, 7, 28)).bucket, "ordered");
  const gone = neverCameConsumable(waiting);
  assert.equal(gone.state, "stocked");
  assert.equal(gone.expectedArrivalDate, null);
  assert.equal(gone.orderedAt, undefined);
  assert.equal(gone.preferredRetailer, "walmart");
  assert.equal(restockPlacement(gone, household, now).bucket, "order_now");
});

test("observed lead time is receive minus orderedAt and can update leadTimeDays", () => {
  const ordered = markConsumableOrdered(
    item({ onHand: 0, leadTimeDays: 14 }),
    { expectedArrivalDate: "2026-08-25", qty: 1 },
    now,
  );
  const received = receiveConsumable(ordered, 1, new Date(2026, 7, 25));
  assert.equal(observedLeadTimeDays(ordered, new Date(2026, 7, 25)), 2);
  assert.equal(received.observedLeadTimeDays, 2);
  assert.equal(received.orderedAt, undefined);
  assert.equal(received.orderedQty, undefined);
  assert.equal(shouldOfferLeadTime(14, 2), true);
  assert.equal(shouldOfferLeadTime(14, 13), false);
  assert.equal(applyLearnedLeadTime(received, 2).leadTimeDays, 2);
});

test("undo-order clears in-flight state and keeps the preferred store", () => {
  const ordered = markConsumableOrdered(
    item({ onHand: 0 }),
    { expectedArrivalDate: "2026-08-25", qty: 1, retailer: "target" },
    now,
  );
  const undone = unmarkConsumableOrdered(ordered);
  assert.equal(undone.orderInFlight, false);
  assert.equal(undone.orderedAt, undefined);
  assert.equal(undone.preferredRetailer, "target");
  assert.equal(changeArrivalDate(ordered, "2026-08-30").expectedArrivalDate, "2026-08-30");
});

test("replacement duties show part, arriving, order-first, and install-today chips", () => {
  const change = duty({
    id: "d1",
    title: "Change HVAC filter",
    kind: "replacement",
    frequency: "once",
    dueDate: "2026-08-23",
  });
  const far = duty({
    id: "d1",
    title: "Change HVAC filter",
    kind: "replacement",
    frequency: "once",
    dueDate: "2026-12-01",
  });
  const house = { duties: [change], completions: [] };
  assert.equal(
    partStatusForDuty(change, { ...house, supplyAutomations: [item({ onHand: 1 })] }, now)?.kind,
    "install_today",
  );
  assert.equal(
    partStatusForDuty(far, { duties: [far], completions: [], supplyAutomations: [item({ onHand: 1 })] }, now)?.kind,
    "part_on_hand",
  );
  const ordered = markConsumableOrdered(item({ onHand: 0 }), { expectedArrivalDate: "2026-08-25", qty: 1 }, now);
  assert.equal(partStatusForDuty(change, { ...house, supplyAutomations: [ordered] }, now)?.kind, "arriving");
  assert.equal(
    partStatusForDuty(change, { ...house, supplyAutomations: [item({ onHand: 0 })] }, now)?.kind,
    "order_first",
  );
});

test("order now tile sums known prices and prefixes at least when some are missing", () => {
  assert.equal(orderNowCostCaption([item({ unitCost: 18 }), item({ id: "s2", lastPaidPrice: 30 })]), "~$48");
  assert.equal(
    orderNowCostCaption([item({ unitCost: 18 }), item({ id: "s2" })]),
    "at least ~$18",
  );
  assert.equal(orderNowCostCaption([item()]), null);
});

const modelNow = new Date(2026, 7, 24);
const emptyDuties = { duties: [] as Duty[], completions: [] };

function daysAgo(days: number, from = modelNow): string {
  return toISODate(addDays(from, -days));
}

function continuous(partial: Partial<SupplyAutomation> = {}): SupplyAutomation {
  return item({
    dutyId: "",
    linkedDutyIds: [],
    onHand: 1,
    reorderAt: 0,
    installedAt: toISODate(modelNow),
    lastConfirmedLevel: 1,
    lastConfirmedAt: toISODate(modelNow),
    orderByDate: "",
    nextOrderDate: "",
    ...partial,
  });
}

test("rate ladder prefers observed, then duty cadence, then lifespan", () => {
  assert.deepEqual(ratePerDayFor(continuous({ observedRatePerDay: 0.05 }), emptyDuties), {
    rate: 0.05,
    source: "observed",
  });
  const monthly = duty({ id: "d-monthly", title: "Add salt", frequency: "monthly" });
  assert.deepEqual(
    ratePerDayFor(item({ dutyId: "d-monthly", linkedDutyIds: ["d-monthly"] }), { duties: [monthly] }),
    { rate: 1 / 30, source: "duty" },
  );
  assert.deepEqual(
    ratePerDayFor(continuous({ lastConfirmedLevel: undefined, lifespanValue: 2, lifespanUnit: "months" }), emptyDuties),
    { rate: 1 / 60, source: "lifespan" },
  );
  assert.equal(
    ratePerDayFor(
      continuous({ lastConfirmedLevel: undefined, lifespanValue: 0, lifespanUnit: "months" }),
      emptyDuties,
    ),
    null,
  );
});

test("depletion math: confirmed 1 unit 30 days ago with 60-day lifespan", () => {
  const soap = continuous({
    lastConfirmedLevel: 1,
    lastConfirmedAt: daysAgo(30),
    lifespanValue: 60,
    lifespanUnit: "days",
  });
  assert.equal(estimatedLevel(soap, emptyDuties, modelNow), 0.5);
  assert.equal(runwayDaysFor(soap, emptyDuties, modelNow), 30);
});

test("anchor fallback uses onHand at installedAt when nothing is confirmed", () => {
  const soap = item({
    dutyId: "",
    linkedDutyIds: [],
    onHand: 2,
    installedAt: daysAgo(15),
    lifespanValue: 30,
    lifespanUnit: "days",
    orderByDate: "",
    nextOrderDate: "",
  });
  assert.equal(estimatedLevel(soap, emptyDuties, modelNow), 1.5);
});

test("order now fires when runway equals lead time plus the safety buffer", () => {
  const detergent = continuous({
    onHand: 1,
    reorderAt: 0,
    leadTimeDays: 14,
    lifespanValue: 21,
    lifespanUnit: "days",
  });
  assert.equal(rateBasedOrderByDate(detergent, emptyDuties, modelNow), toISODate(modelNow));
  const placement = restockPlacement(detergent, emptyDuties, modelNow);
  assert.equal(placement.bucket, "order_now");
  assert.equal(detergent.onHand, 1);
});

test("placement uses the earlier of duty and rate order-by dates", () => {
  const monthlyDuty = duty({ id: "d-merge1", title: "Add salt", frequency: "monthly", monthDay: 1 });
  const ctx = { duties: [monthlyDuty], completions: [], restockSafetyBufferDays: 0 };
  const shared = {
    dutyId: "d-merge1",
    linkedDutyIds: ["d-merge1"],
    onHand: 1,
    reorderAt: 0,
    leadTimeDays: 0,
    lastConfirmedLevel: 1,
    lastConfirmedAt: toISODate(modelNow),
    installedAt: toISODate(modelNow),
  };
  const rateEarlier = restockPlacement(item({ ...shared, observedRatePerDay: 1 / 28 }), ctx, modelNow);
  assert.equal(rateEarlier.orderByDate, "2026-09-21");
  assert.equal(rateEarlier.dutyOrderByDate, "2026-10-01");
  const dutyEarlier = restockPlacement(item({ ...shared, observedRatePerDay: 1 / 200 }), ctx, modelNow);
  assert.equal(dutyEarlier.orderByDate, "2026-10-01");
});

test("long runway stays stocked and reports gauge extras", () => {
  const stocked = continuous({
    leadTimeDays: 14,
    lifespanValue: 90,
    lifespanUnit: "days",
  });
  const placement = restockPlacement(stocked, emptyDuties, modelNow);
  assert.equal(placement.bucket, "stocked");
  assert.equal(placement.runwayDays, 90);
  assert.ok(placement.estimatedLevelFraction != null);
  assert.ok(Math.abs(placement.estimatedLevelFraction - 1) < 0.01);
});

test("check-in to half recalibrates level and blends the observed rate", () => {
  const before = continuous({
    lastConfirmedLevel: 1,
    lastConfirmedAt: daysAgo(20),
    observedRatePerDay: 0.015,
  });
  assert.equal(estimatedLevel(before, emptyDuties, modelNow), 0.7);
  const after = applyCheckin(before, "half", emptyDuties, modelNow);
  assert.equal(after.lastConfirmedLevel, 0.5);
  assert.equal(after.lastConfirmedAt, toISODate(modelNow));
  assert.equal(after.observedRatePerDay, 0.02);
});

test("check-in plenty slows the rate and never stores zero", () => {
  const before = continuous({
    lastConfirmedLevel: 1,
    lastConfirmedAt: daysAgo(30),
    observedRatePerDay: 0.02,
  });
  assert.equal(estimatedLevel(before, emptyDuties, modelNow), 0.4);
  const after = applyCheckin(before, "plenty", emptyDuties, modelNow);
  assert.equal(after.lastConfirmedLevel, 1);
  assert.equal(after.onHand, 1);
  assert.equal(after.observedRatePerDay, 0.015);
  assert.ok((after.observedRatePerDay ?? 0) > 0);
});

test("receiving an order learns cadence from the previous confirmation", () => {
  const before = continuous({
    onHand: 0,
    lastConfirmedLevel: 1,
    lastConfirmedAt: daysAgo(45),
  });
  const received = receiveConsumable(before, 1, modelNow);
  assert.equal(received.observedRatePerDay, 0.0222);
  assert.equal(received.lastConfirmedLevel, 1);
  assert.equal(received.lastConfirmedAt, toISODate(modelNow));
  assert.equal(received.onHand, 1);
});

test("checkinDue only when approaching the decision zone with a stale lifespan or observed rate", () => {
  const due = continuous({
    lastConfirmedAt: daysAgo(31),
    lastConfirmedLevel: 1,
    observedRatePerDay: 1 / 40,
    leadTimeDays: 14,
  });
  assert.equal(checkinDue(due, emptyDuties, modelNow), true);

  const ordered = markConsumableOrdered(due, { expectedArrivalDate: "2026-09-01", qty: 1 }, modelNow);
  assert.equal(checkinDue(ordered, emptyDuties, modelNow), false);

  const monthlyDuty = duty({ id: "d-checkin", title: "Add salt", frequency: "monthly" });
  const dutySourced = item({
    dutyId: "d-checkin",
    linkedDutyIds: ["d-checkin"],
    onHand: 1,
    lastConfirmedLevel: 1,
    lastConfirmedAt: daysAgo(31),
  });
  assert.equal(checkinDue(dutySourced, { duties: [monthlyDuty], completions: [] }, modelNow), false);

  const recent = continuous({
    lastConfirmedAt: daysAgo(5),
    lastConfirmedLevel: 1,
    observedRatePerDay: 1 / 40,
    leadTimeDays: 14,
  });
  assert.equal(checkinDue(recent, emptyDuties, modelNow), false);
});

test("every placement bucket includes runwayDays and estimatedLevelFraction", () => {
  const ordered = markConsumableOrdered(continuous({ onHand: 0 }), {
    expectedArrivalDate: "2026-09-01",
    qty: 1,
  }, modelNow);
  const coming = continuous({
    leadTimeDays: 14,
    lifespanValue: 30,
    lifespanUnit: "days",
  });
  const stocked = continuous({
    leadTimeDays: 14,
    lifespanValue: 90,
    lifespanUnit: "days",
  });
  const nowItem = continuous({
    leadTimeDays: 14,
    lifespanValue: 21,
    lifespanUnit: "days",
  });
  for (const entry of [ordered, coming, stocked, nowItem]) {
    const placement = restockPlacement(entry, emptyDuties, modelNow);
    assert.equal("runwayDays" in placement, true);
    assert.equal("estimatedLevelFraction" in placement, true);
  }
  assert.equal(restockPlacement(ordered, emptyDuties, modelNow).bucket, "ordered");
  assert.equal(restockPlacement(coming, emptyDuties, modelNow).bucket, "coming_up");
  assert.equal(restockPlacement(stocked, emptyDuties, modelNow).bucket, "stocked");
  assert.equal(restockPlacement(nowItem, emptyDuties, modelNow).bucket, "order_now");
});

test("migration drops garbage inventory fields; valid values survive backup restore", async () => {
  const garbage = parseStored(
    JSON.stringify({
      onboarded: true,
      restockSafetyBufferDays: "nope",
      duties: [
        {
          id: "duty-inv1",
          title: "Filter",
          room: "kitchen",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      supplyAutomations: [
        {
          id: "sup-inv01",
          dutyId: "duty-inv1",
          itemName: "Soap",
          lastConfirmedLevel: "lots",
          lastConfirmedAt: "yesterday",
          observedRatePerDay: -3,
        },
      ],
    }),
  );
  const bad = garbage.supplyAutomations[0];
  assert.equal(bad?.lastConfirmedLevel, undefined);
  assert.equal(bad?.lastConfirmedAt, undefined);
  assert.equal(bad?.observedRatePerDay, undefined);
  assert.equal(garbage.restockSafetyBufferDays, undefined);

  const valid = parseStored(
    JSON.stringify({
      onboarded: true,
      restockSafetyBufferDays: 10,
      duties: [
        {
          id: "duty-inv2",
          title: "Filter",
          room: "kitchen",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      supplyAutomations: [
        {
          id: "sup-inv02",
          dutyId: "duty-inv2",
          itemName: "Soap",
          lastConfirmedLevel: 0.5,
          lastConfirmedAt: "2026-08-01",
          observedRatePerDay: 0.05,
        },
      ],
    }),
  );
  assert.equal(valid.restockSafetyBufferDays, 10);
  assert.equal(valid.supplyAutomations[0]?.lastConfirmedLevel, 0.5);
  assert.equal(valid.supplyAutomations[0]?.lastConfirmedAt, "2026-08-01");
  assert.equal(valid.supplyAutomations[0]?.observedRatePerDay, 0.05);

  const file = await sealBackup(JSON.stringify(valid), "correct horse");
  const restored = parseStored(await openBackup(file, "correct horse"));
  assert.equal(restored.restockSafetyBufferDays, 10);
  assert.equal(restored.supplyAutomations[0]?.lastConfirmedLevel, 0.5);
  assert.equal(restored.supplyAutomations[0]?.lastConfirmedAt, "2026-08-01");
  assert.equal(restored.supplyAutomations[0]?.observedRatePerDay, 0.05);
});
