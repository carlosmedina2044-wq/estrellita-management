import assert from "node:assert/strict";
import { test } from "node:test";
import { climatePayoff } from "@/lib/climate-payoff";
import { DEFAULT_ATTRIBUTES } from "@/lib/household-defaults";
import { generateHomeFromAnswers, sampleHomeAnswers } from "@/lib/onboarding/generate";
import {
  applyRestockPicks,
  defaultWalkPicks,
  picksMissingSize,
  SAMPLE_RESTOCK_PICKS,
  visibleWalkItems,
} from "@/lib/onboarding/restock-walk";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { Household } from "@/lib/types";

function seededHousehold(overrides: Partial<Household> = {}): Household {
  const generated = generateHomeFromAnswers(sampleHomeAnswers(), new Date(2026, 5, 1));
  return withHouseholdDefaults({
    version: 8,
    householdName: generated.householdName,
    ownerName: "",
    cleanerName: "Cleaner",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: generated.homeId,
    homeType: generated.homeType,
    location: generated.location,
    attributes: generated.attributes,
    floors: generated.floors,
    rooms: generated.rooms,
    assets: generated.assets,
    consumables: generated.consumables,
    duties: generated.duties,
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

test("Tucson ZIP payoff names monsoon and pre-summer AC", () => {
  const payoff = climatePayoff(
    { postalCode: "85701", lat: 32.22, lng: -110.97, placeName: "Tucson", climateZone: "hot-arid" },
    { ...DEFAULT_ATTRIBUTES, hasYard: true, hasIrrigation: true, hasGutters: true },
  );
  assert.match(payoff.headline, /Tucson/);
  assert.ok(payoff.beats.some((beat) => /AC|filter/i.test(beat)));
  assert.ok(payoff.beats.some((beat) => /roof|monsoon|drainage/i.test(beat)));
});

test("walk-your-house picks seed Restock without duplicating", () => {
  const household = seededHousehold();
  const once = applyRestockPicks(household, SAMPLE_RESTOCK_PICKS, new Date(2026, 5, 1));
  assert.ok(once.supplyAutomations.length >= 5);
  assert.ok(once.supplyAutomations.some((item) => /HVAC filter/i.test(item.itemName)));
  const twice = applyRestockPicks(once, SAMPLE_RESTOCK_PICKS, new Date(2026, 5, 1));
  assert.equal(twice.supplyAutomations.length, once.supplyAutomations.length);
});

test("re-walk is idempotent after a size is baked into the name", () => {
  const household = seededHousehold();
  const now = new Date(2026, 5, 1);
  const once = applyRestockPicks(household, [{ id: "hvac-filter", variant: "20×20×1" }], now);
  const renamed = {
    ...once,
    supplyAutomations: once.supplyAutomations.map((item) =>
      item.itemName === "HVAC filter" ? { ...item, itemName: "HVAC filter (20×20×1)" } : item,
    ),
  };
  const next = applyRestockPicks(renamed, [{ id: "hvac-filter", variant: "16×25×1" }], now);
  assert.equal(next.supplyAutomations.filter((item) => /hvac filter/i.test(item.itemName)).length, 1);
});

test("HVAC filter is defaultOn with no size; pool chlorine follows hasPool", () => {
  const house = seededHousehold();
  const defaults = defaultWalkPicks(house);
  const hvac = defaults.find((pick) => pick.id === "hvac-filter");
  assert.ok(hvac && !("custom" in hvac));
  assert.equal(hvac.variant, undefined);
  assert.equal(
    visibleWalkItems(house).some((item) => item.id === "pool-chlorine"),
    false,
  );

  const poolHouse = seededHousehold({
    attributes: { ...house.attributes, hasPool: true },
  });
  assert.ok(visibleWalkItems(poolHouse).some((item) => item.id === "pool-chlorine"));
  assert.ok(defaultWalkPicks(poolHouse).some((pick) => pick.id === "pool-chlorine" && !("custom" in pick)));
  assert.equal(
    visibleWalkItems({ attributes: { ...house.attributes, hasPool: false }, assets: house.assets }).some(
      (item) => item.id === "pool-chlorine",
    ),
    false,
  );
});

test("cooler pads and well filter appear only with matching attributes", () => {
  const house = seededHousehold();
  assert.equal(visibleWalkItems(house).some((item) => item.id === "cooler-pads"), false);
  assert.equal(visibleWalkItems(house).some((item) => item.id === "well-filter"), false);
  const extras = visibleWalkItems({
    attributes: { ...house.attributes, hasEvaporativeCooler: true, hasWell: true },
    assets: house.assets,
  });
  assert.ok(extras.some((item) => item.id === "cooler-pads"));
  assert.ok(extras.some((item) => item.id === "well-filter"));
});

test("free-text variant is stored as sku and sizeSpec", () => {
  const household = seededHousehold({ supplyAutomations: [] });
  const next = applyRestockPicks(
    household,
    [{ id: "hvac-filter", variant: "20x20x1" }],
    new Date(2026, 5, 1),
  );
  const hvac = next.supplyAutomations.find((item) => item.itemName === "HVAC filter");
  assert.ok(hvac);
  assert.equal(hvac.sku, "20x20x1");
  assert.equal(hvac.sizeSpec, "20x20x1");
  assert.equal(hvac.unitCost, 18);
});

test("picksMissingSize lists checked catalog items that still need a size", () => {
  const missing = picksMissingSize([{ id: "hvac-filter" }, { id: "dishwasher-pods" }, { id: "smoke-battery", variant: "9V" }]);
  assert.deepEqual(
    missing.map((item) => item.id),
    ["hvac-filter"],
  );
});

test("custom walk pick seeds Restock in the chosen room with user origin", () => {
  const household = seededHousehold();
  const garage = household.rooms.find((room) => room.type === "garage" && !room.system);
  assert.ok(garage);
  const next = applyRestockPicks(
    household,
    [
      {
        id: "custom:salt",
        custom: {
          itemName: "Water softener salt",
          sku: "40 lb",
          roomId: garage.id,
          intervalMonths: 1,
          retailer: "walmart",
          group: "whole-home",
        },
      },
    ],
    new Date(2026, 5, 1),
  );
  const item = next.supplyAutomations.find((entry) => entry.itemName === "Water softener salt");
  const duty = next.duties.find((entry) => entry.id === item?.dutyId);
  assert.ok(item);
  assert.equal(item.sku, "40 lb");
  assert.equal(item.sizeSpec, "40 lb");
  assert.equal(item.preferredRetailer, "walmart");
  assert.equal(item.leadTimeDays, 14);
  assert.equal(item.room, garage.id);
  assert.equal(duty?.title, "Restock Water softener salt");
  assert.equal(duty?.origin, "user");
  assert.equal(duty?.frequency, "monthly");
  const twice = applyRestockPicks(next, [
    {
      id: "custom:salt-2",
      custom: {
        itemName: "Water softener salt",
        sku: "40 lb",
        roomId: garage.id,
        intervalMonths: 1,
        group: "whole-home",
      },
    },
  ]);
  assert.equal(twice.supplyAutomations.filter((entry) => entry.itemName === "Water softener salt").length, 1);
});
