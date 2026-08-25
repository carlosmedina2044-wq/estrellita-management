import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_ATTRIBUTES } from "@/lib/household-defaults";
import {
  matchingPlaybooks,
  monthInWindow,
  PLAYBOOK_CONTENT_VERSION,
  PLAYBOOKS,
  playbookApplies,
  playbookProgress,
  seasonYearFor,
  seasonalTimeline,
  windowFor,
  windowState,
} from "@/lib/playbooks";
import {
  conditionHits,
  evaluateTriggers,
  onCooldown,
  weatherWatch,
  WEATHER_TRIGGERS,
  type WeatherForecast,
} from "@/lib/weather/provider";
import type { Duty, Household } from "@/lib/types";
import { withHouseholdDefaults } from "@/lib/household-defaults";

function home(partial: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 8,
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

test("playbooks JSON has a contentVersion and dust-season HVAC", () => {
  assert.ok(PLAYBOOK_CONTENT_VERSION.length > 0);
  assert.ok(PLAYBOOKS.some((item) => item.id === "hot-arid-dust-hvac"));
  assert.ok(PLAYBOOKS.some((item) => item.tasks.some((task) => /drip/i.test(task.title))));
  assert.equal(
    WEATHER_TRIGGERS.some((item) => item.id === "poor-air" || item.id === "dust-advisory"),
    false,
  );
});

function stubDuty(partial: Pick<Duty, "id" | "title"> & Partial<Duty>): Duty {
  return {
    notes: "",
    room: "whole-home",
    nodeId: "home",
    nodeType: "home",
    audience: "me",
    effort: "medium",
    frequency: "once",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate: "2026-08-01",
    priority: "medium",
    createdAt: "2026-04-01T00:00:00.000Z",
    archived: false,
    ...partial,
  };
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
    matchingPlaybooks(home({ location: { climateZone: "mixed" } }), new Date(2026, 7, 1)).some(
      (item) => item.playbook.id === "new-home",
    ),
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
  const matched = matchingPlaybooks(declined, new Date(year, 7, 1)).find((item) => item.playbook.id === "new-home");
  assert.ok(matched);
  const decision = declined.playbookDecisions.find((item) => item.playbookId === "new-home");
  assert.deepEqual(decision?.declinedTaskKeys, ["Change or rekey the exterior locks."]);
  const remaining = matched.playbook.tasks.filter((task) => !decision?.declinedTaskKeys.includes(task.title));
  assert.equal(remaining.some((task) => task.title === "Change or rekey the exterior locks."), false);
  assert.ok(remaining.length > 0);
});

test("Tucson-area home surfaces monsoon and pre-summer AC", () => {
  const tucson = home({
    location: { lat: 32.22, lng: -110.97, postalCode: "85701", climateZone: "hot-arid" },
    attributes: { ...DEFAULT_ATTRIBUTES, hasYard: true, hasIrrigation: true },
  });
  const april = matchingPlaybooks(tucson, new Date(2026, 3, 15));
  const june = matchingPlaybooks(tucson, new Date(2026, 5, 15));
  assert.ok(april.some((item) => item.playbook.id === "hot-arid-presummer"));
  assert.ok(june.some((item) => item.playbook.id === "hot-arid-monsoon"));
});

