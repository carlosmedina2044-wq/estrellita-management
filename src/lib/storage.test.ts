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
  assert.equal(household.savedRetailerLinks.some((item) => item.url.includes("amazon.com")), true);
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

test("keeps an explicit empty installedAt and household saved retailer links", () => {
  const household = parseStored(
    JSON.stringify({
      onboarded: true,
      duties: [
        {
          id: "duty-0004",
          title: "Replace filter",
          room: "kitchen",
          frequency: "quarterly",
          kind: "replacement",
          createdAt: "2026-08-23T12:00:00.000Z",
        },
      ],
      supplyAutomations: [
        {
          id: "sup-00004",
          dutyId: "duty-0004",
          itemName: "Filter",
          onHand: 0,
          installedAt: "",
          leadTimeDays: 14,
        },
      ],
      savedRetailerLinks: [{ url: "https://www.ebay.com/itm/99", useCount: 2, lastUsedAt: "2026-08-23T12:00:00.000Z" }],
    }),
  );
  assert.equal(household.supplyAutomations[0]?.installedAt, "");
  assert.equal(household.supplyAutomations[0]?.reorderAt, 0);
  assert.equal(household.savedRetailerLinks[0]?.url, "https://ebay.com/itm/99");
  assert.equal(household.savedRetailerLinks[0]?.useCount, 2);
});

test("sizeSpec is truncated and stripped of control characters", () => {
  const household = parseStored(
    JSON.stringify({
      onboarded: true,
      duties: [
        {
          id: "duty-0005",
          title: "Replace filter",
          room: "kitchen",
          kind: "replacement",
          createdAt: "2026-08-23T12:00:00.000Z",
        },
      ],
      supplyAutomations: [
        {
          id: "sup-00005",
          dutyId: "duty-0005",
          itemName: "Filter",
          sizeSpec: `16x25x1\u0000${"x".repeat(50)}`,
        },
      ],
      consumables: [
        {
          id: "con-00005",
          nodeId: "hvac",
          name: "HVAC filter",
          intervalDays: 90,
          sizeSpec: `CR2032\u0007${"y".repeat(50)}`,
        },
      ],
    }),
  );
  assert.equal(household.supplyAutomations[0]?.sizeSpec, `16x25x1${"x".repeat(33)}`);
  assert.equal(household.supplyAutomations[0]?.sizeSpec?.length, 40);
  assert.equal(household.consumables[0]?.sizeSpec, `CR2032${"y".repeat(34)}`);
  assert.equal(household.consumables[0]?.sizeSpec?.length, 40);
});

test("keeps a geocoded place name on location", () => {
  const household = parseStored(
    JSON.stringify({
      onboarded: true,
      location: { postalCode: "85701", placeName: "Tucson", climateZone: "hot-arid" },
    }),
  );
  assert.equal(household.location.placeName, "Tucson");
});

test("warrantyUntil round-trips an ISO date", () => {
  const household = parseStored(
    JSON.stringify({
      onboarded: true,
      floors: [{ id: "main", name: "Main", sortOrder: 0 }],
      rooms: [{ id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 1 }],
      assets: [
        {
          id: "asset001",
          roomId: "kitchen",
          name: "Fridge",
          type: "refrigerator",
          installDate: "2024-03-01",
          warrantyUntil: "2027-03-01",
        },
      ],
    }),
  );
  assert.equal(household.assets[0]?.warrantyUntil, "2027-03-01");
  assert.equal(household.assets[0]?.installDate, "2024-03-01");
});

test("malformed warrantyUntil is dropped", () => {
  const household = parseStored(
    JSON.stringify({
      onboarded: true,
      floors: [{ id: "main", name: "Main", sortOrder: 0 }],
      rooms: [{ id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 1 }],
      assets: [
        {
          id: "asset002",
          roomId: "kitchen",
          name: "Dishwasher",
          type: "dishwasher",
          warrantyUntil: "not-a-date",
        },
      ],
    }),
  );
  assert.equal(household.assets[0]?.warrantyUntil, undefined);
});

test("absent tenure stays absent and invalid tenure is dropped", () => {
  const old = parseStored(JSON.stringify({ onboarded: true, householdName: "Old" }));
  assert.equal(old.tenure, undefined);
  const bad = parseStored(JSON.stringify({ onboarded: true, tenure: "yesterday" }));
  assert.equal(bad.tenure, undefined);
  const kept = parseStored(JSON.stringify({ onboarded: true, tenure: "new" }));
  assert.equal(kept.tenure, "new");
});
