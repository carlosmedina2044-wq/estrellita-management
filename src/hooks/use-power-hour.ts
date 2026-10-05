"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tDutyTitle } from "@/i18n/content";
import { useLocale } from "@/i18n/locale-provider";
import { isOverdueFor, todaysOpenDuties } from "@/lib/duties";
import { hapticClose, hapticComplete, hapticPress, hapticSuccess } from "@/lib/native/haptics";
import { kvGet, kvRemove, kvSet } from "@/lib/native/kv";
import {
  endPowerHourActivity,
  startPowerHourActivity,
  updatePowerHourActivity,
} from "@/lib/native/power-hour";
import { prefersReducedMotion } from "@/lib/motion";
import { dayArc } from "@/lib/momentum";
import {
  DEFAULT_POWER_HOUR_LENGTH,
  doneCount,
  endEarly,
  extendSession,
  isTimeUp,
  leftCount,
  markDone,
  nextId,
  parseSession,
  pendingIds,
  pickPowerHour,
  reconcileDone,
  serializeSession,
  skipChore,
  startSession,
  summarize,
  type PowerHourPlan,
  type PowerHourSession,
  type PowerHourSummary,
} from "@/lib/power-hour";
import type { Duty, Household } from "@/lib/types";

/** Ids and times only. Survives an app kill; nothing about a chore is kept. */
const STORAGE_KEY = "cuidala-power-hour-v1";

export type PowerHourPhase = "closed" | "choosing" | "running" | "summary";
export type PowerHourEnding = "timesup" | "ended" | "finished";

export type PowerHourApi = {
  phase: PowerHourPhase;
  session: PowerHourSession | null;
  nowMs: number;
  length: number;
  setLength: (minutes: number) => void;
  plan: PowerHourPlan;
  /** The plan the entry row quotes before anyone opens the sheet. */
  defaultPlan: PowerHourPlan;
  next: Duty | null;
  /** Chores still to do after `next`, in order. */
  rest: Duty[];
  left: number;
  total: number;
  summary: PowerHourSummary | null;
  ending: PowerHourEnding | null;
  /** The whole day's list is finished (drives the closing beat). */
  dayClosed: boolean;
  /** Everything still open on today's list, in or out of the hour. */
  todayLeft: number;
  openChooser: () => void;
  closeChooser: () => void;
  start: () => void;
  done: (duty: Duty) => void;
  skip: (duty: Duty) => void;
  extend: () => void;
  end: () => void;
  dismiss: () => void;
};

