import type { AssetType } from "@/lib/types";

export type CatalogCost = { low: number; mid: number; high: number };

export type CatalogConsumable = {
  name: string;
  intervalDays: number;
  unitCost: number;
};

export type AssetCatalogEntry = {
  type: AssetType;
  label: string;
  defaultLifeYears: number;
  defaultReplacementCost: CatalogCost;
  defaultConsumables: CatalogConsumable[];
};

export const ASSET_CATALOG: AssetCatalogEntry[] = [
  {
    type: "hvac_system",
    label: "Heating / cooling",
    defaultLifeYears: 15,
    defaultReplacementCost: { low: 4500, mid: 7500, high: 12000 },
    defaultConsumables: [{ name: "HVAC filter", intervalDays: 90, unitCost: 22 }],
  },
  {
    type: "furnace",
    label: "Furnace",
    defaultLifeYears: 18,
    defaultReplacementCost: { low: 2500, mid: 4500, high: 7500 },
    defaultConsumables: [{ name: "Furnace filter", intervalDays: 90, unitCost: 18 }],
  },
  {
    type: "water_heater",
    label: "Water heater",
    defaultLifeYears: 12,
    defaultReplacementCost: { low: 900, mid: 1600, high: 2800 },
    defaultConsumables: [],
  },
  {
    type: "refrigerator",
    label: "Fridge",
    defaultLifeYears: 13,
    defaultReplacementCost: { low: 800, mid: 1600, high: 3200 },
    defaultConsumables: [{ name: "Fridge water filter", intervalDays: 180, unitCost: 45 }],
  },
  {
    type: "dishwasher",
    label: "Dishwasher",
    defaultLifeYears: 10,
    defaultReplacementCost: { low: 500, mid: 850, high: 1400 },
    defaultConsumables: [{ name: "Dishwasher detergent", intervalDays: 60, unitCost: 18 }],
  },
  {
    type: "range_oven",
    label: "Range / oven",
    defaultLifeYears: 15,
    defaultReplacementCost: { low: 700, mid: 1400, high: 2800 },
    defaultConsumables: [],
  },
  {
    type: "microwave",
    label: "Microwave",
    defaultLifeYears: 9,
    defaultReplacementCost: { low: 120, mid: 250, high: 500 },
    defaultConsumables: [],
  },
  {
    type: "washer",
    label: "Washer",
    defaultLifeYears: 12,
    defaultReplacementCost: { low: 500, mid: 900, high: 1500 },
    defaultConsumables: [{ name: "Laundry detergent", intervalDays: 60, unitCost: 16 }],
  },
  {
    type: "dryer",
    label: "Dryer",
    defaultLifeYears: 13,
    defaultReplacementCost: { low: 500, mid: 900, high: 1500 },
    defaultConsumables: [],
  },
  {
    type: "garbage_disposal",
    label: "Garbage disposal",
    defaultLifeYears: 10,
    defaultReplacementCost: { low: 120, mid: 220, high: 400 },
    defaultConsumables: [],
  },
  {
    type: "water_softener",
    label: "Water softener",
    defaultLifeYears: 15,
    defaultReplacementCost: { low: 600, mid: 1200, high: 2200 },
    defaultConsumables: [{ name: "Water softener salt", intervalDays: 60, unitCost: 14 }],
  },
  {
    type: "garage_door_opener",
    label: "Garage door opener",
    defaultLifeYears: 15,
    defaultReplacementCost: { low: 200, mid: 350, high: 600 },
    defaultConsumables: [{ name: "Garage door remote battery", intervalDays: 730, unitCost: 6 }],
  },
  {
    type: "roof",
    label: "Roof",
    defaultLifeYears: 22,
    defaultReplacementCost: { low: 8000, mid: 14000, high: 25000 },
    defaultConsumables: [],
  },
  {
    type: "exterior_paint",
    label: "Exterior paint",
    defaultLifeYears: 8,
    defaultReplacementCost: { low: 2500, mid: 4500, high: 8000 },
    defaultConsumables: [],
  },
  {
    type: "interior_paint",
    label: "Interior paint",
    defaultLifeYears: 7,
    defaultReplacementCost: { low: 1500, mid: 2800, high: 5000 },
    defaultConsumables: [],
  },
  {
    type: "carpet",
    label: "Carpet",
    defaultLifeYears: 10,
    defaultReplacementCost: { low: 2000, mid: 4000, high: 7000 },
    defaultConsumables: [],
  },
  {
    type: "hardwood_floor",
    label: "Hardwood floor",
    defaultLifeYears: 40,
    defaultReplacementCost: { low: 4000, mid: 8000, high: 14000 },
    defaultConsumables: [],
  },
  {
    type: "windows",
    label: "Windows",
    defaultLifeYears: 25,
    defaultReplacementCost: { low: 6000, mid: 12000, high: 22000 },
    defaultConsumables: [],
  },
  {
    type: "smoke_detector",
    label: "Smoke detector",
    defaultLifeYears: 10,
    defaultReplacementCost: { low: 20, mid: 40, high: 80 },
    defaultConsumables: [{ name: "Smoke detector 9V battery", intervalDays: 365, unitCost: 8 }],
  },
  {
    type: "sump_pump",
    label: "Sump pump",
    defaultLifeYears: 10,
    defaultReplacementCost: { low: 300, mid: 550, high: 1000 },
    defaultConsumables: [],
  },
  {
    type: "pool_pump",
    label: "Pool pump",
    defaultLifeYears: 8,
    defaultReplacementCost: { low: 400, mid: 800, high: 1400 },
    defaultConsumables: [],
  },
  {
    type: "irrigation_system",
    label: "Irrigation system",
    defaultLifeYears: 15,
    defaultReplacementCost: { low: 1500, mid: 2800, high: 5000 },
    defaultConsumables: [],
  },
  {
    type: "air_purifier",
    label: "Air purifier",
    defaultLifeYears: 8,
    defaultReplacementCost: { low: 150, mid: 300, high: 700 },
    defaultConsumables: [{ name: "Air purifier filter", intervalDays: 180, unitCost: 35 }],
  },
  {
    type: "evaporative_cooler",
    label: "Evaporative cooler",
    defaultLifeYears: 15,
    defaultReplacementCost: { low: 400, mid: 900, high: 1800 },
    defaultConsumables: [{ name: "Cooler pads", intervalDays: 365, unitCost: 40 }],
  },
  {
    type: "other",
    label: "Other",
    defaultLifeYears: 10,
    defaultReplacementCost: { low: 100, mid: 250, high: 600 },
    defaultConsumables: [],
  },
];

const LEGACY_ASSET_TYPE: Record<string, AssetType> = {
  hvac: "hvac_system",
  fridge: "refrigerator",
};

export const CANONICAL_ASSET_TYPES = ASSET_CATALOG.map((item) => item.type);

export function normalizeAssetType(value: string): AssetType {
  if (value in LEGACY_ASSET_TYPE) return LEGACY_ASSET_TYPE[value];
  return ASSET_CATALOG.some((item) => item.type === value) ? (value as AssetType) : "other";
}

export function catalogEntry(type: AssetType): AssetCatalogEntry {
  const canonical = normalizeAssetType(type);
  return ASSET_CATALOG.find((item) => item.type === canonical) ?? ASSET_CATALOG[ASSET_CATALOG.length - 1];
}

export function catalogLabel(type: AssetType): string {
  return catalogEntry(type).label;
}
