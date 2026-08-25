"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Map, Share2, UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { PageHeader } from "@/components/page-header";
import { DayCalendar } from "@/components/day-calendar";
import { CostPrompt } from "@/components/cost-prompt";
import { ConsumableForm } from "@/components/consumable-form";
import { ItemName } from "@/components/item-name";
import { OrderByLine, RestockOrderButton, restockButtonProps } from "@/components/restock-order-flow";
import { DutyForm } from "@/components/duty-form";
import { DutyRow } from "@/components/duty-row";
import { HouseMapSheet } from "@/components/house-map-sheet";
import { ZipSheet } from "@/components/zip-prompt";
import { Button } from "@/components/ui/button";
import { shouldPromptCost, suggestedCostFor } from "@/lib/costs";
import { formatLongDate, isFirstOfMonth, sameDay } from "@/lib/dates";
import {
  dutiesDueOnDate,
  isDoneThisPeriod,
  isOverdueFor,
  installedAtFor,
  monthPlanDuties,
  openDutiesInScope,
  shareText,
  todaysOpenDuties,
  type OutstandingScope,
} from "@/lib/duties";
import { todayGreeting } from "@/lib/greeting";
import { homeSummary } from "@/lib/node-status";
import { shareText as nativeShare } from "@/lib/native/share";
import { useSheetOpenGuard } from "@/lib/sheet-guard";
import { groupRestock, orderNowCostCaption, partStatusForDuty, type RestockFlowHandlers } from "@/lib/restock";
import type { AppNavigateTarget, Audience, Duty, DutyDraft, Household } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SCOPES: { id: OutstandingScope; label: string }[] = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "This week" },
  { id: "monthly", label: "This month" },
];

