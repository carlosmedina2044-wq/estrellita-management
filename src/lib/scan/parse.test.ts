import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLabel } from "./parse";

const NOW = new Date(2026, 9, 4);

test("Rheem water heater plate", () => {
  const p = parseLabel(
    ["RHEEM", "Water Heater", "MODEL NO. XE40M06ST45U1", "SERIAL NO. F081234567", "40 GALLONS  38000 BTU/HR", "MFG DATE: 06/2008"],
    NOW,
  );
  assert.equal(p.brand?.value.id, "rheem");
  assert.equal(p.model?.value, "XE40M06ST45U1");
  assert.equal(p.serial?.value, "F081234567");
  assert.equal(p.type?.value.type, "water_heater");
  assert.equal(p.type?.value.basis, "words");
  assert.deepEqual([p.printedDate?.value.year, p.printedDate?.value.month], [2008, 6]);
  assert.match(p.model?.line ?? "", /MODEL NO/);
});

test("labels in many spellings and mixed case, extra spaces", () => {
  assert.equal(parseLabel(["  mod.   ab12345  "], NOW).model?.value, "AB12345");
  assert.equal(parseLabel(["M/N: GFE28GSKSS"], NOW).model?.value, "GFE28GSKSS");
  assert.equal(parseLabel(["Model Number:   WTW5000DW2"], NOW).model?.value, "WTW5000DW2");
  assert.equal(parseLabel(["S/N  VS2123456"], NOW).serial?.value, "VS2123456");
  assert.equal(parseLabel(["Ser. No. 1305123456"], NOW).serial?.value, "1305123456");
  assert.equal(parseLabel(["SERIAL 1305123456"], NOW).serial?.value, "1305123456");
});

test("model and serial on one line are split", () => {
  const p = parseLabel(["MODEL ABC1234 SERIAL 0735M123456"], NOW);
  assert.equal(p.model?.value, "ABC1234");
  assert.equal(p.serial?.value, "0735M123456");
});

test("label alone on a line takes the next line as the value", () => {
  const p = parseLabel(["MODEL", "RLNB-9000X", "SERIAL NO", "5402A12345"], NOW);
  assert.equal(p.model?.value, "RLNB-9000X");
  assert.equal(p.serial?.value, "5402A12345");
});

test("OCR: zero for O in the label words, and in all-numeric values", () => {
  const p = parseLabel(["M0DEL N0. WT4700", "SER1AL N0: 1S0S"], NOW);
  assert.equal(p.model?.value, "WT4700");
  assert.equal(parseLabel(["SERIAL 13O5I23456"], NOW).serial?.value, "1305123456");
  // Mixed alphanumeric values are left alone (we cannot know which character is wrong).
  assert.equal(parseLabel(["MODEL RE2HO6O"], NOW).model?.value, "RE2HO6O");
});

test("a serial-only line is not read as the model", () => {
  const p = parseLabel(["SERIAL NO. F081234567"], NOW);
  assert.equal(p.model, undefined);
});

test("brand aliases, parents and OCR-squashed names", () => {
  assert.equal(parseLabel(["RUUD"], NOW).brand?.value.id, "ruud");
  assert.equal(parseLabel(["A. O. SMITH"], NOW).brand?.value.id, "aosmith");
  assert.equal(parseLabel(["AOSMITH"], NOW).brand?.value.id, "aosmith");
  assert.equal(parseLabel(["bradford-white"], NOW).brand?.value.id, "bradford_white");
  assert.equal(parseLabel(["BRADFORDWHITE"], NOW).brand?.value.id, "bradford_white");
  assert.equal(parseLabel(["American Standard"], NOW).brand?.value.family, "trane");
  assert.equal(parseLabel(["Kitchen Aid"], NOW).brand?.value.family, "whirlpool");
  assert.equal(parseLabel(["GE"], NOW).brand?.value.id, "ge");
  assert.equal(parseLabel(["Bryant"], NOW).brand?.value.family, "carrier");
});

test("brand words inside other words do not match", () => {
  assert.equal(parseLabel(["MANAGE", "BRAGE", "FORGE 1234", "OLGA"], NOW).brand, undefined);
  assert.equal(parseLabel(["STATE OF CALIFORNIA", "MADE IN MEXICO"], NOW).brand, undefined);
});

