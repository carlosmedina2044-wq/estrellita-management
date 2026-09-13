import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initialRestockOrderState,
  reduceRestockOrder,
  runRestockOrderPath,
} from "@/lib/restock-order-state";

test("restock order path: pick → opened → confirm → ordered", () => {
  const end = runRestockOrderPath([
    { type: "open_picker" },
    { type: "picker_opened", retailer: "Amazon" },
    { type: "confirm" },
  ]);
  assert.equal(end.phase, "ordered");
  assert.equal(end.retailer, "Amazon");
  assert.equal(end.flowProgressing, false);
});

test("picker dismiss after opened keeps confirm reachable", () => {
  let state = reduceRestockOrder(initialRestockOrderState, { type: "open_picker" });
  state = reduceRestockOrder(state, { type: "picker_opened", retailer: "Costco" });
  assert.equal(state.phase, "confirm");
  state = reduceRestockOrder(state, { type: "picker_dismissed" });
  assert.equal(state.phase, "confirm");
  assert.equal(state.retailer, "Costco");
  state = reduceRestockOrder(state, { type: "confirm" });
  assert.equal(state.phase, "ordered");
});

test("already ordered skips retailer open and goes to confirm", () => {
  const end = runRestockOrderPath([
    { type: "open_picker" },
    { type: "already_ordered" },
    { type: "confirm" },
  ]);
  assert.equal(end.phase, "ordered");
});

test("native open waits for resume before confirm", () => {
  let state = reduceRestockOrder(initialRestockOrderState, { type: "open_picker" });
  state = reduceRestockOrder(state, {
    type: "picker_opened",
    retailer: "Amazon",
    waitForResume: true,
  });
  assert.equal(state.phase, "waiting_resume");
  state = reduceRestockOrder(state, { type: "picker_dismissed" });
  assert.equal(state.phase, "waiting_resume");
  state = reduceRestockOrder(state, { type: "resume" });
  assert.equal(state.phase, "confirm");
  state = reduceRestockOrder(state, { type: "confirm" });
  assert.equal(state.phase, "ordered");
});

test("cancel confirm and cancel picker return to closed", () => {
  let state = runRestockOrderPath([
    { type: "open_picker" },
    { type: "picker_opened", retailer: "Target" },
  ]);
  state = reduceRestockOrder(state, { type: "cancel_confirm" });
  assert.equal(state.phase, "closed");

  state = reduceRestockOrder(initialRestockOrderState, { type: "open_picker" });
  state = reduceRestockOrder(state, { type: "picker_dismissed" });
  assert.equal(state.phase, "closed");
  assert.equal(state.flowProgressing, false);
});
