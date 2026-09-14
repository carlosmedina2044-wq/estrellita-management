import { monthRange, weekRange } from "@/lib/dates";
import { typicalCostFor } from "@/lib/costs/quotes";
import { completionsInRange } from "@/lib/duties";
import { dutyTopic } from "@/lib/duty-topics";
import type { Completion, Duty, Household } from "@/lib/types";

export const LEDGER_MIN_AMOUNT = 20;
const EFFORT_FALLBACK = 10;

export type ValueLedger = {
  count: number;
  minutes: number;
  hours: number;
  amount: number;
  showAmount: boolean;
};

export function handledYourselfAmount(duty: Duty, completion: Completion): number {
  if (typeof completion.actualCost === "number") return 0;
  if (duty.isDiy === false) return 0;
  if (duty.frequency === "daily" || duty.frequency === "weekly" || duty.frequency === "once") {
    return 0;
  }
  if (typeof duty.estimatedCost === "number" && duty.estimatedCost > 0) {
    return duty.estimatedCost;
  }
  const topic = dutyTopic(duty);
  if (topic === "water-heater" || /water heater/i.test(duty.title)) {
    return typicalCostFor("water_heater_flush").typical;
  }
  if (
    topic === "hvac-filter" ||
    /furnace|hvac service|a\/?c service/i.test(duty.title)
  ) {
    return typicalCostFor("furnace_service").typical;
  }
  if (/gutter/i.test(duty.title)) return typicalCostFor("gutter_cleaning").typical;
  if (topic === "dryer-vent" || /dryer vent/i.test(duty.title)) return 100;
  return 0;
}

export function valueLedger(household: Household, start: Date, end: Date): ValueLedger {
  const items = completionsInRange(household.completions, start, end);
  let minutes = 0;
  let amount = 0;
  for (const item of items) {
    const duty = household.duties.find((entry) => entry.id === item.dutyId);
    if (!duty) continue;
    minutes += duty.estimatedMinutes ?? EFFORT_FALLBACK;
    amount += handledYourselfAmount(duty, item);
  }
  const hours = Math.round((minutes / 60) * 2) / 2;
  return {
    count: items.length,
    minutes,
    hours,
    amount,
    showAmount: amount >= LEDGER_MIN_AMOUNT,
  };
}

export function monthLedger(household: Household, now = new Date()): ValueLedger {
  const { start, end } = monthRange(now);
  return valueLedger(household, start, end);
}

export function weekLedger(household: Household, now = new Date()): ValueLedger {
  const { start, end } = weekRange(now);
  return valueLedger(household, start, end);
}

import type { MessageKey } from "@/i18n";

export function formatLedgerLine(
  ledger: ValueLedger,
  t: (key: MessageKey, params?: Record<string, string | number>) => string,
): string {
  const hoursText =
    ledger.hours === 1 ? t("ledger.hour") : t("ledger.hours", { hours: ledger.hours });
  const base =
    ledger.hours < 1
      ? t("ledger.monthMinutes", { minutes: ledger.minutes })
      : t("ledger.month", { hours: hoursText });
  if (!ledger.showAmount) return base;
  return `${base} · ${t("ledger.amount", { amount: Math.round(ledger.amount) })}`;
}
