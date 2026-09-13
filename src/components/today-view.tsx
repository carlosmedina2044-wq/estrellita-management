"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { WeekRing } from "@/components/week-ring";
import { ZipSheet } from "@/components/zip-prompt";
import { Button } from "@/components/ui/button";
import { shouldPromptCost, suggestedCostFor } from "@/lib/costs";
import { addDays, formatLongDate, formatTime, formatWeekdayDate, isFirstOfMonth, sameDay, startOfMonth, startOfWeek, toISODate, weekRange } from "@/lib/dates";
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
import { closedDayRun, dismissWeekWrapped, roomsTouchedInRange, shouldShowWeekWrapped, todayEffort, weekProgress } from "@/lib/momentum";
import { tDutyTitle } from "@/i18n/content";
import { todayGreeting } from "@/lib/greeting";
import { homeSummary } from "@/lib/node-status";
import { shareText as nativeShare } from "@/lib/native/share";
import type { WeatherAttribution } from "@/lib/native/weatherkit";
import { useSheetOpenGuard } from "@/lib/sheet-guard";
import { groupRestock, orderNowCostCaption, partStatusForDuty, type RestockFlowHandlers } from "@/lib/restock";
import type { AppNavigateTarget, Audience, Duty, DutyDraft, Household } from "@/lib/types";
import { cn } from "@/lib/utils";
import { prefersReducedMotion, scrollBehavior } from "@/lib/motion";
import { AppleWeatherAttribution } from "@/components/apple-weather-attribution";
import { useLocale } from "@/i18n/locale-provider";
import { useNow } from "@/hooks/use-now";

