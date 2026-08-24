import { userRooms, WHOLE_HOME_ID } from "@/lib/home-model";
import { applyDutySave } from "@/lib/household-update";
import { DEFAULT_LEAD_TIME_DAYS, deriveOrderByDate } from "@/lib/supply";
import { toISODate } from "@/lib/dates";
import { normalizeAssetType } from "@/lib/asset-catalog";
import type { AssetType, Duty, Household, LifespanUnit, RetailerId, RoomType } from "@/lib/types";

export type RestockWalkVariant = { id: string; label: string };

export type RestockWalkGroup = "kitchen" | "laundry" | "living" | "bath" | "whole-home" | "outside";

export type RestockWalkContext = Pick<Household, "attributes" | "assets">;

export type RestockWalkItem = {
  id: string;
  itemName: string;
  hint: string;
  dutyTitle: string;
  lifespanValue: number;
  lifespanUnit: LifespanUnit;
  frequency: Duty["frequency"];
  group: RestockWalkGroup;
  variants?: RestockWalkVariant[];
  roomType?: RoomType;
  assetType?: AssetType;
  when?: (household: RestockWalkContext) => boolean;
  defaultOn?: boolean | ((household: RestockWalkContext) => boolean);
};

export type CatalogRestockPick = { id: string; variant?: string };

export type CustomRestockItem = {
  itemName: string;
  sku?: string;
  roomId: string;
  intervalMonths: 1 | 3 | 6 | 12;
  retailer?: RetailerId | string;
  group: RestockWalkGroup;
};

export type CustomRestockPick = { id: `custom:${string}`; custom: CustomRestockItem };

export type RestockPick = CatalogRestockPick | CustomRestockPick;

export function isCustomRestockPick(pick: RestockPick): pick is CustomRestockPick {
  return "custom" in pick;
}

export function newCustomPick(item: CustomRestockItem): CustomRestockPick {
  return { id: `custom:${crypto.randomUUID()}`, custom: item };
}

export function cadenceForInterval(intervalMonths: 1 | 3 | 6 | 12): {
  frequency: Duty["frequency"];
  lifespanValue: number;
  lifespanUnit: LifespanUnit;
  dutyPrefix: "Restock" | "Replace";
} {
  if (intervalMonths === 1) {
    return { frequency: "monthly", lifespanValue: 1, lifespanUnit: "months", dutyPrefix: "Restock" };
  }
  if (intervalMonths === 3) {
    return { frequency: "quarterly", lifespanValue: 3, lifespanUnit: "months", dutyPrefix: "Restock" };
  }
  if (intervalMonths === 6) {
    return { frequency: "monthly", lifespanValue: 6, lifespanUnit: "months", dutyPrefix: "Replace" };
  }
  return { frequency: "yearly", lifespanValue: 12, lifespanUnit: "months", dutyPrefix: "Replace" };
}

export const RESTOCK_WALK_GROUPS: { id: RestockWalkGroup; label: string }[] = [
  { id: "kitchen", label: "Kitchen" },
  { id: "laundry", label: "Laundry" },
  { id: "living", label: "Living" },
  { id: "bath", label: "Bath" },
  { id: "whole-home", label: "Whole home" },
  { id: "outside", label: "Outside" },
];

function hasAsset(household: RestockWalkContext, type: AssetType): boolean {
  return household.assets.some((asset) => normalizeAssetType(asset.type) === type);
}

export function defaultRoomForGroup(
  household: Pick<Household, "rooms">,
  group: RestockWalkGroup,
): string {
  const whole = household.rooms.find((room) => room.system === "whole-home");
  if (group === "whole-home") return whole?.id ?? WHOLE_HOME_ID;
  if (group === "outside") {
    return household.rooms.find((room) => room.system === "exterior")?.id ?? whole?.id ?? WHOLE_HOME_ID;
  }
  const type =
    group === "kitchen"
      ? "kitchen"
      : group === "laundry"
        ? "laundry"
        : group === "living"
          ? "living"
          : group === "bath"
            ? "bathroom"
            : undefined;
  const match = type ? household.rooms.find((room) => room.type === type && !room.system) : undefined;
  return match?.id ?? userRooms(household)[0]?.id ?? whole?.id ?? WHOLE_HOME_ID;
}

