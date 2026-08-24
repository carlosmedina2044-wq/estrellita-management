import assert from "node:assert/strict";
import { test } from "node:test";
import { generateHomeFromAnswers, sampleHomeAnswers, sizeDefaults } from "@/lib/onboarding/generate";
import { roomTemplateFor } from "@/lib/onboarding/rooms";

test("onboarding carries tenure through generate", () => {
  const generated = generateHomeFromAnswers(
    {
      homeType: "house",
      tenure: "new",
      location: { postalCode: "85701", lat: 32.22, lng: -110.97 },
      nickname: "Home",
      ...sizeDefaults("house"),
      features: ["hasGarage", "hasYard", "hasIrrigation", "hasLaundry", "hasGutters"],
      ages: {},
    },
    new Date(2026, 5, 1),
  );
  assert.equal(generated.tenure, "new");
  assert.ok(generated.seasonalSuggestions.some((item) => item.id === "new-home"));
});

test("settled tenure does not surface the new-home playbook", () => {
  const generated = generateHomeFromAnswers(
    {
      homeType: "house",
      tenure: "settled",
      location: { postalCode: "85701" },
      nickname: "Home",
      ...sizeDefaults("house"),
      features: ["hasLaundry"],
      ages: {},
    },
    new Date(2026, 5, 1),
  );
  assert.equal(generated.tenure, "settled");
  assert.equal(generated.seasonalSuggestions.some((item) => item.id === "new-home"), false);
});

test("defaults accepted produce rooms, chores, and a seasonal suggestion", () => {
  const generated = generateHomeFromAnswers(
    {
      homeType: "house",
      location: { postalCode: "85701", lat: 32.22, lng: -110.97 },
      nickname: "Home",
      ...sizeDefaults("house"),
      features: ["hasGarage", "hasYard", "hasIrrigation", "hasLaundry", "hasGutters"],
      ages: {
        hvac_system: "unsure",
        water_heater: "unsure",
        refrigerator: "unsure",
        washer: "unsure",
        dishwasher: "unsure",
      },
    },
    new Date(2026, 5, 1),
  );
  assert.ok(generated.rooms.some((room) => room.type === "kitchen"));
  assert.ok(generated.assets.some((asset) => asset.type === "hvac_system"));
  assert.ok(generated.duties.length > 0);
  assert.ok(generated.seasonalSuggestions.length > 0);
  assert.equal(generated.assets.find((asset) => asset.type === "hvac_system")?.installDate, undefined);
});

test("skipping location still builds a valid home", () => {
  const generated = generateHomeFromAnswers({
    homeType: "condo",
    location: {},
    nickname: "Home",
    ...sizeDefaults("condo"),
    features: ["hasLaundry"],
    ages: {},
  });
  assert.ok(generated.rooms.length >= 3);
  assert.equal(generated.location.climateZone, "mixed");
});

test("sample home is a 2-bed house with chores and no uploads", () => {
  const generated = generateHomeFromAnswers(sampleHomeAnswers(), new Date(2026, 5, 1));
  const userRooms = generated.rooms.filter((room) => !room.system);
  assert.equal(generated.homeType, "house");
  assert.ok(userRooms.some((room) => room.type === "primary_bedroom"));
  assert.ok(userRooms.filter((room) => room.type === "bedroom" || room.type === "primary_bedroom").length >= 2);
  assert.ok(generated.duties.some((duty) => duty.title === "Clean bathrooms"));
  assert.ok(generated.duties.some((duty) => duty.title === "Check bathroom caulk"));
  assert.ok(generated.duties.some((duty) => duty.title === "Replace HVAC filter"));
});

test("apartment template starts with balcony off and no garage", () => {
  const rooms = roomTemplateFor("apartment");
  assert.equal(rooms.find((room) => room.name === "Balcony")?.enabled, false);
  assert.equal(rooms.some((room) => room.type === "garage"), false);
  const generated = generateHomeFromAnswers({
    homeType: "apartment",
    location: {},
    nickname: "Home",
    rooms,
  });
  assert.equal(generated.attributes.hasGarage, false);
  assert.ok(generated.rooms.some((room) => room.type === "kitchen" && !room.system));
});