export function usePowerHour(args: {
  household: Household;
  now: Date;
  enabled: boolean;
  onComplete: (dutyId: string) => void;
  /** Bumps each time something (a deep link, Siri) asks for a power hour. */
  request: number;
}): PowerHourApi {
  const { household, now, enabled, onComplete, request } = args;
  const { t } = useLocale();
  const [phase, setPhase] = useState<PowerHourPhase>("closed");
  const [baseSession, setSession] = useState<PowerHourSession | null>(null);
  const [length, setLength] = useState<number>(DEFAULT_POWER_HOUR_LENGTH);
  const [ending, setEnding] = useState<PowerHourEnding | null>(null);
  const [frozenAt, setFrozenAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const onCompleteRef = useRef(onComplete);
  const sessionRef = useRef<PowerHourSession | null>(null);
  const loaded = useRef(false);
  const phaseRef = useRef<PowerHourPhase>("closed");
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  // A chore ticked anywhere else still counts toward the hour.
  const session = useMemo(
    () => (baseSession ? reconcileDone(baseSession, household.completions) : null),
    [baseSession, household.completions],
  );

  useEffect(() => {
    sessionRef.current = session;
    phaseRef.current = phase;
  }, [session, phase]);

  const open = useMemo(() => todaysOpenDuties(household, now, "all"), [household, now]);
  const openIds = useMemo(() => new Set(open.map((duty) => duty.id)), [open]);
  const overdue = useCallback((duty: Duty) => isOverdueFor(duty, household, now), [household, now]);
  const plan = useMemo(() => pickPowerHour(open, length, overdue), [open, length, overdue]);
  const defaultPlan = useMemo(
    () => pickPowerHour(open, DEFAULT_POWER_HOUR_LENGTH, overdue),
    [open, overdue],
  );

  const persist = useCallback((value: PowerHourSession | null) => {
    void (value ? kvSet(STORAGE_KEY, serializeSession(value)) : kvRemove(STORAGE_KEY)).catch(() => {});
  }, []);

  const dutyOf = useCallback(
    (id: string) => household.duties.find((duty) => duty.id === id) ?? null,
    [household.duties],
  );

  // Resume after a kill or a relaunch: still inside the window, the hour picks
  // up where it was; past it, the end is offered once and the record cleared.
  useEffect(() => {
    if (!enabled || loaded.current) return;
    loaded.current = true;
    void kvGet(STORAGE_KEY)
      .then((raw) => {
        const saved = parseSession(raw);
        if (!saved) return;
        const reconciled = reconcileDone(saved, household.completions);
        const at = Date.now();
        setNowMs(at);
        if (isTimeUp(reconciled, at)) {
          void kvRemove(STORAGE_KEY).catch(() => {});
          if (doneCount(reconciled) === 0) return;
          setSession(reconciled);
          setFrozenAt(reconciled.endsAtMs);
          setEnding("timesup");
          setPhase("summary");
          return;
        }
        setSession(reconciled);
        setPhase("running");
      })
      .catch(() => {});
    // Read once, with the household as it is when the shell has hydrated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const finish = useCallback(
    (kind: PowerHourEnding, from: PowerHourSession) => {
      const at = Date.now();
      persist(null);
      void endPowerHourActivity(kind === "finished").catch(() => {});
      // Ending with nothing done has nothing to report; no "0 done" screen.
      if (kind === "ended" && doneCount(from) === 0) {
        setPhase("closed");
        setSession(null);
        setEnding(null);
        setFrozenAt(null);
        return;
      }
      const stopped = kind === "timesup" ? from : endEarly(from, at);
      setSession(stopped);
      setFrozenAt(Math.min(at, stopped.endsAtMs));
      setEnding(kind);
      setPhase("summary");
    },
    [persist],
  );

  // One tick a second while an hour runs. It is only a text update: the
  // countdown never animates, so Reduce Motion needs no special case here.
  useEffect(() => {
    if (phase !== "running") return;
    const tick = () => {
      const at = Date.now();
      setNowMs(at);
      const current = sessionRef.current;
      if (current && isTimeUp(current, at)) finish("timesup", current);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, finish]);

  // Someone asked for a power hour from outside (the deep link).
  const [seenRequest, setSeenRequest] = useState(request);
  if (request !== seenRequest) {
    setSeenRequest(request);
    if (enabled && phase === "closed") setPhase("choosing");
  }

  const pushActivity = useCallback(
    (value: PowerHourSession) => {
      const upcoming = nextId(value, openIds);
      const title = upcoming ? dutyOf(upcoming) : null;
      void updatePowerHourActivity({
        left: leftCount(value, openIds),
        nextTitle: title ? tDutyTitle(title.title) : undefined,
        endsAtMs: value.endsAtMs,
      }).catch(() => {});
    },
    [openIds, dutyOf],
  );

  const next = useMemo(() => {
    if (!session) return null;
    const id = nextId(session, openIds);
    return id ? dutyOf(id) : null;
  }, [session, openIds, dutyOf]);
  const rest = useMemo(() => {
    if (!session) return [];
    return pendingIds(session, openIds)
      .slice(1)
      .map(dutyOf)
      .filter((duty): duty is Duty => duty !== null);
  }, [session, openIds, dutyOf]);
  const left = session ? leftCount(session, openIds) : 0;
  const total = session ? session.dutyIds.length : 0;

  const start = useCallback(() => {
    if (plan.count === 0) return;
    const at = Date.now();
    const created = startSession(plan, length, at);
    void hapticPress();
    setSession(created);
    setNowMs(at);
    setFrozenAt(null);
    setEnding(null);
    setPhase("running");
    persist(created);
    const first = plan.duties[0];
    void startPowerHourActivity({
      title: t("powerHour.title"),
      total: created.dutyIds.length,
      left: created.dutyIds.length,
      nextTitle: first ? tDutyTitle(first.title) : undefined,
      endsAtMs: created.endsAtMs,
    }).catch(() => {});
  }, [plan, length, persist, t]);

  const done = useCallback(
    (duty: Duty) => {
      const current = sessionRef.current;
      if (!current) return;
      void hapticComplete();
      // The shell's own completion: the house answers and the streak counts.
      onCompleteRef.current(duty.id);
      const updated = markDone(current, duty.id);
      const remaining = pendingIds(updated, openIds).filter((id) => id !== duty.id);
      if (remaining.length === 0) {
        setSession(updated);
        finish("finished", updated);
        return;
      }
      setSession(updated);
      persist(updated);
      pushActivity(updated);
    },
    [openIds, persist, pushActivity, finish],
  );

  const skip = useCallback(
    (duty: Duty) => {
      const current = sessionRef.current;
      if (!current) return;
      void hapticPress();
      const updated = skipChore(current, duty.id);
      if (pendingIds(updated, openIds).length === 0) {
        setSession(updated);
        finish(doneCount(updated) > 0 ? "finished" : "ended", updated);
        return;
      }
      setSession(updated);
      persist(updated);
      pushActivity(updated);
    },
    [openIds, persist, pushActivity, finish],
  );

  const extend = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    void hapticPress();
    const at = Date.now();
    const taken = new Set([...current.dutyIds, ...(current.skippedIds ?? [])]);
    const updated = extendSession(
      current,
      at,
      open.filter((duty) => !taken.has(duty.id)),
      overdue,
    );
    setSession(updated);
    setNowMs(at);
    setFrozenAt(null);
    setEnding(null);
    setPhase("running");
    persist(updated);
    if (phaseRef.current === "summary") {
      // The activity ended with the time; bring it back for the extra ten.
      const upcoming = nextId(updated, openIds);
      const title = upcoming ? dutyOf(upcoming) : null;
      void startPowerHourActivity({
        title: t("powerHour.title"),
        total: updated.dutyIds.length,
        left: leftCount(updated, openIds),
        nextTitle: title ? tDutyTitle(title.title) : undefined,
        endsAtMs: updated.endsAtMs,
      }).catch(() => {});
    } else {
      pushActivity(updated);
    }
  }, [open, overdue, persist, pushActivity, openIds, dutyOf, t]);

  const end = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    void hapticPress();
    finish("ended", current);
  }, [finish]);

  const dismiss = useCallback(() => {
    setPhase("closed");
    setSession(null);
    setEnding(null);
    setFrozenAt(null);
    persist(null);
  }, [persist]);

  const summary = useMemo(
    () => (session && phase === "summary" ? summarize(session, frozenAt ?? nowMs) : null),
    [session, phase, frozenAt, nowMs],
  );

  const dayClosed = useMemo(() => dayArc(household, now, "all").state === "closed", [household, now]);

  // The closing beat, once, when the hour ends with the whole day's list done.
  const beat = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "summary" || !session || !dayClosed) return;
    if (beat.current === session.id) return;
    beat.current = session.id;
    if (prefersReducedMotion()) void hapticSuccess();
    else void hapticClose();
  }, [phase, session, dayClosed]);

  return {
    phase,
    session,
    nowMs: frozenAt ?? nowMs,
    length,
    setLength,
    plan,
    defaultPlan,
    next,
    rest,
    left,
    total,
    summary,
    ending,
    dayClosed,
    todayLeft: open.length,
    openChooser: () => {
      if (!enabled) return;
      setPhase((current) => (current === "closed" ? "choosing" : current));
    },
    closeChooser: () => setPhase((current) => (current === "choosing" ? "closed" : current)),
    start,
    done,
    skip,
    extend,
    end,
    dismiss,
  };
}
