import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeSerial } from "./serial-dates";

const NOW = new Date(2026, 9, 4);
const d = (brandId: string, serial: string, type?: Parameters<typeof decodeSerial>[0]["type"]) =>
  decodeSerial({ brandId, serial, type, now: NOW });

test("Rheem / Ruud: month letter then two-digit year", () => {
  const r = d("rheem", "F081234567", "water_heater");
  assert.deepEqual([r.year, r.month, r.confidence], [2008, 6, "exact"]);
  assert.deepEqual(r.validYears, [2000, 2026]);
  assert.deepEqual([d("ruud", "A140012345").year, d("ruud", "A140012345").month], [2014, 1]);
  assert.equal(d("rheem", "L231234567").month, 12);
  assert.equal(d("rheem", "I091234567").month, 9);
});

test("Rheem refuses what it cannot be sure of", () => {
  assert.equal(d("rheem", "M031234567").confidence, "unknown"); // M is not a month
  assert.equal(d("rheem", "F981234567").confidence, "unknown"); // 2098 is the future
  assert.equal(d("rheem", "F08ABCDEFG").confidence, "unknown");
  assert.equal(d("rheem", "F081234567", "furnace").confidence, "unknown");
  assert.equal(d("rheem", "F08").confidence, "unknown");
});

test("Rheem OCR: 1 for I and O for 0 are accepted but only as likely", () => {
  const a = d("rheem", "1091234567", "water_heater");
  assert.deepEqual([a.year, a.month, a.confidence, a.corrected], [2009, 9, "likely", true]);
  const b = d("rheem", "FO81234567");
  assert.deepEqual([b.year, b.month, b.confidence], [2008, 6, "likely"]);
});

test("A. O. Smith / State: YYWW", () => {
  const r = d("aosmith", "0735M123456");
  assert.deepEqual([r.year, r.month, r.confidence], [2007, 8, "likely"]);
  assert.equal(d("state", "1201A123456").month, 1);
  assert.equal(d("aosmith", "1253M123456").year, 2012);
  assert.equal(d("aosmith", "0700M123456").confidence, "unknown"); // week 0
  assert.equal(d("aosmith", "0760M123456").confidence, "unknown"); // week 60
  assert.equal(d("aosmith", "9935M123456").confidence, "unknown"); // 1999 is outside the rule
  assert.equal(d("aosmith", "4535M123456").confidence, "unknown"); // 2045 is the future
  assert.equal(d("aosmith", "ABCDEFGHIJ").confidence, "unknown");
});

test("Carrier / Bryant / Payne: WWYY", () => {
  const r = d("carrier", "2514A12345");
  assert.deepEqual([r.year, r.month, r.confidence], [2014, 6, "likely"]);
  assert.equal(d("bryant", "0112A12345").year, 2012);
  assert.equal(d("payne", "5814A12345").confidence, "unknown");
  assert.equal(d("carrier", "2599A12345").confidence, "unknown");
  assert.equal(d("carrier", "2514123456").confidence, "unknown");
});

test("Goodman, and Amana only when it is HVAC: YYMM", () => {
  const r = d("goodman", "1305123456");
  assert.deepEqual([r.year, r.month, r.confidence], [2013, 5, "likely"]);
  assert.equal(d("goodman", "1313123456").confidence, "unknown");
  assert.equal(d("amana", "1305123456", "furnace").year, 2013);
  assert.equal(d("amana", "1305123456", "refrigerator").confidence, "unknown");
  assert.equal(d("amana", "1305123456").confidence, "unknown");
});

test("stubbed brands always return unknown, never a guess", () => {
  for (const [brand, serial] of [
    ["bradford_white", "RB1234567"],
    ["trane", "1234ABC12"],
    ["lennox", "5604A12345"],
    ["whirlpool", "F54123456"],
    ["maytag", "F54123456"],
    ["ge", "AZ123456"],
    ["hotpoint", "AZ123456"],
    ["lg", "407KWAB12345"],
    ["samsung", "0B2L3AHC123456"],
    ["frigidaire", "4A12345678"],
    ["bosch", "FD9001"],
    ["unheard_of", "1234567890"],
  ]) {
    const r = d(brand, serial);
    assert.equal(r.confidence, "unknown", brand);
    assert.equal(r.year, undefined, brand);
  }
});

test("garbage serials", () => {
  for (const s of ["", "   ", "---", "a", "!!!!!!!!!!!!", "\u0000\u0000\u0000\u0000\u0000\u0000"]) {
    for (const b of ["rheem", "aosmith", "carrier", "goodman"]) assert.equal(d(b, s).confidence, "unknown");
  }
});

test("spaces and dashes in the serial are ignored", () => {
  assert.equal(d("rheem", "F08 123 4567").year, 2008);
  assert.equal(d("goodman", "1305-123456").month, 5);
});
