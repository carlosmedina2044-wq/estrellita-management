import { catalogEntry, type CatalogCost } from "@/lib/asset-catalog";
import { blendedCostFor } from "@/lib/costs";
import { addCalendarMonths, parseISODate, toISODate } from "@/lib/dates";
import { normalizeAssetType } from "@/lib/asset-catalog";
import { linkedDutyIdsFor, runwayFor } from "@/lib/restock";
import type { Completion, Duty, HomeAsset, Household } from "@/lib/types";

export type ForecastKind = "consumable" | "task" | "replacement";
export type ForecastConfidence = "high" | "medium" | "low";
export type ForecastSource = "user" | "lastPaid" | "catalog";

export type ForecastItem = {
  kind: ForecastKind;
  nodeId: string;
  nodeType: "asset" | "room" | "home";
  label: string;
  month: string;
  cost: CatalogCost;
  confidence: ForecastConfidence;
  source: ForecastSource;
  overdue?: boolean;
  assetId?: string;
  automationId?: string;
  dutyId?: string;
};

export type ForecastMonth = {
  month: string;
  recurring: number;
  replacements: number;
  total: number;
  items: ForecastItem[];
};

export type MissingForecastData = {
  assetId: string;
  name: string;
  missing: Array<"installDate" | "cost">;
};

export type ForecastResult = {
  horizonMonths: number;
  monthly: ForecastMonth[];
  totals: { recurring: number; replacements: number; total: number };
  suggestedMonthlySetAside: number;
  bigTicket: ForecastItem[];
  missingData: MissingForecastData[];
};

export const BIG_TICKET_THRESHOLD = 500;

export function forecastSourceTag(source: ForecastSource): "Paid" | "Your estimate" | "Typical" {
  if (source === "lastPaid") return "Paid";
  if (source === "user") return "Your estimate";
  return "Typical";
}

export function enteredPriceTotal(forecast: ForecastResult): number {
  return forecast.monthly.reduce(
    (sum, month) =>
      sum +
      month.items.reduce((inner, item) => (item.source === "catalog" ? inner : inner + item.cost.mid), 0),
    0,
  );
}

const CONDITION_FACTOR: Record<string, number> = {
  good: 1,
  fair: 0.8,
  poor: 0.6,
};

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonthsKey(start: Date, months: number): string {
  return monthKey(addCalendarMonths(start, months));
}

export function roundUpTo(value: number, step: number): number {
  if (value <= 0) return 0;
  return Math.ceil(value / step) * step;
}

export function conditionFactor(condition?: HomeAsset["condition"]): number {
  return CONDITION_FACTOR[condition ?? "good"] ?? 1;
}

export function installDateFromAge(ageYears: number, now = new Date()): string {
  return toISODate(addCalendarMonths(now, -Math.round(ageYears * 12)));
}

function singleCost(value: number): CatalogCost {
  return { low: value, mid: value, high: value };
}

function cadenceDays(duty: Duty): number | null {
  switch (duty.frequency) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    case "quarterly":
      return 90;
    case "yearly":
      return 365;
    default:
      return null;
  }
}

function inHorizon(month: string, start: Date, horizonMonths: number): boolean {
  const [year, mon] = month.split("-").map(Number);
  const index = (year - start.getFullYear()) * 12 + (mon - 1 - start.getMonth());
  return index >= 0 && index < horizonMonths;
}

