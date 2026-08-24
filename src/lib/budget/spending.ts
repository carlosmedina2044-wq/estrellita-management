import { monthKey } from "@/lib/forecast";
import { normalizeAssetType } from "@/lib/asset-catalog";
import type { AssetType, Household, Purchase, PurchaseKind } from "@/lib/types";

export type SpendingEntry = {
  id: string;
  month: string;
  completedAt: string;
  label: string;
  actualCost: number;
  category: string;
  kind: PurchaseKind;
};

export type SpendingCategoryShare = {
  category: string;
  actual: number;
  pct: number;
};

export type SpendingMonth = {
  month: string;
  actual: number;
  entries: SpendingEntry[];
};

export type SpendingSummary = {
  months: number;
  planned: number;
  actual: number;
  entries: SpendingEntry[];
  byMonth: SpendingMonth[];
  byCategory: SpendingCategoryShare[];
};

export function spendingCategory(kind: PurchaseKind, assetType?: AssetType): string {
  if (kind === "consumable") return "Supplies";
  if (kind === "task") return "Upkeep";
  switch (assetType ? normalizeAssetType(assetType) : "other") {
    case "hvac_system":
    case "furnace":
    case "evaporative_cooler":
    case "air_purifier":
    case "hvac":
      return "HVAC";
    case "water_heater":
    case "water_softener":
    case "sump_pump":
    case "garbage_disposal":
      return "Plumbing";
    case "roof":
    case "exterior_paint":
    case "windows":
    case "irrigation_system":
    case "garage_door_opener":
    case "pool_pump":
      return "Exterior";
    case "interior_paint":
    case "carpet":
    case "hardwood_floor":
      return "Interior";
    case "smoke_detector":
      return "Safety";
    case "refrigerator":
    case "dishwasher":
    case "range_oven":
    case "microwave":
    case "washer":
    case "dryer":
    case "fridge":
      return "Appliances";
    default:
      return "Replacements";
  }
}

function assetTypeFor(household: Household, assetId?: string): AssetType | undefined {
  if (!assetId) return undefined;
  return household.assets.find((item) => item.id === assetId)?.type;
}

function purchaseEntry(household: Household, purchase: Purchase): SpendingEntry {
  return {
    id: purchase.id,
    month: monthKey(new Date(purchase.completedAt)),
    completedAt: purchase.completedAt,
    label: purchase.label,
    actualCost: purchase.actualCost,
    category: spendingCategory(purchase.kind, assetTypeFor(household, purchase.assetId)),
    kind: purchase.kind,
  };
}

export function spendingSummary(
  household: Household,
  options: { months: number; plannedMonthly: number; now?: Date },
): SpendingSummary {
  const now = options.now ?? new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (options.months - 1), 1);
  const startMs = start.getTime();
  const purchases = household.purchases ?? [];
  const purchaseDutyMonths = new Set(
    purchases
      .filter((item) => item.dutyId)
      .map((item) => `${item.dutyId}:${monthKey(new Date(item.completedAt))}`),
  );

  const fromPurchases = purchases
    .filter((item) => Date.parse(item.completedAt) >= startMs)
    .map((item) => purchaseEntry(household, item));

  const fromCompletions = household.completions
    .filter((item) => typeof item.actualCost === "number" && Date.parse(item.completedAt) >= startMs)
    .filter((item) => !purchaseDutyMonths.has(`${item.dutyId}:${monthKey(new Date(item.completedAt))}`))
    .map((item) => {
      const duty = household.duties.find((entry) => entry.id === item.dutyId);
      const kind: PurchaseKind = duty?.kind === "replacement" ? "consumable" : "task";
      return {
        id: item.id,
        month: monthKey(new Date(item.completedAt)),
        completedAt: item.completedAt,
        label: duty?.title ?? "Maintenance",
        actualCost: item.actualCost as number,
        category: spendingCategory(kind),
        kind,
      } satisfies SpendingEntry;
    });

  const entries = [...fromPurchases, ...fromCompletions].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const actual = entries.reduce((sum, item) => sum + item.actualCost, 0);

  const byMonthMap = new Map<string, SpendingMonth>();
  for (let i = 0; i < options.months; i += 1) {
    const month = monthKey(new Date(start.getFullYear(), start.getMonth() + i, 1));
    byMonthMap.set(month, { month, actual: 0, entries: [] });
  }
  for (const entry of entries) {
    const bucket = byMonthMap.get(entry.month);
    if (!bucket) continue;
    bucket.actual += entry.actualCost;
    bucket.entries.push(entry);
  }

  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.actualCost);
  }
  const byCategory = [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      actual: amount,
      pct: actual > 0 ? Math.round((amount / actual) * 100) : 0,
    }))
    .sort((a, b) => b.actual - a.actual);

  return {
    months: options.months,
    planned: Math.round(options.plannedMonthly * options.months),
    actual: Math.round(actual * 100) / 100,
    entries,
    byMonth: [...byMonthMap.values()],
    byCategory,
  };
}
