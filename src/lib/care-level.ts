import { addDays, startOfDay, toISODate } from "@/lib/dates";
import { doneOnDay, todaysOpenDuties, dutiesDueOnDate } from "@/lib/duties";
import { CARE_LEVELS, type CareLevelId, type CareState, type Household } from "@/lib/types";

export const CARE_CHANGE_COOLDOWN_DAYS = 14;
/** How many past care states are kept for the year view. */
export const CARE_HISTORY_LIMIT = 24;

export type CareSignals = {
  windowDays: number;
  closedRatio: number;
  seasonalOk: boolean;
  openLast7: number;
  openPrev7: number;
};

/** Local copy of momentum.dayOutcome to avoid a care-level ↔ momentum import cycle. */
function householdAsOf(household: Household, day: Date): Household {
  const cutoff = startOfDay(day);
  return {
    ...household,
    duties: household.duties.filter((duty) => startOfDay(new Date(duty.createdAt)) <= cutoff),
    completions: household.completions.filter(
      (item) => startOfDay(new Date(item.completedAt)) <= cutoff,
    ),
  };
}

function outcomeForDay(household: Household, day: Date): "closed" | "open" | "rest" {
  const asOf = householdAsOf(household, day);
  if (todaysOpenDuties(asOf, day).length > 0) return "open";
  if (doneOnDay(asOf, day).length > 0) return "closed";
  if (dutiesDueOnDate(asOf, day).length > 0) return "closed";
  return "rest";
}

function historyFloorDate(household: Household): Date {
  let earliest = Number.POSITIVE_INFINITY;
  for (const duty of household.duties) {
    const created = startOfDay(new Date(duty.createdAt));
    if (Number.isFinite(created) && created < earliest) earliest = created;
  }
  for (const item of household.completions) {
    const done = startOfDay(new Date(item.completedAt));
    if (Number.isFinite(done) && done < earliest) earliest = done;
  }
  if (!Number.isFinite(earliest)) return new Date(startOfDay(new Date()));
  return new Date(earliest);
}

function countOpenDays(
  household: Household,
  startOffset: number,
  endOffset: number,
  now: Date,
): number {
  let open = 0;
  for (let offset = startOffset; offset <= endOffset; offset += 1) {
    if (outcomeForDay(household, addDays(now, -offset)) === "open") open += 1;
  }
  return open;
}

export function careSignals(household: Household, now = new Date()): CareSignals {
  const yesterday = addDays(now, -1);
  const floor = historyFloorDate(household);
  const windowEnd = startOfDay(yesterday);
  const windowStart = Math.max(startOfDay(addDays(yesterday, -29)), startOfDay(floor));
  let windowDays = 0;
  let closed = 0;
  if (windowStart <= windowEnd) {
    const cursor = new Date(windowStart);
    while (startOfDay(cursor) <= windowEnd) {
      windowDays += 1;
      if (outcomeForDay(household, cursor) !== "open") closed += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const seasonalDuties = household.duties.filter(
    (duty) =>
      !duty.archived && (duty.frequency === "quarterly" || duty.frequency === "yearly"),
  );
  let seasonalOk = seasonalDuties.length === 0;
  if (!seasonalOk) {
    const since = startOfDay(addDays(now, -92));
    seasonalOk = household.completions.some((item) => {
      const duty = seasonalDuties.find((entry) => entry.id === item.dutyId);
      return duty && startOfDay(new Date(item.completedAt)) >= since;
    });
  }
  return {
    windowDays,
    closedRatio: windowDays ? closed / windowDays : 0,
    seasonalOk,
    openLast7: countOpenDays(household, 1, 7, now),
    openPrev7: countOpenDays(household, 8, 14, now),
  };
}

export function rawCareLevel(s: CareSignals): CareLevelId {
  if (s.windowDays < 7) return "settling-in";
  const { closedRatio: ratio, seasonalOk } = s;
  if (ratio >= 0.9 && seasonalOk) return "loved";
  if (ratio >= 0.8 && seasonalOk) return "cared-for";
  if (ratio >= 0.8 || (ratio >= 0.65 && seasonalOk)) return "well-kept";
  if (ratio >= 0.5) return "kept";
  return "settling-in";
}

export function careLevelIndex(level: CareLevelId): number {
  return CARE_LEVELS.indexOf(level);
}

function adjacentLevel(level: CareLevelId, direction: "up" | "down"): CareLevelId {
  const index = careLevelIndex(level);
  const next = direction === "up" ? index + 1 : index - 1;
  return CARE_LEVELS[Math.max(0, Math.min(CARE_LEVELS.length - 1, next))];
}

export function nextCareState(
  prev: CareState | undefined,
  s: CareSignals,
  now: Date,
): CareState {
  const today = toISODate(now);
  const raw = rawCareLevel(s);
  if (!prev) return { level: raw, since: today };
  if (raw === prev.level) return prev;
  const sinceMs = startOfDay(new Date(`${prev.since}T12:00:00`));
  const daysSince = Math.floor((startOfDay(now) - sinceMs) / 86_400_000);
  if (daysSince < CARE_CHANGE_COOLDOWN_DAYS) return prev;
  const prevIndex = careLevelIndex(prev.level);
  const rawIndex = careLevelIndex(raw);
  if (rawIndex > prevIndex) {
    return { level: adjacentLevel(prev.level, "up"), since: today, direction: "up" };
  }
  if (rawIndex < prevIndex && s.openLast7 > 3 && s.openPrev7 > 3) {
    return { level: adjacentLevel(prev.level, "down"), since: today, direction: "down" };
  }
  return prev;
}

export function reconcileCareLevel(household: Household, now = new Date()): Household {
  const next = nextCareState(household.momentum.care, careSignals(household, now), now);
  const prev = household.momentum.care;
  if (
    prev &&
    prev.level === next.level &&
    prev.since === next.since &&
    (prev.direction ?? undefined) === (next.direction ?? undefined)
  ) {
    return household;
  }
  // A level change files the state it replaces, oldest first, so the year
  // view can draw the line. A same-level rewrite (a refreshed `since`) is not
  // a change worth remembering.
  const history =
    prev && prev.level !== next.level
      ? [...(household.momentum.careHistory ?? []), prev].slice(-CARE_HISTORY_LIMIT)
      : household.momentum.careHistory;
  return {
    ...household,
    momentum: {
      ...household.momentum,
      care: next,
      ...(history ? { careHistory: history } : {}),
    },
  };
}

export function currentCareState(household: Household, now = new Date()): CareState {
  return household.momentum.care ?? nextCareState(undefined, careSignals(household, now), now);
}

export function houseMomentFor(level: CareLevelId): "living-house" | "breathing-loop" {
  return level === "loved" ? "breathing-loop" : "living-house";
}
