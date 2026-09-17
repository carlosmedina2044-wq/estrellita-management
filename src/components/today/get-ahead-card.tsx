"use client";

import { motion } from "motion/react";
import { Illustration } from "@/components/illustration";
import { Button } from "@/components/ui/button";
import { tDutyTitle } from "@/i18n/content";
import { useLocale } from "@/i18n/locale-provider";
import { formatWeekdayDate } from "@/lib/dates";
import { installedAtFor, nextDueDate } from "@/lib/duties";
import { roomTileFor } from "@/lib/kept-rooms";
import { DUR_QUICK, EASE_OUT } from "@/lib/motion";
import type { Duty, Household } from "@/lib/types";

/**
 * A clear day's optional win: the one quick chore from later this week,
 * pulled forward. Doing it goes through the normal completion flow, so the
 * row moves to Done today and a window lights; "Not today" hides the card
 * until tomorrow. Never more than one a day, never on the calendar view.
 */
export function GetAheadCard({
  duty,
  household,
  now,
  onDo,
  onNotToday,
}: {
  duty: Duty;
  household: Household;
  now: Date;
  onDo: () => void;
  onNotToday: () => void;
}) {
  const { t } = useLocale();
  const room = household.rooms.find((entry) => entry.id === duty.room || entry.id === duty.nodeId);
  const due = nextDueDate(duty, household.completions, now, installedAtFor(household, duty.id));
  const minutes = duty.estimatedMinutes ?? 10;

  return (
    <motion.section
      aria-label={t("today.getAheadTitle")}
      className="rounded-2xl bg-card px-4 py-3"
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: DUR_QUICK, ease: EASE_OUT }}
    >
      <p className="ui-caption font-medium text-primary">{t("today.getAheadTitle")}</p>
      <div className="mt-2 flex items-start gap-3">
        {room ? <Illustration name={roomTileFor(room)} size={56} className="shrink-0 rounded-xl" /> : null}
        <div className="min-w-0 flex-1">
          <p className="ui-body font-medium">{tDutyTitle(duty.title)}</p>
          <p className="mt-0.5 ui-caption text-muted-foreground num">
            {due
              ? t("today.getAheadMeta", { minutes, day: formatWeekdayDate(due) })
              : t("today.effort", { minutes })}
          </p>
          <div className="mt-2 flex gap-2">
            <Button className="h-11 px-4" onClick={onDo}>
              {t("today.getAheadDo")}
            </Button>
            <Button variant="ghost" className="h-11 px-2" onClick={onNotToday}>
              {t("today.getAheadSkip")}
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
