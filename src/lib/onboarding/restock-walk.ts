import { WHOLE_HOME_ID } from "@/lib/home-model";
import { applyDutySave } from "@/lib/household-update";
import { deriveOrderByDate } from "@/lib/supply";
import { toISODate } from "@/lib/dates";
import { normalizeAssetType } from "@/lib/asset-catalog";
import type { AssetType, Duty, Household, LifespanUnit, RoomType } from "@/lib/types";

export type RestockWalkVariant = { id: string; label: string };

export type RestockWalkItem = {
  id: string;
  itemName: string;
  hint: string;
  dutyTitle: string;
  lifespanValue: number;
  lifespanUnit: LifespanUnit;
  frequency: Duty["frequency"];
  variants?: RestockWalkVariant[];
  roomType?: RoomType;
  assetType?: AssetType;
};

export type RestockPick = { id: string; variant?: string };

export const RESTOCK_WALK_CATALOG: RestockWalkItem[] = [
  {
    id: "hvac-filter",
    itemName: "HVAC filter",
    hint: "The size is printed on the frame of the filter in the return.",
    dutyTitle: "Replace HVAC filter",
    lifespanValue: 3,
    lifespanUnit: "months",
    frequency: "quarterly",
    assetType: "hvac_system",
    variants: [
      { id: "16x25x1", label: "16×25×1" },
      { id: "20x25x1", label: "20×25×1" },
      { id: "16x20x1", label: "16×20×1" },
      { id: "14x25x1", label: "14×25×1" },
      { id: "other", label: "Other / not sure" },
    ],
  },
  {
    id: "fridge-filter",
    itemName: "Fridge water filter",
    hint: "Usually inside the fridge, marked with a model number.",
    dutyTitle: "Replace fridge water filter",
    lifespanValue: 6,
    lifespanUnit: "months",
    frequency: "monthly",
    assetType: "refrigerator",
    roomType: "kitchen",
  },
  {
    id: "smoke-battery",
    itemName: "Smoke detector batteries",
    hint: "9V is common; some units are sealed 10-year.",
    dutyTitle: "Replace smoke detector batteries",
    lifespanValue: 12,
    lifespanUnit: "months",
    frequency: "yearly",
    assetType: "smoke_detector",
    variants: [
      { id: "9v", label: "9V" },
      { id: "aa", label: "AA" },
      { id: "sealed", label: "10-year sealed" },
    ],
  },
  {
    id: "water-filter",
    itemName: "Drinking water filter",
    hint: "Pitcher, fridge, or under-sink cartridge.",
    dutyTitle: "Replace drinking water filter",
    lifespanValue: 3,
    lifespanUnit: "months",
    frequency: "quarterly",
    roomType: "kitchen",
  },
  {
    id: "dishwasher-pods",
    itemName: "Dishwasher detergent",
    hint: "Keep a spare pack so you aren’t out mid-week.",
    dutyTitle: "Restock dishwasher detergent",
    lifespanValue: 2,
    lifespanUnit: "months",
    frequency: "monthly",
    roomType: "kitchen",
  },
  {
    id: "laundry-soap",
    itemName: "Laundry detergent",
    hint: "One spare jug is enough.",
    dutyTitle: "Restock laundry detergent",
    lifespanValue: 2,
    lifespanUnit: "months",
    frequency: "monthly",
    roomType: "laundry",
  },
  {
    id: "vacuum-filter",
    itemName: "Vacuum bags or filter",
    hint: "Match the vacuum model if you can.",
    dutyTitle: "Replace vacuum bag or filter",
    lifespanValue: 3,
    lifespanUnit: "months",
    frequency: "quarterly",
    roomType: "living",
  },
  {
    id: "air-purifier",
    itemName: "Air purifier filter",
    hint: "Skip if you don’t have one.",
    dutyTitle: "Replace air purifier filter",
    lifespanValue: 6,
    lifespanUnit: "months",
    frequency: "monthly",
    assetType: "air_purifier",
    roomType: "living",
  },
];

export const SAMPLE_RESTOCK_PICKS: RestockPick[] = [
  { id: "hvac-filter", variant: "16×25×1" },
  { id: "fridge-filter" },
  { id: "smoke-battery", variant: "9V" },
  { id: "dishwasher-pods" },
  { id: "laundry-soap" },
];

function targetFor(household: Household, item: RestockWalkItem): { room: string; nodeId: string; nodeType: Duty["nodeType"] } {
  if (item.assetType) {
    const asset = household.assets.find((entry) => normalizeAssetType(entry.type) === item.assetType);
    if (asset) return { room: asset.roomId, nodeId: asset.id, nodeType: "asset" };
  }
  if (item.roomType) {
    const room = household.rooms.find((entry) => entry.type === item.roomType && !entry.system);
    if (room) return { room: room.id, nodeId: room.id, nodeType: "room" };
  }
  const whole = household.rooms.find((entry) => entry.system === "whole-home");
  return { room: whole?.id ?? WHOLE_HOME_ID, nodeId: whole?.id ?? WHOLE_HOME_ID, nodeType: "home" };
}

function alreadyTracked(household: Household, item: RestockWalkItem): boolean {
  const needle = item.itemName.toLowerCase();
  return household.supplyAutomations.some((entry) => entry.itemName.toLowerCase().startsWith(needle));
}

/** Seeds Restock from a short “walk your house” catalog so day one isn’t empty. */
export function applyRestockPicks(household: Household, picks: RestockPick[], now = new Date()): Household {
  let next = household;
  const today = toISODate(now);
  for (const pick of picks) {
    const item = RESTOCK_WALK_CATALOG.find((entry) => entry.id === pick.id);
    if (!item) continue;
    if (alreadyTracked(next, item)) continue;
    const variant = pick.variant?.trim();
    const itemName = variant && variant !== "Other / not sure" ? `${item.itemName} (${variant})` : item.itemName;
    const target = targetFor(next, item);
    const existing = next.duties.find((duty) => duty.title === item.dutyTitle && !duty.archived);
    const orderByDate = deriveOrderByDate(today, item.lifespanValue, item.lifespanUnit);
    next = applyDutySave(
      next,
      {
        title: existing?.title ?? item.dutyTitle,
        notes: existing?.notes ?? item.hint,
        room: existing?.room ?? target.room,
        nodeId: existing?.nodeId ?? target.nodeId,
        nodeType: existing?.nodeType ?? target.nodeType,
        audience: existing?.audience ?? "me",
        effort: existing?.effort ?? "small",
        frequency: existing?.frequency ?? item.frequency,
        kind: "replacement",
        weekday: existing?.weekday ?? 6,
        monthDay: existing?.monthDay ?? 1,
        dueDate: existing?.dueDate ?? today,
        priority: existing?.priority ?? "medium",
        origin: existing?.origin ?? "starter",
        id: existing?.id,
        supplyAutomation: {
          itemName,
          sku: variant && variant !== "Other / not sure" ? variant : "",
          leadTimeDays: 14,
          onHand: 1,
          qtyPerOrder: 1,
          lifespanValue: item.lifespanValue,
          lifespanUnit: item.lifespanUnit,
          installedAt: today,
          orderByDate,
        },
      },
      now,
    );
  }
  return next;
}
