import assert from "node:assert/strict";
import { test } from "node:test";
import { ASSET_CATALOG, catalogEntry } from "@/lib/asset-catalog";
import { buildForecast } from "@/lib/forecast";
import type { HomeAsset } from "@/lib/types";
import { appraise } from "./appraise";
import { readLabel } from "./index";

const NOW = new Date(2026, 9, 4);

test("water heater made March 2014", () => {
  const a = appraise({ type: "water_heater", manufacturedAt: { year: 2014, month: 3 }, now: NOW })!;
  assert.equal(a.lifeYears, 12);
  assert.equal(a.ageYears, 12.6);
  assert.equal(a.yearsLeft, -0.6);
  assert.equal(a.status, "past_life");
  assert.deepEqual(a.replacement, { low: 900, mid: 1600, high: 2800 });
  assert.equal(a.manufacturedISO, "2014-03-01");
  assert.equal(a.endOfLifeISO, "2026-03-01");
  assert.equal(a.monthsToEnd, 0);
  assert.deepEqual(a.setAside, { monthly: 1600, months: 1 });
});

test("status thresholds: 50% and 80% of usual life", () => {
  const status = (ageYears: number) => {
    const m = new Date(NOW.getFullYear() - ageYears, NOW.getMonth(), 1);
    return appraise({ type: "water_heater", manufacturedAt: m, now: NOW })!.status;
  };
  assert.equal(status(5), "new");
  assert.equal(status(6), "midlife");
  assert.equal(status(9), "midlife");
  assert.equal(status(10), "near_end");
  assert.equal(status(12), "past_life");
  assert.equal(status(30), "past_life");
});

test("future-dated and invalid input", () => {
  const a = appraise({ type: "furnace", manufacturedAt: new Date(2026, 10, 1), now: NOW })!;
  assert.equal(a.ageYears, 0);
  assert.equal(appraise({ type: "furnace", manufacturedAt: "not a date", now: NOW }), undefined);
  assert.equal(appraise({ type: "furnace", manufacturedAt: new Date(NaN), now: NOW }), undefined);
});

test("year only assumes July and says so", () => {
  const a = appraise({ type: "furnace", manufacturedAt: { year: 2010 }, now: NOW })!;
  assert.equal(a.monthAssumed, true);
  assert.equal(a.manufacturedISO, "2010-07-01");
});

test("numbers equal what the Budget forecast computes for the same appliance", () => {
  const cases: { type: HomeAsset["type"]; year: number; month: number }[] = [
    { type: "water_heater", year: 2014, month: 3 },
    { type: "water_heater", year: 2016, month: 11 },
    { type: "furnace", year: 2011, month: 6 },
    { type: "dishwasher", year: 2019, month: 1 },
    { type: "refrigerator", year: 2015, month: 9 },
    { type: "hvac_system", year: 2012, month: 2 },
    { type: "dryer", year: 2013, month: 12 },
  ];
  for (const c of cases) {
    const a = appraise({ type: c.type, manufacturedAt: { year: c.year, month: c.month }, now: NOW })!;
    const asset: HomeAsset = { id: "a", roomId: "r", name: "x", type: c.type, installDate: a.manufacturedISO };
    const horizon = a.setAside.months;
    const forecast = buildForecast(
      { assets: [asset], duties: [], consumables: [], supplyAutomations: [], rooms: [] },
      horizon,
      NOW,
    );
    const item = forecast.monthly.flatMap((m) => m.items).find((i) => i.kind === "replacement");
    assert.ok(item, `${c.type} ${c.year}`);
    assert.deepEqual(item.cost, a.replacement);
    if (!item.overdue) assert.equal(item.month, a.endOfLifeISO.slice(0, 7));
    assert.equal(forecast.suggestedMonthlySetAside, a.setAside.monthly, `${c.type} ${c.year}`);
    assert.equal(a.lifeYears, catalogEntry(c.type).defaultLifeYears);
  }
});

test("every catalog type appraises without throwing", () => {
  for (const entry of ASSET_CATALOG) {
    const a = appraise({ type: entry.type, manufacturedAt: { year: 2015, month: 5 }, now: NOW });
    assert.ok(a && Number.isFinite(a.setAside.monthly));
  }
});

test("readLabel: Rheem plate end to end", () => {
  const r = readLabel(
    ["RHEEM", "WATER HEATER", "MODEL NO. XE40M06ST45U1", "SERIAL NO. C141234567", "40 GALLONS"],
    NOW,
  );
  assert.equal(r.brand?.value.name, "Rheem");
  assert.deepEqual([r.manufactured?.year, r.manufactured?.month, r.manufactured?.source], [2014, 3, "serial"]);
  assert.equal(r.appraisal?.status, "past_life");
  assert.equal(r.confidence.overall, "high");
  assert.deepEqual(r.missing, []);
});

test("readLabel: printed date beats serial; conflict is flagged and lowers confidence", () => {
  const r = readLabel(["RHEEM", "WATER HEATER", "SERIAL C141234567", "MFG DATE 03/2020"], NOW);
  assert.equal(r.manufactured?.source, "printed");
  assert.equal(r.manufactured?.year, 2020);
  assert.equal(r.dateConflict, true);
  assert.equal(r.manufactured?.confidence, "likely");
  assert.notEqual(r.confidence.overall, "high");
});

test("readLabel: stubbed brand falls back to printed date", () => {
  const r = readLabel(["Bradford White", "SERIAL RB1234567", "MFG DATE 2016-11", "MODEL RG240T6"], NOW);
  assert.equal(r.manufactured?.source, "printed");
  assert.deepEqual([r.manufactured?.year, r.manufactured?.month], [2016, 11]);
  assert.equal(r.type?.basis, "brand");
  assert.equal(r.confidence.overall, "medium");
});

test("readLabel: unknown date asks for it instead of guessing", () => {
  const r = readLabel(["LG", "REFRIGERATOR", "MODEL LFXS26973S", "SERIAL 407KWAB12345"], NOW);
  assert.equal(r.manufactured, undefined);
  assert.equal(r.appraisal, undefined);
  assert.deepEqual(r.missing, ["date"]);
  assert.equal(r.confidence.overall, "low");
  assert.equal(r.model?.value, "LFXS26973S");
});

test("readLabel: junk gives an empty, low-confidence reading", () => {
  const r = readLabel(["", "@@@", "12345"], NOW);
  assert.equal(r.confidence.overall, "low");
  assert.deepEqual(r.missing, ["type", "date"]);
});

test("readLabel: Goodman furnace with filter size", () => {
  const r = readLabel(["GOODMAN", "GAS FURNACE", "MODEL GMVC80804CN", "SERIAL 1305123456", "FILTER 16X25X1"], NOW);
  assert.equal(r.type?.type, "furnace");
  assert.deepEqual([r.manufactured?.year, r.manufactured?.month, r.manufactured?.confidence], [2013, 5, "likely"]);
  assert.equal(r.filterSize?.value.text, "16x25x1");
  assert.equal(r.confidence.overall, "medium");
});
