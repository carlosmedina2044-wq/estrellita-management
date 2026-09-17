import { parseISODate, startOfDay, toISODate } from "@/lib/dates";
import { openDutiesInScope, todaysOpenDuties } from "@/lib/duties";
import type { Audience, Duty, Household } from "@/lib/types";

export const GET_AHEAD_PREFIX = "get-ahead-";
const EFFORT_FALLBACK = 10;

function isSnoozed(duty: Duty, now: Date): boolean {
  if (!duty.snoozedUntil) return false;
  return parseISODate(duty.snoozedUntil) > startOfDay(now);
}

function eligible(duty: Duty, now: Date): boolean {
  if (duty.archived) return false;
  if (duty.weatherTriggerId) return false; // weather-added work has its own day
  if (duty.caution) return false; // nothing with a ladder or gas as a casual extra
  if (isSnoozed(duty, now)) return false;
  return true;
}

/**
 * The one small chore worth pulling forward on a day with nothing due: the
 * quickest eligible duty from this week's list that is not already due today,
 * falling back to this month's. Rest days already count as closed for the
 * run, so doing it costs nothing and lights a window.
 */
export function getAheadCandidate(
  household: Household,
  now: Date,
  audience: Audience | "all" = "all",
): Duty | null {
  const today = new Set(todaysOpenDuties(household, now, audience).map((duty) => duty.id));
  for (const scope of ["weekly", "monthly"] as const) {
    const pool = openDutiesInScope(household, scope, now, audience).filter(
      (duty) => !today.has(duty.id) && eligible(duty, now),
    );
    if (pool.length === 0) continue;
    pool.sort(
      (a, b) =>
        (a.estimatedMinutes ?? EFFORT_FALLBACK) - (b.estimatedMinutes ?? EFFORT_FALLBACK) ||
        a.title.localeCompare(b.title),
    );
    return pool[0];
  }
  return null;
}

export function getAheadTipKey(now: Date): string {
  return `${GET_AHEAD_PREFIX}${toISODate(now)}`;
}

export function isGetAheadDismissed(household: Pick<Household, "seenTips">, now: Date): boolean {
  return household.seenTips.includes(getAheadTipKey(now));
}

/** "Not today" hides the card until tomorrow. Older get-ahead keys are pruned
 * so the daily key never crowds the capped `seenTips` list. */
export function dismissGetAhead(household: Household, now: Date): Household {
  const kept = household.seenTips.filter((tip) => !tip.startsWith(GET_AHEAD_PREFIX));
  return { ...household, seenTips: [...kept, getAheadTipKey(now)] };
}
