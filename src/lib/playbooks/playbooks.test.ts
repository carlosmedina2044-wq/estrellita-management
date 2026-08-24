import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_ATTRIBUTES } from "@/lib/household-defaults";
import { matchingPlaybooks, playbookApplies, PLAYBOOKS } from "@/lib/playbooks";
import { conditionHits, evaluateTriggers, onCooldown, type WeatherForecast } from "@/lib/weather/provider";
import { WEATHER_TRIGGERS } from "@/lib/weather/provider";
import type { Household } from "@/lib/types";
import { withHouseholdDefaults } from "@/lib/household-defaults";

function home(partial: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 7,
    householdName: "Test",
    ownerName: "Me",
    cleanerName: "Cleaner",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [],
    rooms: [],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...partial,
  });
}

test("tenure-gated playbook only applies when tenure is new", () => {
  const playbook = PLAYBOOKS.find((item) => item.id === "new-home");
  assert.ok(playbook);
  assert.equal(playbookApplies(playbook, home({ tenure: "new" })), true);
  assert.equal(playbookApplies(playbook, home({ tenure: "settled" })), false);
  assert.equal(playbookApplies(playbook, home({ tenure: "longtime" })), false);
});

test("old vault with no tenure does not get the new-home playbook", () => {
  const playbook = PLAYBOOKS.find((item) => item.id === "new-home");
  assert.ok(playbook);
  assert.equal(playbookApplies(playbook, home()), false);
  assert.equal(
    matchingPlaybooks(home({ location: { climateZone: "mixed" } }), 8).some((item) => item.id === "new-home"),
    false,
  );
  assert.equal(
    playbookApplies(
      { id: "all-safety", name: "Safety", season: "any", climateZones: "all", tasks: [] },
      home(),
    ),
    true,
  );
});

test("declining individual new-home tasks persists like any other playbook", () => {
  const year = new Date().getFullYear();
  const declined = home({
    tenure: "new",
    playbookDecisions: [
      {
        playbookId: "new-home",
        year,
        declinedTaskKeys: ["Change or rekey the exterior locks."],
      },
    ],
  });
  const matched = matchingPlaybooks(declined, 8).find((item) => item.id === "new-home");
  assert.ok(matched);
  const decision = declined.playbookDecisions.find((item) => item.playbookId === "new-home");
  assert.deepEqual(decision?.declinedTaskKeys, ["Change or rekey the exterior locks."]);
  const remaining = matched.tasks.filter((task) => !decision?.declinedTaskKeys.includes(task.title));
  assert.equal(remaining.some((task) => task.title === "Change or rekey the exterior locks."), false);
  assert.ok(remaining.length > 0);
});

test("Tucson-area home surfaces monsoon and pre-summer AC", () => {
  const tucson = home({
    location: { lat: 32.22, lng: -110.97, postalCode: "85701", climateZone: "hot-arid" },
    attributes: { ...DEFAULT_ATTRIBUTES, hasYard: true, hasIrrigation: true },
  });
  const april = matchingPlaybooks(tucson, 4);
  const june = matchingPlaybooks(tucson, 6);
  assert.ok(april.some((item) => item.id === "hot-arid-presummer"));
  assert.ok(june.some((item) => item.id === "hot-arid-monsoon"));
});

test("Minneapolis home surfaces winterization and not monsoon", () => {
  const mpls = home({
    location: { lat: 44.98, lng: -93.27, postalCode: "55401", climateZone: "cold" },
    attributes: { ...DEFAULT_ATTRIBUTES, hasGutters: true, hasFireplace: true, hasBasement: true },
  });
  const october = matchingPlaybooks(mpls, 10);
  assert.ok(october.some((item) => item.id === "cold-winterize"));
  assert.ok(!october.some((item) => item.id.includes("monsoon")));
  assert.equal(
    playbookApplies(
      { id: "hot-arid-monsoon", name: "Monsoon", season: "monsoon", climateZones: ["hot-arid"], tasks: [] },
      mpls,
    ),
    false,
  );
});

test("hasPool toggle gates pool-related requires", () => {
  const playbook = {
    id: "pool",
    name: "Pool",
    season: "summer" as const,
    climateZones: "all" as const,
    requires: { hasPool: true },
    tasks: [],
  };
  const off = home({ attributes: { ...DEFAULT_ATTRIBUTES, hasPool: false } });
  const on = home({ attributes: { ...DEFAULT_ATTRIBUTES, hasPool: true } });
  assert.equal(playbookApplies(playbook, off), false);
  assert.equal(playbookApplies(playbook, on), true);
});

test("freeze trigger creates tasks once and respects cooldown", () => {
  const freeze = WEATHER_TRIGGERS.find((item) => item.id === "hard-freeze");
  assert.ok(freeze);
  const forecast: WeatherForecast = {
    fetchedAt: "2026-01-01T00:00:00.000Z",
    days: [
      { date: "2026-01-01", tempMinF: 25, tempMaxF: 40, windMph: 5, precipIn: 0 },
      { date: "2026-01-02", tempMinF: 24, tempMaxF: 38, windMph: 5, precipIn: 0 },
    ],
  };
  const now = new Date(2026, 0, 1);
  assert.ok(conditionHits(freeze, forecast, now));
  const first = evaluateTriggers(home(), forecast, now);
  assert.ok(first.duties.length > 0);
  assert.equal(first.fires[0]?.triggerId, "hard-freeze");
  const again = evaluateTriggers(
    home({
      duties: first.duties.map((duty, index) => ({
        ...duty,
        id: `d${index}`,
        createdAt: now.toISOString(),
      })),
      weatherFires: first.fires,
    }),
    forecast,
    now,
  );
  assert.equal(again.duties.length, 0);
  assert.equal(onCooldown(freeze, first.fires, now), true);
});

test("firing twice with the same weatherFires state appends nothing", () => {
  const forecast: WeatherForecast = {
    fetchedAt: "2026-01-01T00:00:00.000Z",
    days: [
      { date: "2026-01-01", tempMinF: 25, tempMaxF: 40, windMph: 5, precipIn: 0 },
      { date: "2026-01-02", tempMinF: 24, tempMaxF: 38, windMph: 5, precipIn: 0 },
    ],
  };
  const now = new Date(2026, 0, 1);
  const first = evaluateTriggers(home(), forecast, now);
  assert.ok(first.fires.length > 0);
  const second = evaluateTriggers(home({ weatherFires: first.fires }), forecast, now);
  assert.equal(second.duties.length, 0);
  assert.equal(second.fires.length, 0);
});
