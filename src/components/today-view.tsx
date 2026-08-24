"use client";

import { useState } from "react";
import { CalendarDays, Map, Share2, UserRound } from "lucide-react";
import { BrandMark, BrandLockup } from "@/components/brand-logo";
import { DayCalendar } from "@/components/day-calendar";
import { CostPrompt } from "@/components/cost-prompt";
import { ConsumableForm } from "@/components/consumable-form";
import { ItemName } from "@/components/item-name";
import { OrderByLine, RestockOrderButton } from "@/components/restock-order-flow";
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
import { homeSummary, statusTone } from "@/lib/node-status";
import { shareText as nativeShare } from "@/lib/native/share";
import { useSheetOpenGuard } from "@/lib/sheet-guard";
import { groupRestock, type MarkOrderedDetails } from "@/lib/restock";
import type { Audience, Duty, DutyDraft, Household } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SCOPES: { id: OutstandingScope; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
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
  onMarkOrdered,
  onMarkReceived,
  onSaveLink,
  onPreferRetailer,
  onOpenRestock,
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
  onMarkOrdered?: (id: string, details?: MarkOrderedDetails) => void;
  onMarkReceived?: (id: string, qty: number, paid?: number) => void;
  onSaveLink?: (id: string, url: string) => void;
  onPreferRetailer?: (id: string, retailer: string) => void;
  onOpenRestock?: () => void;
}) {
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
  const createGuard = useSheetOpenGuard();

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
  const summaryTone = statusTone(summary);

  function selectScope(next: OutstandingScope) {
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

  const weekOpen = openDutiesInScope(household, "weekly", now, filter);
  const restock = groupRestock(household.supplyAutomations, household, now);
  const restockItems = [...restock.ordered, ...restock.order_now];
  const costPrompts = onRecordCost
    ? household.completions.filter((item) => {
        const match = household.duties.find((duty) => duty.id === item.dutyId);
        return match ? shouldPromptCost(item, match, now) : false;
      })
    : [];
  const greeting = household.ownerName ? `Hi, ${household.ownerName}` : "Today";
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
      <header className="pt-2">
        <BrandLockup size="sm" />
        <p className="mt-5 text-sm text-muted-foreground">{greeting} · {headingDate}</p>
        <h1 className="ui-heading text-[34px] font-semibold tracking-tight">{household.householdName}</h1>
        {needsZip && onSavePostalCode ? (
          <button
            type="button"
            className="mt-1 text-left text-sm font-medium text-primary"
            onClick={() => setZipOpen(true)}
          >
            {weatherLine ?? "Add your ZIP for weather"}
          </button>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{weatherLine ?? listSummary}</p>
        )}
        <p className="mt-2 inline-flex rounded-full bg-secondary px-3 py-1 text-[13px] font-medium">
          {summary.overdue ? `${summary.overdue} overdue` : ""}
          {summary.overdue && summary.dueSoon ? " · " : ""}
          {summary.dueSoon || summary.total ? `${todaysOpenDuties(household, now).length} due today` : "All clear"}
        </p>
      </header>

      <button
        type="button"
        onClick={() => setHouseOpen(true)}
        className={
          summaryTone === "red"
            ? "rounded-2xl border border-destructive/40 bg-destructive/8 px-4 py-3 text-left"
            : summaryTone === "amber"
              ? "rounded-2xl border border-[#ff9f0a]/40 bg-[#ff9f0a]/10 px-4 py-3 text-left"
              : "rounded-2xl border border-[#34c759]/40 bg-[#34c759]/8 px-4 py-3 text-left"
        }
      >
        <p className="text-[13px] font-medium text-muted-foreground">House map</p>
        <p className="ui-heading text-[20px] font-semibold">
          {summary.total === 0 ? "All rooms clear" : `${summary.total} outstanding across rooms`}
        </p>
      </button>

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
            {item === "all" ? "All" : item === "me" ? "For me" : "For cleaner"}
          </button>
        ))}
      </div>

      {firstOfMonth ? (
        <section className="rounded-2xl bg-accent px-4 py-4">
          <p className="text-[13px] font-medium text-primary">First of the month</p>
          <p className="ui-heading mt-1 text-[22px] font-semibold">This month’s list</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {monthPlan.length === 0
              ? "Nothing scheduled for this month yet."
              : `${monthPlan.length} to complete this month.`}
          </p>
        </section>
      ) : null}

      {open.length === 0 && doneOnDay.length === 0 && costPrompts.length === 0 ? (
        <EmptyToday onAdd={() => createGuard.tryOpen(() => setCreating(true))} calendar={viewingCalendar} />
      ) : (
        <div className="ui-group">
          {open.map((duty) => (
            <div key={duty.id} className="ui-group-row">
              <DutyRow
                duty={duty}
                household={household}
                now={viewDate}
                overdue={isOverdueFor(duty, household, now)}
                onToggle={() => toggle(duty, false)}
                onOpen={() => setEditing(duty)}
              />
            </div>
          ))}
          {doneOnDay.map((duty) => {
            const prompt = costPrompts.find((item) => item.dutyId === duty.id);
            return (
            <div key={duty.id} className="ui-group-row">
              <DutyRow
                duty={duty}
                household={household}
                now={viewDate}
                done
                onToggle={() => toggle(duty, true)}
                onOpen={() => setEditing(duty)}
              />
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
                  <DutyRow
                    duty={duty}
                    household={household}
                    now={viewDate}
                    done
                    onToggle={() => toggle(duty, true)}
                    onOpen={() => setEditing(duty)}
                  />
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
              <DutyRow duty={duty} household={household} now={now} onToggle={() => toggle(duty, false)} onOpen={() => setEditing(duty)} />
            </div>
          ))}
        </div>
      ) : null}

      {household.supplyAutomations.length === 0 ? (
        <section className="rounded-2xl bg-white px-4 py-4">
          <p className="text-[13px] font-medium text-muted-foreground">Restock</p>
          <p className="ui-heading mt-1 text-[22px] font-semibold">Track a filter or battery</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We’ll remind you when to order so it arrives before you run out. Checkout happens on the retailer’s site.
          </p>
          <Button className="mt-4 h-11" onClick={() => createGuard.tryOpen(() => setCreatingRule(true))}>
            Track a filter or battery
          </Button>
        </section>
      ) : (
        <section className="rounded-2xl bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
          <p className="font-medium">Order today</p>
            <div className="flex items-center gap-3">
              {onOpenRestock ? (
                <button type="button" className="text-[13px] font-medium text-primary" onClick={onOpenRestock}>
                  See all
                </button>
              ) : null}
              <button
                type="button"
                className="text-[13px] font-medium text-primary"
                onClick={() => createGuard.tryOpen(() => setCreatingRule(true))}
              >
                Add item
              </button>
            </div>
          </div>
          {restockItems.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Nothing to order. We’ll remind you before you run out.</p>
          ) : (
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
                    onOrdered={onMarkOrdered ? (details) => onMarkOrdered(item.id, details) : undefined}
                    onReceived={onMarkReceived ? (qty, paid) => onMarkReceived(item.id, qty, paid) : undefined}
                    onSaveLink={onSaveLink ? (url) => onSaveLink(item.id, url) : undefined}
                    onPreferRetailer={onPreferRetailer ? (retailer) => onPreferRetailer(item.id, retailer) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
      <Button variant="secondary" className="h-12 rounded-full" onClick={onStartCleanerVisit}>
        <UserRound className="size-4" />
        Hand to cleaner
      </Button>

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
        onMarkOrdered={onMarkOrdered}
        onMarkReceived={onMarkReceived}
        onSaveLink={onSaveLink}
        onPreferRetailer={onPreferRetailer}
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
        onMarkOrdered={onMarkOrdered}
        onMarkReceived={onMarkReceived}
        onSaveLink={onSaveLink}
        onPreferRetailer={onPreferRetailer}
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
        onMarkOrdered={onMarkOrdered}
        onMarkReceived={onMarkReceived}
        onSaveLink={onSaveLink}
        onPreferRetailer={onPreferRetailer}
      />
    </div>
  );
}

function EmptyToday({ onAdd, calendar }: { onAdd: () => void; calendar?: boolean }) {
  return (
    <div className="rounded-2xl bg-card px-5 py-10 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-cream">
        <BrandMark size="sm" />
      </span>
      <p className="ui-heading mt-4 text-[22px] font-semibold">Clear day</p>
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
