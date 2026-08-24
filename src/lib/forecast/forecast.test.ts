import assert from "node:assert/strict";
import { test } from "node:test";
import { buildForecast, conditionFactor, installDateFromAge, roundUpTo } from "@/lib/forecast";
import type { HomeAsset, Household } from "@/lib/types";
import { withHouseholdDefaults } from "@/lib/household-defaults";

function asset(partial: Partial<HomeAsset> & Pick<HomeAsset, "id" | "name" | "type">): HomeAsset {
  return {
    roomId: "kitchen",
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
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 1 },
    ],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

const now = new Date(2026, 7, 1);

test("36-month forecast places end-of-life and set-aside", () => {
  const home = household({
    assets: [
      asset({ id: "hvac", name: "HVAC", type: "hvac_system", installDate: "2013-08-01", replacementCostEstimate: 7500 }),
      asset({ id: "wh", name: "Water heater", type: "water_heater", installDate: "2018-08-01", replacementCostEstimate: 1600 }),
      asset({ id: "fridge", name: "Fridge", type: "refrigerator", installDate: "2020-08-01", replacementCostEstimate: 1600 }),
      asset({ id: "washer", name: "Washer", type: "washer", installDate: "2019-08-01", replacementCostEstimate: 900 }),
      asset({ id: "smoke", name: "Smoke", type: "smoke_detector", installDate: "2022-08-01", replacementCostEstimate: 40 }),
    ],
    consumables: [
      {
        id: "filter",
        assetId: "hvac",
        nodeId: "hvac",
        nodeType: "asset",
        name: "HVAC filter",
        intervalDays: 90,
        unitCost: 22,
      },
    ],
  });
  const result = buildForecast(home, 36, now);
  assert.equal(result.horizonMonths, 36);
  assert.ok(result.suggestedMonthlySetAside >= 5);
  assert.equal(result.suggestedMonthlySetAside, roundUpTo(result.totals.total / 36, 5));
  const hvac = result.monthly
    .flatMap((month) => month.items)
    .find((item) => item.assetId === "hvac" && item.kind === "replacement");
  assert.ok(hvac);
  assert.equal(hvac.cost.mid, 7500);
  assert.equal(hvac.source, "user");
});

test("overdue replacement lands in month 1", () => {
  const home = household({
    assets: [asset({ id: "roof", name: "Roof", type: "roof", installDate: "1990-01-01", replacementCostEstimate: 14000 })],
  });
  const result = buildForecast(home, 12, now);
  const item = result.monthly[0].items.find((entry) => entry.assetId === "roof");
  assert.ok(item);
  assert.equal(item.overdue, true);
});

test("missing install date is listed and excluded from replacements", () => {
  const home = household({
    assets: [asset({ id: "unk", name: "Mystery", type: "dishwasher" })],
  });
  const result = buildForecast(home, 12, now);
  assert.equal(result.monthly.flatMap((month) => month.items).length, 0);
  assert.equal(result.missingData[0]?.assetId, "unk");
});

test("fair condition shortens life by 20%", () => {
  assert.equal(conditionFactor("good"), 1);
  assert.equal(conditionFactor("fair"), 0.8);
  assert.equal(conditionFactor("poor"), 0.6);
  const good = household({
    assets: [asset({ id: "a", name: "HVAC", type: "hvac_system", installDate: "2018-08-01", expectedLifeYears: 10, replacementCostEstimate: 1000, condition: "good" })],
  });
  const fair = household({
    assets: [asset({ id: "a", name: "HVAC", type: "hvac_system", installDate: "2018-08-01", expectedLifeYears: 10, replacementCostEstimate: 1000, condition: "fair" })],
  });
  const goodMonth = buildForecast(good, 36, now).monthly.flatMap((month) => month.items)[0]?.month;
  const fairMonth = buildForecast(fair, 36, now).monthly.flatMap((month) => month.items)[0]?.month;
  assert.ok(goodMonth);
  assert.ok(fairMonth);
  assert.ok(fairMonth <= goodMonth);
});

test("catalog ranges used when user did not enter a price", () => {
  const home = household({
    assets: [asset({ id: "a", name: "HVAC", type: "hvac_system", installDate: "2010-01-01" })],
  });
  const item = buildForecast(home, 24, now).monthly.flatMap((month) => month.items)[0];
  assert.ok(item);
  assert.ok(item.cost.high > item.cost.low);
  assert.equal(item.source, "catalog");
  assert.equal(item.confidence, "low");
});

test("age helper derives an install date", () => {
  assert.equal(installDateFromAge(1.5, new Date(2026, 7, 1)).startsWith("2025"), true);
});

test("forecast uses blended actual cost instead of the estimate", () => {
  const home = household({
    duties: [
      {
        id: "duty-cost",
        title: "Replace filter",
        notes: "",
        room: "kitchen",
        nodeId: "kitchen",
        nodeType: "room",
        audience: "me",
        effort: "small",
        frequency: "once",
        kind: "replacement",
        weekday: 0,
        monthDay: 1,
        dueDate: "2026-09-01",
        priority: "medium",
        createdAt: "2026-08-01T00:00:00.000Z",
        archived: false,
        estimatedCost: 40,
      },
    ],
  });
  const estimated = buildForecast(home, 12, now);
  const withActual = buildForecast(
    {
      ...home,
      completions: [
        {
          id: "comp-cost",
          dutyId: "duty-cost",
          actor: "me",
          visitId: null,
          completedAt: "2026-08-20T12:00:00.000Z",
          actualCost: 24.99,
        },
      ],
    },
    12,
    now,
  );
  const estimatedItem = estimated.monthly.flatMap((month) => month.items).find((item) => item.label === "Replace filter");
  const actualItem = withActual.monthly.flatMap((month) => month.items).find((item) => item.label === "Replace filter");
  assert.equal(estimatedItem?.cost.mid, 40);
  assert.equal(actualItem?.cost.mid, 24.99);
  assert.equal(actualItem?.source, "lastPaid");
  assert.ok(withActual.totals.total < estimated.totals.total);
});

test("forecast total shifts when a real price replaces the estimate", () => {
  const base = household({
    duties: [
      {
        id: "duty-shift",
        title: "Buy salt",
        notes: "",
        room: "kitchen",
        nodeId: "kitchen",
        nodeType: "room",
        audience: "me",
        effort: "small",
        frequency: "once",
        kind: "replacement",
        weekday: 0,
        monthDay: 1,
        dueDate: "2026-08-15",
        priority: "medium",
        createdAt: "2026-08-01T00:00:00.000Z",
        archived: false,
        estimatedCost: 100,
      },
    ],
  });
  const before = buildForecast(base, 12, now).totals.total;
  const after = buildForecast(
    {
      ...base,
      completions: [
        {
          id: "comp-shift",
          dutyId: "duty-shift",
          actor: "me",
          visitId: null,
          completedAt: "2026-08-10T12:00:00.000Z",
          actualCost: 10,
        },
      ],
    },
    12,
    now,
  ).totals.total;
  assert.equal(before, 100);
  assert.equal(after, 10);
});
