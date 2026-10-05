import assert from "node:assert/strict";
import { test } from "node:test";
import { applyFilterSize, filterNameWithSize, isAirFilterName, parseFilterSize } from "./filter";
import { readLabel } from "./index";
import { addFromLabel } from "./add-from-label";
import { automation, consumable, household, NOW } from "./test-fixtures";
import type { HomeAsset } from "@/lib/types";

test("sizes in every printed style", () => {
  for (const line of ["16x25x1", "16 x 25 x 1", '16"x25"x1"', "16X25X1", "16×25×1", "FILTER SIZE: 16 X 25 X 1 IN"]) {
    const s = parseFilterSize([line]);
    assert.equal(s?.width, 16, line);
    assert.equal(s?.height, 25, line);
    assert.equal(s?.depth, 1, line);
  }
  assert.equal(parseFilterSize(["16 x 25 x 1"])?.text, "16x25x1");
  assert.equal(parseFilterSize(['16"x25"x1"'])?.text, "16x25x1");
});

test("width and height are ordered, MERV is read, labelled raises confidence", () => {
  const s = parseFilterSize(["FILTRETE AIR FILTER", "25 x 16 x 1", "MERV 11"]);
  assert.deepEqual([s?.width, s?.height, s?.merv, s?.labelled, s?.confidence], [16, 25, 11, true, "high"]);
  assert.equal(parseFilterSize(["20x20x1"])?.confidence, "medium");
});

test("a two-number size needs the word FILTER; implausible sizes are ignored", () => {
  const s = parseFilterSize(["AIR FILTER 16x25"]);
  assert.deepEqual([s?.text, s?.depth, s?.confidence], ["16x25", undefined, "low"]);
  assert.equal(parseFilterSize(["PHOTO 4x6"]), undefined);
  assert.equal(parseFilterSize(["120x240x60"]), undefined);
  assert.equal(parseFilterSize(["MERV 13 FILTER"]), undefined);
});

test("which names count as air filters", () => {
  assert.equal(isAirFilterName("Furnace filter"), true);
  assert.equal(isAirFilterName("Refrigerator water filter"), false);
  assert.equal(isAirFilterName("Coffee filter"), false);
  assert.equal(filterNameWithSize("Furnace filter", "16x25x1"), "Furnace filter 16x25x1");
  assert.equal(filterNameWithSize("Furnace filter 16x25x1", "16x25x1"), "Furnace filter 16x25x1");
});

const FURNACE: HomeAsset = { id: "furnace-1", roomId: "basement", name: "Furnace", type: "furnace" };

function home() {
  return household({
    assets: [FURNACE],
    consumables: [
      consumable({ id: "c-filter", name: "Furnace filter", nodeId: "furnace-1", nodeType: "asset", assetId: "furnace-1" }),
      consumable({ id: "c-other", name: "Water filter", nodeId: "furnace-1", nodeType: "asset", assetId: "furnace-1" }),
    ],
    supplyAutomations: [
      automation({ id: "a-filter", itemName: "Furnace filter", nodeId: "furnace-1", nodeType: "asset", sku: "", sizeSpec: "20x20x1" }),
      automation({ id: "a-else", itemName: "Furnace filter", nodeId: "someone-else", nodeType: "asset" }),
    ],
  });
}

test("applyFilterSize sets the size on that asset's air filters only", () => {
  const size = parseFilterSize(["FILTER 16x25x1"])!;
  const r = applyFilterSize(home(), { assetId: "furnace-1" }, size);
  assert.deepEqual(r.changed, { consumableIds: ["c-filter"], automationIds: ["a-filter"] });
  assert.deepEqual(r.previousSizes, ["20x20x1"]);
  const c = r.household.consumables.find((x) => x.id === "c-filter")!;
  assert.equal(c.sizeSpec, "16x25x1");
  assert.equal(c.name, "Furnace filter 16x25x1");
  assert.equal(r.household.consumables.find((x) => x.id === "c-other")!.sizeSpec, undefined);
  const a = r.household.supplyAutomations.find((x) => x.id === "a-filter")!;
  assert.deepEqual([a.sizeSpec, a.sku], ["16x25x1", "16x25x1"]);
  assert.equal(r.household.supplyAutomations.find((x) => x.id === "a-else")!.sizeSpec, undefined);
});

test("by room, and re-applying a changed size does not stack names", () => {
  const first = applyFilterSize(home(), { roomId: "basement" }, parseFilterSize(["FILTER 16x25x1"])!);
  assert.equal(first.changed.consumableIds.length, 1);
  const second = applyFilterSize(first.household, { roomId: "basement" }, parseFilterSize(["FILTER 20x25x4"])!);
  assert.equal(second.household.consumables.find((x) => x.id === "c-filter")!.name, "Furnace filter 20x25x4");
  assert.deepEqual(second.previousSizes, ["16x25x1"]);
});

test("a size without thickness, or with no target, changes nothing", () => {
  const h = home();
  assert.equal(applyFilterSize(h, { assetId: "furnace-1" }, parseFilterSize(["AIR FILTER 16x25"])!).skipped, "needs_depth");
  assert.equal(applyFilterSize(h, { assetId: "nobody" }, parseFilterSize(["FILTER 16x25x1"])!).skipped, "no_target");
  assert.equal(applyFilterSize(h, {}, parseFilterSize(["FILTER 16x25x1"])!).household, h);
});

test("add-from-label still names sized filters the same way after the shared helper", () => {
  const reading = readLabel(["CARRIER", "GAS FURNACE", "MODEL NO. 59TP6A080", "SERIAL NO. 1214A12345", "FILTER SIZE 16X25X1"], NOW);
  const { consumables } = addFromLabel({ household: household(), reading, idBase: "furnace-x" });
  const filter = consumables.find((c) => /filter/i.test(c.name));
  assert.equal(filter?.sizeSpec, "16x25x1");
  assert.match(filter?.name ?? "", /16x25x1$/);
});
