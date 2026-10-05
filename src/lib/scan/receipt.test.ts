import assert from "node:assert/strict";
import { test } from "node:test";
import { coreTokens, matchReceipt, parseMoney, parseReceipt } from "./receipt";
import { automation, consumable, household, NOW } from "./test-fixtures";

const HOME_DEPOT = [
  "THE HOME DEPOT #4401",
  "1234 MAIN ST SPRINGFIELD",
  "10/04/2026 02:31 PM",
  "FILTRETE 16X25X1 AIR FILTER",
  "2 @ 12.98          25.96",
  "DAWN DISH SOAP 019 3.48 N",
  "COUPON-MFR              -1.00",
  "SUBTOTAL               28.44",
  "SALES TAX 8.25%         2.35",
  "TOTAL                  30.79",
  "VISA ****1234          30.79",
  "THANK YOU FOR SHOPPING",
];

test("money parsing", () => {
  assert.equal(parseMoney("4.99"), 4.99);
  assert.equal(parseMoney("$ 1,234.50"), 1234.5);
  assert.equal(parseMoney("4,99"), 4.99);
  assert.equal(parseMoney("abc"), null);
});

test("big-box receipt: store, date, total, quantities and a coupon", () => {
  const r = parseReceipt(HOME_DEPOT, NOW);
  assert.equal(r.store, "The Home Depot");
  assert.equal(r.storeKnown, true);
  assert.equal(r.date, "2026-10-04");
  assert.equal(r.subtotal, 28.44);
  assert.equal(r.tax, 2.35);
  assert.equal(r.total, 30.79);
  assert.equal(r.lines.length, 3);
  const [filter, dawn, coupon] = r.lines;
  assert.equal(filter.qty, 2);
  assert.equal(filter.price, 25.96);
  assert.equal(filter.unitPrice, 12.98);
  assert.match(filter.name, /FILTRETE/);
  assert.equal(dawn.price, 3.48);
  assert.equal(coupon.discount, true);
  assert.equal(coupon.price, -1);
  assert.equal(r.sumMatches, true);
  assert.equal(r.confidence, "high");
  assert.ok(!r.lines.some((l) => /TOTAL|TAX|VISA/i.test(l.name)));
});

test("grocery receipt: x2, weights, tax flags, comma decimals, two-digit years", () => {
  const r = parseReceipt(
    [
      "KROGER",
      "MILK GAL 3.49 F",
      "PAPER TOWELS x2     11,98 T",
      "BANANAS",
      "1.62 LB @ 0.59/LB     0.96",
      "TOILET PAPER 12 ROLL  ",
      "9.99",
      "SUBTOTAL 26.42",
      "TAX 1.10",
      "BALANCE DUE 27.52",
      "CASH 30.00",
      "CHANGE 2.48",
      "10-03-26",
    ],
    NOW,
  );
  assert.equal(r.store, "Kroger");
  assert.equal(r.date, "2026-10-03");
  assert.equal(r.total, 27.52);
  assert.deepEqual(r.lines.map((l) => [l.name, l.qty, l.price]), [
    ["MILK GAL", 1, 3.49],
    ["PAPER TOWELS", 2, 11.98],
    ["BANANAS", 1, 0.96],
    ["TOILET PAPER 12 ROLL", 1, 9.99],
  ]);
  assert.equal(r.sumMatches, true);
});

test("hardware store receipt with OCR noise", () => {
  const r = parseReceipt(
    [
      "ACE HARDWARE",
      "STORE 0O412  PH (555) 010-2233",
      "1O/O2/2O26 09:14",
      "0123456789012 FLTR 2OX25X1 FURNACE  14.49 T",
      "DET P0DS 6OCT 036000291452   12.99",
      "SUB T0TAL  27.48",
      "TAX   2.27",
      "T0TAL  29.75",
      "MC *** 4411",
    ],
    NOW,
  );
  assert.equal(r.store, "Ace Hardware");
  assert.equal(r.date, "2026-10-02");
  assert.equal(r.lines.length, 2);
  assert.equal(r.lines[0].price, 14.49);
  assert.equal(r.lines[1].price, 12.99);
  assert.equal(r.subtotal, 27.48);
  assert.equal(r.total, 29.75);
  assert.equal(r.sumMatches, true);
});

test("dates: US formats, future and return-by dates are not the purchase date", () => {
  const pick = (line: string[]) => parseReceipt([...line, "ITEM ONE 1.00"], NOW).date;
  assert.equal(pick(["Oct 4, 2026"]), "2026-10-04");
  assert.equal(pick(["10/4/26"]), "2026-10-04");
  assert.equal(pick(["2026-09-30 11:00"]), "2026-09-30");
  assert.equal(pick(["RETURN BY 11/03/2026", "10/01/2026"]), "2026-10-01");
  assert.equal(pick(["12/31/2027"]), undefined);
});

