import assert from "node:assert/strict";
import { test } from "node:test";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { applyDutySave } from "@/lib/household-update";
import { groupRestock } from "@/lib/restock";
import { parseStored } from "@/lib/storage";
import type { DutyDraft, Household } from "@/lib/types";

function household(overrides: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 8,
    householdName: "Test",
    ownerName: "Me",
    cleanerName: "Cleaner",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: [
      { id: "whole-home", floorId: null, name: "Whole Home", type: "other", sortOrder: 0, system: "whole-home" },
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 1 },
    ],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

function restockDraft(partial: Partial<DutyDraft> & Pick<DutyDraft, "title">): DutyDraft {
  return {
    notes: "",
    room: "kitchen",
    nodeId: "kitchen",
    nodeType: "room",
    audience: "me",
    effort: "medium",
    frequency: "quarterly",
    kind: "replacement",
    weekday: 6,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    supplyAutomation: {
      itemName: partial.title,
      leadTimeDays: 14,
      onHand: 0,
    },
    ...partial,
  };
}

const now = new Date(2026, 7, 23, 12);

test("a newly added restock item with 0 on-hand lands in Order now", () => {
  const next = applyDutySave(
    household(),
    restockDraft({ title: "HVAC filter 16x25x1" }),
    now,
  );
  assert.equal(next.supplyAutomations.length, 1);
  assert.equal(next.supplyAutomations[0]?.installedAt, "");
  assert.equal(next.supplyAutomations[0]?.onHand, 0);
  const groups = groupRestock(next.supplyAutomations, next, now);
  assert.equal(groups.order_now.length, 1);
  assert.equal(groups.order_now[0]?.itemName, "HVAC filter 16x25x1");
  assert.equal(groups.stocked.length, 0);
});

test("new restock item survives parseStored round-trip in Order now", () => {
  const saved = applyDutySave(
    household(),
    restockDraft({ title: "Battery pack", supplyAutomation: { itemName: "Battery pack", leadTimeDays: 14, onHand: 0 } }),
    now,
  );
  const hydrated = parseStored(JSON.stringify(saved));
  assert.equal(hydrated.supplyAutomations.length, 1);
  assert.equal(hydrated.supplyAutomations[0]?.installedAt, "");
  const groups = groupRestock(hydrated.supplyAutomations, hydrated, now);
  assert.equal(groups.order_now.length, 1);
});

test("saving a retailer URL remembers it for the next item", () => {
  const first = applyDutySave(
    household(),
    restockDraft({
      title: "Filter",
      supplyAutomation: { itemName: "Filter", leadTimeDays: 14, onHand: 0, retailerUrl: "https://www.ebay.com/itm/123" },
    }),
    now,
  );
  assert.equal(first.savedRetailerLinks.length, 1);
  assert.match(first.savedRetailerLinks[0]!.url, /ebay\.com/);
  const second = applyDutySave(
    first,
    restockDraft({ title: "Another filter" }),
    now,
  );
  assert.equal(second.savedRetailerLinks.length, 1);
  assert.equal(second.savedRetailerLinks[0]!.url, first.savedRetailerLinks[0]!.url);
});

test("editing an existing consumable keeps installedAt", () => {
  const created = applyDutySave(household(), restockDraft({ title: "Filter" }), now);
  const duty = created.duties[0]!;
  const automation = created.supplyAutomations[0]!;
  const edited = applyDutySave(
    { ...created, supplyAutomations: [{ ...automation, installedAt: "2026-01-15" }] },
    restockDraft({
      id: duty.id,
      title: "Filter",
      supplyAutomation: { id: automation.id, itemName: "Filter 20x20", leadTimeDays: 10, onHand: 2 },
    }),
    now,
  );
  assert.equal(edited.supplyAutomations[0]?.installedAt, "2026-01-15");
  assert.equal(edited.supplyAutomations[0]?.itemName, "Filter 20x20");
  assert.equal(edited.supplyAutomations[0]?.onHand, 2);
});

test("reorderAt is saved and 0 on-hand is Order now even with an install date", () => {
  const created = applyDutySave(
    household(),
    restockDraft({
      title: "Filter",
      supplyAutomation: { itemName: "Filter", leadTimeDays: 14, onHand: 0, reorderAt: 0 },
    }),
    now,
  );
  assert.equal(created.supplyAutomations[0]?.reorderAt, 0);
  const withInstall = {
    ...created,
    supplyAutomations: [{ ...created.supplyAutomations[0]!, installedAt: "2026-08-23" }],
  };
  assert.equal(groupRestock(withInstall.supplyAutomations, withInstall, now).order_now.length, 1);

  const atTwo = applyDutySave(
    household(),
    restockDraft({
      title: "Batteries",
      supplyAutomation: { itemName: "Batteries", leadTimeDays: 14, onHand: 2, reorderAt: 2 },
    }),
    now,
  );
  assert.equal(atTwo.supplyAutomations[0]?.reorderAt, 2);
  assert.equal(groupRestock(atTwo.supplyAutomations, atTwo, now).order_now.length, 1);
});
