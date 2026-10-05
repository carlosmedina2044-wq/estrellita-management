import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyScan } from "./route";

const PLATE = ["RHEEM", "WATER HEATER", "MODEL NO. XG50T06EC36U1", "SERIAL NO. C141234567", "MFG DATE 03/2014", "50 GALLONS"];
const HOME_DEPOT = [
  "THE HOME DEPOT #4401",
  "1234 MAIN ST SPRINGFIELD",
  "FILTRETE 16X25X1 2PK  25.96",
  "DAWN DISH SOAP  3.48",
  "SUBTOTAL 29.44",
  "SALES TAX 2.43",
  "TOTAL 31.87",
  "VISA ****1234",
  "THANK YOU",
];

test("an appliance plate is a label", () => {
  const r = classifyScan({ lines: PLATE });
  assert.equal(r.kind, "label");
  assert.equal(r.confidence, "high");
  assert.ok(r.reasons.includes("label.model") && r.reasons.includes("label.serial"));
});

test("S/N and MFG alone still read as a label", () => {
  assert.equal(classifyScan({ lines: ["S/N 12345678", "MFG 2019-04", "M/N ABC123"] }).kind, "label");
});

test("a receipt is a receipt, even with a filter line on it", () => {
  const r = classifyScan({ lines: HOME_DEPOT, barcodes: ["012345678905"] });
  assert.equal(r.kind, "receipt");
  assert.equal(r.confidence, "high");
});

test("grocery receipt with OCR noise", () => {
  const r = classifyScan({
    lines: ["KROGER", "MILK GAL 3.49 F", "BREAD 2.99", "EGGS 4.29", "SUB T0TAL 10.77", "TAX 0.00", "T0TAL 10.77", "DEBIT"],
  });
  assert.equal(r.kind, "receipt");
});

test("a filter box is a filter", () => {
  const r = classifyScan({ lines: ["FILTRETE", "ALLERGEN DEFENSE", "AIR FILTER", "16 x 25 x 1", "MERV 11"] });
  assert.equal(r.kind, "filter");
  assert.ok(r.reasons.includes("filter.merv"));
});

test("quoted sizes count, a bare 4x6 does not", () => {
  assert.equal(classifyScan({ lines: ['Air Filter 16"x25"x1"'] }).kind, "filter");
  assert.equal(classifyScan({ lines: ["PHOTO PAPER 4X6", "GLOSSY"] }).kind, "unknown");
});

test("a lone barcode is a product", () => {
  const r = classifyScan({ lines: [], barcodes: ["0012345678905"] });
  assert.equal(r.kind, "product");
  assert.equal(classifyScan({ lines: ["CASCADE PLATINUM"], barcodes: ["012345678905"] }).kind, "product");
});

test("a barcode surrounded by lots of unrelated text is not called a product", () => {
  const lines = Array.from({ length: 12 }, (_, i) => `PARAGRAPH ${i} OF SMALL PRINT`);
  assert.notEqual(classifyScan({ lines, barcodes: ["012345678905"] }).kind, "product");
});

test("warranty cards", () => {
  const r = classifyScan({ lines: ["LIMITED WARRANTY", "5 YEAR LIMITED WARRANTY", "WARRANTY PERIOD: 5 YEARS"] });
  assert.equal(r.kind, "warranty");
  assert.equal(classifyScan({ lines: ["10 years limited", "warranty on tank"] }).kind, "warranty");
});

test("close calls ask instead of guessing", () => {
  // A plate with a barcode and a size: label and warranty both score.
  const r = classifyScan({ lines: ["WARRANTY 10 YEAR LIMITED WARRANTY", "MODEL NO. ABC123", "SERIAL NO. 12345"] });
  assert.equal(r.kind, "unknown");
  assert.equal(r.confidence, "low");
  assert.ok(r.reasons.includes("tie"));
  assert.ok(r.candidates.length >= 2);
});

test("filter box with a barcode stays a filter", () => {
  const r = classifyScan({ lines: ["FILTRETE 16x25x1 AIR FILTER"], barcodes: ["051141123456"] });
  assert.equal(r.kind, "filter");
  assert.equal(r.confidence, "medium");
});

test("nothing recognisable is unknown with no candidates", () => {
  const r = classifyScan({ lines: ["hello", "world"] });
  assert.equal(r.kind, "unknown");
  assert.deepEqual(r.candidates, []);
  assert.equal(classifyScan({ lines: [] }).kind, "unknown");
});
