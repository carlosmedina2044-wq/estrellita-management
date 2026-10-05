import type { ForecastResult } from "@/lib/forecast";
import type { Household } from "@/lib/types";

export type FundHealth = {
  saved: number | null;
  needed12: number;
  coveragePct: number | null;
  suggestedMonthly: number;
};

export function fundHealth(household: Household, forecast12: ForecastResult): FundHealth {
  const needed12 = Math.round(forecast12.totals.total);
  const saved = household.maintenanceFund ? household.maintenanceFund.balance : null;
  const coveragePct =
    saved == null ? null : needed12 <= 0 ? 100 : Math.min(100, Math.round((saved / needed12) * 100));
  const suggestedMonthly = forecast12.suggestedMonthlySetAside;
  return {
    saved,
    needed12,
    coveragePct,
    suggestedMonthly,
  };
}
