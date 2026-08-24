import { addCalendarMonths, addCalendarYears, addDays, parseISODate, startOfDay, toISODate } from "@/lib/dates";
import { isDoneThisPeriod, lastCompletion, nextDueDate } from "@/lib/duties";
import { retailerUrlFor } from "@/lib/retailer";
import { DEFAULT_LEAD_TIME_DAYS, DEFAULT_QUANTITY, deriveOrderByDate, expectedArrivalFor, leadTimeDaysFor } from "@/lib/supply";
import type { Completion, Duty, Household, SupplyAutomation } from "@/lib/types";

export const COMING_UP_DAYS = 21;
export const ARRIVAL_GRACE_DAYS = 3;

export type RestockBucket = "order_now" | "coming_up" | "stocked" | "ordered";

export type RestockPlacement = {
  bucket: RestockBucket;
  nudgeArrive: boolean;
  nextNeedDate: string | null;
  orderByDate: string | null;
};

function dateFromISO(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function linkedDutyIdsFor(item: Pick<SupplyAutomation, "dutyId" | "linkedDutyIds">): string[] {
  const ids = [item.dutyId, ...(item.linkedDutyIds ?? [])].filter(Boolean);
  return [...new Set(ids)];
}

export function consumableForDuty(
  items: SupplyAutomation[],
  dutyId: string,
): SupplyAutomation | undefined {
  return items.find((item) => linkedDutyIdsFor(item).includes(dutyId));
}

export function normalizeConsumable(item: SupplyAutomation): SupplyAutomation {
  const linkedDutyIds = linkedDutyIdsFor(item);
  const retailerUrl = retailerUrlFor(item) ?? "";
  const ordered = item.state === "ordered" || item.orderInFlight;
  const qtyPerOrder = Math.max(1, Math.round(item.qtyPerOrder ?? item.quantity ?? DEFAULT_QUANTITY));
  return {
    ...item,
    linkedDutyIds,
    dutyId: linkedDutyIds[0] ?? item.dutyId,
    retailerUrl,
    amazonProductUrl: item.amazonProductUrl || retailerUrl,
    onHand: Math.max(0, Math.round(item.onHand ?? 0)),
    qtyPerOrder,
    quantity: qtyPerOrder,
    state: ordered ? "ordered" : "stocked",
    orderInFlight: ordered,
  };
}

function nextOnce(duty: Duty, completions: Completion[], _onOrAfter: Date): Date | null {
  if (!duty.dueDate || lastCompletion(duty.id, completions)) return null;
  return new Date(parseISODate(duty.dueDate));
}

function nextDaily(onOrAfter: Date): Date {
  return new Date(onOrAfter.getFullYear(), onOrAfter.getMonth(), onOrAfter.getDate());
}

function nextWeekly(weekday: number, onOrAfter: Date): Date {
  const start = new Date(onOrAfter.getFullYear(), onOrAfter.getMonth(), onOrAfter.getDate());
  const add = (weekday - start.getDay() + 7) % 7;
  return addDays(start, add);
}

function nextMonthly(monthDay: number, onOrAfter: Date): Date {
  const day = Math.min(monthDay, new Date(onOrAfter.getFullYear(), onOrAfter.getMonth() + 1, 0).getDate());
  const candidate = new Date(onOrAfter.getFullYear(), onOrAfter.getMonth(), day);
  if (startOfDay(candidate) >= startOfDay(onOrAfter)) return candidate;
  const nextMonth = new Date(onOrAfter.getFullYear(), onOrAfter.getMonth() + 1, 1);
  const nextDay = Math.min(monthDay, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate());
  return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay);
}