export function TodayView({
  household,
  weatherLine,
  needsZip,
  onSavePostalCode,
  onComplete,
  onRecordCost,
  onUndo,
  onSaveDuty,
  onDeleteDuty,
  onStartCleanerVisit,
  onOpenHome,
  onReorderRooms,
  onChangeTree,
  onOpenRestock,
  onNavigate,
  focus,
  onFocusHandled,
  ...restockHandlers
}: {
  household: Household;
  weatherLine?: string;
  needsZip?: boolean;
  onSavePostalCode?: (zip: string) => Promise<{ ok: boolean; error?: string }>;
  onComplete: (dutyId: string) => void;
  onRecordCost?: (completionId: string, input: { actualCost: number } | { skip: true }) => void;
  onUndo: (dutyId: string) => void;
  onSaveDuty: (duty: DutyDraft) => void;
  onDeleteDuty: (id: string) => void;
  onStartCleanerVisit: () => void;
  onOpenHome?: () => void;
  onReorderRooms?: (rooms: Household["rooms"]) => void;
  onChangeTree?: (next: Household) => void;
  onOpenRestock?: () => void;
  onNavigate?: (target: AppNavigateTarget) => void;
  focus?: AppNavigateTarget | null;
  onFocusHandled?: () => void;
} & RestockFlowHandlers) {
  const now = new Date();
  const [filter, setFilter] = useState<Audience | "all">("all");
  const [scope, setScope] = useState<OutstandingScope>("daily");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDay, setCalendarDay] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [houseOpen, setHouseOpen] = useState(false);
  const [editing, setEditing] = useState<Duty | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingRule, setCreatingRule] = useState(false);
  const [weekExpanded, setWeekExpanded] = useState(false);
  const [zipOpen, setZipOpen] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [orderItemId, setOrderItemId] = useState<string | null>(null);
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
  const restockGroups = groupRestock(household.supplyAutomations, household, now);

  useEffect(() => {
    if (!focus?.dutyId) return;
    onFocusHandled?.();
  }, [focus, onFocusHandled]);

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

  const doneOnDay = viewingCalendar
    ? dutiesDueOnDate(household, viewDate, filter).filter((duty) =>
        isDoneThisPeriod(duty, household.completions, viewDate, installedAtFor(household, duty.id)),
      )
    : [];

  const monthPlan = firstOfMonth ? monthPlanDuties(household, now, filter) : [];
  const cleanerOpen = todaysOpenDuties(household, now, "cleaner");
  const summary = homeSummary(household, now);
  const listed = onlyOverdue ? open.filter((duty) => isOverdueFor(duty, household, now)) : open;

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
      onUndo(duty.id);
      toast("Put back on today's list");
      return;
    }
    onComplete(duty.id);
    toast.success("Done", { description: duty.title });
  }

  async function share() {
    const text = shareText(household, cleanerOpen.length ? cleanerOpen : open);
    const result = await nativeShare(`${household.householdName} today`, text);
    if (result === "copied") toast.success("Copied today's list");
    if (result === "failed") toast.error("Couldn't share the list");
  }

  function dutyRow(
    duty: Duty,
    extra: { done?: boolean; overdue?: boolean } = {},
  ) {
    const chip = extra.done ? null : partStatusForDuty(duty, household, now);
    return (
      <DutyRow
        duty={duty}
        household={household}
        now={viewDate}
        done={extra.done}
        overdue={extra.overdue}
        partChip={chip}
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
        onToggle={() => toggle(duty, Boolean(extra.done))}
        onOpen={() => setEditing(duty)}
      />
    );
  }

  const weekOpen = openDutiesInScope(household, "weekly", now, filter);
  const restock = groupRestock(household.supplyAutomations, household, now);
  const restockItems = [...restock.ordered, ...restock.order_now].slice(0, 3);
  const restockHeader = restock.order_now.length > 0 ? "Order now" : "On the way";
  const showRestock = restock.order_now.length + restock.ordered.length > 0;
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
  const listSummary = viewingCalendar
    ? calendarIsToday
      ? open.length === 0
        ? "Nothing left on today's run."
        : `${open.length} to complete today`
      : open.length === 0
        ? "Nothing due on this day."
        : `${open.length} due this day`
    : scope === "daily"
      ? open.length === 0
        ? "Nothing left on today's run."
        : `${open.length} to complete today`
      : scope === "weekly"
        ? open.length === 0
          ? "This week is clear."
          : `${open.length} to complete this week`
        : open.length === 0
          ? "This month is clear."
          : `${open.length} to complete this month`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={greeting}
        title={headingDate}
        subtitle={
          needsZip && onSavePostalCode ? (
            <button
              type="button"
              className="text-left text-[13px] font-medium text-primary"
              onClick={() => setZipOpen(true)}
            >
              {weatherLine ?? "Add your ZIP for weather"}
            </button>
          ) : (
            (weatherLine ?? listSummary)
          )
        }
      />

      <AttentionTiles
        overdue={summary.overdue}
        dueToday={summary.dueToday}
        orderNow={summary.orderNow}
        orderNowCost={orderNowCostCaption(restockGroups.order_now)}
        arriving={summary.arriving}
        onOverdue={() => {
          setOnlyOverdue(true);
          setScope("daily");
          setCalendarDay(null);
          setCalendarOpen(false);
          listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onDueToday={() => {
          setOnlyOverdue(false);
          setScope("daily");
          setCalendarDay(null);
          setCalendarOpen(false);
          listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onOrder={() => onNavigate?.({ tab: "restock", section: "order_now" })}
        onArriving={() => onNavigate?.({ tab: "restock", section: "ordered" })}
        onAllClear={() => setHouseOpen(true)}
      />

      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 rounded-full bg-secondary p-1">
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectScope(item.id)}
              className={cn(
                "h-8 flex-1 rounded-full text-[13px] font-medium",
                scope === item.id && !viewingCalendar
                  ? "bg-white text-foreground shadow-sm"
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
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            calendarOpen || viewingCalendar ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
          )}
          aria-label="Pick a day"
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
          onSelect={selectCalendarDay}
          onMonthChange={setCalendarMonth}
        />
      ) : null}

      {hasCleanerDuties ? (
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(["all", "me", "cleaner"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={
              filter === item
                ? "h-8 shrink-0 rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-foreground"
                : "h-8 shrink-0 rounded-full bg-secondary px-3.5 text-[13px] font-medium text-secondary-foreground"
            }
          >
            {item === "all" ? "All" : item === "me" ? "Mine" : "Cleaner's"}
          </button>
        ))}
      </div>
      ) : null}

      {firstOfMonth ? (
        <section className="rounded-2xl bg-accent px-4 py-4">
          <p className="text-[13px] font-medium text-primary">First of the month</p>
          <p className="ui-heading mt-1 text-[20px] font-semibold">This month’s list</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthPlan.length === 0
              ? "Nothing scheduled for this month yet."
              : `${monthPlan.length} to complete this month.`}
          </p>
        </section>
      ) : null}

      {household.supplyAutomations.length === 0 ? (
        <section className="rounded-2xl bg-white px-4 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Restock</p>
          <p className="ui-heading mt-1 text-[20px] font-semibold">Track a filter or battery</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We’ll remind you when to order so it arrives before you run out. Checkout happens on the retailer’s site.
          </p>
          <Button className="mt-4 h-11" onClick={() => createGuard.tryOpen(() => setCreatingRule(true))}>
            Track a filter or battery
          </Button>
        </section>
      ) : showRestock ? (
        <section className="rounded-2xl bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{restockHeader}</p>
            {onOpenRestock ? (
              <button type="button" className="text-[13px] font-medium text-primary" onClick={onOpenRestock}>
                See all
              </button>
            ) : null}
          </div>
          <ul className="mt-3 grid gap-3">
            {restockItems.map((item) => (
              <li key={item.id} className="grid gap-2">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => {
                    const duty = household.duties.find(
                      (entry) => entry.id === item.dutyId || item.linkedDutyIds.includes(entry.id),
                    );
                    if (duty) setEditing(duty);
                  }}
                >
                  <span className="block text-[15px] font-medium">
                    <ItemName name={item.itemName} sizeSpec={item.sizeSpec} />
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    <OrderByLine item={item} household={household} />
                  </span>
                </button>
                <RestockOrderButton
                  item={item}
                  household={household}
                  compact
                  {...restockButtonProps(item, restockHandlers)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {listed.length === 0 && doneOnDay.length === 0 && costPrompts.length === 0 ? (
        <EmptyToday onAdd={() => createGuard.tryOpen(() => setCreating(true))} calendar={viewingCalendar} />
      ) : (
        <div ref={listRef} className="ui-group">
          {listed.map((duty) => (
            <div key={duty.id} className="ui-group-row">
              {dutyRow(duty, { overdue: isOverdueFor(duty, household, now) })}
            </div>
          ))}
          {doneOnDay.map((duty) => {
            const prompt = costPrompts.find((item) => item.dutyId === duty.id);
            return (
            <div key={duty.id} className="ui-group-row">
              {dutyRow(duty, { done: true })}
              {prompt && onRecordCost ? (
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
          {costPrompts
            .filter((item) => !doneOnDay.some((duty) => duty.id === item.dutyId) && !open.some((duty) => duty.id === item.dutyId))
            .map((prompt) => {
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
      )}

      <button
        type="button"
        onClick={() => setWeekExpanded((current) => !current)}
        className="rounded-2xl bg-white px-4 py-3 text-left"
      >
        <p className="font-medium">This week</p>
        <p className="text-sm text-muted-foreground">{weekOpen.length} remaining · {weekExpanded ? "Hide" : "Show"}</p>
      </button>
      {weekExpanded ? (
        <div className="ui-group">
          {weekOpen.map((duty) => (
            <div key={duty.id} className="ui-group-row">
              {dutyRow(duty)}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" className="h-12 rounded-full" onClick={() => (onOpenHome ? onOpenHome() : setHouseOpen(true))}>
          <Map className="size-4" />
          House
        </Button>
        <Button variant="secondary" className="h-12 rounded-full" onClick={share}>
          <Share2 className="size-4" />
          Share list
        </Button>
      </div>
      {hasCleaner ? (
        <Button variant="secondary" className="h-12 rounded-full" onClick={onStartCleanerVisit}>
          <UserRound className="size-4" />
          Hand to cleaner
        </Button>
      ) : null}

      {orderItem ? (
        <RestockOrderButton
          item={orderItem}
          household={household}
          className="hidden"
          autoPicker
          onPickerOpenChange={(open) => {
            if (!open) setOrderItemId(null);
          }}
          {...restockButtonProps(orderItem, restockHandlers)}
        />
      ) : null}

      <HouseMapSheet
        open={houseOpen}
        household={household}
        now={now}
        filter={filter}
        onOpenChange={setHouseOpen}
        onToggle={toggle}
        onSaveDuty={onSaveDuty}
        onDeleteDuty={onDeleteDuty}
        onReorderRooms={onReorderRooms}
        onChangeTree={onChangeTree}
        {...restockHandlers}
      />

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
          label: "overdue",
          onClick: onOverdue,
          countClass: "text-destructive",
          className: "border-destructive/30 bg-destructive/8",
        }
      : null,
    dueToday > 0
      ? {
          key: "due",
          count: dueToday,
          label: "due today",
          onClick: onDueToday,
          countClass: "text-foreground",
        }
      : null,
    orderNow > 0
      ? {
          key: "order",
          count: orderNow,
          label: "to order",
          costLine: orderNowCost,
          onClick: onOrder,
          countClass: "text-warning",
        }
      : null,
    arriving > 0
      ? {
          key: "arriving",
          count: arriving,
          label: "on the way",
          onClick: onArriving,
          countClass: "text-muted-foreground",
        }
      : null,
  ].filter((tile): tile is NonNullable<typeof tile> => Boolean(tile));

  if (tiles.length === 0) {
    return (
      <button
        type="button"
        onClick={onAllClear}
        className="rounded-2xl border border-success/30 bg-success/8 px-4 py-4 text-left"
        aria-label="All clear. Nothing due, nothing to order"
      >
        <p className="ui-heading text-[28px] font-semibold leading-none">All clear</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Nothing due, nothing to order.</p>
      </button>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          onClick={tile.onClick}
          aria-label={`${tile.count} ${tile.label}`}
          className={cn(
            "rounded-2xl border border-border bg-card px-4 py-3 text-left",
            "className" in tile ? tile.className : null,
          )}
        >
          <p className={cn("ui-heading text-[28px] font-semibold leading-none", tile.countClass)}>{tile.count}</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {"costLine" in tile && tile.costLine ? tile.costLine : tile.label}
          </p>
        </button>
      ))}
    </div>
  );
}

function EmptyToday({ onAdd, calendar }: { onAdd: () => void; calendar?: boolean }) {
  return (
    <div className="rounded-2xl bg-card px-5 py-10 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-cream">
        <BrandMark size="sm" />
      </span>
      <p className="ui-heading mt-4 text-[20px] font-semibold">Clear day</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {calendar
          ? "Nothing is due on this day. Pick another date or add a duty."
          : "Add the jobs you need to complete, or check the house map."}
      </p>
      <Button className="mt-5 h-11" onClick={onAdd}>
        Add a duty
      </Button>
    </div>
  );
}
