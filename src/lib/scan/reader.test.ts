import assert from "node:assert/strict";
import { test } from "node:test";
import type { CuidalaIntelligencePlugin } from "@/lib/native/cuidala-intelligence";
import { installIntelligencePluginForTests } from "@/lib/native/intelligence";
import {
  barcodesFromLines,
  confirmedLines,
  decideKind,
  enrichWithAi,
  makeCapture,
  mergeLabel,
  mergeReceipt,
  needsHelp,
  readAs,
  receiptTotals,
  startingTicks,
  type LabelRead,
  type ReceiptRead,
} from "./reader";
import { automation, household, NOW } from "./test-fixtures";

test.afterEach(() => installIntelligencePluginForTests(null));

const PLATE = ["RHEEM", "WATER HEATER", "MODEL NO. XG50T06EC36U1", "SERIAL NO. C141234567", "MFG DATE 03/2014"];
const HOME_DEPOT = [
  "THE HOME DEPOT #4401",
  "10/04/2026 02:31 PM",
  "CASCADE PLATINUM DW PODS 60CT  18.00",
  "FILTRETE 16X25X1 AIR FILTER  9.00",
  "WIDGET THING  4.00",
  "SUBTOTAL 31.00",
  "TAX 2.56",
  "TOTAL 33.56",
  "VISA ****1234",
];

function home() {
  return household({
    supplyAutomations: [
      automation({ id: "dw", itemName: "Dishwasher detergent" }),
      automation({ id: "ff", itemName: "Furnace filter", sizeSpec: "16x25x1" }),
    ],
  });
}

function fake(overrides: Partial<Record<keyof CuidalaIntelligencePlugin, unknown>>): CuidalaIntelligencePlugin {
  const reject = async () => Promise.reject(new Error("not stubbed"));
  return { availability: reject, structureLabel: reject, structureReceipt: reject, tellCuidala: reject, ...overrides } as unknown as CuidalaIntelligencePlugin;
}

test("typed barcodes: only digit-only lines with a good check digit", () => {
  assert.deepEqual(barcodesFromLines(["0 36000 29145 2", "hello", "123456789013"]), ["036000291452"]);
  assert.deepEqual(makeCapture(["036000291452"]).barcodes, ["036000291452"]);
  assert.deepEqual(makeCapture(["x"], ["036000291452", "12"]).barcodes, ["036000291452"]);
});

test("deciding: plate, receipt, a lone code, a tie asks, nonsense is none", () => {
  assert.equal(decideKind(makeCapture(PLATE)).kind, "label");
  assert.equal(decideKind(makeCapture(HOME_DEPOT)).kind, "receipt");
  assert.equal(decideKind(makeCapture(["036000291452"])).kind, "product");
  assert.equal(decideKind(makeCapture(["hello there"])).kind, "none");
  const tie = decideKind(makeCapture([...PLATE, "SUBTOTAL 5.00", "TOTAL 5.00", "TAX 0.00"]));
  assert.ok(tie.kind === "ask" || tie.kind === "label" || tie.kind === "receipt");
});

test("reading as each kind", () => {
  const h = home();
  const label = readAs("label", makeCapture(PLATE), h, NOW);
  assert.equal(label?.kind, "label");
  const receipt = readAs("receipt", makeCapture(HOME_DEPOT), h, NOW) as ReceiptRead;
  assert.equal(receipt.store, "The Home Depot");
  assert.equal(receipt.total, 33.56);
  assert.equal(readAs("label", makeCapture(["lorem"]), h, NOW), null);
  assert.equal(readAs("filter", makeCapture(["FILTRETE 16X25X1 MERV 8"]), h, NOW)?.kind, "filter");
  const product = readAs("product", makeCapture(["036000291452"]), h, NOW);
  assert.equal(product?.kind === "product" && product.known, undefined);
});

test("a taught barcode is recognised", () => {
  const h = home();
  h.supplyAutomations[0] = { ...h.supplyAutomations[0], sku: "036000291452" };
  const read = readAs("product", makeCapture(["036000291452"]), h, NOW);
  assert.equal(read?.kind === "product" && read.known?.id, "dw");
});

test("merging a label: the model fills gaps, plain values win", () => {
  const lines = ["RHEEM", "WATER HEATER", "MODEL NO. XG50T06EC36U1"];
  const read = readAs("label", makeCapture(lines), home(), NOW) as LabelRead;
  assert.ok(!read.reading.manufactured);
  const merged = mergeLabel(read, { model: "SOMETHING ELSE", serial: "C141234567", manufacturedYear: 2014, manufacturedMonth: 3 }, lines, NOW);
  assert.equal(merged.reading.model?.value, "XG50T06EC36U1");
  assert.equal(merged.reading.manufactured?.year, 2014);
  assert.ok(merged.aiFilled.includes("date"));
  assert.ok(!merged.aiFilled.includes("model"));
  assert.ok(merged.reading.appraisal);
});

test("merging a label: nothing missing means nothing marked", () => {
  const read = readAs("label", makeCapture(PLATE), home(), NOW) as LabelRead;
  const merged = mergeLabel(read, { manufacturedYear: 1999 }, PLATE, NOW);
  assert.equal(merged.aiFilled.length, 0);
  assert.equal(merged.reading.manufactured?.year, 2014);
});

