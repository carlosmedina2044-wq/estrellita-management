import type { AssetType, RoomType } from "@/lib/types";

export type CatalogSuggestion = {
  id: string;
  itemName: string;
  hint: string;
  sku?: string;
  lifespanValue: number;
  lifespanUnit: "days" | "months" | "years";
  roomTypes?: RoomType[];
  assetTypes?: AssetType[];
};

export const CONSUMABLE_CATALOG: CatalogSuggestion[] = [
  {
    id: "hvac-filter",
    itemName: "HVAC filter",
    hint: "Note the size (16×25×1, etc.)",
    lifespanValue: 3,
    lifespanUnit: "months",
    roomTypes: ["other"],
    assetTypes: ["hvac_system", "hvac"],
  },
  {
    id: "smoke-9v",
    itemName: "Smoke detector 9V battery",
    hint: "Whole-home detectors",
    lifespanValue: 12,
    lifespanUnit: "months",
    roomTypes: ["other", "hallway"],
    assetTypes: ["smoke_detector"],
  },
  {
    id: "softener-salt",
    itemName: "Water softener salt",
    hint: "Bags for the brine tank",
    lifespanValue: 2,
    lifespanUnit: "months",
    assetTypes: ["water_softener"],
    roomTypes: ["other", "garage", "basement"],
  },
  {
    id: "fridge-filter",
    itemName: "Fridge water filter",
    hint: "Match the fridge model",
    lifespanValue: 6,
    lifespanUnit: "months",
    assetTypes: ["refrigerator", "fridge"],
    roomTypes: ["kitchen"],
  },
  {
    id: "dishwasher-pods",
    itemName: "Dishwasher detergent",
    hint: "Pods or gel",
    lifespanValue: 2,
    lifespanUnit: "months",
    roomTypes: ["kitchen"],
  },
  {
    id: "laundry-soap",
    itemName: "Laundry detergent",
    hint: "Keep a spare jug",
    lifespanValue: 2,
    lifespanUnit: "months",
    roomTypes: ["laundry"],
  },
];

export function suggestionsForRoom(type: RoomType): CatalogSuggestion[] {
  return CONSUMABLE_CATALOG.filter((item) => item.roomTypes?.includes(type));
}

export function suggestionsForAsset(type: AssetType): CatalogSuggestion[] {
  return CONSUMABLE_CATALOG.filter((item) => item.assetTypes?.includes(type));
}
