import type { Duty } from "@/lib/types";
import { todayEffort } from "@/lib/momentum";

/**
 * Power hour: a timed run at the day's list. Everything here is a plain
 * function over plain data so the screen, the Live Activity and the tests all
 * read the same answers. The clock is always passed in.
 */

export const POWER_HOUR_LENGTHS = [15, 30, 45] as const;
export type PowerHourLength = (typeof POWER_HOUR_LENGTHS)[number];
export const DEFAULT_POWER_HOUR_LENGTH: PowerHourLength = 30;
export const POWER_HOUR_EXTEND_MIN = 10;
export const POWER_HOUR_MAX_CHORES = 10;

const MINUTE_MS = 60_000;

export type PowerHourSession = {
  id: string;
  /** Epoch ms. */
  startedAt: number;
  endsAtMs: number;
  /** The length asked for at the start; extensions only move `endsAtMs`. */
  lengthMin: number;
  /** Chores in the order they come up. Skipped chores are removed. */
  dutyIds: string[];
  doneIds: string[];
  /** Chores waved off this hour, so extending never brings them back. */
  skippedIds?: string[];
};

export type PowerHourPlan = {
  duties: Duty[];
  count: number;
  minutes: number;
};

/** The same per-chore estimate Today's "about N min" adds up. */
export function dutyMinutes(duty: Duty): number {
  return todayEffort([duty]);
}

/**
 * Picks the chores that fit `lengthMin`: overdue first, then the quickest, so
 * the first few minutes already feel like progress. Never more than ten, and
 * always at least one when anything is left, even when that one chore is
 * longer than the hour.
 */
export function pickPowerHour(
  open: Duty[],
  lengthMin: number,
  isOverdue: (duty: Duty) => boolean,
  max = POWER_HOUR_MAX_CHORES,
): PowerHourPlan {
  const ranked = open
    .map((duty, index) => ({ duty, index, overdue: isOverdue(duty), minutes: dutyMinutes(duty) }))
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (a.minutes !== b.minutes) return a.minutes - b.minutes;
      return a.index - b.index;
    });
  const chosen: typeof ranked = [];
  let used = 0;
  for (const item of ranked) {
    if (chosen.length >= max) break;
    if (used + item.minutes > lengthMin) continue;
    chosen.push(item);
    used += item.minutes;
  }
  if (chosen.length === 0 && ranked.length > 0) {
    chosen.push(ranked[0]);
    used = ranked[0].minutes;
  }
  return { duties: chosen.map((item) => item.duty), count: chosen.length, minutes: used };
}

export function startSession(
  plan: PowerHourPlan,
  lengthMin: number,
  nowMs: number,
  id = `ph-${nowMs.toString(36)}`,
): PowerHourSession {
  return {
    id,
    startedAt: nowMs,
    endsAtMs: nowMs + lengthMin * MINUTE_MS,
    lengthMin,
    dutyIds: plan.duties.map((duty) => duty.id),
    doneIds: [],
  };
}

/**
 * Chores still to do. `openIds`, when given, drops chores that stopped being
 * open some other way (finished from Today, snoozed, deleted), so the count
 * never promises something that is gone.
 */
export function pendingIds(session: PowerHourSession, openIds?: ReadonlySet<string>): string[] {
  const done = new Set(session.doneIds);
  return session.dutyIds.filter((id) => !done.has(id) && (!openIds || openIds.has(id)));
}

export function leftCount(session: PowerHourSession, openIds?: ReadonlySet<string>): number {
  return pendingIds(session, openIds).length;
}

export function nextId(session: PowerHourSession, openIds?: ReadonlySet<string>): string | null {
  return pendingIds(session, openIds)[0] ?? null;
}

/** Chores of this hour that are done. */
export function doneCount(session: PowerHourSession): number {
  const done = new Set(session.doneIds);
  return session.dutyIds.filter((id) => done.has(id)).length;
}

/** Marks every chore of the hour that has a completion since it started, so a
 * chore ticked somewhere else still counts. */
export function reconcileDone(
  session: PowerHourSession,
  completions: ReadonlyArray<{ dutyId: string; completedAt: string }>,
): PowerHourSession {
  const finished = new Set(
    completions.filter((item) => Date.parse(item.completedAt) >= session.startedAt).map((item) => item.dutyId),
  );
  const add = session.dutyIds.filter((id) => finished.has(id) && !session.doneIds.includes(id));
  return add.length ? { ...session, doneIds: [...session.doneIds, ...add] } : session;
}