test("empty and garbage input never throws", () => {
  assert.deepEqual(parseReceipt([], NOW).lines, []);
  assert.equal(parseReceipt(["@@@@", "####", "...."], NOW).confidence, "low");
});

// ---------- matching ----------

function home() {
  return household({
    supplyAutomations: [
      automation({ id: "pods", itemName: "Dishwasher detergent pods" }),
      automation({ id: "tp", itemName: "Toilet paper" }),
      automation({ id: "towel", itemName: "Paper towels" }),
      automation({ id: "f1", itemName: "Furnace filter", sizeSpec: "16x25x1", sku: "" }),
      automation({ id: "f2", itemName: "Furnace filter", sizeSpec: "20x20x1", sku: "" }),
      automation({ id: "boxed", itemName: "Trash bags", sku: "", barcodes: ["036000291452"] }),
    ],
    consumables: [consumable({ id: "c-soap", name: "Dish soap" })],
  });
}

test("abbreviations, brands and sizes are stripped before comparing", () => {
  assert.deepEqual(coreTokens("DW DET PODS 60CT"), ["DISHWASHER", "DETERGENT", "POD"]);
  assert.deepEqual(coreTokens("BOUNTY PAPER TOWELS 8 ROLL"), ["PAPER", "TOWEL"]);
  assert.deepEqual(coreTokens("TP 12 ROLL"), ["TOILET", "PAPER"]);
  assert.deepEqual(coreTokens("Furnace filter 16x25x1"), ["AIR", "FILTER"]);
});

test("receipt lines match tracked supplies, and only strong matches start ticked", () => {
  const receipt = parseReceipt(
    [
      "WALMART",
      "CASCADE DW DET PODS 60CT   13.97",
      "TP 12 ROLL                  9.99",
      "BOUNTY PT 8 ROLL           14.99",
      "FILTRETE FLTR 16X25X1       12.98",
      "TOTAL 51.93",
    ],
    NOW,
  );
  const matches = matchReceipt(receipt, home());
  const by = (name: RegExp) => matches.find((m) => name.test(m.line.name))!;
  assert.equal(by(/PODS/).match?.automationId, "pods");
  assert.equal(by(/PODS/).status, "matched");
  assert.equal(by(/^TP/).match?.automationId, "tp");
  assert.equal(by(/^TP/).status, "matched");
  assert.equal(by(/BOUNTY/).match?.automationId, "towel");
  const filter = by(/FILTRETE/);
  assert.equal(filter.match?.automationId, "f1");
  assert.equal(filter.match?.via, "size");
  assert.equal(filter.status, "matched");
  for (const m of matches) assert.equal(m.preChecked, m.status === "matched");
});

test("a different filter size is not matched", () => {
  const receipt = parseReceipt(["FILTRETE FLTR 14X20X1  11.98", "TOTAL 11.98"], NOW);
  const [m] = matchReceipt(receipt, home());
  assert.notEqual(m.status, "matched");
  assert.equal(m.preChecked, false);
});

test("vague or partial names are only a maybe, and unrelated lines are none", () => {
  const receipt = parseReceipt(["PAPER TOWEL HOLDER   8.99", "PAPER PLATES   4.49", "BANANAS  0.96", "TOTAL 14.44"], NOW);
  const [holder, plates, bananas] = matchReceipt(receipt, home());
  assert.notEqual(holder.status, "matched");
  assert.notEqual(plates.status, "matched");
  assert.equal(bananas.status, "none");
  assert.equal(bananas.match, undefined);
});

test("a remembered barcode printed on the receipt wins outright", () => {
  const receipt = parseReceipt(["GLAD KITCHEN 036000291452   8.49", "TOTAL 8.49"], NOW);
  const [m] = matchReceipt(receipt, home());
  assert.equal(m.match?.automationId, "boxed");
  assert.equal(m.match?.via, "barcode");
  assert.equal(m.status, "matched");
});

test("consumables match too, and discounts never do", () => {
  const receipt = parseReceipt(["DAWN DISH SOAP 3.48", "COUPON -1.00", "TOTAL 2.48"], NOW);
  const [soap, coupon] = matchReceipt(receipt, home());
  assert.equal(soap.match?.consumableId, "c-soap");
  assert.equal(soap.status, "matched");
  assert.equal(coupon.status, "none");
});

test("two lines for one tracked item: only the stronger is matched", () => {
  const receipt = parseReceipt(["TOILET PAPER 12 ROLL  9.99", "TP 4 ROLL  3.99", "TOTAL 13.98"], NOW);
  const matches = matchReceipt(receipt, home());
  assert.equal(matches.filter((m) => m.status === "matched").length, 1);
  assert.equal(matches.filter((m) => m.status === "maybe").length, 1);
});

test("an empty household matches nothing", () => {
  const [m] = matchReceipt(parseReceipt(["PAPER TOWELS 9.99", "TOTAL 9.99"], NOW), household());
  assert.equal(m.status, "none");
});