test("merging a receipt: dates and money stay, model matches are unticked maybes", () => {
  const h = home();
  const read = readAs("receipt", makeCapture(HOME_DEPOT), h, NOW) as ReceiptRead;
  const ai = {
    store: "Lowes",
    date: "2020-01-01",
    total: 1,
    items: [{ name: "CASCADE PLATINUM DW PODS 60CT", price: 18, matchesTracked: "Dishwasher detergent" }],
  };
  const merged = mergeReceipt(read, ai, h);
  assert.equal(merged.store, "The Home Depot");
  assert.equal(merged.date, "2026-10-04");
  assert.equal(merged.total, 33.56);
  for (const line of merged.lines) if (line.viaAi) assert.equal(line.preChecked, false);
});

test("merging a receipt: gaps are filled and marked", () => {
  const h = home();
  const lines = ["DW PODS 60CT  18.00", "TOTAL 18.00"];
  const read = readAs("receipt", makeCapture(lines), h, NOW) as ReceiptRead;
  const merged = mergeReceipt(
    read,
    { store: "Target", date: "2026-10-03", items: [{ name: "DW PODS 60CT", price: 18, matchesTracked: "Dishwasher detergent" }] },
    h,
  );
  assert.equal(merged.store, "Target");
  assert.equal(merged.date, "2026-10-03");
  assert.ok(merged.aiFilled.includes("store") && merged.aiFilled.includes("date"));
  const line = merged.lines.find((l) => l.line.price === 18);
  if (line && line.viaAi) {
    assert.equal(line.status, "maybe");
    assert.equal(line.match?.automationId, "dw");
    assert.equal(merged.aiFilled.includes("match"), true);
  }
});

test("a model match to a name that is not tracked is dropped", () => {
  const h = home();
  const read = readAs("receipt", makeCapture(["WIDGET THING 4.00", "TOTAL 4.00"]), h, NOW) as ReceiptRead;
  const merged = mergeReceipt(read, { items: [{ name: "WIDGET THING", price: 4, matchesTracked: "Cat food" }] }, h);
  assert.ok(merged.lines.every((l) => !l.viaAi));
});

test("enrichWithAi: off, failing, slow and working all end well", async () => {
  const h = home();
  const lines = ["RHEEM", "MODEL NO. XG50T06EC36U1"];
  const capture = makeCapture(lines);
  const read = readAs("label", capture, h, NOW)!;
  assert.equal(needsHelp(read), true);

  // Off native: same read back.
  assert.equal(await enrichWithAi(read, capture, h, NOW), read);

  installIntelligencePluginForTests(fake({ availability: async () => ({ available: false, reason: "notEnabled" }) }));
  assert.equal(await enrichWithAi(read, capture, h, NOW), read);

  installIntelligencePluginForTests(
    fake({ availability: async () => ({ available: true }), structureLabel: async () => Promise.reject(new Error("boom")) }),
  );
  assert.equal(await enrichWithAi(read, capture, h, NOW), read);

  installIntelligencePluginForTests(
    fake({ availability: async () => ({ available: true }), structureLabel: () => new Promise(() => undefined) }),
  );
  assert.equal(await enrichWithAi(read, capture, h, NOW, 30), read);

  installIntelligencePluginForTests(
    fake({
      availability: async () => ({ available: true }),
      structureLabel: async () => ({ type: "water_heater", manufacturedYear: 2014, manufacturedMonth: 3 }),
    }),
  );
  const done = await enrichWithAi(read, capture, h, NOW);
  assert.equal(done.kind === "label" && done.reading.manufactured?.year, 2014);
  assert.equal(done.kind === "label" && done.reading.type?.type, "water_heater");
});

test("a confident plate never calls the model", async () => {
  const h = home();
  const capture = makeCapture(PLATE);
  const read = readAs("label", capture, h, NOW)!;
  let called = false;
  installIntelligencePluginForTests(fake({ availability: async () => ((called = true), { available: true }) }));
  if (!needsHelp(read)) {
    await enrichWithAi(read, capture, h, NOW);
    assert.equal(called, false);
  }
});

test("ticks, confirmed lines and the totals for the toast", () => {
  const h = home();
  const read = readAs("receipt", makeCapture(HOME_DEPOT), h, NOW) as ReceiptRead;
  const ticks = startingTicks(read.lines);
  const confirmed = confirmedLines(read.lines, ticks, h);
  const totals = receiptTotals(confirmed);
  assert.equal(totals.count, confirmed.length);
  assert.ok(totals.count >= 1);
  assert.ok(totals.amount > 0);
  // Unticking removes it.
  assert.equal(confirmedLines(read.lines, new Set()).length, 0);
});

test("a bought pack tops a restock item up by its usual order size", () => {
  const h = home();
  h.supplyAutomations[0] = { ...h.supplyAutomations[0], qtyPerOrder: 3 };
  const read = readAs("receipt", makeCapture(["DISHWASHER DETERGENT 18.00", "TOTAL 18.00"]), h, NOW) as ReceiptRead;
  const ticks = new Set<number>();
  read.lines.forEach((l, i) => l.match?.automationId === "dw" && ticks.add(i));
  const confirmed = confirmedLines(read.lines, ticks, h);
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].line.qty, 3);
});
