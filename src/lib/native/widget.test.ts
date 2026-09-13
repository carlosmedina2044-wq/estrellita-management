import assert from "node:assert/strict";
import { test } from "node:test";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { clearWidgetSnapshot, syncWidgetSnapshot } from "@/lib/native/widget";
import type { Household } from "@/lib/types";

function household(): Household {
  return withHouseholdDefaults({
    version: 8,
    householdName: "Casa",
    ownerName: "Me",
    cleanerName: "Ana",
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
  });
}

test("syncWidgetSnapshot and clearWidgetSnapshot are no-ops off native", async () => {
  await assert.doesNotReject(() => syncWidgetSnapshot(household(), new Date(2026, 8, 13)));
  await assert.doesNotReject(() => clearWidgetSnapshot());
});