export function TodayView({
  household,
  weatherAttribution,
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
  const [exitingId, setExitingId] = useState<string | null>(null);
  const exitingIdRef = useRef<string | null>(null);
  const [closedPulse, setClosedPulse] = useState(false);
  const [dutyMenu, setDutyMenu] = useState<{ duty: Duty; x: number; y: number } | null>(null);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
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
  const run = useMemo(() => closedDayRun(household, now), [household, now]);
  const week = useMemo(() => weekProgress(household, now), [household, now]);
  const weekRooms = useMemo(() => {
    const range = weekRange(now);
    return roomsTouchedInRange(household, range.start, now);
  }, [household, now]);
  const showWeekWrapped = shouldShowWeekWrapped(household, now);
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

  function toggle(duty: Duty, completed: boolean) {
    if (completed) {
      if (exitingIdRef.current === duty.id) {
        exitingIdRef.current = null;
        setExitingId(null);
        return;
      }
      onUndo(duty.id);
      void import("@/lib/native/haptics").then((m) => m.hapticUndo()).catch(() => {});
      toast(t("today.undoToast"));
      return;
    }
    if (exitingIdRef.current) return;
    if (prefersReducedMotion()) {
      onComplete(duty.id);
      void import("@/lib/native/haptics").then((m) => m.hapticComplete()).catch(() => {});
      const remaining = open.filter((item) => item.id !== duty.id);
      if (remaining.length === 0 && !viewingCalendar && scope === "daily") {
        void import("@/lib/native/haptics").then((m) => m.hapticSuccess()).catch(() => {});
      }
      toast.success(tDutyTitle(duty.title), {
        action: {
          label: t("today.undoToast"),
          onClick: () => {
            onUndo(duty.id);
            void import("@/lib/native/haptics").then((m) => m.hapticUndo()).catch(() => {});
          },
        },
      });
      return;
    }
    exitingIdRef.current = duty.id;
    setExitingId(duty.id);
    void import("@/lib/native/haptics").then((m) => m.hapticComplete()).catch(() => {});
    toast.success(tDutyTitle(duty.title), {
      action: {
        label: t("today.undoToast"),
        onClick: () => {
          const wasExiting = exitingIdRef.current === duty.id;
          exitingIdRef.current = null;
          setExitingId(null);
          if (!wasExiting) onUndo(duty.id);
          void import("@/lib/native/haptics").then((m) => m.hapticUndo()).catch(() => {});
        },
      },
    });
  }

  function finishExit(dutyId: string) {
    if (exitingIdRef.current !== dutyId) return;
    exitingIdRef.current = null;
    setExitingId(null);
    const remaining = open.filter((duty) => duty.id !== dutyId);
    if (remaining.length === 0 && !viewingCalendar && scope === "daily") {
      void import("@/lib/native/haptics").then((m) => m.hapticSuccess()).catch(() => {});
      if (!prefersReducedMotion()) {
        setClosedPulse(true);
        window.setTimeout(() => setClosedPulse(false), 400);
      }
    }
    onComplete(dutyId);
  }

  function handleDutyMenu(action: DutyMenuAction) {
    const target = dutyMenu?.duty;
    if (!target) return;
    if (action === "complete") {
      toggle(target, false);
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
        exiting={exitingId === duty.id}
        onExitComplete={() => finishExit(duty.id)}
        onLongPress={
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
        onToggle={() => toggle(duty, Boolean(extra.done) || exitingId === duty.id)}
        onOpen={() => setEditing(duty)}
      />
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
  const needCount = open.length;
  let nextUpDay: string | null = null;
  if (needCount === 0) {
    nextUpDay = formatWeekdayDate(addDays(now, 1));
    for (let offset = 1; offset <= 14; offset += 1) {
      const day = addDays(now, offset);
      const due = dutiesDueOnDate(household, day, filter).filter(
        (duty) => !isDoneThisPeriod(duty, household.completions, day, installedAtFor(household, duty.id)),
      );
      if (due.length > 0) {
        nextUpDay = formatWeekdayDate(day);
        break;
      }
    }
  }
  const dayClosed = !viewingCalendar && scope === "daily" && needCount === 0 && doneTodayEntries.length > 0;
  const displayHeadline = dayClosed
    ? t("today.headlineClosed", { count: doneTodayEntries.length })
    : needCount === 0 && doneEntries.length > 0
      ? t("today.headlineDone", { count: doneEntries.length })
      : needCount === 0
        ? t("today.headlineClear", { day: nextUpDay ?? "" })
        : needCount === 1
          ? t("today.headlineOne")
          : t("today.headlineMany", { count: needCount });
  const effortMinutes = !viewingCalendar && scope === "daily" && open.length > 0 ? todayEffort(open) : 0;
  const secondaryLine = [
    headingDate,
    !needsZip ? weatherLine : null,
    effortMinutes > 0 ? t("today.effort", { minutes: effortMinutes }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const showRunPill = run.current >= 2 && household.momentum.enabled;
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

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold leading-snug text-foreground">{greeting}</p>
          <h1
            className={cn(
              "mt-1 origin-left text-[34px] font-bold leading-[1.15] tracking-tight text-foreground transition-transform duration-[400ms] ease-out",
              closedPulse ? "scale-[1.03]" : "scale-100",
            )}
          >
            {displayHeadline}
          </h1>
          {showRunPill ? (
            <p className="mt-2 inline-flex rounded-full bg-success/10 px-2.5 py-1 ui-caption text-success">
              {t("today.runPill", { count: run.current })}
            </p>
          ) : null}
          <p className="mt-1.5 ui-caption num text-muted-foreground">{secondaryLine}</p>
        </div>
        {onOpenSettings ? (
          <button
            type="button"
            aria-label={t("common.settings")}
            onClick={onOpenSettings}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
          >
            <Settings className="size-5" />
          </button>
        ) : null}
      </header>

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
        weekRing={{
          done: week.done,
          planned: week.planned,
          label: t("today.weekRing", { done: week.done, planned: week.planned }),
          onClick: () => selectScope("weekly"),
        }}
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
            {weatherListed.length > 0 ? (
              <div>
                <p className="mb-2 px-1 ui-caption font-medium text-muted-foreground">
                  {t("today.weatherAddedHeader")}
                </p>
                <div className="ui-group">
                  {weatherListed.map((duty) => (
                    <div key={duty.id} className="ui-group-row">
                      {dutyRow(duty, { overdue: isOverdueFor(duty, household, now) })}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {regularListed.length > 0 || leftoverCostPrompts.length > 0 ? (
              <div className="ui-group">
                {regularListed.map((duty) => (
                  <div key={duty.id} className="ui-group-row">
                    {dutyRow(duty, { overdue: isOverdueFor(duty, household, now) })}
                  </div>
                ))}
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
                <div className="ui-group">
                  {doneEntries.map((entry) => {
                    const prompt = costPrompts.find((item) => item.dutyId === entry.duty.id);
                    return (
                      <div key={entry.duty.id} className="ui-group-row">
                        {dutyRow(entry.duty, { done: true, doneMeta: doneMetaFor(entry) })}
                        {prompt && onRecordCost ? (
                          <div className="px-4 pb-3">
                            <CostPrompt
                              suggested={suggestedCostFor(entry.duty, household)}
                              onSave={(amount) => onRecordCost(prompt.id, { actualCost: amount })}
                              onSkip={() => onRecordCost(prompt.id, { skip: true })}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
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
        <div className="rounded-2xl bg-card px-4 py-3">
          <div className="flex items-start gap-3">
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
        </div>
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
  );
}

function AttentionTiles({
  overdue,
  dueToday,
  orderNow,
  orderNowCost,
  arriving,
  weekRing,
  labels,
  onOverdue,
  onDueToday,
  onOrder,
  onArriving,
  onAllClear,
}: {
  overdue: number;
  dueToday: number;
  orderNow: number;
  orderNowCost: string | null;
  arriving: number;
  weekRing?: { done: number; planned: number; label: string; onClick: () => void };
  labels: {
    overdue: string;
    dueToday: string;
    orderNow: string;
    onTheWay: string;
    allClear: string;
    allClearHint: string;
    allClearAria: string;
  };
  onOverdue: () => void;
  onDueToday: () => void;
  onOrder: () => void;
  onArriving: () => void;
  onAllClear: () => void;
}) {
  const tiles = [
    overdue > 0
      ? {
          key: "overdue",
          count: overdue,
          label: labels.overdue,
          onClick: onOverdue,
          countClass: "text-destructive",
          className: "ring-destructive/40",
        }
      : null,
    dueToday > 0
      ? {
          key: "due",
          count: dueToday,
          label: labels.dueToday,
          onClick: onDueToday,
          countClass: "text-foreground",
        }
      : null,
    orderNow > 0
      ? {
          key: "order",
          count: orderNow,
          label: labels.orderNow,
          costLine: orderNowCost,
          onClick: onOrder,
          countClass: "text-warning",
          icon: true,
        }
      : null,
    arriving > 0
      ? {
          key: "arriving",
          count: arriving,
          label: labels.onTheWay,
          onClick: onArriving,
          countClass: "text-muted-foreground",
        }
      : null,
  ].filter((tile): tile is NonNullable<typeof tile> => Boolean(tile));

  const ring = weekRing ? (
    <button
      type="button"
      onClick={weekRing.onClick}
      aria-label={weekRing.label}
      className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 ring-1 ring-border transition-transform duration-75 active:scale-[0.98]"
    >
      <WeekRing done={weekRing.done} planned={weekRing.planned} />
      <span className="ui-caption text-muted-foreground">{weekRing.label}</span>
    </button>
  ) : null;

  if (tiles.length === 0 && !ring) {
    return (
      <button
        type="button"
        onClick={onAllClear}
        className="flex min-h-11 w-full items-center rounded-full bg-success/10 px-4 text-left transition-transform duration-75 active:scale-[0.98]"
        aria-label={labels.allClearAria}
      >
        <span className="ui-body font-medium text-success">{labels.allClear}</span>
        <span className="ml-2 ui-caption text-muted-foreground">{labels.allClearHint}</span>
      </button>
    );
  }

  if (tiles.length === 0) {
    return (
      <div className="app-h-scroll -mx-1 flex gap-2 overflow-x-auto px-1">
        <button
          type="button"
          onClick={onAllClear}
          className="flex min-h-11 min-w-0 flex-1 items-center rounded-full bg-success/10 px-4 text-left transition-transform duration-75 active:scale-[0.98]"
          aria-label={labels.allClearAria}
        >
          <span className="ui-body font-medium text-success">{labels.allClear}</span>
          <span className="ml-2 ui-caption text-muted-foreground">{labels.allClearHint}</span>
        </button>
        {ring}
      </div>
    );
  }

  return (
    <div className="app-h-scroll -mx-1 flex gap-2 overflow-x-auto px-1">
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          onClick={tile.onClick}
          aria-label={`${tile.count} ${tile.label}`}
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 ring-1 ring-border transition-transform duration-75 active:scale-[0.98]",
            "className" in tile ? tile.className : null,
          )}
        >
          {"icon" in tile && tile.icon ? <Package className="size-4 shrink-0" aria-hidden /> : null}
          <span className={cn("ui-body font-semibold num", tile.countClass)}>{tile.count}</span>
          <span className="ui-caption text-muted-foreground">
            {"costLine" in tile && tile.costLine ? `${tile.label} · ${tile.costLine}` : tile.label}
          </span>
        </button>
      ))}
      {ring}
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
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-cream">
        <BrandMark size="sm" />
      </span>
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
