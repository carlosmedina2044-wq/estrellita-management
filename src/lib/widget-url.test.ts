import assert from "node:assert/strict";
import { test } from "node:test";
import { isCuidalaTodayUrl, parseCuidalaUrl } from "@/lib/widget-url";

test("isCuidalaTodayUrl accepts the widget scheme", () => {
  assert.equal(isCuidalaTodayUrl("cuidala://today"), true);
  assert.equal(isCuidalaTodayUrl("cuidala://today/"), true);
  assert.equal(isCuidalaTodayUrl("cuidala://restock"), false);
  assert.equal(isCuidalaTodayUrl("https://cuidala.app/today"), false);
});

test("parseCuidalaUrl reads today, scan, room and appliance links", () => {
  assert.deepEqual(parseCuidalaUrl("cuidala://today"), { kind: "today" });
  assert.deepEqual(parseCuidalaUrl("cuidala://scan"), { kind: "scan" });
  assert.deepEqual(parseCuidalaUrl("cuidala://scan/"), { kind: "scan" });
  assert.deepEqual(parseCuidalaUrl("cuidala://power-hour"), { kind: "power-hour" });
  assert.deepEqual(parseCuidalaUrl("cuidala://POWER-HOUR/"), { kind: "power-hour" });
  assert.deepEqual(parseCuidalaUrl("cuidala://room/kitchen"), { kind: "room", id: "kitchen" });
  assert.deepEqual(parseCuidalaUrl("cuidala://room/room%20one"), { kind: "room", id: "room one" });
  assert.deepEqual(parseCuidalaUrl("cuidala://appliance/a-1?x=1"), { kind: "appliance", id: "a-1" });
});

test("parseCuidalaUrl rejects anything else", () => {
  assert.equal(parseCuidalaUrl("cuidala://room"), null);
  assert.equal(parseCuidalaUrl("cuidala://room/a/b"), null);
  assert.equal(parseCuidalaUrl("cuidala://restock"), null);
  assert.equal(parseCuidalaUrl("cuidala://power-hour/x"), null);
  assert.equal(parseCuidalaUrl("https://cuidala.app/scan"), null);
  assert.equal(parseCuidalaUrl("cuidala://room/%E0%A4%A"), null);
});
