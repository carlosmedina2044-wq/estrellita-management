"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronDown, Package, Settings, Share2, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-logo";
import { DayCalendar } from "@/components/day-calendar";
import { SeasonSection } from "@/components/season-section";
import { CostPrompt } from "@/components/cost-prompt";
import { ConsumableForm } from "@/components/consumable-form";
import { RestockOrderButton, restockButtonProps } from "@/components/restock-order-flow";
import { DutyDetailSheet } from "@/components/duty-detail-sheet";
import { DutyForm } from "@/components/duty-form";
import { DutyRow } from "@/components/duty-row";
import { DutyContextMenu, type DutyMenuAction } from "@/components/duty-context-menu";
import { ZipSheet } from "@/components/zip-prompt";
import { Button } from "@/components/ui/button";
import { AttentionTiles } from "@/components/today/attention-tiles";
import { ClosingReward, ClosingStats } from "@/components/today/closing-ceremony";
import { ParticleLayer, type ParticleLayerHandle } from "@/components/today/particle-layer";
import { PortraitScene } from "@/components/today/portrait-scene";
import { SceneBoundary } from "@/components/scene-boundary";
import { HouseSheet } from "@/components/today/house-sheet";
import { RollingNumber } from "@/components/today/rolling-number";
import { RunStrip } from "@/components/today/run-strip";
import { TodayHero } from "@/components/today/today-hero";
import { TodayNoticeCard, type TodayNotice } from "@/components/today/today-notice-card";
import { WholeHouseCard } from "@/components/today/whole-house-card";
import { useCompletionFlow } from "@/components/today/use-completion-flow";
import { shouldPromptCost, suggestedCostFor } from "@/lib/costs";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { addDays, formatLongDate, formatTime, isFirstOfMonth, sameDay, startOfDay, startOfMonth, startOfWeek, toISODate, weekRange } from "@/lib/dates";
import { keptRooms, wholeHouseKept } from "@/lib/kept-rooms";
import { payoffKeyFor } from "@/lib/payoff-lines";
import { hasSeenTip, markTipSeen, TIP_HOUSE_REVEAL } from "@/lib/teaching";
import { dayOfYear, heroCopyKey, nextUpDayLabel } from "@/lib/today-copy";
import { formatLedgerLine, monthLedger } from "@/lib/value-ledger";
import {
  completionDays,
  doneOnDay,
  doneThisWeek,
  doneToday,
  dutiesDueOnDate,
  isDoneThisPeriod,
  isOverdueFor,
  installedAtFor,
  monthPlanDuties,
  openDutiesInScope,
  relativeDayLabel,
  shareDoneText,
  shareText,
  todaysOpenDuties,
  type DoneEntry,
  type OutstandingScope,
} from "@/lib/duties";
import { closedDayRun, dayArc, dismissWeekWrapped, roomsTouchedInRange, runStripDays, shouldShowWeekWrapped, todayEffort, weekProgress } from "@/lib/momentum";
import { sceneCssVars } from "@/lib/scene/css";
import { skyGradient } from "@/lib/scene/sky";
import { skyPhase, sunTimes } from "@/lib/scene/sun";
import { sceneWeather } from "@/lib/scene/weather";
import { tDutyTitle } from "@/i18n/content";
import { todayGreeting } from "@/lib/greeting";
import { homeSummary } from "@/lib/node-status";
import { shareText as nativeShare } from "@/lib/native/share";
import type { WeatherAttribution } from "@/lib/native/weatherkit";
import { useSheetOpenGuard } from "@/lib/sheet-guard";
import { groupRestock, orderNowCostCaption, partStatusForDuty, type RestockFlowHandlers } from "@/lib/restock";
import type { AppNavigateTarget, Audience, Duty, DutyDraft, Household } from "@/lib/types";
import type { WeatherForecast } from "@/lib/weather/provider";
import { cn } from "@/lib/utils";
import { CEREMONY_MS, DUR_QUICK, EASE_OUT, SPRING_SETTLE, STAGGER_CHILD, scrollBehavior } from "@/lib/motion";
import { hapticComplete, hapticTab } from "@/lib/native/haptics";
import { AppleWeatherAttribution } from "@/components/apple-weather-attribution";
import { useLocale } from "@/i18n/locale-provider";
import { useClock } from "@/hooks/use-clock";
import { useNow } from "@/hooks/use-now";
import { useSessionArrival } from "@/hooks/use-session-arrival";