test("Minneapolis home surfaces winterization and not monsoon", () => {
  const mpls = home({
    location: { lat: 44.98, lng: -93.27, postalCode: "55401", climateZone: "cold" },
    attributes: { ...DEFAULT_ATTRIBUTES, hasGutters: true, hasFireplace: true, hasBasement: true },
  });
  const october = matchingPlaybooks(mpls, new Date(2026, 9, 15));
  assert.ok(october.some((item) => item.playbook.id === "cold-winterize"));
  assert.ok(!october.some((item) => item.playbook.id.includes("monsoon")));
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

test("windowFor defaults wrap around the year", () => {
  assert.deepEqual(windowFor({ id: "a", name: "A", season: "spring", climateZones: "all", triggerMonth: 4, tasks: [] }), {
    early: 3,
    ideal: 4,
    late: 6,
  });
  assert.deepEqual(windowFor({ id: "b", name: "B", season: "winter", climateZones: "all", triggerMonth: 1, tasks: [] }), {
    early: 12,
    ideal: 1,
    late: 3,
  });
  assert.deepEqual(
    windowFor({
      id: "c",
      name: "C",
      season: "winter",
      climateZones: "all",
      triggerMonth: 11,
      lateMonth: 1,
      tasks: [],
    }),
    { early: 10, ideal: 11, late: 1 },
  );
});

test("monthInWindow handles wrapped windows", () => {
  const window = { early: 10, ideal: 11, late: 1 };
  assert.equal(monthInWindow(10, window), true);
  assert.equal(monthInWindow(11, window), true);
  assert.equal(monthInWindow(12, window), true);
  assert.equal(monthInWindow(1, window), true);
  assert.equal(monthInWindow(2, window), false);
  assert.equal(monthInWindow(9, window), false);
});

test("windowState walks get-ahead, ideal, late, and closed", () => {
  const presummer = PLAYBOOKS.find((item) => item.id === "hot-arid-presummer");
  assert.ok(presummer);
  assert.equal(windowState(presummer, 2), "get_ahead");
  assert.equal(windowState(presummer, 3), "get_ahead");
  assert.equal(windowState(presummer, 4), "ideal");
  assert.equal(windowState(presummer, 5), "late");
  assert.equal(windowState(presummer, 6), "late");
  assert.equal(windowState(presummer, 7), "closed");

  const coolerWinter = PLAYBOOKS.find((item) => item.id === "hot-arid-cooler-winter");
  assert.ok(coolerWinter);
  assert.equal(windowState(coolerWinter, 10), "get_ahead");
  assert.equal(windowState(coolerWinter, 11), "ideal");
  assert.equal(windowState(coolerWinter, 12), "late");
  assert.equal(windowState(coolerWinter, 1), "late");
  assert.equal(windowState(coolerWinter, 2), "closed");
});

test("seasonYearFor uses the year the wrapped window opened", () => {
  const coolerWinter = PLAYBOOKS.find((item) => item.id === "hot-arid-cooler-winter");
  const presummer = PLAYBOOKS.find((item) => item.id === "hot-arid-presummer");
  assert.ok(coolerWinter);
  assert.ok(presummer);
  assert.equal(seasonYearFor(coolerWinter, new Date(2027, 0, 15)), 2026);
  assert.equal(seasonYearFor(coolerWinter, new Date(2026, 10, 15)), 2026);
  assert.equal(seasonYearFor(presummer, new Date(2026, 4, 15)), 2026);
  assert.equal(seasonYearFor(presummer, new Date(2027, 0, 15)), 2027);
});

test("matchingPlaybooks returns late playbooks until the window closes", () => {
  const tucson = home({
    location: { lat: 32.22, lng: -110.97, postalCode: "85701", climateZone: "hot-arid" },
  });
  const may = matchingPlaybooks(tucson, new Date(2026, 4, 15));
  const presummer = may.find((item) => item.playbook.id === "hot-arid-presummer");
  assert.ok(presummer);
  assert.equal(presummer.state, "late");
  const july = matchingPlaybooks(tucson, new Date(2026, 6, 15));
  assert.equal(
    july.some((item) => item.playbook.id === "hot-arid-presummer"),
    false,
  );
});

test("matchingPlaybooks hides a declined playbook for its season year", () => {
  const tucson = home({
    location: { lat: 32.22, lng: -110.97, postalCode: "85701", climateZone: "hot-arid" },
    attributes: { ...DEFAULT_ATTRIBUTES, hasEvaporativeCooler: true },
    playbookDecisions: [{ playbookId: "hot-arid-cooler-winter", year: 2026, declinedTaskKeys: ["*"], disabled: true }],
  });
  const matched = matchingPlaybooks(tucson, new Date(2027, 0, 15));
  assert.equal(
    matched.some((item) => item.playbook.id === "hot-arid-cooler-winter"),
    false,
  );
});

test("playbookProgress counts completions and names the next undone duty", () => {
  const household = home({
    duties: [
      stubDuty({ id: "d1", title: "First", playbookId: "hot-arid-presummer" }),
      stubDuty({ id: "d2", title: "Second", playbookId: "hot-arid-presummer" }),
      stubDuty({ id: "d3", title: "Third", playbookId: "hot-arid-presummer" }),
    ],
    completions: [
      { id: "c1", dutyId: "d1", actor: "me", visitId: null, completedAt: "2026-04-02T00:00:00.000Z" },
      { id: "c2", dutyId: "d2", actor: "me", visitId: null, completedAt: "2026-04-03T00:00:00.000Z" },
    ],
  });
  assert.deepEqual(playbookProgress(household, "hot-arid-presummer", 2026), {
    done: 2,
    total: 3,
    nextTitle: "Third",
  });
});

test("seasonalTimeline rolls 12 months and places playbooks on their ideal month", () => {
  const duties = [
    stubDuty({
      id: "d1",
      title: "Service the AC and replace the filter",
      playbookId: "hot-arid-presummer",
      createdAt: "2027-04-01T00:00:00.000Z",
    }),
  ];
  const tucson = home({
    location: { lat: 32.22, lng: -110.97, postalCode: "85701", climateZone: "hot-arid" },
    attributes: { ...DEFAULT_ATTRIBUTES, hasGutters: true },
    playbookDecisions: [{ playbookId: "hot-arid-presummer", year: 2027, declinedTaskKeys: [] }],
    duties,
    completions: [{ id: "c1", dutyId: "d1", actor: "me", visitId: null, completedAt: "2026-04-10T00:00:00.000Z" }],
  });
  const timeline = seasonalTimeline(tucson, new Date(2026, 7, 15));
  assert.equal(timeline[0]?.month, 8);
  const apr = timeline.find((row) => row.month === 4 && row.year === 2027);
  assert.ok(apr?.entries.some((entry) => entry.playbook.id === "hot-arid-presummer" && entry.state === "done"));
  const jun = timeline.find((row) => row.month === 6 && row.year === 2027);
  assert.ok(jun?.entries.some((entry) => entry.playbook.id === "hot-arid-monsoon"));
  const oct = timeline.find((row) => row.month === 10 && row.year === 2026);
  assert.ok(oct?.entries.some((entry) => entry.playbook.id === "hot-arid-post-monsoon"));
});

test("weatherWatch lists a freeze hit and drops requires-gated triggers", () => {
  const forecast: WeatherForecast = {
    fetchedAt: "2026-01-01T00:00:00.000Z",
    days: [
      { date: "2026-01-01", tempMinF: 40, tempMaxF: 55, windMph: 5, precipIn: 0 },
      { date: "2026-01-02", tempMinF: 24, tempMaxF: 38, windMph: 5, precipIn: 0 },
    ],
  };
  const now = new Date(2026, 0, 1);
  const result = weatherWatch(forecast, home({ attributes: { ...DEFAULT_ATTRIBUTES, hasPool: false } }), now);
  assert.ok(result.active.some((item) => item.trigger.id === "hard-freeze" && item.hitDay?.date === "2026-01-02"));
  const gated = WEATHER_TRIGGERS.filter((trigger) => trigger.requires && Object.keys(trigger.requires).length > 0);
  for (const trigger of gated) {
    assert.equal(result.watching.includes(trigger.name), false);
  }
  assert.ok(result.watching.includes("Hard freeze"));
  assert.ok(result.watching.includes("Heat wave"));
});
