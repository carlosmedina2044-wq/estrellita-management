import assert from "node:assert/strict";
import { test } from "node:test";
import { setActiveAppLocale } from "@/i18n";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { Household } from "@/lib/types";
import { roundCoord } from "@/lib/climate";
import { weatherWatchList } from "@/lib/weather/watch";

function home(partial: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 8,
    householdName: "Casa",
    ownerName: "",
    cleanerName: "",
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

test("a home without coordinates publishes no watch list", () => {
  assert.equal(weatherWatchList(home({ location: { postalCode: "85701" } })), null);
});

test("a cold-zone home watches the deep freeze with its zone threshold and never the hard freeze", () => {
  setActiveAppLocale("en");
  // Minneapolis: cold zone.
  const watch = weatherWatchList(home({ location: { lat: 44.9778, lng: -93.265 } }));
  assert.ok(watch);
  const ids = watch!.entries.map((entry) => entry.id);
  assert.ok(ids.includes("deep-freeze"));
  assert.ok(!ids.includes("hard-freeze"));
  const heat = watch!.entries.find((entry) => entry.id === "heat-wave")!;
  assert.equal(heat.value, 95);
  assert.equal(heat.metric, "tempMaxF");
  assert.equal(heat.op, ">");
  assert.match(heat.title, /Heat wave/);
  assert.match(heat.body, /filter|shades/i);
  // Rounded to two decimals, never the raw coordinate.
  assert.equal(watch!.latitude, roundCoord(44.9778));
  assert.equal(watch!.longitude, roundCoord(-93.265));
  assert.notEqual(watch!.latitude, 44.9778);
});

test("private mode carries generic copy and no trigger names", () => {
  setActiveAppLocale("en");
  const watch = weatherWatchList(
    home({
      location: { lat: 33.4484, lng: -112.074 },
      restockDigest: { enabled: true, weekday: 0, hour: 9, lastSentOn: null, permissionAsked: true, privateNotifications: true },
    }),
  );
  assert.ok(watch);
  for (const entry of watch!.entries) {
    assert.equal(entry.title, "Weather this week");
    assert.doesNotMatch(entry.body, /freeze|heat|wind|rain/i);
  }
});