export const RESTOCK_WALK_CATALOG: RestockWalkItem[] = [
  {
    id: "fridge-filter",
    itemName: "Fridge water filter",
    hint: "Usually inside the fridge, marked with a model number.",
    dutyTitle: "Replace fridge water filter",
    lifespanValue: 6,
    lifespanUnit: "months",
    frequency: "monthly",
    group: "kitchen",
    assetType: "refrigerator",
    roomType: "kitchen",
    defaultOn: (household) => hasAsset(household, "refrigerator"),
  },
  {
    id: "water-filter",
    itemName: "Drinking water filter",
    hint: "Pitcher, fridge, or under-sink cartridge.",
    dutyTitle: "Replace drinking water filter",
    lifespanValue: 3,
    lifespanUnit: "months",
    frequency: "quarterly",
    group: "kitchen",
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
    group: "kitchen",
    roomType: "kitchen",
    defaultOn: true,
  },
  {
    id: "laundry-soap",
    itemName: "Laundry detergent",
    hint: "One spare jug is enough.",
    dutyTitle: "Restock laundry detergent",
    lifespanValue: 2,
    lifespanUnit: "months",
    frequency: "monthly",
    group: "laundry",
    roomType: "laundry",
    when: (household) => household.attributes.hasLaundry,
    defaultOn: true,
  },
  {
    id: "vacuum-filter",
    itemName: "Vacuum bags or filter",
    hint: "Match the vacuum model if you can.",
    dutyTitle: "Replace vacuum bag or filter",
    lifespanValue: 3,
    lifespanUnit: "months",
    frequency: "quarterly",
    group: "living",
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
    group: "living",
    assetType: "air_purifier",
    roomType: "living",
    defaultOn: (household) => hasAsset(household, "air_purifier"),
  },
  {
    id: "hvac-filter",
    itemName: "HVAC filter",
    hint: "The size is printed on the frame of the filter in the return.",
    dutyTitle: "Replace HVAC filter",
    lifespanValue: 3,
    lifespanUnit: "months",
    frequency: "quarterly",
    group: "whole-home",
    assetType: "hvac_system",
    defaultOn: true,
    variants: [
      { id: "16x25x1", label: "16×25×1" },
      { id: "20x25x1", label: "20×25×1" },
      { id: "16x20x1", label: "16×20×1" },
      { id: "14x25x1", label: "14×25×1" },
    ],
  },
  {
    id: "smoke-battery",
    itemName: "Smoke detector batteries",
    hint: "9V is common; some units are sealed 10-year.",
    dutyTitle: "Replace smoke detector batteries",
    lifespanValue: 12,
    lifespanUnit: "months",
    frequency: "yearly",
    group: "whole-home",
    assetType: "smoke_detector",
    defaultOn: true,
    variants: [
      { id: "9v", label: "9V" },
      { id: "aa", label: "AA" },
      { id: "sealed", label: "10-year sealed" },
    ],
  },
  {
    id: "water-softener-salt",
    itemName: "Water softener salt",
    hint: "A spare bag in the garage is enough.",
    dutyTitle: "Restock water softener salt",
    lifespanValue: 1,
    lifespanUnit: "months",
    frequency: "monthly",
    group: "whole-home",
    assetType: "water_softener",
    when: (household) => hasAsset(household, "water_softener"),
  },
  {
    id: "cooler-pads",
    itemName: "Evaporative cooler pads",
    hint: "Replace in spring before first use.",
    dutyTitle: "Replace evaporative cooler pads",
    lifespanValue: 12,
    lifespanUnit: "months",
    frequency: "yearly",
    group: "whole-home",
    assetType: "evaporative_cooler",
    when: (household) => household.attributes.hasEvaporativeCooler,
  },
  {
    id: "well-filter",
    itemName: "Well sediment filter",
    hint: "Usually a whole-house canister near the pressure tank.",
    dutyTitle: "Replace well sediment filter",
    lifespanValue: 6,
    lifespanUnit: "months",
    frequency: "monthly",
    group: "whole-home",
    when: (household) => household.attributes.hasWell,
  },
  {
    id: "garage-remote-battery",
    itemName: "Garage door opener remote battery",
    hint: "The small battery in the visor remote.",
    dutyTitle: "Replace garage remote battery",
    lifespanValue: 12,
    lifespanUnit: "months",
    frequency: "yearly",
    group: "whole-home",
    roomType: "garage",
    when: (household) => household.attributes.hasGarage,
  },
  {
    id: "pool-chlorine",
    itemName: "Pool chlorine",
    hint: "Tabs or liquid — whichever you actually buy.",
    dutyTitle: "Restock pool chlorine",
    lifespanValue: 1,
    lifespanUnit: "months",
    frequency: "monthly",
    group: "outside",
    assetType: "pool_pump",
    when: (household) => household.attributes.hasPool,
    defaultOn: true,
  },
  {
    id: "pool-test-strips",
    itemName: "Pool test strips",
    hint: "A spare bottle so you aren’t guessing the chemistry.",
    dutyTitle: "Restock pool test strips",
    lifespanValue: 3,
    lifespanUnit: "months",
    frequency: "quarterly",
    group: "outside",
    assetType: "pool_pump",
    when: (household) => household.attributes.hasPool,
  },
];

