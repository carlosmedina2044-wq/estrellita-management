"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { CalendarDays, ChevronDown, Package, Settings, Share2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-logo";
import { DayCalendar } from "@/components/day-calendar";
import { SeasonSection } from "@/components/season-section";
import { CostPrompt } from "@/components/cost-prompt";
import { ConsumableForm } from "@/components/consumable-form";
import { RestockOrderButton, restockButtonProps } from "@/components/restock-order-flow";
import { DutyForm } from "@/components/duty-form";
import { DutyRow } from "@/components/duty-row";
import { DutyContextMenu, type DutyMenuAction } from "@/components/duty-context-menu";
import { ZipSheet } from "@/components/zip-prompt";
import { Button } from "@/components/ui/button";
import { AttentionTiles } from "@/components/today/attention-tiles";
import { ClosingStats } from "@/components/today/closing-ceremony";
import { ParticleLayer, type ParticleLayerHandle } from "@/components/today/particle-layer";
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
import { hasSeenTip, markTipSeen } from "@/lib/teaching";
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
import { SPRING_SETTLE, scrollBehavior } from "@/lib/motion";
import { AppleWeatherAttribution } from "@/components/apple-weather-attribution";
import { useLocale } from "@/i18n/locale-provider";
import { useNow } from "@/hooks/use-now";

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
  const [filter, setFilter] = useState<Audience | "all">("all");
  const [scope, setScope] = useState<OutstandingScope>("daily");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDay, setCalendarDay] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [editing, setEditing] = useState<Duty | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingRule, setCreatingRule] = useState(false);
  const [zipOpen, setZipOpen] = useState(false);
  const [teachingHidden, setTeachingHidden] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [orderItemId, setOrderItemId] = useState<string | null>(null);
  const [dutyMenu, setDutyMenu] = useState<{ duty: Duty; x: number; y: number } | null>(null);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
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
      if (duty) setEditing(duty);
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
    setOnlyOverdue(false);
    setScope(next);
    setCalendarDay(null);
    setCalendarOpen(false);
  }

  function selectCalendarDay(date: Date) {
    setCalendarDay(date);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
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
      const until = toISODate(addDays(now, 7));
      onSaveDuty({ ...target, snoozedUntil: until });
      toast(t("chore.snoozedToast"));
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
        onOpen={() => setEditing(duty)}
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
  const greeting = todayGreeting(household.ownerName);
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
  const ceremonyStats = {
    done: doneTodayEntries.length,
    minutes: todayEffort(doneTodayEntries.map((entry) => entry.duty)),
    rooms: roomsTouchedInRange(household, new Date(startOfDay(now)), now),
  };
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

  // PortraitScene wires in P2; keep sheet/scroll/ambient scaffolding inactive until then.
  const sceneMode = false;
  const sceneWx = sceneWeather(forecast, todayIso);
  const sceneTimes =
    household.location.lat != null && household.location.lng != null
      ? sunTimes(household.location.lat, household.location.lng, now)
      : null;
  const scenePhase = skyPhase(now, sceneTimes);
  const sceneStops = skyGradient(scenePhase.phase, scenePhase.t, sceneWx.kind, sceneWx.cloudCover);
  const nightFollows =
    sceneMode &&
    household.momentum.nightFollowsSky !== false &&
    (scenePhase.phase === "dusk" || scenePhase.phase === "night");

  useEffect(() => {
    if (!sceneMode) return;
    const pane = rootRef.current?.closest(".app-keep-alive");
    if (!(pane instanceof HTMLElement)) return;
    let frame = 0;
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const y = pane.scrollTop;
        const scene = rootRef.current?.querySelector("[data-home-scene]");
        if (scene instanceof HTMLElement) scene.style.transform = `translateY(${-0.4 * y}px)`;
        const blur = rootRef.current?.querySelector("[data-scene-blur]");
        if (blur instanceof HTMLElement) {
          const amount = Math.min(y / 120, 1) * 12;
          blur.style.backdropFilter = `blur(${amount}px)`;
          blur.style.setProperty("-webkit-backdrop-filter", `blur(${amount}px)`);
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
        nightFollows && "today-night",
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
        <div className="relative">
          {/* PortraitScene replaces this branch in P2 */}
          <div
            data-scene-blur
            className="pointer-events-none absolute inset-0"
            style={{
              WebkitMaskImage: "linear-gradient(black, transparent)",
              maskImage: "linear-gradient(black, transparent)",
            }}
          />
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
        <div className="sticky top-0 z-30 flex h-[calc(env(safe-area-inset-top)+44px)] items-end justify-between bg-background/90 px-5 pb-2 backdrop-blur-md">
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
        <div className="flex min-h-14 items-start justify-between gap-3">
          {arc.state === "closed" ? (
            <ClosingStats stats={ceremonyStats} instant />
          ) : (
            <p className="ui-body font-medium num">
              {t("today.minutesLeft", { minutes: String(arc.minutesLeft) })}
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
      ) : null}

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
              {t("settings.zipHelp")}
            </span>
          </span>
          <span className="shrink-0 ui-caption font-semibold text-primary">{t("today.addZipCta")}</span>
        </button>
      ) : null}

      {weatherLoading && !needsZip ? (
        <div className="forecast-shimmer rounded-[var(--r-container)] bg-card px-4 py-4" aria-hidden>
          <div className="h-3 w-24 rounded-full bg-foreground/8" />
          <div className="mt-3 h-5 w-48 rounded-full bg-foreground/8" />
          <div className="mt-2 h-3 w-36 rounded-full bg-foreground/8" />
        </div>
      ) : null}

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

      <div className="flex items-center gap-2">
        <div role="tablist" aria-label={t("today.scopeList")} className="flex min-w-0 flex-1 rounded-full bg-secondary p-1">
          {scopes.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={scope === item.id && !viewingCalendar}
              onClick={() => selectScope(item.id)}
              className={cn(
                "h-11 flex-1 rounded-full ui-caption font-medium transition-transform duration-75 active:scale-[0.98]",
                scope === item.id && !viewingCalendar
                  ? "bg-brand-cream text-brand-cream-foreground shadow-sm ring-1 ring-primary/40"
                  : "text-secondary-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
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
