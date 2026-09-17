"use client";

import { motion } from "motion/react";
import { RollingNumber } from "@/components/today/rolling-number";
import { DUR_SCREEN, STAGGER_CHILD } from "@/lib/motion";
import { useLocale } from "@/i18n/locale-provider";
import type { RunDay } from "@/lib/momentum";
import { closedDayRun } from "@/lib/momentum";
import type { Household } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RunStrip({
  household,
  now,
  days,
  onOpenCalendar,
  celebrate,
}: {
  household: Household;
  now: Date;
  days: RunDay[];
  onOpenCalendar?: () => void;
  celebrate?: boolean;
}) {
  const { t } = useLocale();
  const run = closedDayRun(household, now);
  const closed = days.filter((day) => day.outcome === "closed" || day.outcome === "rest").length;
  const open = days.filter((day) => day.outcome === "open" || day.outcome === "grace").length;
  // The run count never appeared on Today; only the lock-screen widget said
  // "Day 12". Shown from the second day so a single closed day is not
  // announced as a streak, and rolled by the odometer when the ceremony
  // closes a new day.
  const showRun = run.current >= 2;
  const runParts = t("today.runDay", { count: "%%" }).split("%%");
  const graceUsed = days.some((day) => day.outcome === "grace");

  return (
    <button
      type="button"
      onClick={onOpenCalendar}
      aria-label={
        showRun
          ? `${t("today.runDay", { count: run.current })} · ${t("today.runStripAria", { closed, open })}`
          : t("today.runStripAria", { closed, open })
      }
      className="flex flex-col items-end gap-1 rounded-full py-1 text-left"
    >
      <span className="flex items-center gap-2">
      {showRun ? (
        <span className="ui-caption font-medium num">
          {runParts[0]}
          <RollingNumber value={run.current} />
          {runParts[1] ?? null}
        </span>
      ) : null}
      <motion.span
        className="flex items-center gap-1.5"
        variants={{
          show: { transition: { staggerChildren: STAGGER_CHILD, delayChildren: DUR_SCREEN } },
        }}
        initial={celebrate ? "hidden" : false}
        animate={celebrate ? "show" : undefined}
      >
        {days.map((day) => (
          <motion.span
            key={day.date.toISOString()}
            variants={{
              hidden: { scale: 0.6, opacity: 0 },
              show: { scale: 1, opacity: 1 },
            }}
            className={cn(
              "size-2 rounded-full",
              day.outcome === "closed" && "bg-done",
              // A 1px ring on an 8px dot read as an empty bubble rather than a
              // day. Filled at low opacity it reads as "a day, nothing asked".
              day.outcome === "rest" && "bg-done/45",
              // `bg-border` is 12% cream in the evening look, which left the
              // unfilled days as barely-there ghosts next to the minutes line.
              day.outcome === "open" && "bg-foreground/25",
              day.outcome === "grace" && "bg-soon/60",
              day.isToday && day.outcome === "open" && "today-dot-open",
            )}
          />
        ))}
      </motion.span>
      {run.best > run.current ? (
        <span className="ui-caption text-muted-foreground/60">
          {t("today.runBest", { count: run.best })}
        </span>
      ) : null}
      </span>
      {graceUsed ? (
        // The one forgiven day in seven was real in `walkRun` and invisible in
        // the UI; naming it is what makes a missed day feel fair, not fatal.
        <span className="ui-caption text-soon">{t("today.runGrace")}</span>
      ) : null}
    </button>
  );
}
