import assert from "node:assert/strict";
import { test } from "node:test";
import { readWarranty } from "./warranty-read";
import { NOW } from "./test-fixtures";

test("a printed month and year ends on the last day of that month", () => {
  const r = readWarranty(["LIMITED WARRANTY", "WARRANTY UNTIL 06/2028"], { now: NOW });
  assert.equal(r.warrantyUntil, "2028-06-30");
  assert.equal(r.basis, "printed_end");
  assert.equal(r.monthOnly, true);
  assert.equal(r.confidence, "medium");
  assert.equal(r.needsStartDate, false);
});

test("a full printed end date is high confidence, in several styles", () => {
  assert.equal(readWarranty(["Warranty expires 06/15/2028"], { now: NOW }).warrantyUntil, "2028-06-15");
  assert.equal(readWarranty(["WARRANTY EXPIRES: June 15, 2028"], { now: NOW }).warrantyUntil, "2028-06-15");
  assert.equal(readWarranty(["Warranty valid through 2029-01-31"], { now: NOW }).confidence, "high");
  assert.equal(readWarranty(["WARRANTY UNTIL FEB 2028"], { now: NOW }).warrantyUntil, "2028-02-29");
});

test("a length plus a purchase date", () => {
  const r = readWarranty(["5 YEAR LIMITED WARRANTY"], { now: NOW, purchaseDate: "2026-09-20" });
  assert.equal(r.warrantyUntil, "2031-09-20");
  assert.equal(r.basis, "term_from_date");
  assert.equal(r.termMonths, 60);
  assert.equal(r.confidence, "high");
  assert.ok(r.reasons.includes("warranty.from_purchase"));
});

test("install date is the fallback start and is only medium confidence", () => {
  const r = readWarranty(["WARRANTY PERIOD: 10 YEARS"], { now: NOW, installDate: "2024-02-29" });
  assert.equal(r.warrantyUntil, "2034-02-28");
  assert.equal(r.confidence, "medium");
  assert.equal(r.startDate, "2024-02-29");
});

test("months and word numbers", () => {
  assert.equal(readWarranty(["ONE YEAR LIMITED WARRANTY"], { now: NOW, purchaseDate: "2026-01-15" }).warrantyUntil, "2027-01-15");
  assert.equal(readWarranty(["90 DAY WARRANTY"], { now: NOW, purchaseDate: "2026-01-15" }).warrantyUntil, undefined);
  assert.equal(readWarranty(["12 MONTH WARRANTY"], { now: NOW, purchaseDate: "2026-01-15" }).warrantyUntil, "2027-01-15");
});

test("several terms: the longest wins and confidence drops", () => {
  const r = readWarranty(["10 YEAR LIMITED WARRANTY ON TANK", "1 YEAR ON PARTS", "1 YEAR LIMITED WARRANTY LABOR"], { now: NOW, purchaseDate: "2026-03-01" });
  assert.deepEqual(r.terms, [120, 12]);
  assert.equal(r.warrantyUntil, "2036-03-01");
  assert.equal(r.confidence, "medium");
});

test("a length with no start date asks for one instead of guessing", () => {
  const r = readWarranty(["5 YEAR LIMITED WARRANTY"], { now: NOW });
  assert.equal(r.warrantyUntil, undefined);
  assert.equal(r.needsStartDate, true);
  assert.equal(r.termMonths, 60);
  assert.equal(r.confidence, "low");
});

test("lifetime and unrelated text give no date", () => {
  const life = readWarranty(["LIFETIME LIMITED WARRANTY"], { now: NOW, purchaseDate: "2026-01-01" });
  assert.equal(life.lifetime, true);
  assert.equal(life.warrantyUntil, undefined);
  const none = readWarranty(["KEEP DRY", "MADE IN USA"], { now: NOW });
  assert.deepEqual([none.warrantyUntil, none.confidence, none.reasons], [undefined, "low", ["warranty.none"]]);
  assert.equal(readWarranty([], { now: NOW }).confidence, "low");
});

test("an expiry date on something that is not a warranty is low confidence", () => {
  const r = readWarranty(["EXPIRES 12/2027"], { now: NOW });
  assert.equal(r.warrantyUntil, "2027-12-31");
  assert.equal(r.confidence, "low");
});
