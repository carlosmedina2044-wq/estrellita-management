import { toISODate } from "@/lib/dates";
import type { Household } from "@/lib/types";

/** Oldest days fall off first; a year and change is plenty for the year view. */
export const CHECK_IN_LIMIT = 400;

export function hasCheckedInToday(household: Pick<Household, "checkIns">, now: Date): boolean {
  return (household.checkIns ?? []).includes(toISODate(now));
}

/**
 * Notes that the house was opened today. Counted on device, stored in the
 * vault, never sent anywhere: it is the owner's own number, and the only
 * honest retention figure an app with no analytics can have.
 */
export function recordCheckIn(household: Household, now: Date): Household {
  const today = toISODate(now);
  const existing = household.checkIns ?? [];
  if (existing.includes(today)) return household;
  const next = [...existing, today].sort().slice(-CHECK_IN_LIMIT);
  return { ...household, checkIns: next };
}

export function checkInsInYear(household: Pick<Household, "checkIns">, year: number): number {
  const prefix = `${year}-`;
  return (household.checkIns ?? []).filter((day) => day.startsWith(prefix)).length;
}
