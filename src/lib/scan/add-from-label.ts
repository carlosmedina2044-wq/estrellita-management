import { assetLabel, catalogEntry } from "@/lib/asset-catalog";
import { toISODate } from "@/lib/dates";
import { tActive } from "@/i18n";
import { hasSeenTip, markTipSeen, TIP_SCANNED, TIP_SCAN_PROMPT } from "@/lib/teaching";
import type { AssetType, Consumable, HomeAsset, Household } from "@/lib/types";
import type { LabelReading } from "./index";

/** Furnace and central-air filters come in printed sizes; other consumables do not. */
const SIZED_FILTER_TYPES: AssetType[] = ["furnace", "hvac_system", "hvac"];

export type LabelOverrides = {
  type?: AssetType;
  /** ISO "YYYY-MM-DD", typed by the person. Wins over the date on the label. */
  installDate?: string;
  name?: string;
};

export type AddFromLabelInput = {
  household: Household;
  reading: LabelReading;
  roomId?: string;
  overrides?: LabelOverrides;
  /** Stable id for the new appliance; its supplies get `${idBase}-c0`, `-c1`... */
  idBase?: string;
};

export type AddFromLabelResult = {
  household: Household;
  asset: HomeAsset;
  consumables: Consumable[];
};

/** The type to use: the person's pick, else what the label says, else "other". */
export function typeFor(reading: LabelReading, overrides?: LabelOverrides): AssetType {
  return overrides?.type ?? reading.type?.type ?? "other";
}

/** "Rheem water heater", or just "Water heater" when no brand was read. */
export function assetNameFor(brand: string | undefined, type: AssetType): string {
  const label = assetLabel(type);
  if (!brand) return label;
  return `${brand} ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/** Install date from the label: the 1st of the month, or July when only the year is known. */
export function installDateFromReading(reading: LabelReading): string | undefined {
  const made = reading.manufactured;
  if (!made) return undefined;
  return toISODate(new Date(made.year, (made.month ?? 7) - 1, 1));
}

const DEFAULT_PLACES: Partial<Record<AssetType, Household["rooms"][number]["type"][]>> = {
  refrigerator: ["kitchen"],
  dishwasher: ["kitchen"],
  range_oven: ["kitchen"],
  microwave: ["kitchen"],
  garbage_disposal: ["kitchen"],
  washer: ["laundry"],
  dryer: ["laundry"],
  water_heater: ["basement", "garage", "laundry"],
  furnace: ["basement", "garage", "attic"],
  hvac_system: ["basement", "attic", "garage"],
  water_softener: ["basement", "garage"],
  sump_pump: ["basement"],
};

/** Where a scanned appliance most likely lives, used only when the person did not start from a room. */
export function defaultRoomFor(household: Household, type: AssetType): string {
  for (const roomType of DEFAULT_PLACES[type] ?? []) {
    const hit = household.rooms.find((room) => room.type === roomType && !room.system);
    if (hit) return hit.id;
  }
  const whole = household.rooms.find((room) => room.system === "whole-home");
  return (whole ?? household.rooms.find((room) => !room.system) ?? household.rooms[0])?.id ?? "whole-home";
}

function notesFor(reading: LabelReading): string | undefined {
  const parts: string[] = [];
  if (reading.model) parts.push(tActive("scan.noteModel", { model: reading.model.value }));
  if (reading.serial) parts.push(tActive("scan.noteSerial", { serial: reading.serial.value }));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * Turns a confirmed label reading into a new household: the appliance (with
 * its install date, usual life and replacement cost, which is all the repair
 * forecast, Budget and the house need), and the supplies that go with that
 * kind of appliance. A printed filter size replaces the generic filter name.
 * Pure: the caller decides when to save.
 */
export function addFromLabel(input: AddFromLabelInput): AddFromLabelResult {
  const { household, reading, overrides } = input;
  const idBase = input.idBase ?? crypto.randomUUID();
  const type = typeFor(reading, overrides);
  const catalog = catalogEntry(type);
  const roomExists = input.roomId && household.rooms.some((room) => room.id === input.roomId);
  const roomId = roomExists ? (input.roomId as string) : defaultRoomFor(household, type);

  const asset: HomeAsset = {
    id: idBase,
    roomId,
    name: overrides?.name?.trim() || assetNameFor(reading.brand?.value.name, type),
    type,
    installDate: overrides?.installDate || installDateFromReading(reading),
    expectedLifeYears: catalog.defaultLifeYears,
    replacementCostEstimate: catalog.defaultReplacementCost.mid,
    notes: notesFor(reading),
  };

  const size = SIZED_FILTER_TYPES.includes(catalog.type) ? reading.filterSize?.value : undefined;
  const consumables: Consumable[] = catalog.defaultConsumables.map((item, index) => {
    const sized = size && /filter/i.test(item.name);
    return {
      id: `${idBase}-c${index}`,
      assetId: asset.id,
      nodeId: asset.id,
      nodeType: "asset",
      name: sized ? `${item.name} ${size.text}` : item.name,
      intervalDays: item.intervalDays,
      unitCost: item.unitCost,
      sizeSpec: sized ? size.text : undefined,
    };
  });

  const next: Household = markTipSeen(
    {
      ...household,
      assets: [...household.assets, asset],
      consumables: [...household.consumables, ...consumables],
    },
    TIP_SCANNED,
  );
  return { household: next, asset, consumables };
}

/**
 * The one-time Home card: only for homes that have not scanned anything, have
 * not waved the card away, and have fewer than two appliances with a date.
 */
export function shouldOfferScan(household: Household): boolean {
  if (hasSeenTip(household, TIP_SCAN_PROMPT) || hasSeenTip(household, TIP_SCANNED)) return false;
  return household.assets.filter((asset) => Boolean(asset.installDate)).length < 2;
}
