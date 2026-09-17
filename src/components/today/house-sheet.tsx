"use client";

import { HouseOrbit } from "@/components/today/house-orbit";
import { KeptRoomsRow } from "@/components/today/kept-rooms-row";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MessageKey } from "@/i18n";
import { tPlaybookName } from "@/i18n/content";
import { useLocale } from "@/i18n/locale-provider";
import { currentCareState } from "@/lib/care-level";
import { formatLongDate, parseISODate } from "@/lib/dates";
import { closedDayRun, type DayArc } from "@/lib/momentum";
import { seasonalTimeline } from "@/lib/playbooks";
import type { Household } from "@/lib/types";
import { formatLedgerLine, monthLedger } from "@/lib/value-ledger";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="ui-group-row flex items-center justify-between gap-3 px-4 py-3">
      <span className="shrink-0 ui-caption text-muted-foreground">{label}</span>
      <span className="ui-body font-medium text-right">{value}</span>
    </div>
  );
}

/** The first seasonal window ahead that is still open or under way. */
function nextSeasonal(household: Household, now: Date): string | null {
  for (const month of seasonalTimeline(household, now)) {
    const entry = month.entries.find(
      (item) => item.state === "open" || item.state === "planned" || item.state === "in_progress",
    );
    if (entry) return `${tPlaybookName(entry.playbook.id, entry.playbook.name)} · ${month.label}`;
  }
  return null;
}

/**
 * The state of the house, one tap from the portrait: care level and how long
 * it has held, the day ring, which rooms are kept, this month's ledger, the
 * run, the next seasonal window and the milestones earned. Everything here
 * was already computed for Today; until now it was reachable only from the
 * dev hero page or as a plain list in Settings.
 */
export function HouseSheet({
  open,
  onOpenChange,
  household,
  now,
  arc,
  onSeeYear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  household: Household;
  now: Date;
  arc: DayArc;
  onSeeYear: () => void;
}) {
  const { t } = useLocale();
  const care = currentCareState(household, now);
  const level = t(`care.level.${care.level}` as MessageKey);
  const since = formatLongDate(new Date(parseISODate(care.since)));
  const run = closedDayRun(household, now);
  const runLine =
    run.current > 0
      ? run.best > run.current
        ? `${t("today.runDay", { count: run.current })} · ${t("today.runBest", { count: run.best })}`
        : t("today.runDay", { count: run.current })
      : t("today.runNone");
  const milestones = household.milestones.length;
  const next = nextSeasonal(household, now);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" size="form" className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle>{household.householdName}</SheetTitle>
        </SheetHeader>
        <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-5 px-4 pb-4">
          <div className="flex items-center gap-4">
            <HouseOrbit
              arc={arc}
              level={care.level}
              dimmed={false}
              ceremony={false}
              label={t("today.houseAria", { level })}
            />
            <div className="min-w-0 flex-1">
              <p className="ui-title font-semibold" aria-label={t("care.titleAria", { level })}>
                {level}
              </p>
              <p className="mt-0.5 ui-caption text-muted-foreground">{t("today.careSince", { date: since })}</p>
              <p className="mt-2 ui-caption text-muted-foreground num">{t("today.dayArcAria", { done: arc.done, total: arc.total })}</p>
            </div>
          </div>
          <KeptRoomsRow household={household} now={now} />
          <div className="ui-group">
            <Row label={t("today.rowThisMonth")} value={formatLedgerLine(monthLedger(household, now), t)} />
            <Row label={t("today.rowRun")} value={runLine} />
            <Row label={t("today.rowNextSeasonal")} value={next ?? t("today.nextSeasonalNone")} />
            <Row
              label={t("today.rowMilestones")}
              value={milestones > 0 ? t("today.milestonesEarned", { count: milestones }) : t("today.milestonesNone")}
            />
          </div>
        </div>
        <SheetFooter className="pt-2">
          <Button className="h-12 w-full" onClick={onSeeYear}>
            {t("season.seeYear")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
