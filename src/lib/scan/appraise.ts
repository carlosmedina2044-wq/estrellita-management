import { catalogEntry, normalizeAssetType, type CatalogCost } from "@/lib/asset-catalog";
import { addCalendarMonths, toISODate } from "@/lib/dates";
import { roundUpTo } from "@/lib/forecast";
import type { AssetType } from "@/lib/types";

/** A manufacture date: a real Date, an ISO "YYYY-MM-DD" string, or year (+ optional month). */
export type ManufacturedAt = Date | string | { year: number; month?: number };

export type AgeStatus = "new" | "midlife" | "near_end" | "past_life";

export type Appraisal = {
  type: AssetType;
  /** Local ISO date used as the install date (1st of the month; July when only the year is known). */
  manufacturedISO: string;
  /** The month was not known, so July was used. */
  monthAssumed: boolean;
  ageYears: number;
  lifeYears: number;
  /** lifeYears - ageYears, one decimal. Negative once past its usual life. */
  yearsLeft: number;
  /** Share of usual life used, 0.0 and up (1 decimal place of a percent not needed). */
  fractionUsed: number;
  status: AgeStatus;
  replacement: CatalogCost;
  /** ISO date its usual life ends (same math as the repair forecast). */
  endOfLifeISO: string;
  /** Whole months from the start of this month to the end-of-life month; 0 when due or past due. */
  monthsToEnd: number;
  setAside: {
    /** Dollars a month, rounded up to $5, to have the mid replacement cost by the end-of-life month. */
    monthly: number;
    /** Months it is spread over: monthsToEnd + 1 (the replacement month counts), never less than 1. */
    months: number;
  };
};

const round1 = (value: number) => Math.round(value * 10) / 10;
const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.25;

function toLocalDate(value: ManufacturedAt): { date: Date; monthAssumed: boolean } | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : { date: value, monthAssumed: false };
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value);
    if (!m) return undefined;
    return { date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1)), monthAssumed: false };
  }
  if (!Number.isInteger(value.year)) return undefined;
  const monthAssumed = value.month === undefined;
  return { date: new Date(value.year, (value.month ?? 7) - 1, 1), monthAssumed };
}

/** Status thresholds: new under 50% of usual life, near the end from 80%, past it from 100%. */
export function statusFor(fractionUsed: number): AgeStatus {
  if (fractionUsed >= 1) return "past_life";
  if (fractionUsed >= 0.8) return "near_end";
  if (fractionUsed >= 0.5) return "midlife";
  return "new";
}

export function appraise(input: { type: AssetType; manufacturedAt: ManufacturedAt; now?: Date }): Appraisal | undefined {
  const now = input.now ?? new Date();
  const parsed = toLocalDate(input.manufacturedAt);
  if (!parsed) return undefined;
  const type = normalizeAssetType(input.type);
  const catalog = catalogEntry(type);
  const lifeYears = catalog.defaultLifeYears;

  const ageRaw = Math.max(0, (now.getTime() - parsed.date.getTime()) / DAY_MS / YEAR_DAYS);
  const fractionUsed = ageRaw / lifeYears;

  // Same end-of-life math as buildForecast: install + round(life * 12) calendar months (condition "good").
  const end = addCalendarMonths(parsed.date, Math.round(lifeYears * 12));
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const overdue = end.getTime() < startOfThisMonth.getTime();
  const monthsToEnd = overdue ? 0 : (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  const months = monthsToEnd + 1;

  return {
    type,
    manufacturedISO: toISODate(parsed.date),
    monthAssumed: parsed.monthAssumed,
    ageYears: round1(ageRaw),
    lifeYears,
    yearsLeft: round1(lifeYears - ageRaw),
    fractionUsed,
    status: statusFor(fractionUsed),
    replacement: catalog.defaultReplacementCost,
    endOfLifeISO: toISODate(end),
    monthsToEnd,
    setAside: { monthly: roundUpTo(catalog.defaultReplacementCost.mid / months, 5), months },
  };
}
