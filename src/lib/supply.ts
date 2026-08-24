import { addCalendarMonths, addDays, parseISODate, startOfDay, toISODate } from "@/lib/dates";
import type { LifespanUnit, SupplyAutomation } from "@/lib/types";

export const DEFAULT_LEAD_TIME_DAYS = 14;
export const DEFAULT_QUANTITY = 1;

function dateFromISO(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function leadTimeDaysFor(item: Pick<SupplyAutomation, "leadTimeDays"> | { leadTimeDays?: number }): number {
  const value = item.leadTimeDays;
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LEAD_TIME_DAYS;
  return Math.min(90, Math.max(0, Math.round(value)));
}

export function deriveOrderByDate(
  installedAt: string,
  lifespanValue: number,
  lifespanUnit: LifespanUnit,
): string {
  const [year, month, day] = installedAt.split("-").map(Number);
  const installed = new Date(year, (month ?? 1) - 1, day ?? 1);
  const amount = Math.max(1, Math.round(lifespanValue) || 1);
  if (lifespanUnit === "days") return toISODate(addDays(installed, amount));
  if (lifespanUnit === "months") return toISODate(addCalendarMonths(installed, amount));
  return toISODate(addCalendarMonths(installed, amount * 12));
}

export function lifespanLabel(value: number, unit: LifespanUnit): string {
  const amount = Math.max(1, value);
  if (unit === "days") return amount === 1 ? "1 day" : `${amount} days`;
  if (unit === "months") return amount === 1 ? "1 month" : `${amount} months`;
  return amount === 1 ? "1 year" : `${amount} years`;
}

export function reminderDateFor(item: SupplyAutomation): string {
  const due = item.orderByDate || item.nextOrderDate;
  return toISODate(addDays(dateFromISO(due), -leadTimeDaysFor(item)));
}

export function expectedArrivalFor(now = new Date(), leadTimeDays = DEFAULT_LEAD_TIME_DAYS): string {
  return toISODate(addDays(now, Math.max(0, leadTimeDays)));
}

export function isOrdered(item: Pick<SupplyAutomation, "state" | "orderInFlight">): boolean {
  return item.state === "ordered" || item.orderInFlight;
}

export function isAwaitingArrival(item: SupplyAutomation, now = new Date()): boolean {
  if (!isOrdered(item) || !item.expectedArrivalDate) return false;
  return item.expectedArrivalDate >= toISODate(now);
}

export function isWithinArrivalHold(item: SupplyAutomation, now = new Date()): boolean {
  if (!isOrdered(item) || !item.expectedArrivalDate) return false;
  const resurface = toISODate(addDays(dateFromISO(item.expectedArrivalDate), 3));
  return toISODate(now) <= resurface;
}

export function markAutomationOrdered(item: SupplyAutomation, now = new Date()): SupplyAutomation {
  return {
    ...item,
    state: "ordered",
    orderInFlight: true,
    expectedArrivalDate: expectedArrivalFor(now, leadTimeDaysFor(item)),
  };
}

export function reconcileAutomation(item: SupplyAutomation): SupplyAutomation {
  return item;
}

export function isReorderReminderActive(item: SupplyAutomation, now = new Date()): boolean {
  if (isWithinArrivalHold(item, now)) return false;
  return reminderDateFor(item) <= toISODate(now);
}

export function isAutomationDue(item: SupplyAutomation, now = new Date()): boolean {
  return isReorderReminderActive(item, now);
}

export function sortAutomations(items: SupplyAutomation[]): SupplyAutomation[] {
  return [...items].sort((a, b) => {
    const byDate = reminderDateFor(a).localeCompare(reminderDateFor(b));
    if (byDate !== 0) return byDate;
    return a.itemName.localeCompare(b.itemName);
  });
}

export function orderDateFor(item: SupplyAutomation): string {
  return reminderDateFor(item);
}

export function daysUntilOrder(item: SupplyAutomation, now = new Date()): number {
  const due = parseISODate(reminderDateFor(item));
  return Math.round((due - startOfDay(now)) / 86_400_000);
}

export function isDueToOrderSoon(item: SupplyAutomation, now = new Date(), windowDays = 21): boolean {
  const current = reconcileAutomation(item);
  if (isAwaitingArrival(current, now)) return false;
  return daysUntilOrder(current, now) <= windowDays;
}
