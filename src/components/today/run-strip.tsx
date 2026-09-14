"use client";

import { motion } from "motion/react";
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

  return (
    <button
      type="button"
      onClick={onOpenCalendar}
      aria-label={t("today.runStripAria", { closed, open })}
      className="flex items-center gap-2 rounded-full py-1 text-left"
    >
      <motion.span
        className="flex items-center gap-1.5"
        variants={{
          show: { transition: { staggerChildren: 0.07 } },
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
              "size-2.5 rounded-full",
              day.outcome === "closed" && "bg-done",
              day.outcome === "rest" && "bg-transparent ring-1 ring-done/40",
              day.outcome === "open" && "bg-border",
              day.outcome === "grace" && "bg-soon/60",
              day.isToday && day.outcome === "open" && "animate-pulse",
            )}
          />
        ))}
      </motion.span>
      {run.best > run.current ? (
        <span className="ui-caption text-muted-foreground/60">
          {t("today.runBest", { count: run.best })}
        </span>
      ) : null}
    </button>
  );
}