export function upcomingDutyDates(
  duty: Duty,
  completions: Completion[],
  now: Date,
  count: number,
  installedAt?: string | null,
): Date[] {
  if (count <= 0 || duty.archived) return [];
  const dates: Date[] = [];
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (duty.frequency === "once") {
    const due = nextOnce(duty, completions, cursor);
    return due ? [due] : [];
  }

  if (duty.frequency === "quarterly" || duty.frequency === "yearly") {
    let next = nextDueDate(duty, completions, now, installedAt);
    if (!next) return [];
    if (isDoneThisPeriod(duty, completions, now, installedAt)) {
      next = duty.frequency === "quarterly" ? addCalendarMonths(next, 3) : addCalendarYears(next, 1);
    }
    while (dates.length < count) {
      dates.push(next);
      next = duty.frequency === "quarterly" ? addCalendarMonths(next, 3) : addCalendarYears(next, 1);
    }
    return dates;
  }

  for (let i = 0; i < count; i += 1) {
    let next: Date;
    if (duty.frequency === "daily") next = nextDaily(cursor);
    else if (duty.frequency === "weekly") next = nextWeekly(duty.weekday, cursor);
    else next = nextMonthly(duty.monthDay, cursor);

    if (i === 0 && isDoneThisPeriod(duty, completions, now, installedAt)) {
      cursor = addDays(next, 1);
      if (duty.frequency === "daily") next = nextDaily(cursor);
      else if (duty.frequency === "weekly") next = nextWeekly(duty.weekday, cursor);
      else next = nextMonthly(duty.monthDay, cursor);
    }
    dates.push(next);
    cursor = addDays(next, 1);
  }
  return dates;
}

export function runwayFor(
  item: SupplyAutomation,
  household: Pick<Household, "duties" | "completions">,
  now = new Date(),
): { nextNeedDate: string | null; orderByDate: string | null; upcomingDates: string[] } {
  const current = normalizeConsumable(item);
  const upcoming = current.linkedDutyIds
    .flatMap((dutyId) => {
      const duty = household.duties.find((entry) => entry.id === dutyId);
      if (!duty) return [];
      return upcomingDutyDates(duty, household.completions, now, current.onHand + 8, current.installedAt);
    })
    .map(toISODate)
    .sort((a, b) => a.localeCompare(b));

  const nextNeedDate = upcoming[current.onHand] ?? null;
  const fallbackNeed =
    !nextNeedDate && (current.orderByDate || current.nextOrderDate)
      ? current.orderByDate || current.nextOrderDate
      : nextNeedDate;
  const orderByDate = fallbackNeed
    ? toISODate(addDays(dateFromISO(fallbackNeed), -leadTimeDaysFor(current)))
    : null;
  return { nextNeedDate: fallbackNeed, orderByDate, upcomingDates: upcoming };
}

export function restockPlacement(
  item: SupplyAutomation,
  household: Pick<Household, "duties" | "completions">,
  now = new Date(),
): RestockPlacement {
  const current = normalizeConsumable(item);
  const runway = runwayFor(current, household, now);
  const today = toISODate(now);

  if (current.state === "ordered" && current.expectedArrivalDate) {
    const resurface = toISODate(addDays(dateFromISO(current.expectedArrivalDate), ARRIVAL_GRACE_DAYS));
    if (today <= resurface) {
      return { bucket: "ordered", nudgeArrive: false, ...runway };
    }
    return { bucket: "order_now", nudgeArrive: true, ...runway };
  }

  if (!runway.orderByDate) {
    return { bucket: "stocked", nudgeArrive: false, ...runway };
  }
  if (runway.orderByDate <= today) {
    return { bucket: "order_now", nudgeArrive: false, ...runway };
  }
  const soon = toISODate(addDays(now, COMING_UP_DAYS));
  if (runway.orderByDate <= soon) {
    return { bucket: "coming_up", nudgeArrive: false, ...runway };
  }
  return { bucket: "stocked", nudgeArrive: false, ...runway };
}