export function visibleWalkItems(household: RestockWalkContext): RestockWalkItem[] {
  return RESTOCK_WALK_CATALOG.filter((item) => !item.when || item.when(household));
}

export function isWalkItemDefaultOn(item: RestockWalkItem, household: RestockWalkContext): boolean {
  if (item.when && !item.when(household)) return false;
  if (typeof item.defaultOn === "function") return item.defaultOn(household);
  return item.defaultOn === true;
}

export function defaultWalkPicks(household: RestockWalkContext): RestockPick[] {
  return visibleWalkItems(household)
    .filter((item) => isWalkItemDefaultOn(item, household))
    .map((item) => ({ id: item.id }));
}

/** Typical-house defaults with no size guessed. */
export const SAMPLE_RESTOCK_PICKS: RestockPick[] = [
  { id: "hvac-filter" },
  { id: "fridge-filter" },
  { id: "smoke-battery" },
  { id: "dishwasher-pods" },
  { id: "laundry-soap" },
];

export function picksMissingSize(picks: RestockPick[]): RestockWalkItem[] {
  return picks.flatMap((pick) => {
    if (isCustomRestockPick(pick)) return [];
    const item = RESTOCK_WALK_CATALOG.find((entry) => entry.id === pick.id);
    if (!item?.variants?.length) return [];
    if (pick.variant?.trim()) return [];
    return [item];
  });
}

export function trackedBaseName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
}

export function catalogItemForSupply(item: Pick<{ itemName: string }, "itemName">): RestockWalkItem | undefined {
  const base = trackedBaseName(item.itemName);
  return RESTOCK_WALK_CATALOG.find((entry) => entry.itemName.toLowerCase() === base);
}

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

function alreadyTrackedName(household: Household, itemName: string): boolean {
  const needle = trackedBaseName(itemName);
  return household.supplyAutomations.some((entry) => trackedBaseName(entry.itemName) === needle);
}

function alreadyTracked(household: Household, item: RestockWalkItem): boolean {
  return alreadyTrackedName(household, item.itemName);
}

function applyCustomPick(household: Household, pick: CustomRestockPick, now: Date): Household {
  const custom = pick.custom;
  const itemName = custom.itemName.trim();
  if (!itemName || alreadyTrackedName(household, itemName)) return household;
  const cadence = cadenceForInterval(custom.intervalMonths);
  const room = household.rooms.find((entry) => entry.id === custom.roomId);
  const whole = household.rooms.find((entry) => entry.system === "whole-home");
  const roomId = room?.id ?? whole?.id ?? WHOLE_HOME_ID;
  const nodeType: Duty["nodeType"] = room?.system === "whole-home" ? "home" : "room";
  const today = toISODate(now);
  const variant = custom.sku?.trim();
  const dutyTitle = `${cadence.dutyPrefix} ${itemName}`;
  const existing = household.duties.find((duty) => duty.title === dutyTitle && !duty.archived);
  const orderByDate = deriveOrderByDate(today, cadence.lifespanValue, cadence.lifespanUnit);
  return applyDutySave(
    household,
    {
      title: existing?.title ?? dutyTitle,
      notes: existing?.notes ?? "",
      room: existing?.room ?? roomId,
      nodeId: existing?.nodeId ?? roomId,
      nodeType: existing?.nodeType ?? nodeType,
      audience: existing?.audience ?? "me",
      effort: existing?.effort ?? "small",
      frequency: existing?.frequency ?? cadence.frequency,
      kind: "replacement",
      weekday: existing?.weekday ?? 6,
      monthDay: existing?.monthDay ?? 1,
      dueDate: existing?.dueDate ?? today,
      priority: existing?.priority ?? "medium",
      origin: existing?.origin ?? "user",
      id: existing?.id,
      supplyAutomation: {
        itemName,
        sku: variant ?? "",
        sizeSpec: variant || undefined,
        leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
        onHand: 1,
        qtyPerOrder: 1,
        lifespanValue: cadence.lifespanValue,
        lifespanUnit: cadence.lifespanUnit,
        installedAt: today,
        orderByDate,
        preferredRetailer: custom.retailer,
      },
    },
    now,
  );
}

/** Seeds Restock from a short “walk your house” catalog so day one isn’t empty. */
export function applyRestockPicks(household: Household, picks: RestockPick[], now = new Date()): Household {
  let next = household;
  const today = toISODate(now);
  for (const pick of picks) {
    if (isCustomRestockPick(pick)) {
      next = applyCustomPick(next, pick, now);
      continue;
    }
    const item = RESTOCK_WALK_CATALOG.find((entry) => entry.id === pick.id);
    if (!item) continue;
    if (item.when && !item.when(next)) continue;
    if (alreadyTracked(next, item)) continue;
    const variant = pick.variant?.trim();
    const itemName = item.itemName;
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
          sku: variant ?? "",
          sizeSpec: variant || undefined,
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
