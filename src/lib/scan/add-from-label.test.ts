import assert from "node:assert/strict";
import { test } from "node:test";
import { buildForecast } from "@/lib/forecast";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { hasSeenTip, markTipSeen, TIP_SCANNED, TIP_SCAN_PROMPT } from "@/lib/teaching";
import type { Household } from "@/lib/types";
import { addFromLabel, defaultRoomFor, shouldOfferScan } from "./add-from-label";
import { readLabel } from "./index";

const NOW = new Date(2026, 9, 4);

function household(overrides: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 9,
    householdName: "Test",
    ownerName: "Me",
    cleanerName: "",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: [
      { id: "whole-home", floorId: null, name: "Whole Home", type: "other", sortOrder: 0, system: "whole-home" },
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 1 },
      { id: "garage", floorId: "main", name: "Garage", type: "garage", sortOrder: 2 },
    ],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  }) as Household;
}

const RHEEM = ["RHEEM", "WATER HEATER", "MODEL NO. XG50T06EC36U1", "SERIAL NO. C141234567", "50 GALLONS"];

test("a Rheem plate becomes a dated, priced appliance with model and serial in notes", () => {
  const reading = readLabel(RHEEM, NOW);
  const { household: next, asset } = addFromLabel({ household: household(), reading, roomId: "garage", idBase: "a1" });
  assert.equal(next.assets.length, 1);
  assert.equal(asset.id, "a1");
  assert.equal(asset.name, "Rheem water heater");
  assert.equal(asset.type, "water_heater");
  assert.equal(asset.roomId, "garage");
  assert.equal(asset.installDate, "2014-03-01");
  assert.equal(asset.expectedLifeYears, 12);
  assert.equal(asset.replacementCostEstimate, 1600);
  assert.match(asset.notes ?? "", /XG50T06EC36U1/);
  assert.match(asset.notes ?? "", /C141234567/);
  assert.equal(hasSeenTip(next, TIP_SCANNED), true);
});

test("the forecast and set-aside pick the scanned appliance up with no extra work", () => {
  const before = buildForecast(household(), 12, NOW);
  assert.equal(before.totals.replacements, 0);
  const next = addFromLabel({ household: household(), reading: readLabel(RHEEM, NOW), idBase: "a1" }).household;
  const after = buildForecast(next, 12, NOW);
  const item = after.monthly.flatMap((month) => month.items).find((entry) => entry.assetId === "a1");
  assert.ok(item);
  assert.equal(item.kind, "replacement");
  assert.equal(item.cost.mid, 1600);
  assert.equal(item.source, "user");
  assert.equal(after.missingData.length, 0);
  assert.ok(after.suggestedMonthlySetAside > 0);
});

test("a printed filter size names the furnace filter", () => {
  const reading = readLabel(["GOODMAN", "GAS FURNACE", "MODEL GMVC80804CN", "SERIAL 1305123456", "FILTER 16X25X1"], NOW);
  const { household: next, consumables } = addFromLabel({ household: household(), reading, idBase: "f1" });
  assert.equal(consumables.length, 1);
  assert.equal(consumables[0].name, "Furnace filter 16x25x1");
  assert.equal(consumables[0].sizeSpec, "16x25x1");
  assert.equal(consumables[0].assetId, "f1");
  assert.equal(consumables[0].intervalDays, 90);
  const forecast = buildForecast(next, 6, NOW);
  assert.ok(forecast.monthly.flatMap((m) => m.items).some((i) => i.label === "Furnace filter 16x25x1"));
});

test("without a filter size the catalog filter name is kept, and types without one add none", () => {
  const furnace = readLabel(["GOODMAN", "GAS FURNACE", "SERIAL 1305123456"], NOW);
  assert.equal(addFromLabel({ household: household(), reading: furnace }).consumables[0].name, "Furnace filter");
  assert.equal(addFromLabel({ household: household(), reading: readLabel(RHEEM, NOW) }).consumables.length, 0);
});

test("the person's type, date and room win over the label", () => {
  const reading = readLabel(["LG", "SERIAL 407KWAB12345"], NOW);
  assert.deepEqual(reading.missing.sort(), ["date", "type"]);
  const { asset } = addFromLabel({
    household: household(),
    reading,
    roomId: "kitchen",
    overrides: { type: "refrigerator", installDate: "2019-05-01" },
  });
  assert.equal(asset.type, "refrigerator");
  assert.equal(asset.installDate, "2019-05-01");
  assert.equal(asset.roomId, "kitchen");
  assert.equal(asset.name, "LG fridge");
});

test("no date on the label and none typed leaves the date empty, and the forecast says so", () => {
  const reading = readLabel(["LG", "REFRIGERATOR", "SERIAL 407KWAB12345"], NOW);
  const next = addFromLabel({ household: household(), reading, idBase: "r1" }).household;
  assert.equal(next.assets[0].installDate, undefined);
  assert.deepEqual(buildForecast(next, 12, NOW).missingData.map((m) => m.assetId), ["r1"]);
});

test("an unknown room falls back to where that appliance usually lives", () => {
  const h = household();
  assert.equal(defaultRoomFor(h, "water_heater"), "garage");
  assert.equal(defaultRoomFor(h, "refrigerator"), "kitchen");
  assert.equal(defaultRoomFor(h, "roof"), "whole-home");
  const { asset } = addFromLabel({ household: h, reading: readLabel(RHEEM, NOW), roomId: "gone" });
  assert.equal(asset.roomId, "garage");
});

test("the Home card shows only to homes with few dated appliances that have not used or dismissed it", () => {
  const dated = (id: string) => ({ id, roomId: "kitchen", name: id, type: "dishwasher" as const, installDate: "2020-01-01" });
  assert.equal(shouldOfferScan(household()), true);
  assert.equal(shouldOfferScan(household({ assets: [dated("a")] })), true);
  assert.equal(shouldOfferScan(household({ assets: [dated("a"), dated("b")] })), false);
  assert.equal(shouldOfferScan(markTipSeen(household(), TIP_SCAN_PROMPT)), false);
  assert.equal(shouldOfferScan(addFromLabel({ household: household(), reading: readLabel(RHEEM, NOW) }).household), false);
});
