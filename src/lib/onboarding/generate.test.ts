import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, startOfDay } from "@/lib/dates";
import { nextDueDate, todaysOpenDuties } from "@/lib/duties";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { dutyTopic } from "@/lib/duty-topics";
import { generateHomeFromAnswers, sampleHomeAnswers, seedDutiesForHome, sizeDefaults } from "@/lib/onboarding/generate";
import { roomTemplateFor } from "@/lib/onboarding/rooms";
import { PLAYBOOKS } from "@/lib/playbooks";
import starterSeed from "@/lib/onboarding/starter-chores.json";
import type { Household } from "@/lib/types";

const DAY_ONE_TITLES = ["Tidy the living room", "Wipe kitchen counters", "Take out trash and recycling"];

function seededHousehold(now: Date): Household {
  const generated = generateHomeFromAnswers(sampleHomeAnswers(), now);
  return withHouseholdDefaults({
    version: 8,
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
}

function assertStarterDayOne(now: Date) {
  const home = seededHousehold(now);
  const openTitles = todaysOpenDuties(home, now).map((duty) => duty.title).sort();
  assert.deepEqual(openTitles, [...DAY_ONE_TITLES].sort());

  for (const duty of home.duties.filter((item) => item.frequency === "quarterly")) {
    const next = nextDueDate(duty, [], now);
    assert.ok(next);
    assert.ok(startOfDay(next) > startOfDay(addDays(now, 14)));
  }

  const byTitle = Object.fromEntries(starterSeed.map((item) => [item.title, item]));
  for (const duty of home.duties.filter((item) => item.frequency === "weekly")) {
    const starter = byTitle[duty.title];
    assert.ok(starter);
    assert.equal(duty.weekday, (now.getDay() + starter.firstDueInDays) % 7);
  }
}

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
  assert.ok(generated.seasonalSuggestions.some((item) => item.playbook.id === "new-home"));
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
  assert.equal(generated.seasonalSuggestions.some((item) => item.playbook.id === "new-home"), false);
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
  assert.ok(generated.duties.some((duty) => duty.title === "Tidy the living room"));
  assert.ok(generated.duties.some((duty) => duty.title === "Take out trash and recycling"));
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

test("pool and evaporative cooler extras survive when rooms are also set", () => {
  const generated = generateHomeFromAnswers({
    homeType: "house",
    location: {},
    nickname: "Home",
    rooms: roomTemplateFor("house"),
    features: ["hasPool", "hasEvaporativeCooler"],
  });
  assert.equal(generated.attributes.hasPool, true);
  assert.equal(generated.attributes.hasEvaporativeCooler, true);
  assert.ok(generated.assets.some((asset) => asset.type === "pool_pump"));
  assert.ok(generated.assets.some((asset) => asset.type === "evaporative_cooler"));
});

test("starter seed day-one list is exact on Wednesday", () => {
  const now = new Date(2026, 8, 16);
  assert.equal(now.getDay(), 3);
  assertStarterDayOne(now);
});

test("starter seed day-one list is exact on Sunday", () => {
  const now = new Date(2026, 8, 13);
  assert.equal(now.getDay(), 0);
  assertStarterDayOne(now);
});

test("starter seed day-one list is exact on Saturday", () => {
  const now = new Date(2026, 8, 12);
  assert.equal(now.getDay(), 6);
  assertStarterDayOne(now);
});

test("sample home has no duplicate topics or titles on day one", () => {
  const now = new Date(2026, 8, 13);
  const generated = generateHomeFromAnswers(sampleHomeAnswers(), now);
  const duties = seedDutiesForHome(generated, now);
  const titles = duties.map((duty) => duty.title);
  assert.equal(new Set(titles).size, titles.length);
  const topics = duties.map((duty) => dutyTopic(duty)).filter((topic): topic is string => Boolean(topic));
  assert.equal(new Set(topics).size, topics.length);
  assert.equal(duties.some((duty) => duty.title === "Test smoke and CO detectors"), false);
  assert.equal(duties.some((duty) => duty.title === "Clean refrigerator coils"), false);
  assert.ok(duties.some((duty) => duty.title === "Flush the water heater"));
  assert.ok(duties.some((duty) => duty.title === "Test GFCI outlets"));
});

test("onboarding seeds only the year-round playbooks, never monthly windows", () => {
  const now = new Date(2026, 8, 17);
  const generated = generateHomeFromAnswers(sampleHomeAnswers(), now);
  const duties = seedDutiesForHome(generated, now);
  const seededPlaybooks = new Set(duties.map((duty) => duty.playbookId).filter(Boolean));
  for (const id of seededPlaybooks) {
    const playbook = PLAYBOOKS.find((item) => item.id === id);
    assert.ok(playbook, `unknown playbook ${id}`);
    assert.equal(playbook?.season, "any", `${id} was seeded but has a monthly window`);
  }
  assert.ok(seededPlaybooks.has("all-safety"));
});

