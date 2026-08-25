import assert from "node:assert/strict";
import { test } from "node:test";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import {
  hasSeenTip,
  isAfterFirstDay,
  markTipSeen,
  teachingCardVisible,
  TIP_ARRIVAL,
  withTeaching,
} from "@/lib/teaching";
import type { Household } from "@/lib/types";

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

test("first-three card hides after all three or after seven days", () => {
  const start = home({ teaching: { startedAt: "2026-08-20", checkedChore: false, openedRestock: false, setDigestOrZip: false } });
  assert.equal(teachingCardVisible(start, new Date(2026, 7, 24)), true);
  assert.equal(teachingCardVisible(start, new Date(2026, 7, 28)), false);
  const done = withTeaching(start, { checkedChore: true, openedRestock: true, setDigestOrZip: true });
  assert.equal(teachingCardVisible(done, new Date(2026, 7, 24)), false);
});

test("tips are recorded once and never repeat", () => {
  const first = markTipSeen(home({ seenTips: [] }), TIP_ARRIVAL);
  assert.equal(hasSeenTip(first, TIP_ARRIVAL), true);
  const again = markTipSeen(first, TIP_ARRIVAL);
  assert.equal(again.seenTips.length, 1);
});

test("walk-after-day-one is false on the start day", () => {
  const start = home({ teaching: { startedAt: "2026-08-24", checkedChore: false, openedRestock: false, setDigestOrZip: false } });
  assert.equal(isAfterFirstDay(start, new Date(2026, 7, 24, 18, 0, 0)), false);
  assert.equal(isAfterFirstDay(start, new Date(2026, 7, 25, 8, 0, 0)), true);
});
