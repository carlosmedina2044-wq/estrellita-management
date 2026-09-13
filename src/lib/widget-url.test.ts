import assert from "node:assert/strict";
import { test } from "node:test";
import { isCuidalaTodayUrl } from "@/lib/widget-url";

test("isCuidalaTodayUrl accepts the widget scheme", () => {
  assert.equal(isCuidalaTodayUrl("cuidala://today"), true);
  assert.equal(isCuidalaTodayUrl("cuidala://today/"), true);
  assert.equal(isCuidalaTodayUrl("cuidala://restock"), false);
  assert.equal(isCuidalaTodayUrl("https://cuidala.app/today"), false);
});
