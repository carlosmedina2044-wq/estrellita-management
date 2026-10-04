"use client";

import { Check, ChevronRight } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { ClosingStats } from "@/components/today/closing-ceremony";
import { RollingNumber } from "@/components/today/rolling-number";
import { useLocale } from "@/i18n/locale-provider";
import { formatWeekdayNarrow } from "@/lib/dates";
import { CEREMONY_BEAT, DUR_BASE, DUR_SCREEN, EASE_OUT, STAGGER_CHILD } from "@/lib/motion";
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

const PAST_DOT = { hidden: { scale: 0.6, opacity: 0 }, show: { scale: 1, opacity: 1 } };
/**
 * The day just closed, so its dot overshoots and settles: the eye should go to
 * it rather than to the six that were already there.
 *
 * A tween, not a spring. Springs in motion accept exactly two keyframes and
 * throw on a third — and the throw is not contained, it aborts every other
 * animation starting in the same frame. That is how one bouncy dot silently
 * took out the whole closing ceremony.
 */
const TODAY_DOT = {
  hidden: { scale: 0.6, opacity: 0 },
  show: {
    scale: [0.6, 1.18, 1],
    opacity: 1,
    transition: { duration: DUR_BASE, times: [0, 0.6, 1], ease: [[...EASE_OUT], "easeInOut"] },
  },
} satisfies Variants;

function RunDots({ days, celebrate }: { days: RunDay[]; celebrate: boolean }) {
  return (
    <motion.span
      className="flex items-end gap-[7px]"
      variants={{
        // Lands with the streak number, after the house has had the screen.
        show: { transition: { staggerChildren: STAGGER_CHILD, delayChildren: CEREMONY_BEAT.run } },
      }}
      initial={celebrate ? "hidden" : false}
      animate={celebrate ? "show" : undefined}
    >
      {days.map((day) => (
        <motion.span
          key={day.date.toISOString()}
          className="flex flex-col items-center gap-1"
          variants={day.isToday ? TODAY_DOT : PAST_DOT}
        >
          <span
            className={cn(
              "ui-caption leading-none",
              day.isToday ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
            aria-hidden
          >
            {formatWeekdayNarrow(day.date)}
          </span>
          <span
            className={cn(
              "size-2 rounded-full",
              day.outcome === "closed" && "bg-done",
              day.outcome === "rest" && "bg-done/60",
              day.outcome === "open" && "bg-foreground/45",
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
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-left ui-press"
        >
          <DayRing arc={arc} />
          <span className="min-w-0 flex-1 basis-[60%]">
            <span className="block ui-card font-semibold leading-snug text-foreground">{headline}</span>
            {showCount || showEffort ? (
              <span
                // Not a flex container: CSS strips the collapsible whitespace
                // at the edges of each flex item, so " to do" and "about "
                // lost their spaces and the line read "3to do · about40min".
                // `RollingNumber` is already `inline-flex` and baseline-
                // aligned, so plain inline flow is all this needs.
                className="mt-0.5 block ui-caption num text-muted-foreground"
              >
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
        className="flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left ui-press"
      >
        <span className="min-w-0">
          <span className="block ui-caption text-muted-foreground">{t("year.title")}</span>
          {showRun ? (
            <span className="block ui-body font-semibold num text-foreground">
              {runParts[0]}
              <RollingNumber value={run.current} />
              {runParts[1] ?? null}
            </span>
          ) : run.best >= 2 && run.best > run.current ? (
            <span className="block ui-caption text-muted-foreground">
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
