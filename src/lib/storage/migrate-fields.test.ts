import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStored } from "@/lib/storage";
import type {
  Completion,
  Consumable,
  Duty,
  HaulItem,
  HomeAsset,
  HomeFloor,
  HomeRoom,
  HouseNote,
  Household,
  Purchase,
  SupplyAutomation,
  Visit,
} from "@/lib/types";

/**
 * Reload must never silently drop a field. These fixtures are typed `Required<...>`,
 * so adding a field to Household (or to one of the records inside it) fails the type
 * check here until the field is added to the fixture, and then fails the test below
 * until migrate.ts keeps it. (`haulItems` and `houseNotes` were both dropped this
 * way before there was a test.)
 */

const ISO = "2026-09-01T12:00:00.000Z";

const floor: Required<HomeFloor> = { id: "main", name: "Main", sortOrder: 0, updatedAt: ISO };
const room: Required<HomeRoom> = {
  updatedAt: ISO,
  id: "kitchen",
  floorId: "main",
  name: "Kitchen",
  type: "kitchen",
  sortOrder: 1,
  system: "whole-home",
  tileW: 2,
  tileH: 2,
  tileX: 1,
  tileY: 1,
};
const asset: Required<HomeAsset> = {
  updatedAt: ISO,
  id: "furnace-1",
  roomId: "kitchen",
  name: "Furnace",
  type: "furnace",
  installDate: "2015-03-01",
  warrantyUntil: "2030-03-01",
  purchasePrice: 3000,
  expectedLifeYears: 18,
  replacementCostEstimate: 5000,
  condition: "fair",
  notes: "Basement",
  deferredUntil: "2027-01-01",
  deferReason: "Saving up",
};
const consumable: Required<Consumable> = {
  updatedAt: ISO,
  id: "cons-0001",
  assetId: "furnace-1",
  nodeId: "furnace-1",
  nodeType: "asset",
  name: "Furnace filter",
  intervalDays: 90,
  unitCost: 18,
  lastPaidPrice: 17,
  lastReplacedAt: "2026-08-01",
  sizeSpec: "16x25x1",
};
const duty: Required<Duty> = {
  updatedAt: ISO,
  id: "duty-0001",
  title: "Replace furnace filter",
  notes: "Quarterly",
  room: "kitchen",
  nodeId: "furnace-1",
  nodeType: "asset",
  audience: "me",
  effort: "small",
  frequency: "quarterly",
  kind: "replacement",
  weekday: 2,
  monthDay: 3,
  dueDate: "2026-10-01",
  priority: "high",
  createdAt: ISO,
  archived: false,
  estimatedCost: 18,
  isDiy: true,
  laborCostEstimate: 0,
  estimatedMinutes: 10,
  origin: "user",
  playbookId: "fall-prep",
  weatherTriggerId: "freeze",
  buyLocally: true,
  caution: "ladder",
  rolledCompletions: 2,
  snoozedUntil: "2026-10-09",
};
const completion: Required<Completion> = {
  updatedAt: ISO,
  id: "comp-0001",
  dutyId: "duty-0001",
  actor: "me",
  visitId: "visit-01",
  completedAt: ISO,
  actualCost: 12,
  costSkipped: true,
};
const purchase: Required<Purchase> = {
  updatedAt: ISO,
  id: "purch-01",
  completedAt: ISO,
  actualCost: 20,
  label: "Filter",
  kind: "consumable",
  dutyId: "duty-0001",
  assetId: "furnace-1",
  automationId: "sup-00001",
  laborKind: "diy",
  notes: "Hardware store",
  plannedCost: 18,
};
const visit: Required<Visit> = { id: "visit-01", cleanerName: "Ana", startedAt: ISO, endedAt: ISO, updatedAt: ISO };
const supply: Required<SupplyAutomation> = {
  updatedAt: ISO,
  id: "sup-00001",
  dutyId: "duty-0001",
  linkedDutyIds: ["duty-0001"],
  room: "kitchen",
  nodeId: "furnace-1",
  nodeType: "asset",
  itemName: "Furnace filter 16x25x1",
  sku: "16x25x1",
  barcodes: ["036000291452"],
  sizeSpec: "16x25x1",
  retailerUrl: "https://www.amazon.com/dp/B0FILTER12",
  quantity: 2,
  onHand: 1,
  qtyPerOrder: 2,
  reorderAt: 1,
  leadTimeDays: 5,
  installedAt: "2026-08-01",
  lifespanValue: 3,
  lifespanUnit: "months",
  orderByDate: "2026-10-20",
  nextOrderDate: "2026-10-20",
  orderInFlight: true,
  state: "ordered",
  expectedArrivalDate: "2026-10-12",
  createdAt: ISO,
  unitCost: 18,
  lastPaidPrice: 17,
  lastPaidAt: "2026-09-02",
  preferredRetailer: "amazon",
  orderedAt: "2026-09-03",
  orderedQty: 2,
  observedLeadTimeDays: 4,
  lastConfirmedLevel: 1,
  lastConfirmedAt: "2026-09-20",
  observedRatePerDay: 0.01,
  flaggedLowAt: ISO,
};
const haul: Required<HaulItem> = { id: "haul-001", name: "Milk", addedAt: ISO, updatedAt: ISO };
const note: Required<HouseNote> = {
  updatedAt: ISO,
  id: "note-001",
  roomId: "kitchen",
  title: "Breaker",
  body: "Panel is in the garage",
  kind: "breaker",
  createdAt: ISO,
};

