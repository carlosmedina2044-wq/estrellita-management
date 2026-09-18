"use client";

import { motion } from "motion/react";
import { DUR_QUICK, EASE_OUT, STAGGER_CHILD } from "@/lib/motion";

/** How long the year takes to draw itself: twelve months 45ms apart, plus the
 * last month's own day-by-day fill. The stat tiles wait for it rather than
 * landing over a grid that is still arriving. */
const YEAR_GRID_MS = 700;
import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import { DayCalendar } from "@/components/day-calendar";
import { MilestoneRow, NextMilestone } from "@/components/milestone-list";
import { PageHeader } from "@/components/page-header";
import { ShareCardSheet } from "@/components/today/share-card-sheet";
import { useClock } from "@/hooks/use-clock";
import { currentCareState } from "@/lib/care-level";
import { toISODate } from "@/lib/dates";
import { dayOpacityForPhase, portraitLayerUrls, resolveHomeSpec } from "@/lib/scene/portrait";
import { seasonFor } from "@/lib/scene/season";
import { skyGradient } from "@/lib/scene/sky";
import { skyPhase, sunTimes } from "@/lib/scene/sun";
import { sceneWeather } from "@/lib/scene/weather";
import { yearCardModel, type ShareCardModel, type ShareCardScene } from "@/lib/share-card";
import type { MessageKey } from "@/i18n";
import { tPlaybookName } from "@/i18n/content";
import { useLocale } from "@/i18n/locale-provider";
import { checkInsInYear } from "@/lib/check-ins";
import { formatLongDate, parseISODate } from "@/lib/dates";
import { completionDays, completionsInRange, relativeDayLabel } from "@/lib/duties";
import { formatMoney } from "@/lib/forecast";
import {
  closedDayRun,
  milestoneProgress,
  milestonesForDisplay,
  yearDays,
  type YearDay,
} from "@/lib/momentum";
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
  before: "bg-foreground/8",
};

function Tile({ value, label, index }: { value: string; label: string; index: number }) {
  return (
    <motion.div
      className="rounded-2xl bg-card px-4 py-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR_QUICK, ease: EASE_OUT, delay: YEAR_GRID_MS / 1000 + index * STAGGER_CHILD }}
    >
      <p className="ui-title font-semibold num">{value}</p>
      <p className="mt-0.5 ui-caption text-muted-foreground">{label}</p>
    </motion.div>
  );
}

