import assert from "node:assert/strict";
import { test } from "node:test";
import { findByBarcode, hasValidCheckDigit, isFirstSeen, normalizeBarcode, rememberBarcode, rememberBarcodeDetailed, sameBarcode } from "./barcode";
import { automation, dutyFor, household } from "./test-fixtures";
import { migrateHousehold } from "@/lib/storage/migrate";

const UPC = "012345678905"; // valid UPC-A
const EAN = "0012345678905"; // same product as EAN-13

function base() {
  return household({
    duties: [dutyFor("supply-a1"), dutyFor("supply-a2")],
    supplyAutomations: [
      automation({ id: "supply-a1", itemName: "Dishwasher pods", sku: "" }),
      automation({ id: "supply-a2", itemName: "Furnace filter", sku: "16x25x1", sizeSpec: "16x25x1" }),
    ],
  });
}

test("check digits and normalising", () => {
  assert.equal(hasValidCheckDigit(UPC), true);
  assert.equal(hasValidCheckDigit("012345678906"), false);
  assert.equal(normalizeBarcode("0 12345-678905"), UPC);
  assert.equal(normalizeBarcode("12345"), null);
  assert.equal(normalizeBarcode("ABC123456789"), null);
  assert.equal(sameBarcode(UPC, EAN), true);
});

test("an empty sku takes the code", () => {
  const r = rememberBarcodeDetailed(base(), "supply-a1", UPC);
  assert.equal(r.stored, "sku");
  assert.equal(r.household.supplyAutomations[0].sku, UPC);
  assert.equal(r.household.supplyAutomations[0].barcodes, undefined);
});

test("an existing sku is never overwritten; the code goes in barcodes", () => {
  const r = rememberBarcodeDetailed(base(), "supply-a2", UPC);
  assert.equal(r.stored, "barcodes");
  const item = r.household.supplyAutomations[1];
  assert.equal(item.sku, "16x25x1");
  assert.deepEqual(item.barcodes, [UPC]);
});

test("remembering twice, or the same code as UPC and EAN, changes nothing", () => {
  const once = rememberBarcode(base(), "supply-a2", UPC);
  assert.equal(rememberBarcode(once, "supply-a2", UPC), once);
  assert.equal(rememberBarcode(once, "supply-a2", EAN), once);
});

test("bad codes and unknown items are ignored", () => {
  const h = base();
  assert.equal(rememberBarcode(h, "supply-a1", "123"), h);
  assert.equal(rememberBarcode(h, "nope", UPC), h);
});

test("findByBarcode and isFirstSeen", () => {
  const h = rememberBarcode(rememberBarcode(base(), "supply-a1", UPC), "supply-a2", "036000291452");
  assert.equal(findByBarcode(h, EAN)?.id, "supply-a1");
  assert.equal(findByBarcode(h, "036000291452")?.id, "supply-a2");
  assert.equal(isFirstSeen(h, UPC), false);
  assert.equal(isFirstSeen(h, "049000028911"), true);
  assert.equal(isFirstSeen(h, "garbage"), false);
});

test("teaching a box to a different item moves it", () => {
  const h = rememberBarcode(base(), "supply-a1", UPC);
  const moved = rememberBarcode(h, "supply-a2", UPC);
  assert.equal(findByBarcode(moved, UPC)?.id, "supply-a2");
  assert.equal(moved.supplyAutomations[0].sku, "");
});

test("barcodes survive a storage round trip and bad ones are dropped", () => {
  const h = rememberBarcode(base(), "supply-a2", UPC);
  const json = JSON.parse(JSON.stringify(h)) as typeof h;
  const migrated = migrateHousehold(json as unknown as Record<string, unknown>);
  assert.deepEqual(migrated.supplyAutomations.find((a) => a.id === "supply-a2")?.barcodes, [UPC]);
  const dirty = JSON.parse(JSON.stringify(h));
  dirty.supplyAutomations[1].barcodes = [UPC, UPC, "x", 5, "123"];
  assert.deepEqual(migrateHousehold(dirty as Record<string, unknown>).supplyAutomations.find((a) => a.id === "supply-a2")?.barcodes, [UPC]);
  // An older household with no field still loads.
  assert.equal(migrateHousehold(JSON.parse(JSON.stringify(base())) as Record<string, unknown>).supplyAutomations[0].barcodes, undefined);
});