const FULL: Required<Household> = {
  version: 9,
  householdName: "Casa",
  ownerName: "Ana",
  cleanerName: "Rosa",
  onboarded: true,
  mode: "owner",
  activeVisitId: "visit-01",
  homeId: "home",
  homeType: "townhouse",
  tenure: "settled",
  location: {
    lat: 33.4,
    lng: -112,
    postalCode: "85001",
    placeName: "Phoenix",
    climateZone: "hot-arid",
    climateZoneOverride: "mixed",
  },
  attributes: {
    hasGarage: true,
    hasYard: true,
    hasPool: true,
    hasIrrigation: true,
    hasFireplace: true,
    hasBasement: true,
    hasAttic: true,
    hasLaundry: true,
    hasHomeOffice: true,
    hasGutters: true,
    hasSepticSystem: true,
    hasWell: true,
    hasSolar: true,
    hasEvaporativeCooler: true,
    roofType: "tile",
  },
  homeSpec: { version: 2, kitType: "a", palette: "classic", windows: [{ id: "w1", roomId: "kitchen" }], seed: 7 },
  floors: [floor],
  rooms: [room],
  assets: [asset],
  consumables: [consumable],
  duties: [duty],
  completions: [completion],
  purchases: [purchase],
  visits: [visit],
  maintenanceFund: { balance: 1200, updatedAt: ISO, monthlyContribution: 100 },
  bigTicketThreshold: 500,
  supplyAutomations: [supply],
  savedRetailerLinks: [{ url: "https://www.amazon.com/dp/B0FILTER12", lastUsedAt: ISO, useCount: 3 }],
  preferredRetailers: ["amazon"],
  playbookDecisions: [{ playbookId: "fall-prep", year: 2026, declinedTaskKeys: ["a"], disabled: true }],
  weatherFires: [{ triggerId: "freeze", firedAt: ISO }],
  weatherStatus: { lastSuccessAt: ISO, lastError: "x" },
  lockSettings: { requireFaceId: false, lockAfter: "15min" },
  householdRole: "adult",
  restockDigest: { enabled: false, weekday: 3, hour: 10, lastSentOn: "2026-09-20", permissionAsked: true, privateNotifications: true },
  morningBrief: { enabled: false, hour: 7, weekdaysOnly: true },
  eveningNudge: { enabled: true, hour: 20 },
  restockSafetyBufferDays: 10,
  teaching: { startedAt: "2026-09-01", checkedChore: true, openedRestock: true, setDigestOrZip: true },
  seenTips: ["tip-1"],
  milestones: [{ id: "first-close", earnedAt: ISO }],
  momentum: {
    enabled: false,
    bestRun: 9,
    care: { level: "kept", since: "2026-09-01", direction: "up" },
    careHistory: [{ level: "settling-in", since: "2026-08-01" }],
    nightFollowsSky: false,
  },
  checkIns: ["2026-09-01", "2026-09-02"],
  haulItems: [haul],
  houseNotes: [note],
  tombstones: [
    { type: "supply", id: "sup-gone-1", deletedAt: ISO, keep: { lastConfirmedAt: "2026-09-20", lastConfirmedLevel: 1 } },
    { type: "duty", id: "duty-gone-1", deletedAt: ISO },
  ],
  profileUpdatedAt: ISO,
  sync: { enabled: true, deviceId: "device-abc", homeId: "home-xyz", lastSyncAt: ISO },
};

function keysOf(value: unknown): string[] {
  return value && typeof value === "object" ? Object.keys(value) : [];
}

test("every Household field survives a reload", () => {
  const out = parseStored(JSON.stringify(FULL)) as unknown as Record<string, unknown>;
  const missing = Object.keys(FULL).filter((key) => out[key] === undefined);
  assert.deepEqual(missing, [], `migrate.ts drops Household fields: ${missing.join(", ")}`);
});

test("every field of the records and settings inside a Household survives a reload", () => {
  const out = parseStored(JSON.stringify(FULL)) as unknown as Record<string, unknown>;
  const lists = [
    "floors", "rooms", "assets", "consumables", "duties", "completions", "purchases", "visits",
    "supplyAutomations", "savedRetailerLinks", "playbookDecisions", "weatherFires", "houseNotes", "haulItems", "milestones", "tombstones",
  ] as const;
  const objects = [
    "location", "attributes", "homeSpec", "maintenanceFund", "weatherStatus", "lockSettings", "restockDigest",
    "morningBrief", "eveningNudge", "teaching", "momentum", "sync",
  ] as const;
  const dropped: string[] = [];
  for (const name of lists) {
    const sent = (FULL[name] as unknown[])[0];
    // The same record by id (or its first key), not by position: the app adds its own system rooms at the front.
    const idKey = name === "savedRetailerLinks" ? "useCount" : name === "playbookDecisions" ? "playbookId" : name === "weatherFires" ? "triggerId" : "id";
    const got = (out[name] as Array<Record<string, unknown>> | undefined)?.find(
      (item) => item[idKey] === (sent as Record<string, unknown>)[idKey],
    );
    for (const key of keysOf(sent)) {
      if ((got as Record<string, unknown> | undefined)?.[key] === undefined) dropped.push(`${name}[].${key}`);
    }
  }
  for (const name of objects) {
    const sent = FULL[name];
    const got = out[name] as Record<string, unknown> | undefined;
    for (const key of keysOf(sent)) if (got?.[key] === undefined) dropped.push(`${name}.${key}`);
  }
  assert.deepEqual(dropped, [], `migrate.ts drops fields: ${dropped.join(", ")}`);
});
