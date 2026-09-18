import { addDays, startOfDay, startOfWeek, toISODate, weekRange } from "@/lib/dates";
import { completionsInRange } from "@/lib/duties";
import { keptRooms } from "@/lib/kept-rooms";
import { dayOutcome, roomsTouchedInRange, weekProgress } from "@/lib/momentum";
import type { Household } from "@/lib/types";

export const QUEST_IDS = ["every-room", "close-five", "do-things", "one-seasonal"] as const;
export type QuestId = (typeof QUEST_IDS)[number];

export type Quest = {
  id: QuestId;
  /** The week's own Sunday, as an ISO date, so a completed week can be
   * remembered. Deliberately not an ISO week number: `isoWeekKey` counts
   * Monday-to-Sunday weeks while the whole app runs Sunday-to-Saturday, so
   * keying on it moved the quest every Sunday — mid-week by the app's own
   * reckoning. */
  week: string;
  current: number;
  target: number;
  /** 0–1, clamped. */
  fraction: number;
  done: boolean;
};

const CLOSE_DAYS_TARGET = 5;
const MIN_THINGS_TARGET = 5;

function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The home's first recorded day, or null when it has no history at all. */
function firstDay(household: Household): number | null {
  let earliest = Number.POSITIVE_INFINITY;
  for (const duty of household.duties) {
    const created = startOfDay(new Date(duty.createdAt));
    if (Number.isFinite(created) && created < earliest) earliest = created;
  }
  for (const item of household.completions) {
    const done = startOfDay(new Date(item.completedAt));
    if (Number.isFinite(done) && done < earliest) earliest = done;
  }
  return Number.isFinite(earliest) ? earliest : null;
}

function seasonalDutyIds(household: Household): Set<string> {
  return new Set(
    household.duties
      .filter(
        (duty) => !duty.archived && (duty.frequency === "quarterly" || duty.frequency === "yearly"),
      )
      .map((duty) => duty.id),
  );
}

/** Days this week already behind us, counting today. */
function daysElapsed(now: Date): number {
  const { start } = weekRange(now);
  return Math.floor((startOfDay(now) - startOfDay(start)) / 86_400_000) + 1;
}

function countClosedThisWeek(household: Household, now: Date): number {
  const { start } = weekRange(now);
  let closed = 0;
  for (let offset = 0; offset < daysElapsed(now); offset += 1) {
    if (dayOutcome(household, addDays(start, offset)) !== "open") closed += 1;
  }
  return closed;
}

function measure(household: Household, id: QuestId, now: Date): { current: number; target: number } {
  const { start } = weekRange(now);
  switch (id) {
    case "every-room": {
      const rooms = keptRooms(household, now);
      return {
        current: roomsTouchedInRange(household, start, now),
        target: Math.max(rooms.length, 1),
      };
    }
    case "close-five":
      return { current: countClosedThisWeek(household, now), target: CLOSE_DAYS_TARGET };
    case "do-things":
      return {
        current: completionsInRange(household.completions, start, now).length,
        target: Math.max(MIN_THINGS_TARGET, weekProgress(household, now).planned),
      };
    case "one-seasonal": {
      const ids = seasonalDutyIds(household);
      const done = completionsInRange(household.completions, start, now).filter((item) =>
        ids.has(item.dutyId),
      ).length;
      return { current: done, target: 1 };
    }
  }
}

/**
 * Whether a quest is worth asking of this home this week. Deliberately keyed
 * off things that do not move mid-week — how many rooms there are, whether the
 * home keeps seasonal work, when its history starts — so the week's quest
 * cannot change out from under someone on a Wednesday.
 */
function eligible(household: Household, id: QuestId, now: Date): boolean {
  const { start } = weekRange(now);
  const began = firstDay(household);
  // A home set up midweek cannot close five days it was never asked about.
  const fullWeek = began != null && began <= startOfDay(start);
  switch (id) {
    case "every-room":
      return keptRooms(household, now).length >= 2;
    case "close-five":
      return fullWeek;
    case "do-things":
      return true;
    case "one-seasonal":
      return seasonalDutyIds(household).size > 0;
  }
}

/**
 * One named goal for the week, drawn from what the home actually does.
 *
 * The gap this fills: the day ring resolves in hours and the care level moves
 * at most one rung a fortnight, so there was nothing in between to aim at —
 * the middle distance where a habit is actually built. Deterministic for a
 * given home and week, and it rotates, so no quest becomes wallpaper.
 */
export function weeklyQuest(household: Household, now = new Date()): Quest | null {
  const week = toISODate(startOfWeek(now));
  const pool = QUEST_IDS.filter((id) => eligible(household, id, now));
  if (pool.length === 0) return null;
  const id = pool[hash32(`${week}:${household.homeId}`) % pool.length];
  const { current, target } = measure(household, id, now);
  const capped = Math.min(current, target);
  return {
    id,
    week,
    current: capped,
    target,
    fraction: target > 0 ? Math.max(0, Math.min(1, current / target)) : 0,
    done: current >= target,
  };
}

export const QUEST_DONE_PREFIX = "quest-done-";

export function questDoneTipKey(week: string): string {
  return `${QUEST_DONE_PREFIX}${week}`;
}

/** True once this week's quest has been met, whether or not the card is still up. */
export function isQuestDone(household: Household, now = new Date()): boolean {
  const quest = weeklyQuest(household, now);
  if (!quest) return false;
  return quest.done || household.seenTips.includes(questDoneTipKey(quest.week));
}

/**
 * Files the week as won. Older keys are pruned so the weekly key never crowds
 * the capped `seenTips` list, the same way the get-ahead card handles its own.
 */
export function markQuestDone(household: Household, week: string): Household {
  const key = questDoneTipKey(week);
  if (household.seenTips.includes(key)) return household;
  const kept = household.seenTips.filter((tip) => !tip.startsWith(QUEST_DONE_PREFIX));
  return { ...household, seenTips: [...kept, key] };
}
