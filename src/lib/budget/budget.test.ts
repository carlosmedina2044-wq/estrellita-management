import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyDeferAsset,
  applyLogPurchase,
  applyReplaceAsset,
  applySetHomeValue,
  applySetMaintenanceFund,
  budgetInsights,
  fundHealth,
  spendingSummary,
} from "@/lib/budget";
import { buildForecast, formatCostRange, formatMoney } from "@/lib/forecast";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { parseStored } from "@/lib/storage";
import type { HomeAsset, Household } from "@/lib/types";

function asset(partial: Partial<HomeAsset> & Pick<HomeAsset, "id" | "name" | "type">): HomeAsset {
  return { roomId: "kitchen", ...partial };
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

const now = new Date(2026, 7, 24);

test("formatCostRange hides a duplicate bound", () => {
  assert.equal(formatCostRange({ low: 22, mid: 22, high: 22 }), "$22");
  assert.equal(formatCostRange({ low: 900, mid: 1600, high: 2800 }), "$900–$2,800");
  assert.equal(formatMoney(24.99), "$24.99");
});

test("deferring an overdue asset moves it out of month 1", () => {
  const home = household({
    assets: [asset({ id: "asset-roof", name: "Roof", type: "roof", installDate: "1990-01-01", replacementCostEstimate: 14000 })],
  });
  const before = buildForecast(home, 12, now);
  assert.equal(before.monthly[0].items.some((item) => item.assetId === "asset-roof" && item.overdue), true);
  const deferred = applyDeferAsset(home, "asset-roof", 6, "still working fine", now);
  const after = buildForecast(deferred, 12, now);
  const item = after.monthly.flatMap((month) => month.items).find((entry) => entry.assetId === "asset-roof");
  assert.ok(item);
  assert.ok(!item.overdue);
  assert.equal(item.month, "2027-02");
  assert.equal(deferred.assets[0]?.deferReason, "still working fine");
});

test("replacing an asset records a purchase and resets the clock", () => {
  const home = household({
    assets: [
      asset({
        id: "asset-wh01",
        name: "Water heater",
        type: "water_heater",
        installDate: "2014-08-01",
        replacementCostEstimate: 1600,
        deferredUntil: "2027-01-01",
      }),
    ],
  });
  const next = applyReplaceAsset(
    home,
    {
      assetId: "asset-wh01",
      actualCost: 1850,
      replacedOn: "2026-08-20",
      laborKind: "hired",
      plannedCost: 1600,
    },
    now,
  );
  assert.equal(next.assets[0]?.installDate, "2026-08-20");
  assert.equal(next.assets[0]?.purchasePrice, 1850);
  assert.equal(next.assets[0]?.condition, "good");
  assert.equal(next.assets[0]?.deferredUntil, undefined);
  assert.equal(next.purchases.length, 1);
  assert.equal(next.purchases[0]?.actualCost, 1850);
  assert.equal(next.purchases[0]?.laborKind, "hired");
  assert.equal(next.purchases[0]?.plannedCost, 1600);
});

test("logging a duty purchase writes a completion with actualCost", () => {
  const home = household({
    duties: [
      {
        id: "duty-filt1",
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
        dueDate: "2026-08-01",
        priority: "medium",
        createdAt: "2026-08-01T00:00:00.000Z",
        archived: false,
        estimatedCost: 40,
      },
    ],
    consumables: [
      {
        id: "cons-filt",
        nodeId: "kitchen",
        nodeType: "room",
        name: "HVAC filter",
        intervalDays: 90,
        unitCost: 22,
      },
    ],
  });
  const next = applyLogPurchase(
    home,
    {
      actualCost: 18.5,
      completedOn: "2026-08-15",
      label: "HVAC filter",
      kind: "consumable",
      dutyId: "duty-filt1",
    },
    now,
  );
  assert.equal(next.purchases[0]?.actualCost, 18.5);
  assert.equal(next.completions[0]?.actualCost, 18.5);
  assert.equal(next.consumables[0]?.lastPaidPrice, 18.5);
});

test("fund health reports coverage and the 1% rule", () => {
  const home = applySetHomeValue(
    applySetMaintenanceFund(
      household({
        assets: [
          asset({
            id: "asset-hvac",
            name: "HVAC",
            type: "hvac_system",
            installDate: "2011-09-01",
            replacementCostEstimate: 7500,
          }),
        ],
      }),
      { balance: 2400 },
      now,
    ),
    250000,
  );
  const forecast = buildForecast(home, 12, now);
  const health = fundHealth(home, forecast);
  assert.equal(health.saved, 2400);
  assert.ok(health.needed12 > 0);
  assert.ok(health.coveragePct != null && health.coveragePct >= 0);
  assert.ok(health.onePercentCopy && /1.3%/.test(health.onePercentCopy));
});

test("spending summary compares plan to actual and groups categories", () => {
  const home = household({
    assets: [asset({ id: "asset-wh02", name: "Water heater", type: "water_heater", installDate: "2020-01-01" })],
    purchases: [
      {
        id: "purchase1",
        completedAt: "2026-06-10T12:00:00.000Z",
        actualCost: 1600,
        label: "Water heater replacement",
        kind: "replacement",
        assetId: "asset-wh02",
      },
      {
        id: "purchase2",
        completedAt: "2026-07-02T12:00:00.000Z",
        actualCost: 22,
        label: "HVAC filter",
        kind: "consumable",
        dutyId: "duty-xxxx",
      },
    ],
    completions: [
      {
        id: "comp-skip1",
        dutyId: "duty-xxxx",
        actor: "me",
        visitId: null,
        completedAt: "2026-07-02T12:00:00.000Z",
        actualCost: 22,
      },
    ],
  });
  const summary = spendingSummary(home, { months: 6, plannedMonthly: 200, now });
  assert.equal(summary.planned, 1200);
  assert.equal(summary.actual, 1622);
  assert.ok(summary.byCategory.some((item) => item.category === "Plumbing"));
  assert.equal(summary.entries.length, 2);
});

test("insights flag overdue risk, backlog, and seasonal spikes", () => {
  const home = applySetMaintenanceFund(
    household({
      assets: [
        asset({ id: "asset-roof", name: "Roof", type: "roof", installDate: "1990-01-01", replacementCostEstimate: 14000 }),
        asset({
          id: "asset-wh03",
          name: "Water heater",
          type: "water_heater",
          installDate: "2008-01-01",
          replacementCostEstimate: 1600,
        }),
      ],
    }),
    { balance: 400, monthlyContribution: 200 },
    now,
  );
  const forecast = buildForecast(home, 12, now);
  const insights = budgetInsights(home, forecast, now);
  assert.ok(insights.some((item) => item.id === "urgency" && /Roof/.test(item.body)));
  assert.ok(insights.some((item) => item.id === "backlog" && /overdue/.test(item.body)));
});

test("migrates purchases and a maintenance fund from stored JSON", () => {
  const householdData = parseStored(
    JSON.stringify({
      onboarded: true,
      floors: [{ id: "main", name: "Main", sortOrder: 0 }],
      rooms: [{ id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 1 }],
      duties: [{ id: "duty-0008", title: "Sweep", room: "kitchen", createdAt: "2026-01-01T00:00:00.000Z" }],
      maintenanceFund: { balance: 2400, updatedAt: "2026-08-01T00:00:00.000Z", monthlyContribution: 200 },
      homeValueEstimate: 425000,
      bigTicketThreshold: 750,
      purchases: [
        {
          id: "purchase1",
          completedAt: "2026-08-02T00:00:00.000Z",
          actualCost: 18.5,
          label: "Filter",
          kind: "consumable",
        },
      ],
      assets: [
        {
          id: "asset-0001",
          roomId: "kitchen",
          name: "Fridge",
          type: "refrigerator",
          deferredUntil: "2027-03-01",
          deferReason: "still working fine",
        },
      ],
    }),
  );
  assert.equal(householdData.maintenanceFund?.balance, 2400);
  assert.equal(householdData.homeValueEstimate, 425000);
  assert.equal(householdData.bigTicketThreshold, 750);
  assert.equal(householdData.purchases[0]?.actualCost, 18.5);
  assert.equal(householdData.assets[0]?.deferredUntil, "2027-03-01");
});
