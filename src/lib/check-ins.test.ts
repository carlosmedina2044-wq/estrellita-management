import assert from "node:assert/strict";
import { test } from "node:test";
import { CHECK_IN_LIMIT, checkInsInYear, hasCheckedInToday, recordCheckIn } from "@/lib/check-ins";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { Household } from "@/lib/types";

function home(checkIns?: string[]): Household {
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
    ...(checkIns ? { checkIns } : {}),
  });
}

test("a check-in is recorded once per day and counted per year", () => {
  const now = new Date(2026, 8, 17, 9);
  const first = recordCheckIn(home(), now);
  assert.deepEqual(first.checkIns, ["2026-09-17"]);
  assert.equal(hasCheckedInToday(first, now), true);
  assert.equal(recordCheckIn(first, new Date(2026, 8, 17, 21)), first);
  const next = recordCheckIn(first, new Date(2026, 8, 18, 8));
  assert.equal(checkInsInYear(next, 2026), 2);
  assert.equal(checkInsInYear(next, 2025), 0);
});

test("the list is capped, oldest first to go", () => {
  const many = Array.from({ length: CHECK_IN_LIMIT }, (_, i) => {
    const d = new Date(2025, 0, 1 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const capped = recordCheckIn(home(many), new Date(2026, 8, 17));
  assert.equal(capped.checkIns?.length, CHECK_IN_LIMIT);
  assert.equal(capped.checkIns?.[capped.checkIns.length - 1], "2026-09-17");
  assert.ok(!capped.checkIns?.includes(many[0]));
});