function MonthGrid({
  days,
  label,
  selected,
  monthIndex,
  onSelect,
}: {
  days: YearDay[];
  label: string;
  selected: boolean;
  /** Its place in the stagger, so the year fills left to right. */
  monthIndex: number;
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
        {days.map((day, dayIndex) => (
          <motion.span
            key={day.date.toISOString()}
            className={cn(
              "size-[7px] rounded-full",
              DOT[day.outcome],
              day.isToday && "ring-1 ring-primary ring-offset-1 ring-offset-background",
              day.isToday && day.outcome !== "closed" && "today-dot-open",
            )}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            // The year draws itself once, month by month and day by day, in
            // about a second. A grid of 365 dots that is simply there says
            // nothing; watching it fill in is the point of the screen.
            transition={{
              duration: DUR_QUICK,
              ease: EASE_OUT,
              delay: monthIndex * 0.045 + dayIndex * 0.0035,
            }}
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
  // Earned first, newest win at the top, then whatever is closest to falling —
  // the list has to read as a ladder, not a receipt.
  const milestones = useMemo(
    () => milestonesForDisplay(milestoneProgress(household, now)),
    [household, now],
  );
  const next = milestones.open[0] ?? null;
  const rest = milestones.open.slice(1);
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
  const hoursText =
    ledger.hours >= 1
      ? t("ledger.hours", { hours: ledger.hours })
      : ledger.minutes > 0
        ? t("today.effort", { minutes: ledger.minutes })
        : "–";
  const clock = useClock();
  const [shareCard, setShareCard] = useState<{ model: ShareCardModel; scene: ShareCardScene; fallback: string } | null>(null);
  function shareYear() {
    const { lat, lng } = household.location;
    const phase = skyPhase(clock, lat != null && lng != null ? sunTimes(lat, lng, clock) : null);
    const weather = sceneWeather(null, toISODate(now));
    const spec = resolveHomeSpec(household);
    const layers = portraitLayerUrls(spec.kitType, spec.palette, seasonFor(now, lat ?? null));
    const careLine = t(`care.level.${currentCareState(household, now).level}` as MessageKey);
    const privateMode = household.restockDigest.privateNotifications === true;
    setShareCard({
      model: yearCardModel({
        home: household.householdName,
        headline: t("today.yearWrappedTitle", { year }),
        closedDays,
        bestRun,
        hoursText,
        labels: { closed: t("year.closedDays"), best: t("year.bestRun"), hours: t("year.hoursGiven") },
        careLine,
        brand: t("opening.brand"),
        privateMode,
      }),
      scene: {
        layers,
        sky: skyGradient(phase.phase, phase.t, weather.kind, weather.cloudCover),
        dayOpacity: dayOpacityForPhase(phase.phase, phase.t),
        windowStates: layers.windows.map(() => "lit" as const),
        snow: weather.kind === "snow",
      },
      fallback: t("share.yearWrappedText", {
        year,
        name: household.householdName,
        closed: closedDays,
        best: bestRun,
        hours: hoursText,
      }),
    });
  }
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
        action={
          <button
            type="button"
            aria-label={t("share.cardShare")}
            onClick={shareYear}
            className="flex size-11 items-center justify-center rounded-full bg-secondary"
          >
            <Share2 className="size-5" />
          </button>
        }
      />
      <ShareCardSheet
        open={Boolean(shareCard)}
        onOpenChange={(openSheet) => {
          if (!openSheet) setShareCard(null);
        }}
        scene={shareCard?.scene ?? null}
        model={shareCard?.model ?? null}
        filename={`cuidala-${year}.png`}
        fallbackText={shareCard?.fallback ?? ""}
      />

      <section aria-label={t("year.gridAria", { closed: closedDays, year })}>
        <div className="grid grid-cols-4 gap-2">
          {months.map((monthDays, index) => (
            <MonthGrid
              key={index}
              days={monthDays}
              label={new Date(year, index, 1).toLocaleString(dateLocale, { month: "short" })}
              selected={openMonth === index}
              monthIndex={index}
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
        <Tile index={0} value={String(closedDays)} label={t("year.closedDays")} />
        <Tile
          index={1}
          value={bestRun > 0 ? t("today.runDay", { count: bestRun }) : "–"}
          label={t("year.bestRun")}
        />
        <Tile index={2} value={hoursText} label={t("year.hoursGiven")} />
        {ledger.showAmount ? (
          <Tile index={3} value={formatMoney(Math.round(ledger.amount))} label={t("year.handled")} />
        ) : (
          <Tile index={3} value={String(opened)} label={t("year.daysOpened")} />
        )}
        {ledger.showAmount ? <Tile index={4} value={String(opened)} label={t("year.daysOpened")} /> : null}
      </section>

      <section>
        <h2 className="ui-heading mb-2 ui-title font-semibold">{t("today.rowMilestones")}</h2>
        <NextMilestone item={next} />
        {/* Won and still-to-come are two different things to look at, and a
            single run of fourteen rows made them one. The count on each head
            is the shape of the ladder in one glance. The nearest one is the
            card above, so the list carries what comes after it rather than
            naming the same milestone twice in a row. */}
        {rest.length > 0 ? (
          <>
            <h3 className="ui-heading mt-4 mb-2 ui-caption text-muted-foreground">
              {t("milestone.groupOpen", { count: rest.length })}
            </h3>
            <div className="ui-group">
              {rest.map((item) => (
                <MilestoneRow key={item.id} item={item} />
              ))}
            </div>
          </>
        ) : null}
        {milestones.earned.length > 0 ? (
          <>
            <h3 className="ui-heading mt-4 mb-2 ui-caption text-muted-foreground">
              {t("milestone.groupEarned", { count: milestones.earned.length })}
            </h3>
            <div className="ui-group">
              {milestones.earned.map((item) => (
                <MilestoneRow
                  key={item.id}
                  item={item}
                  earnedLabel={
                    item.earnedAt ? relativeDayLabel(new Date(item.earnedAt), now) : undefined
                  }
                />
              ))}
            </div>
          </>
        ) : null}
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
