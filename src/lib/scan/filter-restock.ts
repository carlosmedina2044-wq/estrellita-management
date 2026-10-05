import { ASSET_CATALOG, normalizeAssetType } from "@/lib/asset-catalog";
import { applyRestockPicks, newCustomPick, trackedBaseName } from "@/lib/onboarding/restock-walk";
import type { Household } from "@/lib/types";
import { normalizeBarcode, rememberBarcode } from "./barcode";
import { filterNameWithSize, isAirFilterName, type FilterTarget, type ParsedFilterSize } from "./filter";

/** What "Remind me to reorder it" would create. */
export type FilterRestockPlan = {
  /** "Furnace filter 16x25x1". */
  itemName: string;
  /** Matches the Restock quick-add intervals. */
  intervalMonths: 1 | 3 | 6 | 12;
  roomId: string;
  assetId?: string;
  unitCost?: number;
};

const INTERVALS: Array<1 | 3 | 6 | 12> = [1, 3, 6, 12];

function nearestInterval(days: number): 1 | 3 | 6 | 12 {
  const months = days / 30;
  return INTERVALS.reduce((best, n) => (Math.abs(n - months) < Math.abs(best - months) ? n : best));
}

/**
 * Works out the Restock item a scanned filter size should create. Returns
 * undefined when there is nothing to offer: no depth yet, no tracked air filter
 * at the target, or that target already has an air filter in Restock (the size
 * is simply updated there by applyFilterSize). Pure; never changes anything.
 */
export function planFilterRestock(
  household: Household,
  target: FilterTarget,
  size: ParsedFilterSize,
): FilterRestockPlan | undefined {
  if (size.depth === undefined) return undefined;
  const nodeIds = new Set<string>();
  if (target.assetId) nodeIds.add(target.assetId);
  if (target.roomId) {
    nodeIds.add(target.roomId);
    for (const asset of household.assets) if (asset.roomId === target.roomId) nodeIds.add(asset.id);
  }
  if (nodeIds.size === 0) return undefined;

  const hit = household.consumables.find(
    (c) => isAirFilterName(c.name) && (nodeIds.has(c.nodeId) || (c.assetId !== undefined && nodeIds.has(c.assetId))),
  );
  if (!hit) return undefined;
  if (household.supplyAutomations.some((a) => isAirFilterName(a.itemName) && nodeIds.has(a.nodeId))) return undefined;

  const asset = household.assets.find((a) => a.id === (hit.assetId ?? hit.nodeId));
  const catalogFilter = asset
    ? ASSET_CATALOG.find((entry) => entry.type === normalizeAssetType(asset.type))?.defaultConsumables.find((c) =>
        isAirFilterName(c.name),
      )
    : undefined;
  const baseName = catalogFilter?.name ?? hit.name.replace(/\s*\d{1,2}(?:\.\d{1,2})?\s*[xX×*]\s*\d.*$/, "").trim();
  const room = asset?.roomId ?? target.roomId ?? hit.nodeId;
  return {
    itemName: filterNameWithSize(baseName || "Air filter", size.text),
    intervalMonths: nearestInterval(catalogFilter?.intervalDays ?? hit.intervalDays ?? 90),
    roomId: room,
    assetId: asset?.id,
    unitCost: hit.unitCost ?? catalogFilter?.unitCost,
  };
}

/**
 * Creates the Restock item through the same path the Restock quick-add uses
 * (applyRestockPicks with a custom pick), then points it at the furnace or AC
 * itself and teaches the box's barcode if one came with the scan. A no-op when
 * the same name is already tracked. Pure; the caller saves.
 */
export function addFilterToRestock(
  household: Household,
  plan: FilterRestockPlan,
  size: ParsedFilterSize,
  barcode?: string,
  now = new Date(),
): Household {
  const before = new Set(household.supplyAutomations.map((a) => a.id));
  let next = applyRestockPicks(
    household,
    [
      newCustomPick({
        itemName: plan.itemName,
        sku: size.text,
        roomId: plan.roomId,
        intervalMonths: plan.intervalMonths,
        group: "whole-home",
      }),
    ],
    now,
  );
  const created = next.supplyAutomations.find(
    (a) => !before.has(a.id) && trackedBaseName(a.itemName) === trackedBaseName(plan.itemName),
  );
  if (!created) return next;
  const asset = plan.assetId ? next.assets.find((a) => a.id === plan.assetId) : undefined;
  next = {
    ...next,
    supplyAutomations: next.supplyAutomations.map((a) =>
      a.id === created.id
        ? {
            ...a,
            ...(asset ? { nodeId: asset.id, nodeType: "asset" as const, room: asset.roomId } : {}),
            ...(plan.unitCost !== undefined ? { unitCost: plan.unitCost } : {}),
          }
        : a,
    ),
    duties: asset
      ? next.duties.map((d) =>
          d.id === created.dutyId ? { ...d, nodeId: asset.id, nodeType: "asset" as const, room: asset.roomId } : d,
        )
      : next.duties,
  };
  if (barcode && normalizeBarcode(barcode)) next = rememberBarcode(next, created.id, barcode);
  return next;
}
