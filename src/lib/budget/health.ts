import { formatMoney, type ForecastResult } from "@/lib/forecast";
import type { Household } from "@/lib/types";

export type FundHealth = {
  saved: number | null;
  needed12: number;
  coveragePct: number | null;
  suggestedMonthly: number;
  homeValue?: number;
  annualPctOfValue: number | null;
  onePercentCopy: string | null;
};

export function fundHealth(household: Household, forecast12: ForecastResult): FundHealth {
  const needed12 = Math.round(forecast12.totals.total);
  const saved = household.maintenanceFund ? household.maintenanceFund.balance : null;
  const coveragePct =
    saved == null ? null : needed12 <= 0 ? 100 : Math.min(100, Math.round((saved / needed12) * 100));
  const homeValue = household.homeValueEstimate;
  const suggestedMonthly = forecast12.suggestedMonthlySetAside;
  const annual = suggestedMonthly * 12;
  const annualPctOfValue =
    homeValue && homeValue > 0 ? Math.round((annual / homeValue) * 1000) / 10 : null;
  let onePercentCopy: string | null = null;
  if (annualPctOfValue != null && homeValue) {
    const band =
      annualPctOfValue < 1
        ? "below the typical 1–3% range"
        : annualPctOfValue <= 3
          ? "within the typical 1–3% range"
          : "above the typical 1–3% range";
    onePercentCopy = `Your forecast is ${formatMoney(suggestedMonthly)}/mo, about ${annualPctOfValue}% of your home’s value annually, which is ${band}.`;
  }
  return {
    saved,
    needed12,
    coveragePct,
    suggestedMonthly,
    homeValue,
    annualPctOfValue,
    onePercentCopy,
  };
}
