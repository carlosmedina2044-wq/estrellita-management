import assert from "node:assert/strict";
import { test } from "node:test";
import { applyFilterSize, parseFilterSize } from "./filter";
import { addFilterToRestock, planFilterRestock } from "./filter-restock";
import { findByBarcode } from "./barcode";
import { automation, consumable, household, NOW } from "./test-fixtures";
import type { HomeAsset } from "@/lib/types";

const FURNACE: HomeAsset = { id: "furnace-1", roomId: "basement", name: "Furnace", type: "furnace" };
const size = parseFilterSize(["FILTER 16x25x1"])!;
const filterConsumable = consumable({ id: "c1", name: "Furnace filter", nodeId: "furnace-1", nodeType: "asset", assetId: "furnace-1" });

test("offers a Restock item named with the size and the catalog interval", () => {
  const plan = planFilterRestock(household({ assets: [FURNACE], consumables: [filterConsumable] }), { assetId: "furnace-1" }, size);
  assert.equal(plan?.itemName, "Furnace filter 16x25x1");
  assert.equal(plan?.intervalMonths, 3);
  assert.equal(plan?.roomId, "basement");
  assert.equal(plan?.assetId, "furnace-1");
});

test("offers nothing without a depth, without a tracked filter, or when Restock already has one", () => {
  const h = household({ assets: [FURNACE], consumables: [filterConsumable] });
  assert.equal(planFilterRestock(h, { assetId: "furnace-1" }, parseFilterSize(["AIR FILTER 16x25"])!), undefined);
  assert.equal(planFilterRestock(household({ assets: [FURNACE] }), { assetId: "furnace-1" }, size), undefined);
  const tracked = household({
    assets: [FURNACE],
    consumables: [filterConsumable],
    supplyAutomations: [automation({ id: "a1", itemName: "Furnace filter", nodeId: "furnace-1", nodeType: "asset" })],
  });
  assert.equal(planFilterRestock(tracked, { assetId: "furnace-1" }, size), undefined);
});

test("creates the Restock item on the furnace and teaches the barcode", () => {
  const h = household({ assets: [FURNACE], consumables: [filterConsumable] });
  const plan = planFilterRestock(h, { assetId: "furnace-1" }, size)!;
  const next = addFilterToRestock(applyFilterSize(h, { assetId: "furnace-1" }, size).household, plan, size, "036000291452", NOW);
  assert.equal(next.supplyAutomations.length, 1);
  const item = next.supplyAutomations[0];
  assert.equal(item.itemName, "Furnace filter 16x25x1");
  assert.equal(item.sizeSpec, "16x25x1");
  assert.equal(item.nodeId, "furnace-1");
  assert.equal(item.nodeType, "asset");
  assert.equal(item.unitCost, 18);
  assert.equal(findByBarcode(next, "036000291452")?.id, item.id);
  assert.equal(next.duties.find((d) => d.id === item.dutyId)?.nodeId, "furnace-1");
  // Once it exists, it is not offered a second time and not created twice.
  assert.equal(planFilterRestock(next, { assetId: "furnace-1" }, size), undefined);
  assert.equal(addFilterToRestock(next, plan, size, undefined, NOW).supplyAutomations.length, 1);
});

test("a bad barcode is ignored, the item is still created", () => {
  const h = household({ assets: [FURNACE], consumables: [filterConsumable] });
  const plan = planFilterRestock(h, { assetId: "furnace-1" }, size)!;
  const next = addFilterToRestock(h, plan, size, "12", NOW);
  assert.equal(next.supplyAutomations.length, 1);
  assert.equal(next.supplyAutomations[0].barcodes, undefined);
});