export function buildForecast(
  household: Pick<Household, "assets" | "duties" | "consumables" | "supplyAutomations" | "rooms"> & {
    completions?: Completion[];
  },
  horizonMonths: number,
  now = new Date(),
  options?: { bigTicketThreshold?: number },
): ForecastResult {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const months: ForecastMonth[] = Array.from({ length: horizonMonths }, (_, index) => {
    const month = addMonthsKey(start, index);
    return { month, recurring: 0, replacements: 0, total: 0, items: [] };
  });
  const byMonth = new Map(months.map((item) => [item.month, item]));
  const missingData: MissingForecastData[] = [];
  const threshold = options?.bigTicketThreshold ?? BIG_TICKET_THRESHOLD;

  for (const asset of household.assets) {
    const type = normalizeAssetType(asset.type);
    const catalog = catalogEntry(type);
    const missing: MissingForecastData["missing"] = [];
    if (!asset.installDate) missing.push("installDate");
    if (asset.replacementCostEstimate == null && asset.purchasePrice == null) missing.push("cost");
    if (!asset.installDate) {
      missingData.push({ assetId: asset.id, name: asset.name, missing });
      continue;
    }
    if (missing.includes("cost")) {
      missingData.push({ assetId: asset.id, name: asset.name, missing: ["cost"] });
    }

    const lifeYears = asset.expectedLifeYears ?? catalog.defaultLifeYears;
    // parseISODate keeps "2014-08-01" in local time; new Date("2014-08-01") is UTC and
    // lands on July 31 in US time zones, shifting end-of-life by a month at boundaries.
    const installed = new Date(parseISODate(asset.installDate));
    const end = addCalendarMonths(installed, Math.round(lifeYears * 12 * conditionFactor(asset.condition)));
    let month = monthKey(end);
    let overdue = false;
    if (!inHorizon(month, start, horizonMonths) && end.getTime() < start.getTime()) {
      month = months[0].month;
      overdue = true;
    }
    if (!inHorizon(month, start, horizonMonths)) continue;

    const userCost = asset.replacementCostEstimate ?? asset.purchasePrice;
    const cost = userCost != null ? singleCost(userCost) : catalog.defaultReplacementCost;
    const item: ForecastItem = {
      kind: "replacement",
      nodeId: asset.id,
      nodeType: "asset",
      label: `${asset.name} replacement`,
      month,
      cost,
      confidence: userCost != null && asset.condition ? "high" : userCost != null ? "medium" : "low",
      source: userCost != null ? "user" : "catalog",
      overdue,
      assetId: asset.id,
    };
    const bucket = byMonth.get(month);
    if (bucket) {
      bucket.items.push(item);
      bucket.replacements += cost.mid;
    }
  }

  for (const consumable of household.consumables) {
    const price = consumable.lastPaidPrice ?? consumable.unitCost;
    if (price == null || consumable.intervalDays <= 0) continue;
    const source: ForecastSource = consumable.lastPaidPrice != null ? "lastPaid" : "catalog";
    const occurrences = Math.max(1, Math.floor((horizonMonths * 30) / consumable.intervalDays));
    for (let i = 0; i < occurrences; i += 1) {
      const date = addCalendarMonths(start, Math.round((i * consumable.intervalDays) / 30));
      const month = monthKey(date);
      if (!inHorizon(month, start, horizonMonths)) continue;
      const item: ForecastItem = {
        kind: "consumable",
        nodeId: consumable.nodeId,
        nodeType: consumable.nodeType === "asset" ? "asset" : "room",
        label: consumable.name,
        month,
        cost: singleCost(price),
        confidence: consumable.lastPaidPrice != null ? "high" : "medium",
        source,
        assetId: consumable.assetId,
      };
      const bucket = byMonth.get(month);
      if (bucket) {
        bucket.items.push(item);
        bucket.recurring += price;
      }
    }
  }

  for (const automation of household.supplyAutomations) {
    const price = automation.lastPaidPrice ?? automation.unitCost;
    if (price == null) continue;
    const unitPrice = price;
    const source: ForecastSource = automation.lastPaidPrice != null ? "lastPaid" : "catalog";
    const linked = linkedDutyIdsFor(automation);
    const hasRunwayAnchor = linked.length > 0 || Boolean(automation.orderByDate);
    const purchaseDates = hasRunwayAnchor
      ? runwayFor(automation, { duties: household.duties, completions: household.completions ?? [] }, now).upcomingDates.slice(
          Math.max(0, automation.onHand),
        )
      : [];

    function pushConsumable(isoOrMonth: string) {
      let month = isoOrMonth.length > 7 ? isoOrMonth.slice(0, 7) : isoOrMonth;
      const past = isoOrMonth.length > 7 && parseISODate(isoOrMonth) < start.getTime();
      if (!inHorizon(month, start, horizonMonths) && past) month = months[0].month;
      if (!inHorizon(month, start, horizonMonths)) return;
      const item: ForecastItem = {
        kind: "consumable",
        nodeId: automation.nodeId,
        nodeType: automation.nodeType === "asset" ? "asset" : "room",
        label: automation.itemName,
        month,
        cost: singleCost(unitPrice),
        confidence: automation.lastPaidPrice != null ? "high" : "medium",
        source,
        automationId: automation.id,
      };
      const bucket = byMonth.get(month);
      if (bucket) {
        bucket.items.push(item);
        bucket.recurring += unitPrice;
      }
    }

    if (hasRunwayAnchor) {
      for (const iso of purchaseDates) pushConsumable(iso);
      continue;
    }

    const days =
      automation.lifespanUnit === "days"
        ? automation.lifespanValue
        : automation.lifespanUnit === "years"
          ? automation.lifespanValue * 365
          : automation.lifespanValue * 30;
    if (days <= 0) continue;
    const occurrences = Math.max(1, Math.floor((horizonMonths * 30) / days));
    for (let i = 0; i < occurrences; i += 1) {
      const date = addCalendarMonths(start, Math.round((i * days) / 30));
      pushConsumable(monthKey(date));
    }
  }

  for (const duty of household.duties) {
    if (duty.archived) continue;
    const blended = blendedCostFor(duty, household.completions ?? []);
    if (!blended) continue;
    const cost = blended.cost;
    const source: ForecastSource = blended.source === "actual" ? "lastPaid" : "user";
    const days = cadenceDays(duty);
    if (!days) {
      if (duty.dueDate) {
        const month = duty.dueDate.slice(0, 7);
        if (inHorizon(month, start, horizonMonths)) {
          const item: ForecastItem = {
            kind: "task",
            nodeId: duty.nodeId,
            nodeType: duty.nodeType === "asset" ? "asset" : "room",
            label: duty.title,
            month,
            cost: singleCost(cost),
            confidence: blended.source === "actual" ? "high" : "medium",
            source,
            dutyId: duty.id,
          };
          const bucket = byMonth.get(month);
          if (bucket) {
            bucket.items.push(item);
            bucket.recurring += cost;
          }
        }
      }
      continue;
    }
    const occurrences = Math.max(1, Math.floor((horizonMonths * 30) / days));
    for (let i = 0; i < occurrences; i += 1) {
      const date = addCalendarMonths(start, Math.round((i * days) / 30));
      const month = monthKey(date);
      if (!inHorizon(month, start, horizonMonths)) continue;
      const item: ForecastItem = {
        kind: "task",
        nodeId: duty.nodeId,
        nodeType: duty.nodeType === "asset" ? "asset" : "room",
        label: duty.title,
        month,
        cost: singleCost(cost),
        confidence: blended.source === "actual" ? "high" : "medium",
        source,
        dutyId: duty.id,
      };
      const bucket = byMonth.get(month);
      if (bucket) {
        bucket.items.push(item);
        bucket.recurring += cost;
      }
    }
  }

  for (const month of months) {
    month.total = month.recurring + month.replacements;
  }

  const totals = months.reduce(
    (acc, month) => ({
      recurring: acc.recurring + month.recurring,
      replacements: acc.replacements + month.replacements,
      total: acc.total + month.total,
    }),
    { recurring: 0, replacements: 0, total: 0 },
  );

  const bigTicket = months
    .flatMap((month) => month.items)
    .filter((item) => item.kind === "replacement" && item.cost.mid >= threshold)
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    horizonMonths,
    monthly: months,
    totals,
    suggestedMonthlySetAside: roundUpTo(totals.total / horizonMonths, 5),
    bigTicket,
    missingData,
  };
}

export function next90DaysSpend(household: Household, now = new Date()): number {
  return buildForecast(household, 3, now).totals.total;
}

export function roomsWithNearReplacement(household: Household, months = 6, now = new Date()): Set<string> {
  const forecast = buildForecast(household, months, now);
  const rooms = new Set<string>();
  for (const item of forecast.monthly.flatMap((month) => month.items)) {
    if (item.kind !== "replacement" || !item.assetId) continue;
    const asset = household.assets.find((entry) => entry.id === item.assetId);
    if (asset) rooms.add(asset.roomId);
  }
  return rooms;
}
