import { startOfDay } from "@/lib/dates";
import { lastCompletion } from "@/lib/duties";
import { cadenceDays } from "@/lib/kept-rooms";
import type { Completion, Duty } from "@/lib/types";

export type LastDoneInfo = { completedAt: string; actor: Completion["actor"] };

/** Who did this chore last, and when — the detail sheet's first fact. */
export function lastDoneInfo(dutyId: string, completions: Completion[]): LastDoneInfo | null {
  const entry = lastCompletion(dutyId, completions);
  return entry ? { completedAt: entry.completedAt, actor: entry.actor } : null;
}

export type Rhythm = { done: number; of: number; streak: number };

/**
 * How consistently a recurring chore gets done: of the last `periods`
 * cadence-length windows counting back from `now`, how many had at least one
 * completion, and how many of the most recent ones in a row did (the
 * streak stops at the first miss). `null` for a one-time chore, which has no
 * rhythm to report.
 */
export function recentRhythm(
  duty: Pick<Duty, "id" | "frequency">,
  completions: Completion[],
  now: Date,
  periods = 6,
): Rhythm | null {
  const days = cadenceDays(duty.frequency);
  if (days == null) return null;
  // Whole-day granularity, like `completionsInRange` elsewhere — `now` in
  // this app is conventionally pinned to local midnight (see `useNow`), so
  // comparing raw instants would put every completion from later "today"
  // outside the window ending "now". Normalizing both sides to the day they
  // fall on sidesteps that regardless of what time `now` actually carries.
  const completionDays = completions
    .filter((item) => item.dutyId === duty.id)
    .map((item) => startOfDay(new Date(item.completedAt)));
  const windowMs = days * 86_400_000;
  const nowDay = startOfDay(now);
  let done = 0;
  let streak = 0;
  let streakBroken = false;
  for (let i = 0; i < periods; i++) {
    const windowEnd = nowDay - i * windowMs;
    const windowStart = windowEnd - windowMs;
    const hit = completionDays.some((d) => d > windowStart && d <= windowEnd);
    if (hit) {
      done += 1;
      if (!streakBroken) streak += 1;
    } else {
      streakBroken = true;
    }
  }
  return { done, of: periods, streak };
}

export type CostSummary = { total: number; count: number; entries: { completedAt: string; actualCost: number }[] };

/** Every completion of this chore that recorded a real cost — for the
 * detail sheet's cost history, not just the single latest figure
 * `realCostFor` returns elsewhere. */
export function costSummary(dutyId: string, completions: Completion[]): CostSummary | null {
  const withCost = completions
    .filter((item): item is Completion & { actualCost: number } => item.dutyId === dutyId && typeof item.actualCost === "number")
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  if (withCost.length === 0) return null;
  const total = withCost.reduce((sum, item) => sum + item.actualCost, 0);
  return {
    total,
    count: withCost.length,
    entries: withCost.slice(0, 3).map((item) => ({ completedAt: item.completedAt, actualCost: item.actualCost })),
  };
}
