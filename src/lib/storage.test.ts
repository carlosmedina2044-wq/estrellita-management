import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStored } from "@/lib/storage";

test("migrates a pre-release household and drops account/PIN fields", () => {
  const legacy = {
    version: 6,
    householdName: "Old house",
    ownerPin: "sha256:abc",
    account: { appleUserId: "001", email: "x@y.z", providers: ["apple"] },
    onboarded: true,
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: [{ id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 2 }],
    duties: [
      {
        id: "duty-0001",
        title: "Replace filter",
        room: "kitchen",
        frequency: "quarterly",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    supplyAutomations: [
      {
        id: "sup-00001",
        dutyId: "duty-0001",
        itemName: "Filter",
        amazonProductUrl: "https://www.amazon.com/dp/B0FILTER12",
        asin: "B0FILTER12",
        amazonOneClick: true,
        leadTimeDays: 10,
      },
    ],
  };
  const household = parseStored(JSON.stringify(legacy));
  assert.equal(household.householdName, "Old house");
  assert.equal("ownerPin" in household, false);
  assert.equal("account" in household, false);
  assert.equal(household.duties[0]?.kind, "replacement");
  const supply = household.supplyAutomations[0]!;
  assert.equal(supply.retailerUrl, "https://www.amazon.com/dp/B0FILTER12");
  assert.equal("amazonOneClick" in supply, false);
  assert.ok(household.rooms.some((room) => room.system === "whole-home"));
});

test("unknown room ids fall back to a generic room, not a specific house", () => {
  const household = parseStored(
    JSON.stringify({
      onboarded: true,
      duties: [{ id: "duty-0002", title: "Dust", room: "carlos-office", createdAt: "2026-01-01T00:00:00.000Z" }],
    }),
  );
  assert.equal(household.rooms.every((room) => !/carlos|adriana|elliott|ramada/i.test(room.name)), true);
  assert.ok(household.rooms.some((room) => room.id === household.duties[0]?.room));
});

test("drops orphaned consumables and control characters", () => {
  const household = parseStored(
    JSON.stringify({
      onboarded: true,
      duties: [{ id: "duty-0003", title: "Sweep\u0000 floor", room: "whole-home", createdAt: "2026-01-01T00:00:00.000Z" }],
      supplyAutomations: [{ id: "sup-00002", dutyId: "missing-duty", itemName: "Ghost" }],
    }),
  );
  assert.equal(household.duties[0]?.title, "Sweep floor");
  assert.equal(household.supplyAutomations.length, 0);
});

test("rejects non-object payloads", () => {
  assert.throws(() => parseStored("[]"));
  assert.throws(() => parseStored("null"));
});
