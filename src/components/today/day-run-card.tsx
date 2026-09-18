"use client";

import { Check, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { ClosingStats } from "@/components/today/closing-ceremony";
import { RollingNumber } from "@/components/today/rolling-number";
import { useLocale } from "@/i18n/locale-provider";
import { formatWeekdayNarrow } from "@/lib/dates";
import { DUR_SCREEN, EASE_OUT, STAGGER_CHILD } from "@/lib/motion";
import type { DayArc, RunDay } from "@/lib/momentum";
import { cn } from "@/lib/utils";

function DayRing({ arc, size = 44 }: { arc: DayArc; size?: number }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  // A clear or rest day asks for nothing, so its ring reads full rather than
  // empty — an empty ring on a day with no chores looked like a day failed.
  const quiet = arc.state !== "open";
  const fraction = quiet ? 1 : arc.fraction;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--done)"
          strokeWidth={stroke}
          strokeLinecap="round"
          // Dash maths rather than motion's `pathLength`: that prop writes its
          // own strokeDasharray, so a fraction of 0 still drew a full ring.
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - fraction) }}
          transition={{ duration: DUR_SCREEN, ease: EASE_OUT }}
          opacity={arc.state === "clear" || arc.state === "rest" ? 0.5 : 1}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {quiet ? (
          <Check className="size-5 text-done" aria-hidden />
        ) : (
          <span className="ui-body font-semibold num text-foreground">
            <RollingNumber value={arc.open} />
          </span>
        )}
      </span>
    </div>
  );
}

function RunDots({ days, celebrate }: { days: RunDay[]; celebrate: boolean }) {
  return (
    <motion.span
      className="flex items-end gap-[7px]"
      variants={{
        show: { transition: { staggerChildren: STAGGER_CHILD, delayChildren: DUR_SCREEN } },
      }}
      initial={celebrate ? "hidden" : false}
      animate={celebrate ? "show" : undefined}
    >
      {days.map((day) => (
        <motion.span
          key={day.date.toISOString()}
          className="flex flex-col items-center gap-1"
          variants={{ hidden: { scale: 0.6, opacity: 0 }, show: { scale: 1, opacity: 1 } }}
        >
          <span
            className={cn(
              "ui-caption leading-none",
              day.isToday ? "font-semibold text-foreground" : "text-muted-foreground/70",
            )}
            aria-hidden
          >
            {formatWeekdayNarrow(day.date)}
          </span>
          <span
            className={cn(
              "size-2 rounded-full",
              day.outcome === "closed" && "bg-done",
              day.outcome === "rest" && "bg-done/45",
              day.outcome === "open" && "bg-foreground/30",
              day.outcome === "grace" && "bg-soon/60",
              day.isToday && day.outcome === "open" && "today-dot-open",
            )}
          />
        </motion.span>
      ))}
    </motion.span>
  );
}

export function DayRunCard({
  arc,
  days,
  run,
  graceUsed,
  headline,
  stats,
  celebrate,
  instant,
  onOpenList,
  onOpenYear,
}: {
  arc: DayArc;
  days: RunDay[];
  run: { current: number; best: number };
  graceUsed: boolean;
  headline: string;
  stats: { done: number; minutes: number; rooms: number };
  celebrate: boolean;
  instant: boolean;
  onOpenList: () => void;
  onOpenYear: () => void;
}) {
  const { t } = useLocale();
  const closed = arc.state === "closed";
  // Shown from the second day so a single closed day is not announced as a streak.
  const showRun = run.current >= 2;
  const runParts = t("today.runDay", { count: "%%" }).split("%%");
  const closedDays = days.filter((day) => day.outcome === "closed" || day.outcome === "rest").length;
  const openDays = days.filter((day) => day.outcome === "open" || day.outcome === "grace").length;

  // Split around the number rather than interpolated, so both halves of the
  // subline can roll when a chore is ticked instead of the whole line being
  // replaced under the user. Same shape as `runParts` above.
  const countParts = t("today.runCount", { count: "%%" }).split("%%");
  const effortParts = t("today.effort", { minutes: "%%" }).split("%%");
  const showCount = arc.open > 0;
  const showEffort = arc.minutesLeft > 0;

  return (
    <div className="ui-group">
      {closed ? (
        <div className="px-4 py-3">
          <ClosingStats stats={stats} instant={instant} />
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpenList}
          aria-label={t("today.runOpenList")}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-transform duration-75 active:scale-[0.99]"
        >
          <DayRing arc={arc} />
          <span className="min-w-0 flex-1">
            <span className="block ui-card font-semibold leading-snug text-foreground">{headline}</span>
            {showCount || showEffort ? (
              <span className="mt-0.5 flex items-baseline ui-caption num text-muted-foreground">
                {showCount ? (
                  <>
                    {countParts[0]}
                    <RollingNumber value={arc.open} />
                    {countParts[1] ?? null}
                  </>
                ) : null}
                {showCount && showEffort ? <>&nbsp;·&nbsp;</> : null}
                {showEffort ? (
                  <>
                    {effortParts[0]}
                    <RollingNumber value={arc.minutesLeft} />
                    {effortParts[1] ?? null}
                  </>
                ) : null}
              </span>
            ) : null}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      )}

      <button
        type="button"
        onClick={onOpenYear}
        aria-label={`${t("year.title")} · ${
          showRun ? `${t("today.runDay", { count: run.current })} · ` : ""
        }${t("today.runStripAria", { closed: closedDays, open: openDays })}`}
        className="flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left transition-transform duration-75 active:scale-[0.99]"
      >
        <span className="min-w-0">
          <span className="block ui-caption text-muted-foreground">{t("year.title")}</span>
          {showRun ? (
            <span className="block ui-body font-semibold num text-foreground">
              {runParts[0]}
              <RollingNumber value={run.current} />
              {runParts[1] ?? null}
            </span>
          ) : run.best > run.current ? (
            <span className="block ui-caption text-muted-foreground/60">
              {t("today.runBest", { count: run.best })}
            </span>
          ) : null}
          {/* The one forgiven day in seven is real in `walkRun`; naming it is
              what makes a missed day feel fair rather than fatal. */}
          {graceUsed ? (
            <span className="block ui-caption text-soon">{t("today.runGrace")}</span>
          ) : null}
        </span>
        <span className="ml-auto flex items-end gap-3">
          <RunDots days={days} celebrate={celebrate} />
          <ChevronRight className="mb-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        </span>
      </button>
    </div>
  );
}
