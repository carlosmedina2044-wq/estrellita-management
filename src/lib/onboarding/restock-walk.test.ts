import assert from "node:assert/strict";
import { test } from "node:test";
import { climatePayoff } from "@/lib/climate-payoff";
import { DEFAULT_ATTRIBUTES } from "@/lib/household-defaults";
import { generateHomeFromAnswers, sampleHomeAnswers } from "@/lib/onboarding/generate";
import { applyRestockPicks, SAMPLE_RESTOCK_PICKS } from "@/lib/onboarding/restock-walk";
import { withHouseholdDefaults } from "@/lib/household-defaults";

test("Tucson ZIP payoff names monsoon and pre-summer AC", () => {
  const payoff = climatePayoff(
    { postalCode: "85701", lat: 32.22, lng: -110.97, placeName: "Tucson", climateZone: "hot-arid" },
    { ...DEFAULT_ATTRIBUTES, hasYard: true, hasIrrigation: true, hasGutters: true },
  );
  assert.match(payoff.headline, /Tucson/);
  assert.ok(payoff.beats.some((beat) => /AC|filter/i.test(beat)));
  assert.ok(payoff.beats.some((beat) => /roof|monsoon|drainage/i.test(beat)));
});

test("walk-your-house picks seed Restock without duplicating", () => {
  const generated = generateHomeFromAnswers(sampleHomeAnswers(), new Date(2026, 5, 1));
  const household = withHouseholdDefaults({
    version: 7,
    householdName: generated.householdName,
    ownerName: "",
    cleanerName: "Cleaner",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: generated.homeId,
    homeType: generated.homeType,
    location: generated.location,
    attributes: generated.attributes,
    floors: generated.floors,
    rooms: generated.rooms,
    assets: generated.assets,
    consumables: generated.consumables,
    duties: generated.duties,
    completions: [],
    visits: [],
    supplyAutomations: [],
  });
  const once = applyRestockPicks(household, SAMPLE_RESTOCK_PICKS, new Date(2026, 5, 1));
  assert.ok(once.supplyAutomations.length >= 5);
  assert.ok(once.supplyAutomations.some((item) => /HVAC filter/i.test(item.itemName)));
  const twice = applyRestockPicks(once, SAMPLE_RESTOCK_PICKS, new Date(2026, 5, 1));
  assert.equal(twice.supplyAutomations.length, once.supplyAutomations.length);
});
