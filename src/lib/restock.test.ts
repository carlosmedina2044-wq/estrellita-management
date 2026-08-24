import assert from "node:assert/strict";
import { test } from "node:test";
import { digestCopy, shouldSendDigest } from "@/lib/digest";
import { expectedArrivalFor } from "@/lib/supply";
import {
  applyLearnedLeadTime,
  changeArrivalDate,
  closestArrivalOffset,
  consumeLinkedUnit,
  digestCandidates,
  groupRestock,
  markConsumableOrdered,
  orderNowCostCaption,
  neverCameConsumable,
  observedLeadTimeDays,
  partStatusForDuty,
  receiveConsumable,
  restockPlacement,
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
