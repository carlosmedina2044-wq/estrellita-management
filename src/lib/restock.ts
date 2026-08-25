import { addCalendarMonths, addCalendarYears, addDays, parseISODate, startOfDay, toISODate } from "@/lib/dates";
import { isDoneThisPeriod, isOverdue, lastCompletion, nextDueDate } from "@/lib/duties";
import { retailerUrlFor } from "@/lib/retailer";
import { DEFAULT_LEAD_TIME_DAYS, DEFAULT_QUANTITY, isOrdered, leadTimeDaysFor } from "@/lib/supply";
import type { Completion, Duty, Frequency, Household, SupplyAutomation } from "@/lib/types";

export const DEFAULT_REORDER_AT = 0;
export const COMING_UP_DAYS = 21;
export const ARRIVAL_GRACE_DAYS = 3;
export const DEFAULT_SAFETY_BUFFER_DAYS = 7;
/** Below this fraction of a full unit, a check-in answer of "Running low" applies. */
export const CHECKIN_LEVELS = {
  plenty: 1.0,
  half: 0.5,
  low: 0.2,
  out: 0,
} as const;
export type CheckinLevel = keyof typeof CHECKIN_LEVELS;
export const CHECKIN_OPTIONS: { level: CheckinLevel; label: string; short: string }[] = [
  { level: "plenty", label: "Plenty left", short: "Full" },
  { level: "half", label: "About half", short: "Half" },
  { level: "low", label: "Running low", short: "Low" },
  { level: "out", label: "Out", short: "Out" },
];
/** Don't re-ask for a check-in if the estimate was confirmed within this many days. */
export const CHECKIN_STALE_DAYS = 30;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

type RestockHousehold = Pick<Household, "duties" | "completions" | "restockSafetyBufferDays">;

export function reorderAtFor(item: Pick<SupplyAutomation, "reorderAt"> | { reorderAt?: number }): number {
  const value = item.reorderAt;
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_REORDER_AT;
  return Math.min(99, Math.max(0, Math.round(value)));
}

export type RestockBucket = "order_now" | "coming_up" | "stocked" | "ordered";

export type RestockPlacement = {
  bucket: RestockBucket;
  nudgeArrive: boolean;
  nextNeedDate: string | null;
  orderByDate: string | null;
  dutyOrderByDate: string | null;
  runwayDays: number | null;
  estimatedLevelFraction: number | null;
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

export type PartStatus = {
  kind: "part_on_hand" | "arriving" | "order_first" | "install_today";
  label: string;
};

export function partStatusForDuty(
  duty: Duty,
  household: Pick<Household, "duties" | "completions" | "supplyAutomations" | "restockSafetyBufferDays">,
  now = new Date(),
): PartStatus | null {
  if (duty.kind !== "replacement") return null;
  const item = consumableForDuty(household.supplyAutomations, duty.id);
  if (!item) return null;
  const placement = restockPlacement(item, household, now);
  if (placement.bucket === "ordered") {
    const day = item.expectedArrivalDate
      ? new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(parseISODate(item.expectedArrivalDate)))
      : "";
    return { kind: "arriving", label: day ? `Arriving ${day}` : "Arriving" };
  }
  if (item.onHand <= 0 && placement.bucket === "order_now") {
    return { kind: "order_first", label: "Order first" };
  }
  if (item.onHand > 0) {
    const installedAt = item.installedAt ?? null;
    const overdue = isOverdue(duty, household.completions, now, installedAt);
    const next = nextDueDate(duty, household.completions, now, installedAt);
    const dueSoon = Boolean(next) && startOfDay(next!) <= startOfDay(addDays(now, 7));
    if (overdue || dueSoon) return { kind: "install_today", label: "Supplies ready" };
    return { kind: "part_on_hand", label: "Supplies on hand" };
  }
  return null;
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
    onHand: Math.max(0, Math.round(item.onHand ?? 0)),
    qtyPerOrder,
    reorderAt: reorderAtFor(item),
    quantity: qtyPerOrder,
    state: ordered ? "ordered" : "stocked",
    orderInFlight: ordered,
  };
}

function nextOnce(duty: Duty, completions: Completion[]): Date | null {
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
    const due = nextOnce(duty, completions);
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
    !nextNeedDate && upcoming.length === 0 && (current.orderByDate || current.nextOrderDate)
      ? current.orderByDate || current.nextOrderDate
      : nextNeedDate;
  const orderByDate = fallbackNeed
    ? toISODate(addDays(dateFromISO(fallbackNeed), -leadTimeDaysFor(current)))
    : null;
  return { nextNeedDate: fallbackNeed, orderByDate, upcomingDates: upcoming };
}

