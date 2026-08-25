import type { Household, TeachingProgress } from "@/lib/types";

export const TIP_ARRIVAL = "arrival-prompt";
export const TIP_BUDGET_PRICES = "budget-no-prices";
export const TIP_LOCK_REENGAGE = "lock-reengage";
export const TIP_WALK_AFTER_DAY_ONE = "walk-after-day-one";

const TEACHING_DAYS = 7;

export function teachingCardVisible(household: Household, now = new Date()): boolean {
  const teaching = household.teaching;
  if (!teaching?.startedAt) return false;
  if (teaching.checkedChore && teaching.openedRestock && teaching.setDigestOrZip) return false;
  const start = Date.parse(`${teaching.startedAt}T00:00:00`);
  if (!Number.isFinite(start)) return false;
  const elapsed = (now.getTime() - start) / 86_400_000;
  return elapsed < TEACHING_DAYS;
}

export function markTipSeen(household: Household, tip: string): Household {
  if (household.seenTips.includes(tip)) return household;
  return { ...household, seenTips: [...household.seenTips, tip] };
}

export function hasSeenTip(household: Pick<Household, "seenTips">, tip: string): boolean {
  return household.seenTips.includes(tip);
}

export function withTeaching(
  household: Household,
  patch: Partial<TeachingProgress>,
): Household {
  return { ...household, teaching: { ...household.teaching, ...patch } };
}

/** True once the first calendar day after teaching started has passed. */
export function isAfterFirstDay(household: Household, now = new Date()): boolean {
  const start = household.teaching?.startedAt;
  if (!start) return false;
  const startMs = Date.parse(`${start}T00:00:00`);
  if (!Number.isFinite(startMs)) return false;
  return (now.getTime() - startMs) / 86_400_000 >= 1;
}
