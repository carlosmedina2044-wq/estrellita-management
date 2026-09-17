"use client";

import { useMemo, useState } from "react";
import { DayCalendar } from "@/components/day-calendar";
import { PageHeader } from "@/components/page-header";
import type { MessageKey } from "@/i18n";
import { tPlaybookName } from "@/i18n/content";
import { useLocale } from "@/i18n/locale-provider";
import { checkInsInYear } from "@/lib/check-ins";
import { formatLongDate, parseISODate } from "@/lib/dates";
import { completionDays, completionsInRange, relativeDayLabel } from "@/lib/duties";
import { formatMoney } from "@/lib/forecast";
import { closedDayRun, yearDays, type YearDay } from "@/lib/momentum";
import { PLAYBOOKS } from "@/lib/playbooks";
import type { CareState, Household } from "@/lib/types";
import { valueLedger } from "@/lib/value-ledger";
import { cn } from "@/lib/utils";

const DOT: Record<YearDay["outcome"], string> = {
  closed: "bg-done",
  rest: "bg-done/45",
  open: "bg-foreground/25",
  grace: "bg-soon/60",
  future: "bg-foreground/8",
};

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3">
      <p className="ui-title font-semibold num">{value}</p>
      <p className="mt-0.5 ui-caption text-muted-foreground">{label}</p>
    </div>
  );
}

