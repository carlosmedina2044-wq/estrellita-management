import { toISODate } from "@/lib/dates";
import { TIP_AI_INVITE_PREFIX } from "@/lib/teaching";
import type { Household } from "@/lib/types";

/** What `useAiAvailability` reports. */
export type AiState = "unknown" | "unavailable" | "notEnabled" | "modelNotReady" | "available";

export const AI_INVITE_REPEAT_DAYS = 30;

export type AiInviteDismissal = { count: number; on: string } | null;

/** Reads the dismissal count and the day of the last one out of `seenTips`. */
export function aiInviteDismissal(household: Pick<Household, "seenTips">): AiInviteDismissal {
  for (const tip of household.seenTips) {
    if (!tip.startsWith(TIP_AI_INVITE_PREFIX)) continue;
    const match = /^(\d{1,2}):(\d{4}-\d{2}-\d{2})$/.exec(tip.slice(TIP_AI_INVITE_PREFIX.length));
    if (match) return { count: Number(match[1]), on: match[2] };
  }
  return null;
}

/**
 * Whether to show the invitation in a place that can be waved away (under a scan
 * result). Only when it is switched off: 30 days after a first dismissal it
 * comes back once, and a second dismissal is for good. The Settings row ignores
 * this on purpose; it is where the person goes to look.
 */
export function shouldShowAiInvite(
  household: Pick<Household, "seenTips">,
  state: AiState,
  now: Date = new Date(),
): boolean {
  if (state !== "notEnabled") return false;
  const dismissal = aiInviteDismissal(household);
  if (!dismissal) return true;
  if (dismissal.count >= 2) return false;
  const since = Date.parse(`${dismissal.on}T00:00:00`);
  if (!Number.isFinite(since)) return false;
  return (now.getTime() - since) / 86_400_000 >= AI_INVITE_REPEAT_DAYS;
}

/** Records one more "Not now". Replaces the old entry so `seenTips` keeps a single slot. */
export function recordAiInviteDismissal<T extends Pick<Household, "seenTips">>(household: T, now: Date = new Date()): T {
  const count = Math.min(9, (aiInviteDismissal(household)?.count ?? 0) + 1);
  const kept = household.seenTips.filter((tip) => !tip.startsWith(TIP_AI_INVITE_PREFIX));
  return { ...household, seenTips: [...kept, `${TIP_AI_INVITE_PREFIX}${count}:${toISODate(now)}`] };
}
