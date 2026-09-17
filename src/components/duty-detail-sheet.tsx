"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocale } from "@/i18n/locale-provider";
import { tDutyTitle } from "@/i18n/content";
import { formatDueDate } from "@/lib/dates";
import { dutySubtitle, nextDueDate, relativeDayLabel, wasCompletedToday } from "@/lib/duties";
import { costSummary, lastDoneInfo, recentRhythm } from "@/lib/duty-history";
import { formatMoney } from "@/lib/forecast";
import { DUR_QUICK, EASE_OUT, STAGGER_CHILD } from "@/lib/motion";
import type { Duty, Household } from "@/lib/types";

function Row({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <motion.div
      className="ui-group-row flex items-center justify-between gap-3 px-4 py-3"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR_QUICK, ease: EASE_OUT, delay: index * STAGGER_CHILD }}
    >
      <span className="ui-caption text-muted-foreground">{label}</span>
      <span className="ui-body font-medium text-right">{value}</span>
    </motion.div>
  );
}

export function DutyDetailSheet({
  open,
  duty,
  household,
  now,
  onOpenChange,
  onComplete,
  onUndo,
  onSnooze,
  onEdit,
}: {
  open: boolean;
  duty: Duty | null;
  household: Household;
  now: Date;
  onOpenChange: (open: boolean) => void;
  onComplete: (duty: Duty) => void;
  onUndo: (duty: Duty) => void;
  onSnooze: (duty: Duty) => void;
  onEdit: (duty: Duty) => void;
}) {
  const { t } = useLocale();
  if (!duty) return null;

  const completions = household.completions;
  const doneToday = wasCompletedToday(duty, completions, now);
  const last = lastDoneInfo(duty.id, completions);
  const next = nextDueDate(duty, completions, now);
  const rhythm = recentRhythm(duty, completions, now);
  const cost = costSummary(duty.id, completions);

  const lastDoneLine = last
    ? t("today.doneBy", {
        name:
          last.actor === "cleaner"
            ? household.cleanerName.trim() || t("audience.cleaner")
            : t("audience.me"),
      }) + ` · ${relativeDayLabel(new Date(last.completedAt), now)}`
    : t("duty.detail.never");

  let rowIndex = 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" size="form" className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle>{tDutyTitle(duty.title)}</SheetTitle>
        </SheetHeader>
        <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
          <p className="ui-caption text-muted-foreground">
            {dutySubtitle(duty, completions, now, undefined, household)}
          </p>
          <div className="ui-group">
            <Row label={t("duty.detail.lastDone")} value={lastDoneLine} index={rowIndex++} />
            {next ? (
              <Row label={t("duty.detail.nextDue")} value={formatDueDate(next)} index={rowIndex++} />
            ) : null}
            {rhythm ? (
              <Row
                label={t("duty.detail.rhythm")}
                value={t("duty.detail.rhythmLine", { done: rhythm.done, of: rhythm.of, streak: rhythm.streak })}
                index={rowIndex++}
              />
            ) : null}
            {cost ? (
              <Row
                label={t("duty.detail.cost")}
                value={t("duty.detail.costTotal", { total: formatMoney(cost.total), count: cost.count })}
                index={rowIndex++}
              />
            ) : null}
          </div>
          {duty.notes ? (
            <motion.div
              className="ui-group px-4 py-3"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR_QUICK, ease: EASE_OUT, delay: rowIndex * STAGGER_CHILD }}
            >
              <p className="ui-caption text-muted-foreground">{t("chore.notes")}</p>
              <p className="mt-1 ui-body">{duty.notes}</p>
            </motion.div>
          ) : null}
        </div>
        <SheetFooter className="grid grid-cols-2 gap-2 pt-2">
          <Button
            variant={doneToday ? "secondary" : "default"}
            className="col-span-2 h-12"
            onClick={() => (doneToday ? onUndo(duty) : onComplete(duty))}
          >
            {doneToday ? t("common.undo") : t("chore.complete")}
          </Button>
          <Button variant="secondary" className="h-12" onClick={() => onSnooze(duty)}>
            {t("chore.snoozeWeek")}
          </Button>
          <Button variant="secondary" className="h-12" onClick={() => onEdit(duty)}>
            {t("common.edit")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
