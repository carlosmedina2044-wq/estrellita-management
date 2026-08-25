import { catalogEntry, normalizeAssetType } from "@/lib/asset-catalog";
import { parseISODate, addCalendarMonths } from "@/lib/dates";
import {
  conditionFactor,
  formatMoney,
  monthsUntil,
  roundUpTo,
  type ForecastItem,
  type ForecastResult,
} from "@/lib/forecast";
import type { Household } from "@/lib/types";

export type BudgetInsight = {
  id: "urgency" | "backlog" | "pace" | "seasonal";
  tone: "info" | "warn" | "ok";
  title: string;
  body: string;
};

const SEASONS: { id: "winter" | "spring" | "summer" | "fall"; label: string; months: number[] }[] = [
  { id: "winter", label: "Winter", months: [12, 1, 2] },
  { id: "spring", label: "Spring", months: [3, 4, 5] },
  { id: "summer", label: "Summer", months: [6, 7, 8] },
  { id: "fall", label: "Fall", months: [9, 10, 11] },
];

function monthNumber(key: string): number {
  return Number(key.split("-")[1]);
}

function itemName(item: ForecastItem): string {
  return item.label.replace(/ replacement$/i, "");
}

function yearsPastLife(household: Household, item: ForecastItem, now: Date): number | null {
  if (!item.assetId) return null;
  const asset = household.assets.find((entry) => entry.id === item.assetId);
  if (!asset?.installDate) return null;
  const catalog = catalogEntry(normalizeAssetType(asset.type));
  const lifeYears = asset.expectedLifeYears ?? catalog.defaultLifeYears;
  const installed = new Date(parseISODate(asset.installDate));
  const end = addCalendarMonths(installed, Math.round(lifeYears * 12 * conditionFactor(asset.condition)));
  if (end.getTime() >= now.getTime()) return null;
  return (now.getTime() - end.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

function urgencyInsight(household: Household, forecast: ForecastResult, now: Date): BudgetInsight | null {
  const overdue = forecast.monthly
    .flatMap((month) => month.items)
    .filter((item) => item.overdue && item.kind === "replacement")
    .sort((a, b) => b.cost.mid - a.cost.mid);
  const top = overdue[0];
  if (!top) return null;
  const years = yearsPastLife(household, top, now);
  const age =
    years != null && years >= 0.5
      ? `${itemName(top)} is ${Math.max(1, Math.round(years))} year${Math.round(years) === 1 ? "" : "s"} past its expected life. `
      : `${itemName(top)} is past its expected life. `;
  return {
    id: "urgency",
    tone: "warn",
    title: "Largest risk right now",
    body: `${age}This is the single largest risk in your forecast (${formatMoney(top.cost.mid)}).`,
  };
}

function backlogInsight(forecast: ForecastResult): BudgetInsight | null {
  const overdue = (forecast.monthly[0]?.items ?? []).filter((item) => item.overdue);
  const total = overdue.reduce((sum, item) => sum + item.cost.mid, 0);
  if (total < 400) return null;
  const monthly = roundUpTo(total / 6, 5);
  return {
    id: "backlog",
    tone: "warn",
    title: "Catch-up plan",
    body: `You have ${formatMoney(Math.round(total))} in overdue maintenance. Spreading it over 6 months is about ${formatMoney(monthly)}/month so it doesn’t all hit at once.`,
  };
}

function paceInsight(household: Household, forecast: ForecastResult, now: Date): BudgetInsight | null {
  const fund = household.maintenanceFund;
  const next = forecast.bigTicket[0];
  if (!fund || !next) return null;
  const months = Math.max(1, monthsUntil(next.month, now));
  const needed = next.cost.mid;
  const contribution = fund.monthlyContribution ?? forecast.suggestedMonthlySetAside;
  const projected = fund.balance + contribution * months;
  const name = itemName(next);
  if (projected + 1 >= needed) {
    return {
      id: "pace",
      tone: "ok",
      title: "On track for the next big expense",
      body: `At ${formatMoney(contribution)}/month, you should cover ${name} (${formatMoney(needed)}) in about ${months} month${months === 1 ? "" : "s"}.`,
    };
  }
  const shortfall = Math.round(needed - projected);
  const bumpTo = roundUpTo((needed - fund.balance) / months, 5);
  return {
    id: "pace",
    tone: "info",
    title: "Savings pace",
    body: `At ${formatMoney(contribution)}/month, you’ll be ${formatMoney(shortfall)} short when ${name} comes due. Consider bumping to ${formatMoney(bumpTo)}/month.`,
  };
}

function seasonalInsight(forecast: ForecastResult): BudgetInsight | null {
  const horizon = forecast.monthly.slice(0, 12);
  if (horizon.every((month) => month.total === 0)) return null;
  const scored = SEASONS.map((season) => {
    const months = horizon.filter((month) => season.months.includes(monthNumber(month.month)));
    const total = months.reduce((sum, month) => sum + month.total, 0);
    const items = months.flatMap((month) => month.items).sort((a, b) => b.cost.mid - a.cost.mid);
    const peak = months.slice().sort((a, b) => b.total - a.total)[0];
    return { season, total, items, peak };
  }).sort((a, b) => b.total - a.total);
  const top = scored[0];
  const mean = scored.reduce((sum, item) => sum + item.total, 0) / scored.length;
  if (!top || top.total < 50 || top.total < mean * 1.25) return null;
  let names = top.items.map(itemName);
  names = [...new Set(names.map((n) => n.trim()))];
  const extra = names.length > 3 ? names.length - 3 : 0;
  const shown = names.slice(0, 3);
  const joined =
    shown.length === 0
      ? "Several jobs"
      : shown.length === 2
        ? `${shown[0]} and ${shown[1]}`
        : shown.join(", ").replace(/, ([^,]*)$/, ", and $1");
  const list = extra > 0 ? `${joined} and ${extra} more` : joined;
  const monthName = top.peak
    ? new Date(Number(top.peak.month.slice(0, 4)), Number(top.peak.month.slice(5, 7)) - 1, 1).toLocaleDateString(
        "en-US",
        { month: "long" },
      )
    : null;
  const when = monthName ? ` all hit in ${monthName}` : "";
  return {
    id: "seasonal",
    tone: "info",
    title: `${top.season.label} is your most expensive stretch`,
    body: `${list}${when}.`,
  };
}

export function budgetInsights(household: Household, forecast: ForecastResult, now = new Date()): BudgetInsight[] {
  const insights = [
    urgencyInsight(household, forecast, now),
    backlogInsight(forecast),
    paceInsight(household, forecast, now),
    seasonalInsight(forecast),
  ].filter((item): item is BudgetInsight => Boolean(item));
  if (insights.some((item) => item.id === "urgency") && insights.some((item) => item.id === "backlog")) {
    const overdueCount = (forecast.monthly[0]?.items ?? []).filter((item) => item.overdue).length;
    if (overdueCount <= 1) return insights.filter((item) => item.id !== "backlog");
  }
  return insights;
}

export function spikeLabel(items: ForecastItem[]): string | null {
  const top = [...items].sort((a, b) => b.cost.mid - a.cost.mid)[0];
  return top ? itemName(top) : null;
}