function isISODate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value);
}

function wholeDaysBetween(fromISO: string, now: Date): number {
  return Math.max(0, Math.round((startOfDay(now) - parseISODate(fromISO)) / MS_PER_DAY));
}

function storedRate(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const rounded = Math.round(value * 10_000) / 10_000;
  if (rounded <= 0) return undefined;
  return Math.min(100, rounded);
}

function earlierISO(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function cadenceDaysFor(frequency: Frequency): number | null {
  switch (frequency) {
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

export function safetyBufferDaysFor(
  household: Pick<Household, "restockSafetyBufferDays">,
): number {
  const value = household.restockSafetyBufferDays;
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_SAFETY_BUFFER_DAYS;
  return Math.min(30, Math.max(0, Math.round(value)));
}

export function lifespanDaysFor(
  item: Pick<SupplyAutomation, "lifespanValue" | "lifespanUnit">,
): number | null {
  const value = item.lifespanValue;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (item.lifespanUnit === "days") return value;
  if (item.lifespanUnit === "months") return value * 30;
  if (item.lifespanUnit === "years") return value * 365;
  return null;
}

export type RateSource = "observed" | "duty" | "lifespan" | "none";

export function ratePerDayFor(
  item: SupplyAutomation,
  household: Pick<Household, "duties">,
): { rate: number; source: RateSource } | null {
  const current = normalizeConsumable(item);
  const observed = current.observedRatePerDay;
  if (typeof observed === "number" && Number.isFinite(observed) && observed > 0) {
    return { rate: observed, source: "observed" };
  }

  let shortest: number | null = null;
  for (const dutyId of linkedDutyIdsFor(current)) {
    const duty = household.duties.find((entry) => entry.id === dutyId);
    if (!duty) continue;
    const days = cadenceDaysFor(duty.frequency);
    if (days == null) continue;
    if (shortest == null || days < shortest) shortest = days;
  }
  if (shortest != null && shortest > 0) {
    return { rate: 1 / shortest, source: "duty" };
  }

  const lifespanDays = lifespanDaysFor(current);
  if (lifespanDays != null && lifespanDays > 0) {
    return { rate: 1 / lifespanDays, source: "lifespan" };
  }

  return null;
}

export function anchorLevelFor(
  item: SupplyAutomation,
  now = new Date(),
): { level: number; atISO: string } | null {
  const current = normalizeConsumable(item);
  const today = toISODate(now);
  const confirmedLevel = current.lastConfirmedLevel;
  const confirmedAt = current.lastConfirmedAt;
  if (
    typeof confirmedLevel === "number" &&
    Number.isFinite(confirmedLevel) &&
    confirmedLevel >= 0 &&
    isISODate(confirmedAt)
  ) {
    return { level: confirmedLevel, atISO: confirmedAt > today ? today : confirmedAt };
  }
  if (
    current.onHand > 0 &&
    isISODate(current.installedAt) &&
    linkedDutyIdsFor(current).length === 0
  ) {
    return { level: current.onHand, atISO: current.installedAt > today ? today : current.installedAt };
  }
  if (current.onHand > 0) {
    return { level: current.onHand, atISO: today };
  }
  return { level: 0, atISO: today };
}

export function estimatedLevel(
  item: SupplyAutomation,
  household: Pick<Household, "duties">,
  now = new Date(),
): number | null {
  const anchor = anchorLevelFor(item, now);
  if (anchor == null) return null;
  const rate = ratePerDayFor(item, household);
  if (rate == null) return Math.round(anchor.level * 100) / 100;
  const days = wholeDaysBetween(anchor.atISO, now);
  const level = Math.max(0, anchor.level - rate.rate * days);
  return Math.round(level * 100) / 100;
}

export function runwayDaysFor(
  item: SupplyAutomation,
  household: Pick<Household, "duties">,
  now = new Date(),
): number | null {
  const level = estimatedLevel(item, household, now);
  const rate = ratePerDayFor(item, household);
  if (level == null || rate == null) return null;
  if (level === 0 || rate.rate <= 0) return 0;
  return Math.floor(level / rate.rate);
}

export function rateBasedOrderByDate(
  item: SupplyAutomation,
  household: Pick<Household, "duties" | "restockSafetyBufferDays">,
  now = new Date(),
): string | null {
  const runway = runwayDaysFor(item, household, now);
  if (runway == null) return null;
  const runOutDate = addDays(now, runway);
  return toISODate(addDays(runOutDate, -(leadTimeDaysFor(item) + safetyBufferDaysFor(household))));
}

export function applyCheckin(
  item: SupplyAutomation,
  level: CheckinLevel,
  household: Pick<Household, "duties">,
  now = new Date(),
): SupplyAutomation {
  const current = normalizeConsumable(item);
  const predicted = estimatedLevel(current, household, now);
  const pack = Math.max(1, Math.round(current.onHand) || 1);
  const confirmedLevel =
    level === "plenty" ? pack : level === "out" ? 0 : CHECKIN_LEVELS[level] * pack;

  let observedRatePerDay = current.observedRatePerDay;
  const rate = ratePerDayFor(current, household);
  const anchor = anchorLevelFor(current, now);
  const daysElapsed = anchor ? Math.max(1, wholeDaysBetween(anchor.atISO, now)) : 0;
  const canLearn =
    predicted != null &&
    anchor != null &&
    wholeDaysBetween(anchor.atISO, now) >= 7 &&
    rate != null &&
    (rate.source === "observed" || rate.source === "lifespan");
  if (canLearn && rate) {
    const actualConsumed = Math.max(0, anchor.level - confirmedLevel);
    const impliedRate = actualConsumed / daysElapsed;
    const blended =
      impliedRate > 0 ? rate.rate * 0.5 + impliedRate * 0.5 : rate.rate * 0.75;
    observedRatePerDay = storedRate(blended) ?? observedRatePerDay;
  }

  return normalizeConsumable({
    ...current,
    lastConfirmedLevel: confirmedLevel,
    lastConfirmedAt: toISODate(now),
    observedRatePerDay,
    ...(level === "out" ? { onHand: 0 } : {}),
  });
}

export function checkinDue(
  item: SupplyAutomation,
  household: Pick<Household, "duties" | "completions" | "restockSafetyBufferDays">,
  now = new Date(),
): boolean {
  const current = normalizeConsumable(item);
  if (isOrdered(current)) return false;
  const rate = ratePerDayFor(current, household);
  if (rate == null || (rate.source !== "observed" && rate.source !== "lifespan")) return false;
  const runway = runwayDaysFor(current, household, now);
  const threshold = 2 * (leadTimeDaysFor(current) + safetyBufferDaysFor(household));
  if (runway == null || runway > threshold) return false;
  const anchor = anchorLevelFor(current, now);
  if (anchor == null) return false;
  const neverConfirmed = !isISODate(current.lastConfirmedAt);
  const stale = wholeDaysBetween(anchor.atISO, now) > CHECKIN_STALE_DAYS;
  return neverConfirmed || stale;
}

export function updateObservedRateOnReceive(
  item: SupplyAutomation,
  now = new Date(),
): Pick<SupplyAutomation, "observedRatePerDay"> | Record<string, never> {
  const current = normalizeConsumable(item);
  if (!isISODate(current.lastConfirmedAt)) return {};
  const daysBetween = wholeDaysBetween(current.lastConfirmedAt, now);
  if (daysBetween < 7) return {};
  const confirmed = current.lastConfirmedLevel;
  if (typeof confirmed !== "number" || !Number.isFinite(confirmed) || confirmed <= 0) return {};
  const impliedRate = confirmed / daysBetween;
  const existing = current.observedRatePerDay;
  const blended =
    typeof existing === "number" && Number.isFinite(existing) && existing > 0
      ? existing * 0.5 + impliedRate * 0.5
      : impliedRate;
  const stored = storedRate(blended);
  if (stored == null) return {};
  return { observedRatePerDay: stored };
}

function placementExtras(
  item: SupplyAutomation,
  household: Pick<Household, "duties">,
  now: Date,
): { runwayDays: number | null; estimatedLevelFraction: number | null } {
  const current = normalizeConsumable(item);
  const level = estimatedLevel(current, household, now);
  const runwayDays = runwayDaysFor(current, household, now);
  if (level == null) return { runwayDays, estimatedLevelFraction: null };
  const confirmed =
    typeof current.lastConfirmedLevel === "number" && Number.isFinite(current.lastConfirmedLevel)
      ? current.lastConfirmedLevel
      : 0;
  const fullLevel = Math.max(1, current.onHand, confirmed);
  return {
    runwayDays,
    estimatedLevelFraction: Math.min(1, Math.max(0, level / fullLevel)),
  };
}

export function restockPlacement(
  item: SupplyAutomation,
  household: RestockHousehold,
  now = new Date(),
): RestockPlacement {
  const current = normalizeConsumable(item);
  const runway = runwayFor(current, household, now);
  const extras = placementExtras(current, household, now);
  const today = toISODate(now);
  const dutyOrderByDate = runway.orderByDate;
  const base = { ...runway, dutyOrderByDate, ...extras };

  if (current.state === "ordered" && current.expectedArrivalDate) {
    const resurface = toISODate(addDays(dateFromISO(current.expectedArrivalDate), ARRIVAL_GRACE_DAYS));
    if (today <= resurface) {
      return { bucket: "ordered", nudgeArrive: false, ...base };
    }
    return { bucket: "order_now", nudgeArrive: true, ...base };
  }

  const rate = ratePerDayFor(current, household);
  const explicitReorder = typeof item.reorderAt === "number" && item.reorderAt > 0;
  const rateOrderBy = rateBasedOrderByDate(current, household, now);
  const effectiveOrderBy = earlierISO(rateOrderBy, dutyOrderByDate);
  const placed = { ...base, orderByDate: effectiveOrderBy };

  if ((explicitReorder || rate == null) && current.onHand <= reorderAtFor(current)) {
    return { bucket: "order_now", nudgeArrive: false, ...placed };
  }

  if (!effectiveOrderBy) {
    return { bucket: "stocked", nudgeArrive: false, ...placed };
  }
  if (effectiveOrderBy <= today) {
    return { bucket: "order_now", nudgeArrive: false, ...placed };
  }
  const soon = toISODate(addDays(now, COMING_UP_DAYS));
  if (effectiveOrderBy <= soon) {
    return { bucket: "coming_up", nudgeArrive: false, ...placed };
  }
  return { bucket: "stocked", nudgeArrive: false, ...placed };
}

export function groupRestock(
  items: SupplyAutomation[],
  household: RestockHousehold,
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

export function orderNowCostCaption(items: SupplyAutomation[]): string | null {
  const priced = items
    .map((item) => item.lastPaidPrice ?? item.unitCost)
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);
  if (priced.length === 0) return null;
  const total = Math.round(priced.reduce((sum, value) => sum + value, 0));
  const label = `~$${total.toLocaleString()}`;
  return priced.length < items.length ? `at least ${label}` : label;
}

export function digestCandidates(
  items: SupplyAutomation[],
  household: RestockHousehold,
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

export function markConsumableOrdered(
  item: SupplyAutomation,
  details: MarkOrderedDetails,
  now = new Date(),
): SupplyAutomation {
  const current = normalizeConsumable(item);
  const qty = Math.min(99, Math.max(1, Math.round(details.qty) || current.qtyPerOrder));
  return {
    ...current,
    state: "ordered",
    orderInFlight: true,
    orderedAt: toISODate(now),
    orderedQty: qty,
    qtyPerOrder: qty,
    quantity: qty,
    expectedArrivalDate: details.expectedArrivalDate,
    preferredRetailer: details.retailer || current.preferredRetailer,
  };
}

export type MarkOrderedDetails = {
  expectedArrivalDate: string;
  qty: number;
  retailer?: string;
};

export type RestockFlowHandlers = {
  onMarkOrdered?: (id: string, details: MarkOrderedDetails) => void;
  onMarkReceived?: (id: string, qty: number, paid?: number) => void;
  onSaveLink?: (id: string, url: string) => void;
  onPreferRetailer?: (id: string, retailer: string) => void;
  onStillWaiting?: (id: string) => void;
  onNeverCame?: (id: string) => void;
  onChangeArrival?: (id: string, date: string) => void;
  onApplyLeadTime?: (id: string, days: number) => void;
  onCheckin?: (id: string, level: CheckinLevel) => void;
};

export const ARRIVAL_OFFSETS = [
  { id: "tomorrow", days: 1, label: "Tomorrow" },
  { id: "two", days: 2, label: "2 days" },
  { id: "week", days: 5, label: "This week" },
  { id: "next", days: 10, label: "Next week" },
] as const;

export function closestArrivalOffset(leadTimeDays: number): number {
  let best: number = ARRIVAL_OFFSETS[0].days;
  for (const option of ARRIVAL_OFFSETS) {
    if (Math.abs(option.days - leadTimeDays) < Math.abs(best - leadTimeDays)) best = option.days;
  }
  return best;
}

export function receiveConsumable(item: SupplyAutomation, qty: number, now = new Date()): SupplyAutomation {
  const current = normalizeConsumable(item);
  const amount = Math.max(1, Math.round(qty) || current.qtyPerOrder);
  const observed = observedLeadTimeDays(current, now);
  const learnedRate = updateObservedRateOnReceive(current, now);
  const newLevel = current.onHand + amount;
  return {
    ...current,
    onHand: newLevel,
    qtyPerOrder: amount,
    quantity: amount,
    state: "stocked",
    orderInFlight: false,
    expectedArrivalDate: null,
    observedLeadTimeDays: observed ?? current.observedLeadTimeDays,
    orderedAt: undefined,
    orderedQty: undefined,
    ...learnedRate,
    lastConfirmedLevel: newLevel,
    lastConfirmedAt: toISODate(now),
  };
}

export function observedLeadTimeDays(
  item: Pick<SupplyAutomation, "orderedAt">,
  now = new Date(),
): number | null {
  if (!item.orderedAt) return null;
  return Math.max(0, Math.round((startOfDay(now) - parseISODate(item.orderedAt)) / 86_400_000));
}

export function shouldOfferLeadTime(leadTimeDays: number, observed: number): boolean {
  return Math.abs(observed - leadTimeDays) >= 3;
}

export function applyLearnedLeadTime(item: SupplyAutomation, days: number): SupplyAutomation {
  const current = normalizeConsumable(item);
  return { ...current, leadTimeDays: Math.min(90, Math.max(0, Math.round(days))) };
}

export function stillWaitingConsumable(item: SupplyAutomation, now = new Date()): SupplyAutomation {
  const current = normalizeConsumable(item);
  const today = toISODate(now);
  const baseline =
    current.expectedArrivalDate && current.expectedArrivalDate >= today ? current.expectedArrivalDate : today;
  return {
    ...current,
    state: "ordered",
    orderInFlight: true,
    expectedArrivalDate: toISODate(addDays(dateFromISO(baseline), ARRIVAL_GRACE_DAYS)),
  };
}

export function neverCameConsumable(item: SupplyAutomation): SupplyAutomation {
  const current = normalizeConsumable(item);
  return {
    ...current,
    state: "stocked",
    orderInFlight: false,
    expectedArrivalDate: null,
    orderedAt: undefined,
    orderedQty: undefined,
  };
}

export function unmarkConsumableOrdered(item: SupplyAutomation): SupplyAutomation {
  return neverCameConsumable(item);
}

export function changeArrivalDate(item: SupplyAutomation, expectedArrivalDate: string): SupplyAutomation {
  const current = normalizeConsumable(item);
  return {
    ...current,
    state: "ordered",
    orderInFlight: true,
    expectedArrivalDate,
  };
}

export function consumeLinkedUnit(item: SupplyAutomation, now = new Date()): SupplyAutomation {
  const current = normalizeConsumable(item);
  const onHand = Math.max(0, current.onHand - 1);
  return {
    ...current,
    onHand,
    lastConfirmedLevel: onHand,
    lastConfirmedAt: toISODate(now),
  };
}

export function restoreLinkedUnit(item: SupplyAutomation, now = new Date()): SupplyAutomation {
  const current = normalizeConsumable(item);
  const onHand = current.onHand + 1;
  return {
    ...current,
    onHand,
    lastConfirmedLevel: onHand,
    lastConfirmedAt: toISODate(now),
  };
}

export function saveRetailerLink(item: SupplyAutomation, url: string): SupplyAutomation {
  const current = normalizeConsumable(item);
  return {
    ...current,
    retailerUrl: url,
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
  return roomLabel;
}

export function defaultConsumableFields(now = new Date()): Pick<
  SupplyAutomation,
  "sku" | "retailerUrl" | "quantity" | "onHand" | "qtyPerOrder" | "reorderAt" | "leadTimeDays" | "installedAt" | "lifespanValue" | "lifespanUnit" | "orderByDate" | "nextOrderDate" | "orderInFlight" | "state" | "expectedArrivalDate"
> {
  const orderByDate = toISODate(now);
  return {
    sku: "",
    retailerUrl: "",
    quantity: DEFAULT_QUANTITY,
    onHand: 0,
    qtyPerOrder: DEFAULT_QUANTITY,
    reorderAt: DEFAULT_REORDER_AT,
    leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
    installedAt: "",
    lifespanValue: 12,
    lifespanUnit: "months",
    orderByDate,
    nextOrderDate: orderByDate,
    orderInFlight: false,
    state: "stocked",
    expectedArrivalDate: null,
  };
}
