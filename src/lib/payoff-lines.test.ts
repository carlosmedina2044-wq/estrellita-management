import assert from "node:assert/strict";
import { test } from "node:test";
import en from "@/i18n/messages/en.json";
import { ILLUSTRATIONS } from "@/lib/illustrations";
import { payoffArtFor, payoffKeyFor } from "@/lib/payoff-lines";

test("payoffKeyFor is quarterly/yearly only and keys exist", () => {
  assert.equal(payoffKeyFor({ title: "Anything", frequency: "weekly" }), null);
  const key = payoffKeyFor({ title: "Water heater flush", frequency: "quarterly" });
  assert.equal(key, "payoff.waterHeater");
  assert.ok(key && key in en);
});

test("payoffArtFor returns known illustrations", () => {
  const art = payoffArtFor({ title: "Water heater flush", frequency: "yearly" });
  assert.equal(art, "sys-water-heater");
  assert.ok(art && art in ILLUSTRATIONS);
});
