import { addDays, addCalendarMonths, monthRange, startOfDay, weekRange } from "@/lib/dates";
import {
  completionsInRange,
  doneOnDay,
  dutiesDueOnDate,
  installedAtFor,
  isOverdue,
  isScheduledInRange,
  todaysOpenDuties,
} from "@/lib/duties";
import type { Duty, Household } from "@/lib/types";

export type DayOutcome = "closed" | "open" | "rest";

export type ClosedDayRun = {
  current: number;
  best: number;
  graceUsed: boolean;
};

export type WeekProgress = {
  done: number;
  planned: number;
  minutes: number;
};

export type MonthRecap = {
  done: number;
  minutes: number;
  longestRun: number;
  roomsTouched: number;
};

const DAY_MS = 86_400_000;
const GRACE_WINDOW_DAYS = 7;
const EFFORT_FALLBACK = 10;

type MomentumFields = {
  momentum?: { enabled?: boolean; bestRun?: number };
};

function effortMinutes(duty: Pick<Duty, "estimatedMinutes">): number {
  return duty.estimatedMinutes ?? EFFORT_FALLBACK;
}

function cachedBestRun(household: Household): number {
  const best = (household as Household & MomentumFields).momentum?.bestRun;
  if (typeof best !== "number" || !Number.isFinite(best) || best <= 0) return 0;
  return Math.trunc(best);
}

/** Duties and completions visible at the end of `day` (local calendar). */
export function householdAsOf(household: Household, day: Date): Household {
  const cutoff = startOfDay(day);
  return {
    ...household,
    duties: household.duties.filter((duty) => startOfDay(new Date(duty.createdAt)) <= cutoff),
    completions: household.completions.filter((item) => startOfDay(new Date(item.completedAt)) <= cutoff),
  };
}

function historyFloor(household: Household): number {
  let earliest = Number.POSITIVE_INFINITY;
  for (const duty of household.duties) {
    const created = startOfDay(new Date(duty.createdAt));
    if (Number.isFinite(created) && created < earliest) earliest = created;
  }
  for (const item of household.completions) {
    const done = startOfDay(new Date(item.completedAt));
    if (Number.isFinite(done) && done < earliest) earliest = done;
  }
  if (!Number.isFinite(earliest)) return startOfDay(new Date());
  const cap = startOfDay(addCalendarMonths(new Date(), -24));
  return Math.max(earliest, cap);
}

export function dayOutcome(household: Household, day: Date): DayOutcome {
  const asOf = householdAsOf(household, day);
  if (todaysOpenDuties(asOf, day).length > 0) return "open";
  if (doneOnDay(asOf, day).length > 0) return "closed";
  if (dutiesDueOnDate(asOf, day).length > 0) return "closed";
  return "rest";
}

export function closedDayRun(household: Household, now = new Date()): ClosedDayRun {
  const today = dayOutcome(household, now);
  let cursor = today === "open" ? addDays(now, -1) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const floor = historyFloor(household);
  let current = 0;
  let graceUsed = false;
  let graceAt: number | null = null;
  let steps = 0;

  while (startOfDay(cursor) >= floor && steps < 800) {
    steps += 1;
    const outcome = dayOutcome(household, cursor);
    if (outcome !== "open") {
      current += 1;
    } else if (graceAt === null || startOfDay(cursor) <= graceAt - GRACE_WINDOW_DAYS * DAY_MS) {
      graceAt = startOfDay(cursor);
      graceUsed = true;
    } else {
      break;
    }
    cursor = addDays(cursor, -1);
  }

  return { current, best: cachedBestRun(household), graceUsed };
}

export function weekProgress(household: Household, now = new Date()): WeekProgress {
  const { start, end } = weekRange(now);
  const beforeWeek = household.completions.filter(
    (item) => startOfDay(new Date(item.completedAt)) < startOfDay(start),
  );
  const seen = new Set<string>();
  const planned: Duty[] = [];

  for (const duty of household.duties) {
    if (duty.archived || seen.has(duty.id)) continue;
    const installedAt = installedAtFor(household, duty.id);
    const scheduled = isScheduledInRange(duty, start, end, household.completions, installedAt);
    const overdueAtStart = isOverdue(duty, beforeWeek, start, installedAt);
    if (!scheduled && !overdueAtStart) continue;
    seen.add(duty.id);
    planned.push(duty);
  }

  const doneIds = new Set(
    completionsInRange(household.completions, start, now).map((item) => item.dutyId),
  );
  const doneDuties = planned.filter((duty) => doneIds.has(duty.id));
  return {
    planned: planned.length,
    done: doneDuties.length,
    minutes: doneDuties.reduce((sum, duty) => sum + effortMinutes(duty), 0),
  };
}

export function todayEffort(open: Duty[]): number {
  return open.reduce((sum, duty) => sum + effortMinutes(duty), 0);
}

function longestClosedStretch(household: Household, start: Date, end: Date): number {
  let longest = 0;
  let current = 0;
  let graceAt: number | null = null;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = startOfDay(end);
  while (startOfDay(cursor) <= last) {
    const outcome = dayOutcome(household, cursor);
    if (outcome !== "open") {
      current += 1;
      longest = Math.max(longest, current);
    } else if (graceAt === null || startOfDay(cursor) >= graceAt + GRACE_WINDOW_DAYS * DAY_MS) {
      graceAt = startOfDay(cursor);
    } else {
      current = 0;
      graceAt = startOfDay(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return longest;
}

export function monthRecap(household: Household, month: Date): MonthRecap {
  const { start, end } = monthRange(month);
  const items = completionsInRange(household.completions, start, end);
  let minutes = 0;
  const rooms = new Set<string>();
  for (const item of items) {
    const duty = household.duties.find((entry) => entry.id === item.dutyId);
    minutes += effortMinutes(duty ?? {});
    if (duty) rooms.add(duty.room);
  }
  return {
    done: items.length,
    minutes,
    longestRun: longestClosedStretch(household, start, end),
    roomsTouched: rooms.size,
  };
}

export function roomsTouchedInRange(household: Household, start: Date, end: Date): number {
  const ids = new Set(completionsInRange(household.completions, start, end).map((item) => item.dutyId));
  const rooms = new Set<string>();
  for (const duty of household.duties) {
    if (ids.has(duty.id)) rooms.add(duty.room);
  }
  return rooms.size;
}
