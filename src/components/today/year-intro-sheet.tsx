"use client";

import { useMemo } from "react";
import { SceneBoundary } from "@/components/scene-boundary";
import { PortraitScene } from "@/components/today/portrait-scene";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { tDutyTitle, tPlaybookName } from "@/i18n/content";
import { useLocale } from "@/i18n/locale-provider";
import { useClock } from "@/hooks/use-clock";
import { formatWeekdayDate, toISODate } from "@/lib/dates";
import { installedAtFor, nextDueDate, todaysOpenDuties } from "@/lib/duties";
import { dayArc } from "@/lib/momentum";
import { seasonalTimeline } from "@/lib/playbooks";
import { skyPhase, sunTimes } from "@/lib/scene/sun";
import { sceneWeather } from "@/lib/scene/weather";
import type { Household } from "@/lib/types";

function firstUp(household: Household, now: Date): { key: "today" | "on" | "none"; title?: string; day?: string } {
  const today = todaysOpenDuties(household, now);
  if (today[0]) return { key: "today", title: tDutyTitle(today[0].title) };
  let best: { title: string; at: Date } | null = null;
  for (const duty of household.duties) {
    if (duty.archived) continue;
    const at = nextDueDate(duty, household.completions, now, installedAtFor(household, duty.id));
    if (!at) continue;
    if (!best || at < best.at) best = { title: duty.title, at };
  }
  if (!best) return { key: "none" };
  return { key: "on", title: tDutyTitle(best.title), day: formatWeekdayDate(best.at) };
}

/**
 * "Here's your year": the first thing a new home sees, before its list. The
 * house, the next four seasonal windows with their months, the first chore
 * due, and how many supplies are watched. Sets the expectation that this is
 * about the whole house and the whole year, not today's three chores.
 */
export function YearIntroSheet({
  open,
  household,
  now,
  onStart,
}: {
  open: boolean;
  household: Household;
  now: Date;
  onStart: () => void;
}) {
  const { t } = useLocale();
  const clock = useClock();
  const clockMs = clock.getTime();
  const { lat, lng } = household.location;
  const phase = useMemo(
    () => skyPhase(new Date(clockMs), lat != null && lng != null ? sunTimes(lat, lng, new Date(clockMs)) : null),
    [clockMs, lat, lng],
  );
  const arc = useMemo(() => dayArc(household, now, "all"), [household, now]);
  const weather = useMemo(() => sceneWeather(null, toISODate(now)), [now]);
  const windows = useMemo(
    () =>
      seasonalTimeline(household, now)
        .flatMap((month) =>
          month.entries
            .filter((entry) => entry.state !== "declined" && entry.state !== "done")
            .map((entry) => ({ label: month.label, name: tPlaybookName(entry.playbook.id, entry.playbook.name) })),
        )
        .slice(0, 4),
    [household, now],
  );
  const next = firstUp(household, now);
  const supplies = household.supplyAutomations.length;

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onStart())}>
      <SheetContent side="bottom" size="form" className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle>{t("intro.title", { name: household.householdName })}</SheetTitle>
        </SheetHeader>
        <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-5 px-4 pb-4">
          <div className="overflow-hidden rounded-2xl">
            <SceneBoundary fallback={<div aria-hidden className="h-[272px] bg-secondary" />}>
              <PortraitScene
                household={household}
                arc={arc}
                phase={phase.phase}
                phaseT={phase.t}
                weather={weather}
                ceremony={false}
                greeting=""
                secondaryLine=""
                insetTop={false}
              />
            </SceneBoundary>
          </div>
          {windows.length > 0 ? (
            <section>
              <p className="mb-2 px-1 ui-caption font-medium text-muted-foreground">{t("intro.seasonal")}</p>
              <div className="ui-group">
                {windows.map((entry) => (
                  <div key={`${entry.label}-${entry.name}`} className="ui-group-row flex items-center justify-between gap-3 px-4 py-3">
                    <span className="ui-body font-medium">{entry.name}</span>
                    <span className="shrink-0 ui-caption text-muted-foreground">{entry.label}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <section>
            <p className="mb-2 px-1 ui-caption font-medium text-muted-foreground">{t("intro.firstUp")}</p>
            <div className="ui-group">
              <div className="ui-group-row px-4 py-3">
                <p className="ui-body font-medium">
                  {next.key === "today"
                    ? t("intro.firstUpToday", { title: next.title ?? "" })
                    : next.key === "on"
                      ? t("intro.firstUpOn", { title: next.title ?? "", day: next.day ?? "" })
                      : t("intro.nothingDue")}
                </p>
                {supplies > 0 ? (
                  <p className="mt-0.5 ui-caption text-muted-foreground num">{t("intro.supplies", { count: supplies })}</p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
        <SheetFooter className="pt-2">
          <Button className="h-12 w-full" onClick={onStart}>
            {t("intro.start")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
