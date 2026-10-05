"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocale } from "@/i18n/locale-provider";
import { tDutyTitle } from "@/i18n/content";
import { icsFileContent, icsFilenameFor, googleCalendarUrl } from "@/lib/calendar-export";
import { formatDueDate, toISODate } from "@/lib/dates";
import { dutySubtitle, nextDueDate, relativeDayLabel, wasCompletedToday } from "@/lib/duties";
import { costSummary, lastDoneInfo, recentRhythm } from "@/lib/duty-history";
import { formatMoney } from "@/lib/forecast";
import { DUR_QUICK, EASE_OUT, STAGGER_CHILD } from "@/lib/motion";
import { openExternalUrl } from "@/lib/native/open-url";
import { shareIcsFile } from "@/lib/native/share";
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

/**
 * The body used to sit behind an `if (!duty) return null` placed ABOVE the
 * `<Sheet>`, so completing, undoing or snoozing tore the sheet out in one
 * frame while every other sheet in the app slides out — and `editFromDetail`'s
 * 350ms hand-off was waiting on an animation that never played. The Sheet now
 * stays mounted and closes on `duty` going null; the last duty is held just
 * long enough for the exit to finish (it also keeps a `SheetTitle` in the tree
 * the whole time, which Radix requires).
 */
export function DutyDetailSheet(props: {
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
  const { open, duty, household, now, onOpenChange, onComplete, onUndo, onSnooze, onEdit } = props;
  const [lastDuty, setLastDuty] = useState<Duty | null>(duty);
  if (duty && duty !== lastDuty) setLastDuty(duty);
  const shown = duty ?? lastDuty;

  return (
    <Sheet open={open && Boolean(duty)} onOpenChange={onOpenChange}>
      {shown ? (
        <DutyDetailBody
          duty={shown}
          household={household}
          now={now}
          onComplete={onComplete}
          onUndo={onUndo}
          onSnooze={onSnooze}
          onEdit={onEdit}
        />
      ) : null}
    </Sheet>
  );
}

function DutyDetailBody({
  duty,
  household,
  now,
  onComplete,
  onUndo,
  onSnooze,
  onEdit,
}: {
  duty: Duty;
  household: Household;
  now: Date;
  onComplete: (duty: Duty) => void;
  onUndo: (duty: Duty) => void;
  onSnooze: (duty: Duty) => void;
  onEdit: (duty: Duty) => void;
}) {
  const { t } = useLocale();
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [calendarDutyId, setCalendarDutyId] = useState(duty.id);
  if (duty.id !== calendarDutyId) {
    setCalendarDutyId(duty.id);
    setAddingToCalendar(false);
  }
  const completions = household.completions;
  const doneToday = wasCompletedToday(duty, completions, now);
  const last = lastDoneInfo(duty.id, completions);
  const next = nextDueDate(duty, completions, now);
  const rhythm = recentRhythm(duty, completions, now);
  const cost = costSummary(duty.id, completions);

  function calendarEvent() {
    return {
      title: tDutyTitle(duty.title),
      details: duty.notes.trim() ? [duty.notes.trim()] : [],
      date: toISODate(next ?? now),
      recurYearly: duty.frequency === "yearly",
    };
  }

  async function addToGoogleCalendar() {
    setAddingToCalendar(false);
    await openExternalUrl(googleCalendarUrl(calendarEvent()));
  }

  async function addToAppleCalendar() {
    setAddingToCalendar(false);
    const event = calendarEvent();
    const result = await shareIcsFile(icsFileContent(event), icsFilenameFor(event.title), event.title);
    if (result === "failed") toast.error(t("duty.calendarShareFailed"));
  }

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
    <SheetContent
      side="bottom"
      className="max-h-[88dvh] gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <SheetHeader className="shrink-0 gap-1 pb-2 pr-14">
        <SheetTitle className="text-2xl font-semibold leading-tight">{tDutyTitle(duty.title)}</SheetTitle>
        <p className="ui-caption text-muted-foreground">
          {dutySubtitle(duty, completions, now, undefined, household)}
        </p>
      </SheetHeader>
      <div data-keyboard-scroll className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pb-3">
        <div className="ui-group">
          <Row label={t("duty.detail.lastDone")} value={lastDoneLine} index={rowIndex++} />
          {next ? <Row label={t("duty.detail.nextDue")} value={formatDueDate(next)} index={rowIndex++} /> : null}
          {last && rhythm ? (
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
        {duty.notes.trim() ? (
          <motion.div
            className="ui-group px-4 py-3"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR_QUICK, ease: EASE_OUT, delay: rowIndex * STAGGER_CHILD }}
          >
            <p className="ui-caption text-muted-foreground">{t("chore.notes")}</p>
            <p className="mt-1 ui-body whitespace-pre-wrap">{duty.notes.trim()}</p>
          </motion.div>
        ) : null}
      </div>
      <SheetFooter className="gap-2 pt-1">
        <Button
          variant={doneToday ? "secondary" : "default"}
          className="h-12 w-full"
          onClick={() => (doneToday ? onUndo(duty) : onComplete(duty))}
        >
          {doneToday ? t("common.undo") : t("chore.complete")}
        </Button>
        <div className="flex flex-wrap gap-2">
          {addingToCalendar ? (
            <>
              <Button variant="secondary" className={SECONDARY} onClick={addToGoogleCalendar}>
                {t("duty.addToGoogleCalendar")}
              </Button>
              <Button variant="secondary" className={SECONDARY} onClick={addToAppleCalendar}>
                {t("duty.addToAppleCalendar")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" className={SECONDARY} onClick={() => onSnooze(duty)}>
                {t("chore.snoozeWeek")}
              </Button>
              <Button variant="secondary" className={SECONDARY} onClick={() => onEdit(duty)}>
                {t("common.edit")}
              </Button>
              <Button variant="secondary" className={SECONDARY} onClick={() => setAddingToCalendar(true)}>
                {t("duty.addToCalendar")}
              </Button>
            </>
          )}
        </div>
      </SheetFooter>
    </SheetContent>
  );
}

const SECONDARY = "h-auto min-h-11 min-w-[7rem] flex-1 whitespace-normal py-2 text-center";