test("type from words, brand and weak units", () => {
  assert.equal(parseLabel(["GAS FURNACE", "INPUT 80,000 BTU/H"], NOW).type?.value.type, "furnace");
  assert.equal(parseLabel(["CLOTHES DRYER"], NOW).type?.value.type, "dryer");
  assert.equal(parseLabel(["Clothes Washer"], NOW).type?.value.type, "washer");
  assert.equal(parseLabel(["DISHWASHER"], NOW).type?.value.type, "dishwasher");
  assert.equal(parseLabel(["REFRIGERATOR-FREEZER"], NOW).type?.value.type, "refrigerator");
  assert.equal(parseLabel(["AIR CONDITIONER", "3 TON"], NOW).type?.value.type, "hvac_system");
  const weak = parseLabel(["50 GALLONS"], NOW).type?.value;
  assert.deepEqual([weak?.type, weak?.basis], ["water_heater", "weak"]);
  const tons = parseLabel(["COOLING 3 TON"], NOW).type?.value;
  assert.deepEqual([tons?.type, tons?.basis], ["hvac_system", "weak"]);
  const byBrand = parseLabel(["Bradford White"], NOW).type?.value;
  assert.deepEqual([byBrand?.type, byBrand?.basis], ["water_heater", "brand"]);
  assert.equal(parseLabel(["Samsung"], NOW).type, undefined);
});

test("filter size", () => {
  const p = parseLabel(["FILTER SIZE 16X25X1", "MODEL TEST1234"], NOW);
  assert.equal(p.filterSize?.value.text, "16x25x1");
  assert.equal(p.filterSize?.value.labelled, true);
  assert.equal(parseLabel(["Filter: 20 x 20 x 4"], NOW).filterSize?.value.depth, 4);
  assert.equal(parseLabel(["DIMENSIONS 120x240x60"], NOW).filterSize, undefined);
});

test("printed manufacture date formats", () => {
  const f = (line: string) => {
    const d = parseLabel([line], NOW).printedDate?.value;
    return d ? [d.year, d.month] : undefined;
  };
  assert.deepEqual(f("MFG DATE 03/2014"), [2014, 3]);
  assert.deepEqual(f("MFG. DATE: 03-14"), [2014, 3]);
  assert.deepEqual(f("DATE OF MANUFACTURE: 2014-03"), [2014, 3]);
  assert.deepEqual(f("MFD MAR 2014"), [2014, 3]);
  assert.deepEqual(f("Date of Manufacture: March 2014"), [2014, 3]);
  assert.deepEqual(f("MFD: 11/05/2012"), [2012, 11]);
  assert.deepEqual(f("MFG DATE 0I/2O14"), [2014, 1]);
  assert.deepEqual(f("MFG DATE MAR-14"), [2014, 3]);
  assert.deepEqual(f("MFG DATE: 98-07"), [1998, 7]);
  assert.deepEqual(f("MFD 2011"), [2011, undefined]);
});

test("printed date: ambiguous, future, unlabelled and install dates are not trusted blindly", () => {
  assert.equal(parseLabel(["MFG DATE 05-11"], NOW).printedDate?.value.ambiguous, true);
  assert.equal(parseLabel(["MFG DATE 03/2031"], NOW).printedDate, undefined);
  assert.equal(parseLabel(["03/2014"], NOW).printedDate, undefined);
  assert.equal(parseLabel(["MADE IN MEXICO"], NOW).printedDate, undefined);
  assert.equal(parseLabel(["INSTALL DATE 03/2014"], NOW).printedDate, undefined);
});

test("date on the line after a lone label", () => {
  assert.deepEqual(
    [parseLabel(["DATE OF MANUFACTURE", "09/2019"], NOW).printedDate?.value.year],
    [2019],
  );
});

test("junk, empty and hostile input never throws and yields nothing", () => {
  for (const input of [[], [""], ["   "], ["@@@@ ####", "\u0000\u0001", "x".repeat(5000)], ["MODEL", "SERIAL", "MFG DATE"]]) {
    const p = parseLabel(input, NOW);
    assert.equal(p.brand, undefined);
    assert.equal(p.model, undefined);
    assert.equal(p.serial, undefined);
    assert.equal(p.printedDate, undefined);
  }
  assert.doesNotThrow(() => parseLabel([null as unknown as string, 5 as unknown as string], NOW));
});

test("junk lines mixed with real ones", () => {
  const p = parseLabel(
    ["~~ |", "WARNING: DO NOT STORE FLAMMABLE", "A.O.SMITH", "MODEL: GCV-40", "I=I", "SERIAL: 1214M123456", "ASSEMBLED IN USA"],
    NOW,
  );
  assert.equal(p.brand?.value.id, "aosmith");
  assert.equal(p.model?.value, "GCV-40");
  assert.equal(p.serial?.value, "1214M123456");
});
