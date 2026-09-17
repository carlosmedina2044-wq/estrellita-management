import { addDays, addCalendarMonths, monthRange, startOfDay, weekRange } from "@/lib/dates";
import {
  completionsInRange,
  doneOnDay,
  doneToday,
  dutiesDueOnDate,
  installedAtFor,
  isDoneThisPeriod,
  isOverdue,
  isScheduledInRange,
  todaysOpenDuties,
} from "@/lib/duties";
import type { Audience, Duty, Household, MilestoneId } from "@/lib/types";

export type DayOutcome = "closed" | "open" | "rest";

export type DayArcState = "open" | "closed" | "clear" | "rest";

export type DayArc = {
  total: number;
  done: number;
  open: number;
  fraction: number;
  minutesLeft: number;
  minutesDone: number;
  state: DayArcState;
  nextUp: Date | null;
};

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

function effortMinutes(duty: Pick<Duty, "estimatedMinutes">): number {
  return duty.estimatedMinutes ?? EFFORT_FALLBACK;
}

function cachedBestRun(household: Household): number {
  const best = household.momentum?.bestRun;
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

function historyFloor(household: Household, now: Date): number {
  let earliest = Number.POSITIVE_INFINITY;
  for (const duty of household.duties) {
    const created = startOfDay(new Date(duty.createdAt));
    if (Number.isFinite(created) && created < earliest) earliest = created;
  }
  for (const item of household.completions) {
    const done = startOfDay(new Date(item.completedAt));
    if (Number.isFinite(done) && done < earliest) earliest = done;
  }
  if (!Number.isFinite(earliest)) return startOfDay(now);
  const cap = startOfDay(addCalendarMonths(now, -24));
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
  const walked = walkRun(household, now);
  return { current: walked.current, best: cachedBestRun(household), graceUsed: walked.graceDays.size > 0 };
}

function walkRun(
  household: Household,
  now: Date,
): { current: number; graceDays: Set<number> } {
  const today = dayOutcome(household, now);
  let cursor = today === "open" ? addDays(now, -1) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const floor = historyFloor(household, now);
  let current = 0;
  const graceDays = new Set<number>();
  let graceAt: number | null = null;
  let steps = 0;

  while (startOfDay(cursor) >= floor && steps < 800) {
    steps += 1;
    const outcome = dayOutcome(household, cursor);
    if (outcome !== "open") {
      current += 1;
    } else if (graceAt === null || startOfDay(cursor) <= graceAt - GRACE_WINDOW_DAYS * DAY_MS) {
      graceAt = startOfDay(cursor);
      graceDays.add(graceAt);
    } else {
      break;
    }
    cursor = addDays(cursor, -1);
  }

  return { current, graceDays };
}

export type RunDay = {
  date: Date;
  outcome: DayOutcome | "grace";
  isToday: boolean;
};

export type YearDay = {
  date: Date;
  /** `before` is a day earlier than the home's first duty or completion:
   * nothing was asked and nothing was done, so it is painted like the
   * future rather than as an earned rest day. */
  outcome: DayOutcome | "grace" | "future" | "before";
  isToday: boolean;
};

/** Every day of `year`, 1 January to 31 December, painted like the run strip;
 * days after `now` are `future`, days before the home's history are `before`.
 * The current run's forgiven days show as grace. */
export function yearDays(household: Household, year: number, now = new Date()): YearDay[] {
  const walked = walkRun(household, now);
  const today = startOfDay(now);
  const floor = historyFloor(household, now);
  const days: YearDay[] = [];
  for (let date = new Date(year, 0, 1); date.getFullYear() === year; date = addDays(date, 1)) {
    const stamp = startOfDay(date);
    let outcome: YearDay["outcome"];
    if (stamp > today) {
      outcome = "future";
    } else if (stamp < floor) {
      outcome = "before";
    } else {
      const raw = dayOutcome(household, date);
      outcome = raw === "open" && walked.graceDays.has(stamp) ? "grace" : raw;
    }
    days.push({ date, outcome, isToday: stamp === today });
  }
  return days;
}

export function runStripDays(household: Household, now = new Date()): RunDay[] {
  const walked = walkRun(household, now);
  const days: RunDay[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = addDays(now, -offset);
    const raw = dayOutcome(household, date);
    const outcome: DayOutcome | "grace" =
      raw === "open" && walked.graceDays.has(startOfDay(date)) ? "grace" : raw;
    days.push({
      date,
      outcome,
      isToday: offset === 0,
    });
  }
  return days;
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

export function dayArc(
  household: Household,
  now = new Date(),
  audience: Audience | "all" = "all",
): DayArc {
  const openDuties = todaysOpenDuties(household, now, audience);
  const doneEntries = doneToday(household, now, audience);
  const doneDuties = doneEntries.map((entry) => entry.duty);
  const openCount = openDuties.length;
  const doneCount = doneDuties.length;
  const total = openCount + doneCount;
  const minutesLeft = todayEffort(openDuties);
  const minutesDone = todayEffort(doneDuties);
  let nextUp: Date | null = null;
  let state: DayArcState;
  if (openCount > 0) {
    state = "open";
  } else if (doneCount > 0) {
    state = "closed";
  } else {
    for (let offset = 1; offset <= 14; offset += 1) {
      const day = addDays(now, offset);
      const due = dutiesDueOnDate(household, day, audience).filter(
        (duty) =>
          !isDoneThisPeriod(
            duty,
            household.completions,
            day,
            installedAtFor(household, duty.id),
          ),
      );
      if (due.length > 0) {
        nextUp = day;
        break;
      }
    }
    state = nextUp ? "clear" : "rest";
  }
  return {
    total,
    done: doneCount,
    open: openCount,
    fraction: total ? doneCount / total : 0,
    minutesLeft,
    minutesDone,
    state,
    nextUp,
  };
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

export const WEEK_WRAPPED_PREFIX = "week-wrapped-";

/** ISO week id (YYYY-Www) so the wrap card occupies one seenTips slot. */
export function isoWeekKey(date: Date): string {
  const tmp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = tmp.getDay() || 7;
  tmp.setDate(tmp.getDate() + 4 - weekday);
  const yearStart = new Date(tmp.getFullYear(), 0, 1);
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${tmp.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekWrappedTipKey(now: Date): string {
  return `${WEEK_WRAPPED_PREFIX}${isoWeekKey(now)}`;
}

export function shouldShowWeekWrapped(household: Household, now = new Date()): boolean {
  if (startOfDay(now) < startOfDay(weekRange(now).end)) return false;
  if (weekProgress(household, now).done <= 0) return false;
  return !household.seenTips.includes(weekWrappedTipKey(now));
}

export function dismissWeekWrapped(household: Household, now = new Date()): Household {
  const key = weekWrappedTipKey(now);
  const kept = household.seenTips.filter((tip) => !tip.startsWith(WEEK_WRAPPED_PREFIX));
  return { ...household, seenTips: [...kept, key] };
}

function hasClosedDay(household: Household, now: Date): boolean {
  const floor = historyFloor(household, now);
  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let steps = 0;
  while (startOfDay(cursor) >= floor && steps < 400) {
    if (dayOutcome(household, cursor) === "closed") return true;
    cursor = addDays(cursor, -1);
    steps += 1;
  }
  return false;
}

function weekWasFull(household: Household, now: Date): boolean {
  const progress = weekProgress(household, now);
  return progress.planned > 0 && progress.done === progress.planned;
}

function everyRoomTouched(household: Household, now: Date): boolean {
  const rooms = household.rooms.filter((room) => !room.system);
  if (rooms.length === 0) return false;
  const start = addDays(now, -30);
  const touched = new Set<string>();
  for (const item of completionsInRange(household.completions, start, now)) {
    const duty = household.duties.find((entry) => entry.id === item.dutyId);
    if (duty) touched.add(duty.room);
  }
  return rooms.every((room) => touched.has(room.id));
}

function hasQuarterlyDone(household: Household): boolean {
  const ids = new Set(
    household.duties
      .filter((duty) => duty.frequency === "quarterly" || duty.frequency === "yearly")
      .map((duty) => duty.id),
  );
  return household.completions.some((item) => ids.has(item.dutyId));
}

export const MILESTONES: Array<{ id: MilestoneId; when: (household: Household, now: Date) => boolean }> = [
  { id: "first-close", when: hasClosedDay },
  {
    id: "first-week",
    when: (household, now) => weekWasFull(household, now) || weekWasFull(household, addDays(now, -7)),
  },
  { id: "ten-done", when: (household) => household.completions.length >= 10 },
  { id: "every-room", when: everyRoomTouched },
  { id: "first-quarterly", when: hasQuarterlyDone },
  {
    id: "thirty-run",
    when: (household, now) => closedDayRun(household, now).current >= 30 || cachedBestRun(household) >= 30,
  },
];

export function newlyEarned(household: Household, now = new Date()): MilestoneId[] {
  const have = new Set(household.milestones.map((item) => item.id));
  return MILESTONES.filter((item) => !have.has(item.id) && item.when(household, now)).map((item) => item.id);
}

import { reconcileCareLevel } from "@/lib/care-level";

export function applyMomentumOnComplete(household: Household, now = new Date()): Household {
  const earned = newlyEarned(household, now);
  const run = closedDayRun(household, now);
  const earnedAt = now.toISOString();
  const next: Household = {
    ...household,
    milestones: [...household.milestones, ...earned.map((id) => ({ id, earnedAt }))],
    momentum: {
      ...household.momentum,
      bestRun: Math.max(household.momentum.bestRun, run.current),
    },
  };
  return reconcileCareLevel(next, now);
}
