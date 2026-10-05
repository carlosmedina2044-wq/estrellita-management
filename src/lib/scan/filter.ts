import type { Consumable, Household, SupplyAutomation } from "@/lib/types";
import { cleanLine } from "./text";

/** A printed air-filter size. `depth` is missing for a two-number size such as "16x25". */
export type ParsedFilterSize = {
  width: number;
  height: number;
  depth?: number;
  /** "16x25x1", or "16x25" when no thickness was printed. */
  text: string;
  merv?: number;
  /** The text said FILTER or MERV near the size. */
  labelled: boolean;
  confidence: "high" | "medium" | "low";
  line: string;
};

const SIZE_3D = /(?<![\d.])(\d{1,2}(?:\.\d{1,2})?)\s*["”']?\s*[xX×*]\s*(\d{1,2}(?:\.\d{1,2})?)\s*["”']?\s*[xX×*]\s*(\d{1,2}(?:\.\d{1,2})?)\s*["”']?(?![\d.])/;
const SIZE_2D = /(?<![\d.xX×*])(\d{1,2})\s*["”']?\s*[xX×]\s*(\d{1,2})\s*["”']?(?![\d.xX×*])/;
const MERV_RE = /\bMERV\s*[-:#]?\s*(\d{1,2})\b/i;

/** Real furnace and AC filters: sides 8 to 36 inches, thickness 0.5 to 6. */
function plausible(a: number, b: number, depth?: number): boolean {
  const [w, h] = a <= b ? [a, b] : [b, a];
  if (w < 8 || h > 36) return false;
  return depth === undefined || (depth >= 0.5 && depth <= 6);
}

/** Reads a filter size (and MERV rating) out of recognised text. Never throws. */
export function parseFilterSize(rawLines: string[]): ParsedFilterSize | undefined {
  const lines = rawLines.map(cleanLine).filter(Boolean);
  const all = lines.join(" ");
  const mervMatch = MERV_RE.exec(all);
  const merv = mervMatch && Number(mervMatch[1]) >= 1 && Number(mervMatch[1]) <= 20 ? Number(mervMatch[1]) : undefined;
  let best: ParsedFilterSize | undefined;
  for (let i = 0; i < lines.length; i += 1) {
    const near = `${lines[i - 1] ?? ""} ${lines[i]} ${lines[i + 1] ?? ""}`;
    const labelled = /\b(FILTERS?|FLTR|MERV)\b/i.test(near);
    const m3 = SIZE_3D.exec(lines[i]);
    if (m3 && plausible(Number(m3[1]), Number(m3[2]), Number(m3[3]))) {
      const found: ParsedFilterSize = {
        width: Math.min(Number(m3[1]), Number(m3[2])),
        height: Math.max(Number(m3[1]), Number(m3[2])),
        depth: Number(m3[3]),
        text: `${m3[1]}x${m3[2]}x${m3[3]}`,
        merv,
        labelled,
        confidence: labelled ? "high" : "medium",
        line: lines[i],
      };
      if (labelled) return found;
      best ??= found;
      continue;
    }
    const m2 = SIZE_2D.exec(lines[i]);
    if (m2 && labelled && plausible(Number(m2[1]), Number(m2[2]))) {
      best ??= {
        width: Math.min(Number(m2[1]), Number(m2[2])),
        height: Math.max(Number(m2[1]), Number(m2[2])),
        text: `${m2[1]}x${m2[2]}`,
        merv,
        labelled,
        confidence: "low",
        line: lines[i],
      };
    }
  }
  return best;
}

/** Shared with add-from-label: does this supply name say it is a filter? */
export function isFilterName(name: string): boolean {
  return /filter/i.test(name);
}

/** Air filters for a furnace or AC. Water, coffee and range-hood filters are different sizes entirely. */
export function isAirFilterName(name: string): boolean {
  return isFilterName(name) && !/\b(water|fridge|refrigerator|coffee|pitcher|hood|grease|dryer|vent|pool|pump|oil|fuel)\b/i.test(name);
}

/** "Furnace filter" + 16x25x1 -> "Furnace filter 16x25x1"; leaves a name that already shows a size alone. */
export function filterNameWithSize(name: string, sizeText: string): string {
  if (name.includes(sizeText) || SIZE_3D.test(name)) return name;
  return `${name} ${sizeText}`;
}

export type FilterTarget = { assetId?: string; roomId?: string };

export type ApplyFilterResult = {
  household: Household;
  changed: { consumableIds: string[]; automationIds: string[] };
  /** Sizes that were there before and have been replaced. */
  previousSizes: string[];
  /** "needs_depth" = a two-number size was given; "no_target" = nothing filter-like matched. */
  skipped?: "needs_depth" | "no_target";
};

/**
 * Sets the printed filter size on the matching tracked filters: consumables and
 * restock items for a furnace/AC asset (or every asset in a room). The caller
 * confirms first; this never creates anything.
 */
export function applyFilterSize(household: Household, target: FilterTarget, size: ParsedFilterSize): ApplyFilterResult {
  const none = (skipped: ApplyFilterResult["skipped"]): ApplyFilterResult => ({
    household,
    changed: { consumableIds: [], automationIds: [] },
    previousSizes: [],
    skipped,
  });
  if (size.depth === undefined) return none("needs_depth");

  const nodeIds = new Set<string>();
  if (target.assetId) nodeIds.add(target.assetId);
  if (target.roomId) {
    nodeIds.add(target.roomId);
    for (const asset of household.assets) if (asset.roomId === target.roomId) nodeIds.add(asset.id);
  }
  if (nodeIds.size === 0) return none("no_target");

  const consumableHit = (c: Consumable) =>
    isAirFilterName(c.name) && (nodeIds.has(c.nodeId) || (c.assetId !== undefined && nodeIds.has(c.assetId)));
  const automationHit = (a: SupplyAutomation) => isAirFilterName(a.itemName) && nodeIds.has(a.nodeId);

  const consumableIds: string[] = [];
  const automationIds: string[] = [];
  const previousSizes: string[] = [];
  const remember = (prev?: string) => {
    if (prev && prev !== size.text && !previousSizes.includes(prev)) previousSizes.push(prev);
  };

  const consumables = household.consumables.map((c) => {
    if (!consumableHit(c)) return c;
    consumableIds.push(c.id);
    remember(c.sizeSpec);
    return { ...c, sizeSpec: size.text, name: filterNameWithSize(stripSize(c.name, c.sizeSpec), size.text) };
  });
  const supplyAutomations = household.supplyAutomations.map((a) => {
    if (!automationHit(a)) return a;
    automationIds.push(a.id);
    remember(a.sizeSpec);
    return { ...a, sizeSpec: size.text, sku: a.sku.trim() === "" ? size.text : a.sku };
  });

  if (consumableIds.length === 0 && automationIds.length === 0) return none("no_target");
  return { household: { ...household, consumables, supplyAutomations }, changed: { consumableIds, automationIds }, previousSizes, skipped: undefined };
}

function stripSize(name: string, previous?: string): string {
  let out = name;
  if (previous) out = out.replace(previous, "");
  return out.replace(SIZE_3D, "").replace(/\s+/g, " ").trim();
}