/** 0 to 1, over the chores the hour holds now. */
export function progress(session: PowerHourSession): number {
  const total = session.dutyIds.length;
  if (total === 0) return 0;
  return Math.min(1, doneCount(session) / total);
}

export function remainingMs(session: PowerHourSession, nowMs: number): number {
  return Math.max(0, session.endsAtMs - nowMs);
}

export function isTimeUp(session: PowerHourSession, nowMs: number): boolean {
  return nowMs >= session.endsAtMs;
}

/** "12:05", or "1:02:00" past an hour (an extended 45 never gets there, but a
 * resumed session might). Whole seconds, rounded up so it never shows 0:00
 * while time is still left. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  return `${minutes}:${ss}`;
}

export function markDone(session: PowerHourSession, dutyId: string): PowerHourSession {
  if (!session.dutyIds.includes(dutyId) || session.doneIds.includes(dutyId)) return session;
  return { ...session, doneIds: [...session.doneIds, dutyId] };
}

/** Takes a chore out of the hour. It stays on today's list; it is just not
 * this hour's to do. */
export function skipChore(session: PowerHourSession, dutyId: string): PowerHourSession {
  if (!session.dutyIds.includes(dutyId) || session.doneIds.includes(dutyId)) return session;
  return {
    ...session,
    dutyIds: session.dutyIds.filter((id) => id !== dutyId),
    skippedIds: [...(session.skippedIds ?? []), dutyId],
  };
}

/**
 * Ten more minutes. When `open` is given, chores that fit the new ten are
 * added to the end (quickest first), so extending a hour that ran out of
 * chores is not an empty gift.
 */
export function extendSession(
  session: PowerHourSession,
  nowMs: number,
  open: Duty[] = [],
  isOverdue: (duty: Duty) => boolean = () => false,
  minutes = POWER_HOUR_EXTEND_MIN,
): PowerHourSession {
  // Time already up: the extra ten counts from now, not from the old end.
  const base = Math.max(session.endsAtMs, nowMs);
  const taken = new Set([...session.dutyIds, ...(session.skippedIds ?? [])]);
  const fresh = open.filter((duty) => !taken.has(duty.id));
  const room = Math.max(0, POWER_HOUR_MAX_CHORES - pendingIds(session).length);
  const extra = pickPowerHour(fresh, minutes, isOverdue, room);
  return {
    ...session,
    endsAtMs: base + minutes * MINUTE_MS,
    dutyIds: [...session.dutyIds, ...extra.duties.map((duty) => duty.id)],
  };
}

/** Ending early leaves everything else exactly where it was; only the clock
 * stops. */
export function endEarly(session: PowerHourSession, nowMs: number): PowerHourSession {
  return { ...session, endsAtMs: Math.min(session.endsAtMs, nowMs) };
}

export type PowerHourSummary = {
  done: number;
  /** Whole minutes the hour actually ran, at least 1. */
  minutes: number;
  finishedAll: boolean;
};

export function summarize(
  session: PowerHourSession,
  nowMs: number,
  openIds?: ReadonlySet<string>,
): PowerHourSummary {
  const end = Math.min(nowMs, session.endsAtMs);
  return {
    done: doneCount(session),
    minutes: Math.max(1, Math.round((end - session.startedAt) / MINUTE_MS)),
    finishedAll: leftCount(session, openIds) === 0,
  };
}

/** What gets saved between launches. Only ids and times, never chore names. */
export function serializeSession(session: PowerHourSession): string {
  return JSON.stringify(session);
}

export function parseSession(raw: string | null): PowerHourSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PowerHourSession> | null;
    if (!value || typeof value !== "object") return null;
    const strings = (list: unknown): list is string[] =>
      Array.isArray(list) && list.every((item) => typeof item === "string");
    if (
      typeof value.id !== "string" ||
      !Number.isFinite(value.startedAt) ||
      !Number.isFinite(value.endsAtMs) ||
      !Number.isFinite(value.lengthMin) ||
      !strings(value.dutyIds) ||
      !strings(value.doneIds)
    ) {
      return null;
    }
    const session: PowerHourSession = {
      id: value.id,
      startedAt: value.startedAt as number,
      endsAtMs: value.endsAtMs as number,
      lengthMin: value.lengthMin as number,
      dutyIds: value.dutyIds.slice(0, 40),
      doneIds: value.doneIds.slice(0, 40),
    };
    if (strings(value.skippedIds)) session.skippedIds = value.skippedIds.slice(0, 40);
    return session;
  } catch {
    return null;
  }
}
