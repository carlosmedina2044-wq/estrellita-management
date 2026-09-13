import { tActive, type MessageKey } from "@/i18n";
import { tMonthName } from "@/i18n/content";
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

const SEASONS: { id: "winter" | "spring" | "summer" | "fall"; months: number[] }[] = [
  { id: "winter", months: [12, 1, 2] },
  { id: "spring", months: [3, 4, 5] },
  { id: "summer", months: [6, 7, 8] },
  { id: "fall", months: [9, 10, 11] },
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
  const name = itemName(top);
  const age =
    years != null && years >= 0.5
      ? Math.round(years) === 1
        ? tActive("budget.insight.pastLifeYear1", { name })
        : tActive("budget.insight.pastLifeYears", { name, years: Math.max(1, Math.round(years)) })
      : tActive("budget.insight.pastLife", { name });
  return {
    id: "urgency",
    tone: "warn",
    title: tActive("budget.insight.urgencyTitle"),
    body: tActive("budget.insight.urgencyBody", { age, cost: formatMoney(top.cost.mid) }),
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
    title: tActive("budget.insight.backlogTitle"),
    body: tActive("budget.insight.backlogBody", {
      total: formatMoney(Math.round(total)),
      monthly: formatMoney(monthly),
    }),
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
      title: tActive("budget.insight.paceOnTrackTitle"),
      body:
        months === 1
          ? tActive("budget.insight.paceOnTrackBody1", {
              contribution: formatMoney(contribution),
              name,
              needed: formatMoney(needed),
            })
          : tActive("budget.insight.paceOnTrackBody", {
              contribution: formatMoney(contribution),
              name,
              needed: formatMoney(needed),
              months,
            }),
    };
  }
  const shortfall = Math.round(needed - projected);
  const bumpTo = roundUpTo((needed - fund.balance) / months, 5);
  return {
    id: "pace",
    tone: "info",
    title: tActive("budget.insight.paceShortTitle"),
    body: tActive("budget.insight.paceShortBody", {
      contribution: formatMoney(contribution),
      shortfall: formatMoney(shortfall),
      name,
      bump: formatMoney(bumpTo),
    }),
  };
}

function joinItemNames(names: string[]): string {
  if (names.length === 0) return tActive("budget.insight.severalJobs");
  if (names.length === 1) return names[0];
  if (names.length === 2) return tActive("budget.insight.listAnd", { a: names[0], b: names[1] });
  const head = names.slice(0, -1).join(", ");
  return `${head},${tActive("budget.insight.listAnd", { a: "", b: names[names.length - 1] })}`;
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
  const joined = joinItemNames(shown);
  const list = extra > 0 ? tActive("budget.insight.andMore", { joined, extra }) : joined;
  const monthIndex = top.peak ? Number(top.peak.month.slice(5, 7)) - 1 : null;
  const monthName = monthIndex != null && monthIndex >= 0 && monthIndex < 12 ? tMonthName(monthIndex) : null;
  const when = monthName ? tActive("budget.insight.allHitIn", { month: monthName }) : "";
  return {
    id: "seasonal",
    tone: "info",
    title: tActive("budget.insight.seasonTitleTpl", {
      season: tActive(`budget.season.${top.season.id}` as MessageKey),
    }),
    body: tActive("budget.insight.seasonBody", { list, when }),
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