export function TodayView({
  household,
  weatherAttribution,
  forecast = null,
  weatherLine,
  needsZip,
  weatherLoading,
  onSavePostalCode,
  onComplete,
  onRecordCost,
  onUndo,
  onSaveDuty,
  onDeleteDuty,
  onStartCleanerVisit,
  onOpenHome,
  onOpenSettings,
  showTeaching,
  onOpenDigest,
  onOpenRestock,
  onNavigate,
  onChangeTree,
  onUpdateTree,
  focus,
  onFocusHandled,
  ...restockHandlers
}: {
  household: Household;
  weatherAttribution?: WeatherAttribution | null;
  forecast?: WeatherForecast | null;
  weatherLine?: string;
  needsZip?: boolean;
  weatherLoading?: boolean;
  onSavePostalCode?: (zip: string) => Promise<{ ok: boolean; error?: string }>;
  onComplete: (dutyId: string) => void;
  onRecordCost?: (completionId: string, input: { actualCost: number } | { skip: true }) => void;
  onUndo: (dutyId: string) => void;
  onSaveDuty: (duty: DutyDraft) => void;
  onDeleteDuty: (id: string) => void;
  onStartCleanerVisit: () => void;
  onOpenHome?: () => void;
  onOpenSettings?: () => void;
  showTeaching?: boolean;
  onOpenDigest?: () => void;
  onReorderRooms?: (rooms: Household["rooms"]) => void;
  onChangeTree?: (next: Household) => void;
  /** Preferred over `onChangeTree` for writes that happen later than the
   * render they were scheduled in (timers), so they apply to the household
   * as it is then, not as it was. */
  onUpdateTree?: (updater: (current: Household) => Household) => void;
  onOpenRestock?: () => void;
  onNavigate?: (target: AppNavigateTarget) => void;
  focus?: AppNavigateTarget | null;
  onFocusHandled?: () => void;
} & RestockFlowHandlers) {
  const { t } = useLocale();
  const scopes = useMemo(
    () =>
      [
        { id: "daily" as const, label: t("today.scopeToday") },
        { id: "weekly" as const, label: t("today.scopeWeek") },
        { id: "monthly" as const, label: t("today.scopeMonth") },
      ] satisfies { id: OutstandingScope; label: string }[],
    [t],
  );
  const now = useNow();
  // Calendar day (`now`) and wall clock (`clock`) are separate on purpose:
  // `now` stays pinned to local midnight so date maths and the duty list are
  // stable, while anything that tracks the hour reads `clock`.
  const clock = useClock();
  const clockMs = clock.getTime();
  // True only for the very first paint of Today this app launch — never on a
  // tab switch back to it (the pane stays mounted, just hidden). Reduce
  // Motion still gets the flag (so nothing downstream needs to know why),
  // it just skips animating from it.
  const isArrival = useSessionArrival();
  const reduceMotion = useReducedMotion();
  const playArrival = isArrival && !reduceMotion;
  const [filter, setFilter] = useState<Audience | "all">("all");
  const [scope, setScope] = useState<OutstandingScope>("daily");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDay, setCalendarDay] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [editing, setEditing] = useState<Duty | null>(null);
  const [detail, setDetail] = useState<Duty | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingRule, setCreatingRule] = useState(false);
  const [zipOpen, setZipOpen] = useState(false);
  const [teachingHidden, setTeachingHidden] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [orderItemId, setOrderItemId] = useState<string | null>(null);
  const [dutyMenu, setDutyMenu] = useState<{ duty: Duty; x: number; y: number } | null>(null);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [houseOpen, setHouseOpen] = useState(false);
  const particlesRef = useRef<ParticleLayerHandle>(null);
  const celebratedDays = useRef<Set<string>>(new Set());
  const wholeHouseShownWeeks = useRef<Set<string>>(new Set());
  const [ceremonyDay, setCeremonyDay] = useState<string | null>(null);
  const [payoffDuty, setPayoffDuty] = useState<Duty | null>(null);
  const [dismissedCareKeys, setDismissedCareKeys] = useState<Set<string>>(() => new Set());
  const [showWholeHouseCard, setShowWholeHouseCard] = useState(false);
  const [compactBar, setCompactBar] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [prevFocus, setPrevFocus] = useState(focus);
  if (focus !== prevFocus) {
    setPrevFocus(focus);
    if (focus?.dutyId) {
      const duty = household.duties.find((entry) => entry.id === focus.dutyId);
      if (duty) setDetail(duty);
    }
  }
  const listRef = useRef<HTMLDivElement>(null);
  const createGuard = useSheetOpenGuard();
  const restock = useMemo(
    () => groupRestock(household.supplyAutomations, household, now),
    [household, now],
  );

  useEffect(() => {
    if (!focus?.dutyId) return;
    onFocusHandled?.();
  }, [focus, onFocusHandled]);

  const calendarMarks = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth));
    return completionDays(household, start, addDays(start, 41));
  }, [household, calendarMonth]);
  const week = useMemo(() => weekProgress(household, now), [household, now]);
  const weekRooms = useMemo(() => {
    const range = weekRange(now);
    return roomsTouchedInRange(household, range.start, now);
  }, [household, now]);
  const showWeekWrapped = household.momentum.enabled && shouldShowWeekWrapped(household, now);
  const viewingCalendar = calendarDay !== null;
  const viewDate = calendarDay ?? now;
  const calendarIsToday = viewingCalendar && sameDay(viewDate, now);
  const firstOfMonth = isFirstOfMonth(now) && scope === "monthly" && !viewingCalendar;

  const open = viewingCalendar
    ? calendarIsToday
      ? todaysOpenDuties(household, now, filter)
      : dutiesDueOnDate(household, viewDate, filter).filter(
          (duty) => !isDoneThisPeriod(duty, household.completions, viewDate, installedAtFor(household, duty.id)),
        )
    : openDutiesInScope(household, scope, now, filter);

  const doneTodayEntries = !viewingCalendar && scope === "daily" ? doneToday(household, now, filter) : [];
  // Unscoped, unlike `doneTodayEntries` above: the ceremony stats must reflect
  // today's real totals regardless of which segmented-control tab (Today/This
  // week/This month) happens to be selected. Reusing `doneTodayEntries` here
  // made the closing-ceremony numbers read "0 things done" the moment someone
  // switched to This week, even minutes after closing the day.
  const todayDoneForCeremony = doneToday(household, now, filter);
  const doneWeek = !viewingCalendar && scope === "weekly" ? doneThisWeek(household, now, filter) : [];
  const calendarDone = viewingCalendar ? doneOnDay(household, viewDate, filter) : [];
  const doneEntries: DoneEntry[] = viewingCalendar
    ? calendarDone
    : scope === "weekly"
      ? doneWeek.flatMap((group) => group.entries)
      : doneTodayEntries;

  const monthPlan = firstOfMonth ? monthPlanDuties(household, now, filter) : [];
  const cleanerOpen = todaysOpenDuties(household, now, "cleaner");
  const summary = homeSummary(household, now);
  const listed = onlyOverdue ? open.filter((duty) => isOverdueFor(duty, household, now)) : open;
  const weatherListed = listed.filter((duty) => Boolean(duty.weatherTriggerId));
  const regularListed = listed.filter((duty) => !duty.weatherTriggerId);

  const completion = useCompletionFlow({
    open,
    scope,
    viewingCalendar,
    momentumOn: household.momentum.enabled,
    onComplete,
    onUndo,
    onCommitted: (duty, remaining) => {
      if (payoffKeyFor(duty)) {
        setPayoffDuty(duty);
      } else {
        setPayoffDuty(null);
      }
      if (
        remaining.length === 0 &&
        scope === "daily" &&
        !viewingCalendar &&
        household.momentum.enabled
      ) {
        const iso = toISODate(now);
        if (!celebratedDays.current.has(iso)) {
          celebratedDays.current.add(iso);
          setCeremonyDay(iso);
        }
      }
    },
  });

  function selectScope(next: OutstandingScope) {
    if (next !== scope) void hapticTab();
    setOnlyOverdue(false);
    setScope(next);
    setCalendarDay(null);
    setCalendarOpen(false);
  }

  function selectCalendarDay(date: Date) {
    setCalendarDay(date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function snoozeDuty(target: Duty) {
    const until = toISODate(addDays(now, 7));
    onSaveDuty({ ...target, snoozedUntil: until });
    toast(t("chore.snoozedToast"));
  }

  function handleDutyMenu(action: DutyMenuAction) {
    const target = dutyMenu?.duty;
    if (!target) return;
    if (action === "complete") {
      completion.complete(target);
      return;
    }
    if (action === "edit") {
      setEditing(target);
      return;
    }
    if (action === "delete") {
      onDeleteDuty(target.id);
      return;
    }
    if (action === "snooze") {
      snoozeDuty(target);
    }
  }

  async function share() {
    const text = shareText(household, cleanerOpen.length ? cleanerOpen : open);
    const result = await nativeShare(t("share.todayTitle", { name: household.householdName }), text);
    if (result === "copied") toast.success(t("share.copiedToday"));
    if (result === "failed") toast.error(t("share.failedList"));
  }

  async function shareDone() {
    const result = await nativeShare(
      t("share.doneTitle", { name: household.householdName }),
      shareDoneText(household, doneEntries),
    );
    if (result === "copied") toast.success(t("share.copiedDone"));
    if (result === "failed") toast.error(t("share.failedList"));
  }

  function dutyRow(
    duty: Duty,
    extra: { done?: boolean; overdue?: boolean; doneMeta?: string } = {},
  ) {
    const chip = extra.done ? null : partStatusForDuty(duty, household, now);
    return (
      <DutyRow
        duty={duty}
        household={household}
        now={viewDate}
        done={extra.done}
        doneMeta={extra.doneMeta}
        overdue={extra.overdue}
        hideOverdueChip={onlyOverdue}
        partChip={chip}
        completing={!extra.done && completion.completingId === duty.id}
        onPressStart={() => {}}
        onLongPress={
          extra.done
            ? undefined
            : (point) => setDutyMenu({ duty, x: point.x, y: point.y })
        }
        onMore={
          extra.done
            ? undefined
            : (point) => setDutyMenu({ duty, x: point.x, y: point.y })
        }
        onPartChip={
          chip?.kind === "order_first"
            ? () => {
                const item = household.supplyAutomations.find(
                  (entry) => entry.dutyId === duty.id || entry.linkedDutyIds.includes(duty.id),
                );
                if (item) setOrderItemId(item.id);
              }
            : undefined
        }
        missingPartHint={chip?.kind === "order_first"}
        onToggle={() =>
          extra.done || completion.completingId === duty.id
            ? completion.undo(duty)
            : completion.complete(duty)
        }
        onOpen={() => setDetail(duty)}
        onSparkleError={(point) => particlesRef.current?.burst({ ...point, count: 12 })}
      />
    );
  }

  function animatedDuty(duty: Duty, extra: { done?: boolean; overdue?: boolean; doneMeta?: string } = {}) {
    return (
      <motion.div
        key={duty.id}
        layout
        layoutId={duty.id}
        className="ui-group-row"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={SPRING_SETTLE}
      >
        {dutyRow(duty, extra)}
      </motion.div>
    );
  }

  const restockCount = restock.order_now.length + restock.ordered.length;
  const showRestockChip = restockCount > 0;
  const hasCleanerDuties = household.duties.some((duty) => duty.audience !== "me");
  const hasCleaner = Boolean(household.cleanerName.trim());
  const orderItem = orderItemId
    ? household.supplyAutomations.find((item) => item.id === orderItemId) ?? null
    : null;
  const costPrompts = onRecordCost
    ? household.completions.filter((item) => {
        const match = household.duties.find((duty) => duty.id === item.dutyId);
        return match ? shouldPromptCost(item, match, now, household) : false;
      })
    : [];
  const greeting = todayGreeting(household.ownerName, clock.getHours());
  const headingDate = viewingCalendar ? formatLongDate(viewDate) : formatLongDate(now);
  const zipBannerVisible = Boolean(needsZip && onSavePostalCode);
  const showTeachingCard = Boolean(showTeaching && !teachingHidden && !zipBannerVisible && summary.overdue === 0);
  const arc = dayArc(household, viewDate, filter);
  const momentumOn = household.momentum.enabled && household.mode === "owner";
  const doneIds = new Set(doneEntries.map((entry) => entry.duty.id));
  const leftoverCostPrompts = costPrompts.filter(
    (item) => !doneIds.has(item.dutyId) && !open.some((duty) => duty.id === item.dutyId),
  );
  const includeDoneDay = scope === "weekly" && !viewingCalendar;
  const doneHeader = viewingCalendar
    ? calendarIsToday
      ? t("today.doneToday")
      : t("today.done")
    : scope === "weekly"
      ? t("today.doneThisWeek")
      : t("today.doneToday");

  function doneMetaFor(entry: DoneEntry): string {
    const name =
      entry.completion.actor === "cleaner"
        ? household.cleanerName.trim() || t("audience.cleaner")
        : t("audience.me");
    const parts = [t("today.doneBy", { name }), formatTime(new Date(entry.completion.completedAt))];
    if (includeDoneDay) {
      parts.push(relativeDayLabel(new Date(entry.completion.completedAt), now));
    }
    return parts.join(" · ");
  }

  const secondaryLine = [headingDate, !needsZip ? weatherLine : null]
    .filter(Boolean)
    .join(" · ");

  const todayIso = toISODate(now);
  const ceremonyActive = ceremonyDay === todayIso;
  // Plays once, the first time Today ever renders with a chosen house look —
  // never again after (existing households with no `homeSpec` never had a
  // "your house" moment to begin with, so they're excluded rather than
  // getting a surprise reveal on an unrelated day).
  const [houseReveal, setHouseReveal] = useState(
    () => Boolean(household.homeSpec) && !hasSeenTip(household, TIP_HOUSE_REVEAL),
  );
  useEffect(() => {
    if (!houseReveal) return;
    void hapticComplete();
    const timer = window.setTimeout(() => {
      setHouseReveal(false);
      // A functional update, never the household this effect closed over: the
      // shell applies `onChangeTree` as a whole-tree replacement, so writing
      // back a 1.2s-old snapshot here discarded anything persisted meanwhile.
      // On a fresh install that window is exactly when the first forecast
      // lands and the weather triggers add their duties.
      const mark = (current: Household) => markTipSeen(current, TIP_HOUSE_REVEAL);
      if (onUpdateTree) onUpdateTree(mark);
      else onChangeTree?.(mark(household));
    }, CEREMONY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseReveal]);
  const ceremonyStats = {
    done: todayDoneForCeremony.length,
    minutes: todayEffort(todayDoneForCeremony.map((entry) => entry.duty)),
    rooms: roomsTouchedInRange(household, new Date(startOfDay(now)), now),
  };
  const sceneMinutesParts = t("today.minutesLeft", { minutes: "%%" }).split("%%");
  // A clear or rest day has no minutes to count down, and "0 min left" read
  // as a bug. The hero copy pools ("All clear. Next up Friday.", "A rest day.
  // The house is fine.") already exist for exactly these states; they only
  // ever rendered in the unreachable TodayHero branch. Rotates by day.
  const sceneQuietLine =
    arc.state === "clear" || arc.state === "rest"
      ? t(
          heroCopyKey(arc.state, dayOfYear(now), {
            hasName: Boolean(household.ownerName.trim()),
            count: 0,
            nextUp: arc.nextUp,
          }),
          { count: 0, minutes: 0, day: nextUpDayLabel(arc.nextUp), name: household.ownerName.trim() },
        )
      : null;
  const monthLedgerLine = useMemo(() => formatLedgerLine(monthLedger(household, now), t), [household, now, t]);
  const kept = useMemo(() => keptRooms(household, now), [household, now]);
  const houseKept = useMemo(() => wholeHouseKept(kept, household, now), [kept, household, now]);
  const weekKey = toISODate(startOfWeek(now));

  useEffect(() => {
    if (!household.momentum.enabled || !houseKept) return;
    if (wholeHouseShownWeeks.current.has(weekKey)) return;
    wholeHouseShownWeeks.current.add(weekKey);
    setShowWholeHouseCard(true);
  }, [houseKept, household.momentum.enabled, weekKey]);

  const pendingMilestone = household.milestones.find(
    (item) =>
      sameDay(new Date(item.earnedAt), now) &&
      !hasSeenTip(household, `milestone-card-${item.id}`),
  );
  const careState = household.momentum.care;
  const careKey =
    careState?.since === todayIso && careState.direction
      ? `${careState.since}:${careState.direction}:${careState.level}`
      : null;
  const careNotice =
    careKey && careState && !dismissedCareKeys.has(careKey) ? careState : null;

  let activeNotice: TodayNotice | null = null;
  if (pendingMilestone) {
    activeNotice = { kind: "milestone", id: pendingMilestone.id };
  } else if (careNotice) {
    activeNotice = { kind: "care", state: careNotice };
  } else if (payoffDuty) {
    activeNotice = { kind: "payoff", duty: payoffDuty };
  }

  function dismissNotice() {
    if (activeNotice?.kind === "milestone") {
      onChangeTree?.(markTipSeen(household, `milestone-card-${activeNotice.id}`));
      return;
    }
    if (activeNotice?.kind === "care" && careKey) {
      setDismissedCareKeys((prev) => new Set(prev).add(careKey));
      return;
    }
    if (activeNotice?.kind === "payoff") {
      setPayoffDuty(null);
    }
  }

  async function shareClosedDay() {
    const run = closedDayRun(household, now).current;
    const result = await nativeShare(
      t("share.dayClosedTitle", { name: household.householdName }),
      t("share.dayClosedText", {
        done: ceremonyStats.done,
        minutes: ceremonyStats.minutes,
        rooms: ceremonyStats.rooms,
        run,
      }),
    );
    if (result === "copied") toast.success(t("share.copiedDone"));
    if (result === "failed") toast.error(t("share.failedList"));
  }

  // Momentum scene: layered portrait; plain/cleaner keeps the M7-09-r2 hero card.
  //
  // The sky reads `clock`, never `now`. `now` is local midnight by design (see
  // `useNow`), and `skyPhase` reads `getHours()` — feeding it `now` pinned every
  // user's sky to "night" at every hour of the day.
  const sceneMode = momentumOn;
  const sceneWx = sceneWeather(forecast, todayIso);
  const { lat, lng } = household.location;
  const sceneTimes = useMemo(
    () => (lat != null && lng != null ? sunTimes(lat, lng, new Date(clockMs)) : null),
    [lat, lng, clockMs],
  );
  const scenePhase = useMemo(() => skyPhase(new Date(clockMs), sceneTimes), [clockMs, sceneTimes]);
  // Settings promises a fixed appearance "stays put" (Always light / Always
  // dark / Match iPhone). `nightFollowsSky === false` means the user picked
  // one of those, so the scene itself — not just the chrome — has to stop
  // reading the real sun position. Without this, the sky/moon kept following
  // real dusk/night under "Always light," producing a lit cream sheet under a
  // night sky with no way to tell the setting was doing anything at all.
  const { resolvedTheme } = useTheme();
  const scenePhaseEffective = useMemo(
    () =>
      household.momentum.nightFollowsSky === false
        ? { phase: (resolvedTheme === "dark" ? "night" : "day") as typeof scenePhase.phase, t: 0.5 }
        : scenePhase,
    [household.momentum.nightFollowsSky, resolvedTheme, scenePhase],
  );
  const sceneStops = useMemo(
    () => skyGradient(scenePhaseEffective.phase, scenePhaseEffective.t, sceneWx.kind, sceneWx.cloudCover),
    [scenePhaseEffective.phase, scenePhaseEffective.t, sceneWx.kind, sceneWx.cloudCover],
  );
  const nightFollows =
    sceneMode &&
    household.momentum.nightFollowsSky !== false &&
    (scenePhase.phase === "dusk" || scenePhase.phase === "night");

  // The evening look has to sit on the document, not on the Today root. Scoped
  // to Today it produced a dark panel floating in a cream shell: the tab bar and
  // the space reserved for it stayed light, which is the "light bottom" the
  // scene appeared to be cut out of. Tokens are a full mirror of `.dark`
  // (see `.today-night` in globals.css), so promoting it themes the whole app
  // coherently. This deviates from the handoff's "do not toggle the global
  // theme" line deliberately — that instruction is what produced the two-tone
  // screen. The class is separate from next-themes' `.dark` and only ever
  // added while the user's `nightFollowsSky` setting is on and the sky is
  // actually dusk or night.
  useEffect(() => {
    const el = document.documentElement;
    // Best-effort cache for `layout.tsx`'s pre-hydration bootstrap script —
    // see the comment there. Never throws: a full or disabled localStorage
    // just means the next launch falls back to today's status quo.
    try {
      window.localStorage.setItem("cuidala-today-night", nightFollows ? "1" : "0");
    } catch {
      // ignore
    }
    if (!nightFollows) {
      el.classList.remove("today-night");
      return;
    }
    el.classList.add("today-night");
    return () => el.classList.remove("today-night");
  }, [nightFollows]);

  useEffect(() => {
    if (!sceneMode) return;
    const pane = rootRef.current?.closest(".app-keep-alive");
    if (!(pane instanceof HTMLElement)) return;
    // Queried once per mount, not once per scroll frame: the node this
    // selector finds does not change while the scene is up.
    const blur = rootRef.current?.querySelector("[data-scene-blur]");
    const blurEl = blur instanceof HTMLElement ? blur : null;
    let frame = 0;
    // `backdrop-filter` is the most expensive property in this scroll: every
    // distinct blur radius forces the browser to re-sample and re-composite
    // whatever sits behind the scene, every frame, for the whole first 120px
    // of scroll — exactly the moment someone is judging how the app feels.
    // Snapping to a handful of steps reads as continuous (a new level every
    // 24px of scroll) while cutting DOM writes by well over 90%.
    const BLUR_STEPS = 5;
    const MAX_BLUR_PX = 12;
    let lastStep = -1;
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        // Clamp against iOS rubber-band overscroll: .app-keep-alive can report a
        // momentary negative scrollTop while it elastically bounces at the top,
        // which previously fed straight into the scene's transform and made the
        // art visibly bounce. The scene itself no longer transforms on scroll —
        // it is `position: sticky` (see the wrapper below) so the browser pins it
        // natively and the sheet slides up to cover it with no seam, instead of
        // two independently JS-driven layers racing at different speeds.
        const y = Math.max(0, pane.scrollTop);
        const step = Math.round(Math.min(y / 120, 1) * BLUR_STEPS);
        if (step !== lastStep) {
          lastStep = step;
          if (blurEl) {
            const amount = (step / BLUR_STEPS) * MAX_BLUR_PX;
            blurEl.style.backdropFilter = `blur(${amount}px)`;
            blurEl.style.setProperty("-webkit-backdrop-filter", `blur(${amount}px)`);
          }
        }
        setCompactBar(y > 120);
      });
    };
    pane.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      pane.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [sceneMode]);

  return (
    <div
      ref={rootRef}
      className={cn(
        sceneMode
          ? "today-scene-root -mx-4 -mt-[max(0.75rem,env(safe-area-inset-top))]"
          : "flex flex-col gap-5",
      )}
      style={
        sceneMode
          ? {
              ...sceneCssVars(sceneStops),
              background: "color-mix(in oklab, var(--background) 96%, var(--ambient))",
            }
          : undefined
      }
    >
      <ParticleLayer ref={particlesRef} />
      {sceneMode ? (
        <div
          // `top` cancels the negative margin this root uses to bleed the scene
          // under the status bar. The scroll container's content starts below
          // its own top padding, so a plain `top: 0` made sticky clamp the scene
          // down by exactly the safe-area inset while the sheet below stayed at
          // its flow position — the sheet then covered 90px of the scene on a
          // notched phone instead of 28px, burying the house. Offsetting by the
          // same amount pins the scene exactly at its flow position.
          className="sticky z-0"
          style={{ top: "calc(-1 * max(0.75rem, env(safe-area-inset-top)))" }}
        >
          <SceneBoundary
            // Same box the scene would have filled, so the sheet's negative
            // margin and the compact bar keep their geometry if the art fails.
            fallback={<div aria-hidden style={{ height: "calc(env(safe-area-inset-top) + 272px)" }} />}
          >
            <PortraitScene
              household={household}
              arc={arc}
              phase={scenePhaseEffective.phase}
              phaseT={scenePhaseEffective.t}
              weather={sceneWx}
              ceremony={ceremonyActive || houseReveal}
              arrival={playArrival}
              greeting={greeting}
              secondaryLine={secondaryLine}
              onOpenSettings={onOpenSettings}
              onOpenHouse={() => setHouseOpen(true)}
            />
          </SceneBoundary>
        </div>
      ) : (
        <TodayHero
          household={household}
          now={now}
          arc={arc}
          greeting={greeting}
          secondaryLine={secondaryLine}
          variant={momentumOn ? "momentum" : "plain"}
          careState={household.momentum.care}
          ceremony={ceremonyActive}
          ceremonyStats={ceremonyStats}
          ledgerLine={monthLedgerLine}
          onOpenSettings={onOpenSettings}
          onOpenCalendar={() => setCalendarOpen(true)}
          onShareClosed={() => {
            void shareClosedDay();
          }}
        />
      )}

      {sceneMode && compactBar ? (
        <div className="sticky top-0 z-30 flex h-[calc(env(safe-area-inset-top)+52px)] items-end justify-between bg-background/90 px-5 pb-1 backdrop-blur-md">
          <p className="ui-caption font-medium">
            {arc.state === "closed"
              ? t("today.compactClosed")
              : t("today.compactTitle", { count: arc.open })}
          </p>
          {onOpenSettings ? (
            <button
              type="button"
              aria-label={t("common.settings")}
              onClick={onOpenSettings}
              className="flex size-11 items-center justify-center rounded-full bg-secondary"
            >
              <Settings className="size-5" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={
          sceneMode
            ? "today-sheet relative z-10 -mt-7 flex flex-col gap-5 rounded-t-[28px] bg-background px-5 pt-4"
            : "contents"
        }
        style={
          sceneMode
            ? { boxShadow: "inset 0 1px 0 color-mix(in oklab, var(--ambient) 18%, transparent)" }
            : undefined
        }
      >
      {sceneMode ? (
        // The sky's dominant color bleeds a short way into the sheet, the way
        // Music/Photos let artwork color wash into the chrome below it — a
        // real, visible link between the scene and the rest of the app instead
        // of the 1px inset highlight above, which reads as no relationship at
        // all against a saturated sky.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-24 rounded-t-[28px]"
          style={{
            background:
              "linear-gradient(color-mix(in oklab, var(--ambient) 20%, var(--background)), transparent)",
          }}
        />
      ) : null}
      {sceneMode ? (
        <motion.div
          initial={playArrival ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR_QUICK, ease: EASE_OUT }}
        >
          <div className="flex min-h-14 items-start justify-between gap-3">
            {arc.state === "closed" ? (
              <ClosingStats stats={ceremonyStats} instant={!ceremonyActive} />
            ) : sceneQuietLine ? (
              <p className="ui-body font-medium">{sceneQuietLine}</p>
            ) : (
              <p className="ui-body font-medium num">
                {sceneMinutesParts[0]}
                <RollingNumber value={arc.minutesLeft} />
                {sceneMinutesParts[1] ?? null}
              </p>
            )}
            <RunStrip
              household={household}
              now={now}
              days={runStripDays(household, now)}
              celebrate={arc.state === "closed"}
              onOpenCalendar={() => setCalendarOpen(true)}
            />
          </div>
          {arc.state === "closed" ? (
            <ClosingReward
              onShare={() => {
                void shareClosedDay();
              }}
              instant={!ceremonyActive}
            />
          ) : null}
        </motion.div>
      ) : null}

      {momentumOn || zipBannerVisible ? (
        <motion.div
          className="flex flex-col gap-5"
          initial={playArrival ? { opacity: 0, y: 8 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DUR_QUICK, ease: EASE_OUT, delay: playArrival ? STAGGER_CHILD : 0 }}
        >
      {momentumOn ? <TodayNoticeCard notice={activeNotice} onDismiss={dismissNotice} /> : null}
      {zipBannerVisible ? (
        <button
          type="button"
          onClick={() => setZipOpen(true)}
          className="ui-group flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-foreground/6"
        >
          <span className="min-w-0">
            <span className="block ui-body font-medium">{t("today.addZip")}</span>
            <span className="mt-0.5 block ui-caption text-muted-foreground">
              {t("zip.addBody")}
            </span>
          </span>
          <span className="shrink-0 ui-caption font-semibold text-primary">{t("today.addZipCta")}</span>
        </button>
      ) : null}
        </motion.div>
      ) : null}

      {weatherLoading && !needsZip ? (
        <div className="forecast-shimmer rounded-[var(--r-container)] bg-card px-4 py-4" aria-hidden>
          <div className="h-3 w-24 rounded-full bg-foreground/8" />
          <div className="mt-3 h-5 w-48 rounded-full bg-foreground/8" />
          <div className="mt-2 h-3 w-36 rounded-full bg-foreground/8" />
        </div>
      ) : null}

      <motion.div
        initial={playArrival ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR_QUICK, ease: EASE_OUT, delay: playArrival ? STAGGER_CHILD * 2 : 0 }}
      >
      <AttentionTiles
        overdue={summary.overdue}
        dueToday={summary.dueToday}
        orderNow={summary.orderNow}
        orderNowCost={orderNowCostCaption(restock.order_now)}
        arriving={summary.arriving}
        labels={{
          overdue: t("today.overdue"),
          dueToday: t("today.dueToday"),
          orderNow: t("today.orderNow"),
          onTheWay: t("today.onTheWay"),
          allClear: t("today.allClear"),
          allClearHint: t("today.allClearHint"),
          allClearAria: t("today.allClearAria"),
        }}
        onOverdue={() => {
          setOnlyOverdue(true);
          setScope("daily");
          setCalendarDay(null);
          setCalendarOpen(false);
          listRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
        }}
        onDueToday={() => {
          setOnlyOverdue(false);
          setScope("daily");
          setCalendarDay(null);
          setCalendarOpen(false);
          listRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
        }}
        onOrder={() => onNavigate?.({ tab: "restock", section: "order_now" })}
        onArriving={() => onNavigate?.({ tab: "restock", section: "ordered" })}
        onAllClear={() => onOpenHome?.()}
      />
      </motion.div>

      <div className="flex items-center gap-2">
        <div role="tablist" aria-label={t("today.scopeList")} className="flex min-w-0 flex-1 rounded-full bg-secondary p-1">
          {scopes.map((item) => {
            const active = scope === item.id && !viewingCalendar;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => selectScope(item.id)}
                className={cn(
                  "relative h-11 flex-1 rounded-full ui-caption font-medium transition-transform duration-75 active:scale-[0.98]",
                  active ? "text-brand-cream-foreground" : "text-secondary-foreground",
                )}
              >
                {active ? (
                  // Shared layoutId: the pill is a single element that moves
                  // between buttons rather than three that fade in and out, so
                  // the segmented control slides the way UISegmentedControl
                  // does instead of teleporting between positions.
                  <motion.span
                    layoutId="today-scope-pill"
                    className="absolute inset-0 rounded-full bg-brand-cream shadow-sm ring-1 ring-primary/40"
                    transition={SPRING_SETTLE}
                  />
                ) : null}
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setCalendarOpen((current) => !current)}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full transition-transform duration-75 active:scale-[0.98]",
            calendarOpen || viewingCalendar
              ? "bg-brand-cream text-brand-cream-foreground ring-1 ring-primary/40"
              : "bg-secondary text-secondary-foreground",
          )}
          aria-label={t("today.pickDay")}
          aria-pressed={calendarOpen || viewingCalendar}
        >
          <CalendarDays className="size-4" />
        </button>
      </div>

      {calendarOpen ? (
        <DayCalendar
          month={calendarMonth}
          selected={viewDate}
          today={now}
          marks={calendarMarks}
          onSelect={selectCalendarDay}
          onMonthChange={setCalendarMonth}
        />
      ) : null}

      {hasCleanerDuties ? (
      <div className="app-h-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(["all", "me", "cleaner"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
            className={
              filter === item
                ? "h-11 shrink-0 rounded-full bg-brand-cream px-3.5 ui-caption font-medium text-brand-cream-foreground shadow-sm ring-1 ring-primary/40 transition-transform duration-75 active:scale-[0.98]"
                : "h-11 shrink-0 rounded-full bg-secondary px-3.5 ui-caption font-medium text-secondary-foreground transition-transform duration-75 active:scale-[0.98]"
            }
          >
            {item === "all"
              ? t("today.filterAll")
              : item === "me"
                ? t("today.filterMine")
                : t("today.filterCleaner")}
          </button>
        ))}
      </div>
      ) : null}

      {firstOfMonth ? (
        <section className="rounded-2xl bg-accent px-4 py-4">
          <p className="ui-caption font-medium text-primary">{t("today.firstOfMonth")}</p>
          <p className="ui-heading mt-1 ui-title font-semibold">{t("today.monthList")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthPlan.length === 0
              ? t("today.monthNone")
              : t("today.monthCount", { count: monthPlan.length })}
          </p>
        </section>
      ) : null}

      {listed.length === 0 && doneEntries.length === 0 && costPrompts.length === 0 ? (
        <EmptyToday
          onAdd={() => createGuard.tryOpen(() => setCreating(true))}
          calendar={viewingCalendar}
          t={t}
        />
      ) : (
        <>
          <div ref={listRef} className="flex flex-col gap-5">
            <LayoutGroup id="today-list">
              {weatherListed.length > 0 ? (
                <div>
                  <p className="mb-2 px-1 ui-caption font-medium text-muted-foreground">
                    {t("today.weatherAddedHeader")}
                  </p>
                  <div className="ui-group">
                    <AnimatePresence initial={false} mode="popLayout">
                      {weatherListed.map((duty) =>
                        animatedDuty(duty, { overdue: isOverdueFor(duty, household, now) }),
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ) : null}
              {regularListed.length > 0 || leftoverCostPrompts.length > 0 ? (
                <div className="ui-group">
                  <AnimatePresence initial={false} mode="popLayout">
                    {regularListed.map((duty) =>
                      animatedDuty(duty, { overdue: isOverdueFor(duty, household, now) }),
                    )}
                  </AnimatePresence>
                  {leftoverCostPrompts.map((prompt) => {
                    const duty = household.duties.find((item) => item.id === prompt.dutyId);
                    if (!duty) return null;
                    return (
                      <div key={prompt.id} className="ui-group-row">
                        {dutyRow(duty, { done: true })}
                        {onRecordCost ? (
                          <div className="px-4 pb-3">
                            <CostPrompt
                              suggested={suggestedCostFor(duty, household)}
                              onSave={(amount) => onRecordCost(prompt.id, { actualCost: amount })}
                              onSkip={() => onRecordCost(prompt.id, { skip: true })}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {doneEntries.length > 0 ? (
                <div>
                  <p className="mb-2 px-1 ui-caption font-medium text-muted-foreground">
                    {doneHeader}
                  </p>
                  <div
                    className="ui-group"
                    data-animating={completion.completingId ? "" : undefined}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {doneEntries.map((entry) => (
                        <motion.div
                          key={entry.duty.id}
                          layout
                          layoutId={entry.duty.id}
                          className="ui-group-row"
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.98 }}
                          transition={SPRING_SETTLE}
                        >
                          {dutyRow(entry.duty, { done: true, doneMeta: doneMetaFor(entry) })}
                          {(() => {
                            const prompt = costPrompts.find((item) => item.dutyId === entry.duty.id);
                            return prompt && onRecordCost ? (
                              <div className="px-4 pb-3">
                                <CostPrompt
                                  suggested={suggestedCostFor(entry.duty, household)}
                                  onSave={(amount) => onRecordCost(prompt.id, { actualCost: amount })}
                                  onSkip={() => onRecordCost(prompt.id, { skip: true })}
                                />
                              </div>
                            ) : null;
                          })()}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ) : null}
            </LayoutGroup>
          </div>
          <Button
            className="h-12 rounded-full"
            onClick={() => createGuard.tryOpen(() => setCreating(true))}
          >
            {t("today.addChore")}
          </Button>
        </>
      )}

      {scope === "daily" && !viewingCalendar ? (
        <SeasonSection household={household} now={now} onNavigate={onNavigate} />
      ) : null}

      {household.supplyAutomations.length === 0 ? (
        <section className="rounded-2xl bg-card px-4 py-4">
          <p className="ui-caption font-medium text-muted-foreground">{t("tabs.restock")}</p>
          <p className="ui-title mt-1 font-semibold">{t("today.trackSupplyTitle")}</p>
          <p className="mt-1 ui-body text-muted-foreground">{t("today.trackSupplyBody")}</p>
          <Button className="mt-4 h-11" onClick={() => createGuard.tryOpen(() => setCreatingRule(true))}>
            {t("today.trackSupplyCta")}
          </Button>
        </section>
      ) : showRestockChip && onOpenRestock ? (
        <button
          type="button"
          onClick={onOpenRestock}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 text-left transition-transform duration-75 active:scale-[0.98]"
        >
          <span className="flex items-center gap-2">
            <Package className="size-4 text-primary" aria-hidden />
            <span className="ui-body font-medium">
              {restock.order_now.length > 0
                ? t("today.toOrderCount", { count: restock.order_now.length })
                : t("today.onTheWayCount", { count: restock.ordered.length })}
            </span>
          </span>
          <span className="ui-caption font-medium text-primary">{t("tabs.restock")}</span>
        </button>
      ) : null}

      {showWeekWrapped ? (
        <WholeHouseCard rooms={kept}>
          <div className="mt-3 flex items-start gap-3">
            <BrandMark size="sm" className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="ui-body font-medium">{t("today.weekWrappedTitle")}</p>
              <p className="mt-0.5 ui-caption text-muted-foreground">
                {t("today.weekWrappedBody", {
                  done: week.done,
                  minutes: week.minutes,
                  rooms: weekRooms,
                })}
              </p>
              <p className="mt-1 ui-caption text-muted-foreground">{monthLedgerLine}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="ghost"
                  className="h-11 px-2"
                  onClick={() => onChangeTree?.(dismissWeekWrapped(household, now))}
                >
                  {t("common.gotIt")}
                </Button>
              </div>
            </div>
          </div>
        </WholeHouseCard>
      ) : showWholeHouseCard && momentumOn ? (
        <WholeHouseCard rooms={kept}>
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              className="h-11 px-2"
              onClick={() => setShowWholeHouseCard(false)}
            >
              {t("common.gotIt")}
            </Button>
          </div>
        </WholeHouseCard>
      ) : null}

      {showTeachingCard ? (
        <div className="rounded-2xl bg-card px-4 py-3">
          <div className="flex items-start gap-3">
            <BrandMark size="sm" className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="ui-body font-medium">{t("teaching.tip")}</p>
              <p className="mt-0.5 ui-caption text-muted-foreground">
                {!household.teaching.checkedChore
                  ? t("teaching.checkChore")
                  : !household.teaching.openedRestock
                    ? t("teaching.openRestock")
                    : !household.teaching.setDigestOrZip
                      ? t("teaching.digestOrZip")
                      : t("teaching.youreSet")}
              </p>
              <div className="mt-2 flex gap-2">
                {!household.teaching.openedRestock ? (
                  <Button className="h-11 px-3" onClick={() => onOpenRestock?.()}>
                    {t("tabs.restock")}
                  </Button>
                ) : !household.teaching.setDigestOrZip ? (
                  <Button className="h-11 px-3" onClick={() => onOpenDigest?.()}>
                    {t("today.reminders")}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  className="h-11 px-2"
                  onClick={() => {
                    setTeachingHidden(true);
                  }}
                >
                  {t("common.gotIt")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl bg-muted/70">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          aria-expanded={moreOptionsOpen}
          onClick={() => setMoreOptionsOpen((current) => !current)}
        >
          <span className="ui-body font-medium">{t("today.moreOptions")}</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              moreOptionsOpen && "rotate-180",
            )}
          />
        </button>
        {moreOptionsOpen ? (
          <div className="grid gap-2 px-4 pb-4">
            <Button variant="secondary" className="h-12 rounded-full" onClick={share}>
              <Share2 className="size-4" />
              {t("today.shareList")}
            </Button>
            <Button variant="secondary" className="h-12 rounded-full" onClick={shareDone}>
              <Share2 className="size-4" />
              {t("today.shareDone")}
            </Button>
            {hasCleaner ? (
              <Button variant="secondary" className="h-12 rounded-full" onClick={onStartCleanerVisit}>
                <UserRound className="size-4" />
                {t("today.handToCleaner")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {weatherLine && !needsZip ? (
        <AppleWeatherAttribution attribution={weatherAttribution} />
      ) : null}

      <DutyContextMenu
        open={Boolean(dutyMenu)}
        x={dutyMenu?.x ?? 0}
        y={dutyMenu?.y ?? 0}
        title={dutyMenu ? tDutyTitle(dutyMenu.duty.title) : ""}
        onAction={handleDutyMenu}
        onClose={() => setDutyMenu(null)}
      />

      {orderItem ? (
        <RestockOrderButton
          item={orderItem}
          household={household}
          className="hidden"
          autoPicker
          onFlowFinished={() => setOrderItemId(null)}
          onFlowCancelled={() => setOrderItemId(null)}
          {...restockButtonProps(orderItem, restockHandlers)}
        />
      ) : null}

      {onSavePostalCode ? (
        <ZipSheet
          open={zipOpen}
          initialZip={household.location.postalCode}
          onOpenChange={setZipOpen}
          onSave={onSavePostalCode}
        />
      ) : null}

      <HouseSheet
        open={houseOpen}
        onOpenChange={setHouseOpen}
        household={household}
        now={now}
        arc={arc}
        onSeeYear={() => {
          // Until the year screen (E2-03) lands, "See the year" opens the
          // month calendar under the scope tabs, once the sheet has closed.
          setHouseOpen(false);
          window.setTimeout(() => {
            setCalendarOpen(true);
            listRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
          }, 350);
        }}
      />

      <DutyDetailSheet
        open={Boolean(detail)}
        duty={detail}
        household={household}
        now={now}
        onOpenChange={(openSheet) => {
          if (!openSheet) setDetail(null);
        }}
        onComplete={(target) => {
          completion.complete(target);
          setDetail(null);
        }}
        onUndo={(target) => {
          completion.undo(target);
          setDetail(null);
        }}
        onSnooze={(target) => {
          snoozeDuty(target);
          setDetail(null);
        }}
        onEdit={(target) => {
          setDetail(null);
          window.setTimeout(() => setEditing(target), 350);
        }}
      />

      <DutyForm
        open={creating || Boolean(editing)}
        duty={editing}
        household={household}
        defaultRoom={household.rooms.find((room) => !room.system)?.id ?? "kitchen"}
        defaultsForToday={creating}
        supplyAutomation={
          editing
            ? household.supplyAutomations.find(
                (item) => item.dutyId === editing.id || item.linkedDutyIds.includes(editing.id),
              )
            : null
        }
        onOpenChange={(openSheet) => {
          if (!openSheet) {
            createGuard.markClosed();
            setCreating(false);
            setEditing(null);
          }
        }}
        onSave={onSaveDuty}
        onDelete={onDeleteDuty}
        {...restockHandlers}
      />

      <ConsumableForm
        open={creatingRule}
        duty={null}
        household={household}
        defaultRoom={household.rooms.find((room) => !room.system)?.id ?? "whole-home"}
        automation={null}
        onOpenChange={(openSheet) => {
          if (!openSheet) {
            createGuard.markClosed();
            setCreatingRule(false);
          }
        }}
        onSave={onSaveDuty}
        {...restockHandlers}
      />
      </div>
    </div>
  );
}

function EmptyToday({
  onAdd,
  calendar,
  t,
}: {
  onAdd: () => void;
  calendar?: boolean;
  t: (key: import("@/i18n").MessageKey, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-2xl bg-card px-5 py-10 text-center">
      {calendar ? (
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-cream">
          <BrandMark size="sm" />
        </span>
      ) : (
        <span className="mx-auto flex justify-center">
          <IllustratedMoment kind="shelf-scene" size={140} loop autoplay />
        </span>
      )}
      <p className="ui-heading mt-4 ui-title font-semibold">{t("today.clearDay")}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {calendar ? t("today.emptyCalendar") : t("today.emptyToday")}
      </p>
      <Button className="mt-5 h-11" onClick={onAdd}>
        {t("today.addChore")}
      </Button>
    </div>
  );
}