export function groupRestock(
  items: SupplyAutomation[],
  household: Pick<Household, "duties" | "completions">,
  now = new Date(),
): Record<RestockBucket, SupplyAutomation[]> {
  const groups: Record<RestockBucket, SupplyAutomation[]> = {
    order_now: [],
    coming_up: [],
    stocked: [],
    ordered: [],
  };
  for (const item of items) {
    const placement = restockPlacement(item, household, now);
    groups[placement.bucket].push(normalizeConsumable(item));
  }
  const sortKey = (item: SupplyAutomation) => restockPlacement(item, household, now).orderByDate ?? "9999";
  for (const key of Object.keys(groups) as RestockBucket[]) {
    groups[key].sort((a, b) => {
      const byDate = sortKey(a).localeCompare(sortKey(b));
      if (byDate !== 0) return byDate;
      return a.itemName.localeCompare(b.itemName);
    });
  }
  return groups;
}

export function digestCandidates(
  items: SupplyAutomation[],
  household: Pick<Household, "duties" | "completions">,
  now = new Date(),
): SupplyAutomation[] {
  const today = toISODate(now);
  const weekEnd = toISODate(addDays(now, 7));
  return items.filter((item) => {
    const placement = restockPlacement(item, household, now);
    if (placement.bucket === "order_now") return true;
    return placement.bucket === "coming_up" && Boolean(placement.orderByDate) && placement.orderByDate! <= weekEnd && placement.orderByDate! >= today;
  });
}

export function markConsumableOrdered(item: SupplyAutomation, now = new Date()): SupplyAutomation {
  const current = normalizeConsumable(item);
  return {
    ...current,
    state: "ordered",
    orderInFlight: true,
    expectedArrivalDate: expectedArrivalFor(now, leadTimeDaysFor(current)),
  };
}

export function receiveConsumable(item: SupplyAutomation, qty: number): SupplyAutomation {
  const current = normalizeConsumable(item);
  const amount = Math.max(1, Math.round(qty) || current.qtyPerOrder);
  return {
    ...current,
    onHand: current.onHand + amount,
    qtyPerOrder: amount,
    quantity: amount,
    state: "stocked",
    orderInFlight: false,
    expectedArrivalDate: null,
  };
}

export function consumeLinkedUnit(item: SupplyAutomation): SupplyAutomation {
  const current = normalizeConsumable(item);
  return { ...current, onHand: Math.max(0, current.onHand - 1) };
}

export function restoreLinkedUnit(item: SupplyAutomation): SupplyAutomation {
  const current = normalizeConsumable(item);
  return { ...current, onHand: current.onHand + 1 };
}

export function saveRetailerLink(item: SupplyAutomation, url: string): SupplyAutomation {
  const current = normalizeConsumable(item);
  return {
    ...current,
    retailerUrl: url,
    amazonProductUrl: url,
  };
}

export function usedWhere(
  item: SupplyAutomation,
  household: Pick<Household, "duties" | "rooms">,
): string {
  const duty = household.duties.find((entry) => linkedDutyIdsFor(item).includes(entry.id));
  if (!duty) return "";
  const room = household.rooms.find((entry) => entry.id === duty.room || entry.id === duty.nodeId);
  const roomLabel = room?.name ?? duty.room;
  return `${roomLabel} → ${duty.title}`;
}

export function defaultConsumableFields(now = new Date()): Pick<
  SupplyAutomation,
  "sku" | "asin" | "amazonProductUrl" | "amazonOneClick" | "amazonNotes" | "retailerUrl" | "quantity" | "onHand" | "qtyPerOrder" | "leadTimeDays" | "installedAt" | "lifespanValue" | "lifespanUnit" | "orderByDate" | "nextOrderDate" | "orderInFlight" | "state" | "expectedArrivalDate"
> {
  const installedAt = toISODate(now);
  const orderByDate = deriveOrderByDate(installedAt, 12, "months");
  return {
    sku: "",
    asin: "",
    amazonProductUrl: "",
    amazonOneClick: false,
    amazonNotes: "",
    retailerUrl: "",
    quantity: DEFAULT_QUANTITY,
    onHand: 0,
    qtyPerOrder: DEFAULT_QUANTITY,
    leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
    installedAt,
    lifespanValue: 12,
    lifespanUnit: "months",
    orderByDate,
    nextOrderDate: orderByDate,
    orderInFlight: false,
    state: "stocked",
    expectedArrivalDate: null,
  };
}