function MonthGrid({
  days,
  label,
  selected,
  onSelect,
}: {
  days: YearDay[];
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useLocale();
  // Leading blanks so the first day lands on its weekday column.
  const lead = days[0]?.date.getDay() ?? 0;
  const closed = days.filter((day) => day.outcome === "closed").length;
  const open = days.filter((day) => day.outcome === "open" || day.outcome === "grace").length;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${label}: ${t("today.runStripAria", { closed, open })}`}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl p-1.5 text-left transition-transform duration-75 active:scale-[0.98]",
        selected && "bg-secondary",
      )}
    >
      <span className="ui-caption font-medium text-muted-foreground">{label}</span>
      <span className="grid grid-cols-7 gap-[3px]" aria-hidden>
        {Array.from({ length: lead }, (_, index) => (
          <span key={`lead-${index}`} className="size-[7px]" />
        ))}
        {days.map((day) => (
          <span
            key={day.date.toISOString()}
            className={cn(
              "size-[7px] rounded-full",
              DOT[day.outcome],
              day.isToday && "ring-1 ring-primary ring-offset-1 ring-offset-background",
            )}
          />
        ))}
      </span>
    </button>
  );
}

function careEntriesForYear(household: Household, year: number): CareState[] {
  const history = household.momentum.careHistory ?? [];
  const current = household.momentum.care;
  const all = current ? [...history, current] : history;
  return all.filter((entry) => entry.since.startsWith(`${year}-`));
}

/**
 * Where a year of effort lives: a dot for every day painted like the run
 * strip, the numbers that accumulate (closed days, best run, hours, money
 * handled yourself, days the house was opened), the milestones with their
 * dates, the seasonal jobs done, and the care level's path through the year.
 */
export function YearView({
  household,
  now,
  onBack,
  backLabel,
}: {
  household: Household;
  now: Date;
  onBack: () => void;
  backLabel?: string;
}) {
  const { t, dateLocale } = useLocale();
  const year = now.getFullYear();
  const days = useMemo(() => yearDays(household, year, now), [household, year, now]);
  const months = useMemo(() => {
    const byMonth: YearDay[][] = Array.from({ length: 12 }, () => []);
    for (const day of days) byMonth[day.date.getMonth()].push(day);
    return byMonth;
  }, [days]);
  const [openMonth, setOpenMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date>(now);
  const closedDays = days.filter((day) => day.outcome === "closed").length;
  const run = closedDayRun(household, now);
  const bestRun = Math.max(run.best, run.current);
  const yearStart = useMemo(() => new Date(year, 0, 1), [year]);
  const ledger = valueLedger(household, yearStart, now);
  const opened = checkInsInYear(household, year);
  const milestones = [...household.milestones]
    .filter((item) => item.earnedAt.startsWith(`${year}-`))
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
  const seasonalDone = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of completionsInRange(household.completions, yearStart, now)) {
      const duty = household.duties.find((entry) => entry.id === item.dutyId);
      if (!duty?.playbookId) continue;
      counts.set(duty.playbookId, (counts.get(duty.playbookId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => {
        const playbook = PLAYBOOKS.find((entry) => entry.id === id);
        return { id, count, name: playbook ? tPlaybookName(playbook.id, playbook.name) : id };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [household, yearStart, now]);
  const care = careEntriesForYear(household, year);
  const calendarMarks = useMemo(
    () => (openMonth == null ? undefined : completionDays(household, new Date(year, openMonth, 1), new Date(year, openMonth + 1, 0))),
    [household, year, openMonth],
  );

  return (
    <div className="mx-auto flex w-full max-w-[32rem] flex-col gap-5 pb-8">
      <PageHeader
        title={t("year.title")}
        subtitle={t("year.subtitle", { year, name: household.householdName })}
        onBack={onBack}
        backLabel={backLabel}
      />

      <section aria-label={t("year.gridAria", { closed: closedDays, year })}>
        <div className="grid grid-cols-4 gap-2">
          {months.map((monthDays, index) => (
            <MonthGrid
              key={index}
              days={monthDays}
              label={new Date(year, index, 1).toLocaleString(dateLocale, { month: "short" })}
              selected={openMonth === index}
              onSelect={() => setOpenMonth((current) => (current === index ? null : index))}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 ui-caption text-muted-foreground" aria-hidden>
          {(["closed", "rest", "open", "grace"] as const).map((kind) => (
            <span key={kind} className="flex items-center gap-1.5">
              <span className={cn("size-[7px] rounded-full", DOT[kind])} />
              {t(`year.legend.${kind}` as MessageKey)}
            </span>
          ))}
        </div>
        {openMonth != null ? (
          <div className="mt-3">
            <DayCalendar
              month={new Date(year, openMonth, 1)}
              selected={selectedDay}
              today={now}
              marks={calendarMarks}
              onSelect={setSelectedDay}
              onMonthChange={(date) => setOpenMonth(date.getFullYear() === year ? date.getMonth() : null)}
            />
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Tile value={String(closedDays)} label={t("year.closedDays")} />
        <Tile value={bestRun > 0 ? t("today.runDay", { count: bestRun }) : "–"} label={t("year.bestRun")} />
        <Tile
          value={ledger.hours >= 1 ? t("ledger.hours", { hours: ledger.hours }) : t("today.effort", { minutes: ledger.minutes })}
          label={t("year.hoursGiven")}
        />
        {ledger.showAmount ? (
          <Tile value={formatMoney(Math.round(ledger.amount))} label={t("year.handled")} />
        ) : (
          <Tile value={String(opened)} label={t("year.daysOpened")} />
        )}
        {ledger.showAmount ? <Tile value={String(opened)} label={t("year.daysOpened")} /> : null}
      </section>

      <section>
        <h2 className="ui-heading mb-2 ui-title font-semibold">{t("today.rowMilestones")}</h2>
        <div className="ui-group">
          {milestones.length === 0 ? (
            <div className="ui-group-row px-4 py-3">
              <p className="ui-caption text-muted-foreground">{t("settings.milestonesEmpty")}</p>
            </div>
          ) : (
            milestones.map((item) => (
              <div key={item.id} className="ui-group-row flex items-center justify-between gap-3 px-4 py-3">
                <p className="ui-body font-medium">{t(`milestone.${item.id}.title` as MessageKey)}</p>
                <p className="shrink-0 ui-caption text-muted-foreground">{relativeDayLabel(new Date(item.earnedAt), now)}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="ui-heading mb-2 ui-title font-semibold">{t("year.seasonalDone")}</h2>
        <div className="ui-group">
          {seasonalDone.length === 0 ? (
            <div className="ui-group-row px-4 py-3">
              <p className="ui-caption text-muted-foreground">{t("year.seasonalNone")}</p>
            </div>
          ) : (
            seasonalDone.map((entry) => (
              <div key={entry.id} className="ui-group-row flex items-center justify-between gap-3 px-4 py-3">
                <p className="ui-body font-medium">{entry.name}</p>
                <p className="shrink-0 ui-caption text-muted-foreground num">{entry.count}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {care.length > 0 ? (
        <section>
          <h2 className="ui-heading mb-2 ui-title font-semibold">{t("year.careLevel")}</h2>
          <div className="ui-group">
            {care.map((entry) => (
              <div key={`${entry.level}-${entry.since}`} className="ui-group-row flex items-center justify-between gap-3 px-4 py-3">
                <p className="ui-body font-medium">{t(`care.level.${entry.level}` as MessageKey)}</p>
                <p className="shrink-0 ui-caption text-muted-foreground">
                  {t("today.careSince", { date: formatLongDate(new Date(parseISODate(entry.since))) })}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
