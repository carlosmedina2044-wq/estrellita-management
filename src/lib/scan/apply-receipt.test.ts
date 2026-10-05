import assert from "node:assert/strict";
import { test } from "node:test";
import { applyReceipt } from "./apply-receipt";
import { matchReceipt, parseReceipt } from "./receipt";
import { automation, consumable, household, NOW } from "./test-fixtures";

const RECEIPT = [
  "THE HOME DEPOT #4401",
  "10/04/2026",
  "CASCADE DW DET PODS 60CT   13.97",
  "FILTRETE FLTR 16X25X1       12.98",
  "DAWN DISH SOAP  3.48",
  "MYSTERY GADGET  7.77",
  "SUBTOTAL 38.20",
  "TAX 3.15",
  "TOTAL 41.35",
];

function home() {
  return household({
    supplyAutomations: [
      automation({
        id: "pods",
        itemName: "Dishwasher detergent pods",
        state: "ordered",
        orderInFlight: true,
        orderedAt: "2026-09-29",
        expectedArrivalDate: "2026-10-03",
        onHand: 0,
      }),
      automation({ id: "filter", itemName: "Furnace filter", sizeSpec: "16x25x1", onHand: 1 }),
      automation({ id: "untouched", itemName: "Toilet paper", onHand: 2 }),
    ],
    consumables: [consumable({ id: "c-soap", name: "Dish soap" })],
  });
}

test("end to end: parse, match, tick the strong ones, apply", () => {
  const h = home();
  const receipt = parseReceipt(RECEIPT, NOW);
  const matches = matchReceipt(receipt, h);
  const confirmed = matches
    .filter((m) => m.preChecked && m.match)
    .map((m) => ({ line: m.line, automationId: m.match!.automationId, consumableId: m.match!.consumableId }));
  assert.equal(confirmed.length, 3); // the gadget matched nothing and is not here

  const result = applyReceipt(h, confirmed, { date: receipt.date, store: receipt.store }, NOW);
  assert.deepEqual(result.arrivedAutomationIds.sort(), ["filter", "pods"]);
  assert.deepEqual(result.pricedConsumableIds, ["c-soap"]);

  const pods = result.household.supplyAutomations.find((a) => a.id === "pods")!;
  assert.equal(pods.state, "stocked");
  assert.equal(pods.orderInFlight, false);
  assert.equal(pods.expectedArrivalDate, null);
  assert.equal(pods.orderedAt, undefined);
  assert.ok(pods.onHand >= 1);
  assert.equal(pods.lastPaidPrice, 13.97);
  assert.equal(pods.lastPaidAt, "2026-10-04");
  assert.equal(pods.observedLeadTimeDays, 5);

  const filter = result.household.supplyAutomations.find((a) => a.id === "filter")!;
  assert.equal(filter.onHand, 2);
  assert.equal(filter.lastPaidPrice, 12.98);

  const untouched = result.household.supplyAutomations.find((a) => a.id === "untouched")!;
  assert.deepEqual(untouched, h.supplyAutomations[2]);

  assert.equal(result.household.consumables[0].lastPaidPrice, 3.48);
  assert.equal(result.household.purchases.length, 3);
  assert.deepEqual(result.household.purchases.map((p) => p.actualCost).sort((a, b) => a - b), [3.48, 12.98, 13.97]);
  assert.ok(result.household.purchases.every((p) => p.kind === "consumable" && p.completedAt.startsWith("2026-10-0")));
  assert.equal(result.household.supplyAutomations.length, 3, "nothing is auto-created");
  assert.equal(result.household.duties.length, h.duties.length);
});

test("recordPurchases: false still records the price but logs no purchase", () => {
  const result = applyReceipt(home(), [{ line: { name: "PODS", qty: 1, price: 9.99 }, automationId: "pods" }], { recordPurchases: false }, NOW);
  assert.equal(result.household.purchases.length, 0);
  assert.equal(result.household.supplyAutomations[0].lastPaidPrice, 9.99);
  assert.equal(result.household.supplyAutomations[0].state, "stocked");
});

test("quantity on the line becomes stock; unknown ids and unmatched lines are skipped", () => {
  const result = applyReceipt(
    home(),
    [
      { line: { name: "TP", qty: 3, price: 20 }, automationId: "untouched" },
      { line: { name: "x", qty: 1, price: 1 }, automationId: "ghost" },
      { line: { name: "GADGET", qty: 1, price: 7.77 } },
      { line: { name: "SOAP", qty: 1, price: 0 }, consumableId: "c-soap" },
    ],
    {},
    NOW,
  );
  assert.equal(result.household.supplyAutomations.find((a) => a.id === "untouched")!.onHand, 5);
  assert.equal(result.skipped, 3);
});

test("applying nothing returns an equal household", () => {
  const h = home();
  assert.deepEqual(applyReceipt(h, [], {}, NOW).household, h);
});
