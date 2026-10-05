import assert from "node:assert/strict";
import { test } from "node:test";
import { arrivalKey, BOX_STALE_DAYS, deliveriesAtDoor, MAX_PORCH_BOXES, pickCourierWalk } from "@/lib/scene/delivery";
import type { SupplyAutomation } from "@/lib/types";

const now = new Date(2026, 9, 4, 10, 0, 0); // 2026-10-04 local

function supply(partial: Partial<SupplyAutomation> & Pick<SupplyAutomation, "id">): SupplyAutomation {
  return {
    itemName: partial.id,
    state: "ordered",
    orderInFlight: true,
    expectedArrivalDate: "2026-10-04",
    ...partial,
  } as SupplyAutomation;
}

test("a box is on the porch from the due day, not before", () => {
  const items = [
    supply({ id: "today", expectedArrivalDate: "2026-10-04" }),
    supply({ id: "tomorrow", expectedArrivalDate: "2026-10-05" }),
  ];
  assert.deepEqual(deliveriesAtDoor(items, now).map((d) => d.itemId), ["today"]);
});

test("a box stays after its due day until the item is marked arrived", () => {
  const late = supply({ id: "late", expectedArrivalDate: "2026-10-01" });
  assert.equal(deliveriesAtDoor([late], now).length, 1);
  const arrived = { ...late, state: "stocked" as const, orderInFlight: false, expectedArrivalDate: null };
  assert.equal(deliveriesAtDoor([arrived], now).length, 0);
});

test("an item that was never ordered has no box", () => {
  const stocked = supply({ id: "s", state: "stocked", orderInFlight: false, expectedArrivalDate: null });
  assert.equal(deliveriesAtDoor([stocked], now).length, 0);
});

test("a box a month overdue is no longer drawn", () => {
  const old = supply({ id: "old", expectedArrivalDate: "2026-09-01" });
  assert.equal(deliveriesAtDoor([old], now).length, 0);
  assert.ok(BOX_STALE_DAYS >= 7);
});

test("oldest wait first", () => {
  const items = [
    supply({ id: "b", expectedArrivalDate: "2026-10-04" }),
    supply({ id: "a", expectedArrivalDate: "2026-10-02" }),
  ];
  assert.deepEqual(deliveriesAtDoor(items, now).map((d) => d.itemId), ["a", "b"]);
  assert.ok(MAX_PORCH_BOXES >= 1);
});

test("the courier walks only for an arrival due today that has not been walked", () => {
  const items = deliveriesAtDoor(
    [supply({ id: "a", expectedArrivalDate: "2026-10-02" }), supply({ id: "b", expectedArrivalDate: "2026-10-04" })],
    now,
  );
  assert.equal(pickCourierWalk(items, new Set(), now)?.itemId, "b");
  assert.equal(pickCourierWalk(items, new Set([arrivalKey(items[1])]), now), null);
});

test("a moved due date is a new arrival with its own walk", () => {
  const first = { itemId: "a", dueDate: "2026-10-04" };
  const moved = { itemId: "a", dueDate: "2026-10-07" };
  assert.notEqual(arrivalKey(first), arrivalKey(moved));
});
