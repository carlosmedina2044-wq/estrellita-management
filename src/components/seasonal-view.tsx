"use client";

import { useEffect, useState } from "react";
import { getActiveAppLocale, localeDateTag, tActive, type MessageKey } from "@/i18n";
import { tDutyTitle, tPlaybookName, tPlaybookWhy, tTriggerName } from "@/i18n/content";
import { useLocale } from "@/i18n/locale-provider";
import { splitPlaybookTasks } from "@/lib/duty-topics";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ZipSheet } from "@/components/zip-prompt";
import { climateLabel, deriveClimate } from "@/lib/climate";
import { metricValue, weatherWatch, type WeatherForecast, type WeatherWatchItem } from "@/lib/weather/provider";
import { parseISODate } from "@/lib/dates";
import { scrollBehavior } from "@/lib/motion";
import {
  matchingPlaybooks,
  monthInWindow,
  PLAYBOOKS,
  playbookProgress,
  seasonYearFor,
  seasonalTimeline,
  windowFor,
  type Playbook,
  type TimelineEntryState,
  type WindowState,
} from "@/lib/playbooks";
import { AppleWeatherAttribution } from "@/components/apple-weather-attribution";
import type { WeatherAttribution } from "@/lib/native/weatherkit";
import type { Household } from "@/lib/types";

const CHIP = "rounded-full px-2 py-0.5 ui-caption font-medium";

const ATTRIBUTE_TOGGLES = [
  ["hasPool", "seasonal.feature.pool"],
  ["hasIrrigation", "seasonal.feature.irrigation"],
  ["hasGutters", "seasonal.feature.gutters"],
  ["hasFireplace", "seasonal.feature.fireplace"],
  ["hasBasement", "seasonal.feature.basement"],
  ["hasEvaporativeCooler", "seasonal.feature.swamp"],
] as const satisfies ReadonlyArray<
  readonly [
    "hasPool" | "hasIrrigation" | "hasGutters" | "hasFireplace" | "hasBasement" | "hasEvaporativeCooler",
    MessageKey,
  ]
>;

function joinWatching(names: string[]): string {
  const lower = names.map((name) => name.toLowerCase());
  if (lower.length === 0) return "";
  if (lower.length === 1) return lower[0];
  if (lower.length === 2) return tActive("seasonal.listAnd", { a: lower[0], b: lower[1] });
  return tActive("seasonal.listAndMany", {
    list: lower.slice(0, -1).join(", "),
    last: lower[lower.length - 1],
  });
}

function hitMetricLine(item: WeatherWatchItem): string | null {
  if (!item.hitDay) return null;
  const metric = item.trigger.condition.metric;
  const n = Math.round(metricValue(item.hitDay, metric));
  if (metric === "tempMinF") return tActive("seasonal.lowOf", { n });
  if (metric === "tempMaxF") return tActive("seasonal.highOf", { n });
  if (metric === "windMph") return tActive("seasonal.windsTo", { n });
  if (metric === "precipIn") return tActive("seasonal.precip", { n });
  return null;
}

function watchCaption(item: WeatherWatchItem): string {
  if (item.hitDay) {
    const weekday = new Date(parseISODate(item.hitDay.date)).toLocaleDateString(
      localeDateTag(getActiveAppLocale()),
      { weekday: "long" },
    );
    const metric = hitMetricLine(item);
    return metric ? tActive("seasonal.expectedMetric", { weekday, metric }) : tActive("seasonal.expected", { weekday });
  }
  return tActive("seasonal.firedWeek");
}

function stateChip(state: WindowState) {
  if (state === "get_ahead") return { label: tActive("seasonal.getAhead"), className: "bg-secondary text-muted-foreground" };
  if (state === "ideal") return { label: tActive("seasonal.idealTime"), className: "bg-primary/10 text-primary" };
  if (state === "late") return { label: tActive("seasonal.runningLate"), className: "bg-warning/15 text-warning" };
  return null;
}

function timelineChip(
  state: TimelineEntryState,
  progress: { done: number; total: number },
): { label: string; className: string } | null {
  if (state === "done") return { label: tActive("common.done"), className: "bg-success/15 text-success" };
  if (state === "in_progress") {
    return {
      label: tActive("seasonal.doneOf", { done: progress.done, total: progress.total }),
      className: "bg-primary/10 text-primary",
    };
  }
  if (state === "planned") return { label: tActive("seasonal.planned"), className: "bg-secondary" };
  if (state === "declined") return { label: tActive("seasonal.skipped"), className: "bg-secondary text-muted-foreground" };
  return null;
}

function attributeCaption(
  key: (typeof ATTRIBUTE_TOGGLES)[number][0],
  household: Household,
): string {
  const zone = deriveClimate(household.location);
  const n = PLAYBOOKS.filter((playbook) => {
    if (!playbook.requires || playbook.requires[key] !== true) return false;
    return playbook.climateZones === "all" || playbook.climateZones.includes(zone);
  }).length;
  if (n === 0) return tActive("seasonal.none");
  return n === 1 ? tActive("seasonal.countOne") : tActive("seasonal.countMany", { count: n });
}

function scrollToPlaybook(id: string) {
  document.getElementById(`seasonal-playbook-${id}`)?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
}

export function SeasonalView({
  household,
  weatherAttribution,
  forecast,
  weatherLine,
  needsZip,
  weatherError,
  onSavePostalCode,
  onAccept,
  onDecline,
  onReconsider,
  onToggleAttribute,
  onBack,
  backLabel = "Back to Today",
  focusPlaybookId,
}: {
  household: Household;
  weatherAttribution?: WeatherAttribution | null;
  forecast: WeatherForecast | null;
  weatherLine: string;
  needsZip?: boolean;
  onBack?: () => void;
  weatherError: string | null;
  onSavePostalCode?: (zip: string) => Promise<{ ok: boolean; error?: string }>;
  onAccept: (playbookId: string, titles?: string[]) => void;
  onDecline: (playbookId: string) => void;
  onReconsider: (playbookId: string) => void;
  onToggleAttribute: (
    key: "hasPool" | "hasIrrigation" | "hasGutters" | "hasFireplace" | "hasBasement" | "hasEvaporativeCooler",
  ) => void;
  backLabel?: string;
  focusPlaybookId?: string;
}) {
  const { t } = useLocale();
  const back = backLabel === "Back to Today" ? t("seasonal.backToday") : backLabel;
  const now = new Date();
  const suggested = matchingPlaybooks(household, now);
  const timeline = seasonalTimeline(household, now);
  const watch = weatherWatch(forecast, household, now);
  const [zipOpen, setZipOpen] = useState(false);
  const [attrsOpen, setAttrsOpen] = useState(false);
  const missingZip = needsZip ?? (!household.location.postalCode && household.location.lat == null);
  const zone = climateLabel(deriveClimate(household.location));
  const subtitle = missingZip || weatherLine.startsWith(zone) ? weatherLine : `${zone} · ${weatherLine}`;
  const showWeatherError = Boolean(weatherError) && !forecast;
  const showWatchingLine = watch.active.length === 0 && watch.watching.length > 0 && Boolean(forecast);

  useEffect(() => {
    if (!focusPlaybookId) return;
    scrollToPlaybook(focusPlaybookId);
  }, [focusPlaybookId]);

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div>
        <PageHeader title={t("seasonal.title")} subtitle={subtitle} onBack={onBack} backLabel={back} />
        {forecast ? (
          <AppleWeatherAttribution
            className="mt-1 ui-caption text-muted-foreground"
            attribution={weatherAttribution}
          />
        ) : null}
        {showWeatherError ? (
          <p className="mt-2 ui-caption text-muted-foreground">
            {t("seasonal.weatherRefreshFail")}
          </p>
        ) : null}
        {missingZip && onSavePostalCode ? (
          <button
            type="button"
            className="mt-3 w-full rounded-2xl bg-card px-4 py-4 text-left transition-transform duration-75 active:scale-[0.98]"
            onClick={() => setZipOpen(true)}
          >
            <p className="font-medium text-primary">{t("zip.addTitle")}</p>
            <p className="mt-1 ui-body text-muted-foreground">{t("seasonal.zipSame")}</p>
          </button>
        ) : null}
      </div>

      {watch.active.length > 0 ? (
        <ul className="grid gap-3">
          {watch.active.slice(0, 2).map((item) => (
            <li key={item.trigger.id} className="rounded-2xl bg-card px-4 py-4">
              <p className="ui-card font-medium">{tTriggerName(item.trigger.id, item.trigger.name)}</p>
              <p className="mt-1 ui-caption text-muted-foreground">{watchCaption(item)}</p>
            </li>
          ))}
        </ul>
      ) : showWatchingLine ? (
        <p className="ui-caption text-muted-foreground">
          {t("seasonal.watching", { list: joinWatching(watch.watching) })}
        </p>
      ) : null}

      <section>
        <h2 className="ui-heading ui-title font-semibold">{t("seasonal.doNow")}</h2>
        {suggested.length === 0 ? (
          <p className="mt-2 ui-caption text-muted-foreground">{t("seasonal.doNowEmpty")}</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {suggested.map((entry) => (
              <DoNowCard
                key={entry.playbook.id}
                playbook={entry.playbook}
                state={entry.state}
                decided={entry.decided}
                household={household}
                now={now}
                onAccept={onAccept}
                onDecline={onDecline}
                onReconsider={onReconsider}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="ui-heading ui-title font-semibold">{t("seasonal.yourYear")}</h2>
        <ul className="mt-3 grid gap-3">
          {timeline
            .filter((row) => row.entries.length > 0)
            .map((row) => {
              const isCurrent = row.month === now.getMonth() + 1 && row.year === now.getFullYear();
              return (
                <li key={`${row.year}-${row.month}`} className="flex gap-3">
                  <p className="w-14 shrink-0 ui-caption text-muted-foreground">{row.label}</p>
                  <ul className="min-w-0 flex-1 grid gap-2">
                    {row.entries.map((entry) => {
                      const window = windowFor(entry.playbook);
                      const open =
                        window != null && monthInWindow(now.getMonth() + 1, window);
                      const seasonYear = seasonYearFor(entry.playbook, new Date(row.year, row.month - 1, 15));
                      const progress = playbookProgress(household, entry.playbook.id, seasonYear);
                      const chip = timelineChip(entry.state, progress);
                      return (
                        <li key={entry.playbook.id}>
                          {open ? (
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 text-left"
                              onClick={() => scrollToPlaybook(entry.playbook.id)}
                            >
                              <span className={`ui-body ${isCurrent ? "font-medium" : ""}`}>
                                {tPlaybookName(entry.playbook.id, entry.playbook.name)}
                              </span>
                              {chip ? <span className={`${CHIP} ${chip.className}`}>{chip.label}</span> : null}
                            </button>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span className={`ui-body ${isCurrent ? "font-medium" : ""}`}>
                                {tPlaybookName(entry.playbook.id, entry.playbook.name)}
                              </span>
                              {chip ? <span className={`${CHIP} ${chip.className}`}>{chip.label}</span> : null}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
        </ul>
      </section>

      <button
        type="button"
        className="inline-flex min-h-11 items-center text-left ui-caption font-medium text-primary"
        onClick={() => setAttrsOpen(true)}
      >
        {t("seasonal.notSeeing")}
      </button>

      <Sheet open={attrsOpen} onOpenChange={setAttrsOpen}>
        <SheetContent side="bottom" className="gap-0 rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle className="ui-title">{t("seasonal.yourHome")}</SheetTitle>
          </SheetHeader>
          <div className="ui-group mx-4 mb-4">
            {ATTRIBUTE_TOGGLES.map(([key, labelKey]) => (
              <div key={key} className="ui-group-row flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="ui-body font-medium">{t(labelKey)}</p>
                  <p className="ui-caption text-muted-foreground">{attributeCaption(key, household)}</p>
                </div>
                <button
                  type="button"
                  aria-pressed={household.attributes[key]}
                  onClick={() => onToggleAttribute(key)}
                  className={
                    household.attributes[key]
                      ? "h-11 shrink-0 rounded-full bg-primary px-3 ui-caption font-medium text-primary-foreground"
                      : "h-11 shrink-0 rounded-full bg-secondary px-3 ui-caption font-medium"
                  }
                >
                  {household.attributes[key] ? t("seasonal.on") : t("seasonal.off")}
                </button>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {onSavePostalCode ? (
        <ZipSheet
          open={zipOpen}
          initialZip={household.location.postalCode}
          onOpenChange={setZipOpen}
          onSave={onSavePostalCode}
        />
      ) : null}
    </div>
  );
}

function DoNowCard({
  playbook,
  state,
  decided,
  household,
  now,
  onAccept,
  onDecline,
  onReconsider,
}: {
  playbook: Playbook;
  state: WindowState;
  decided: boolean;
  household: Household;
  now: Date;
  onAccept: (playbookId: string, titles?: string[]) => void;
  onDecline: (playbookId: string) => void;
  onReconsider: (playbookId: string) => void;
}) {
  const { t } = useLocale();
  const chip = stateChip(state);
  const progress = playbookProgress(household, playbook.id, seasonYearFor(playbook, now));
  const fraction = progress.total > 0 ? progress.done / progress.total : 0;
  // What Add would actually add. A task another list already covers (a
  // starter chore, an earlier playbook this season) is shown, but marked, so
  // the card never promises five things and delivers three.
  const coverage = splitPlaybookTasks(playbook.tasks, household.duties, household.completions);
  const covered = new Set(coverage.dropped.map((task) => task.title));
  const nothingToAdd = coverage.keep.length === 0;

  return (
    <li id={`seasonal-playbook-${playbook.id}`} className="rounded-2xl bg-card px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="ui-card font-medium">{tPlaybookName(playbook.id, playbook.name)}</p>
        {chip ? <span className={`${CHIP} shrink-0 ${chip.className}`}>{chip.label}</span> : null}
      </div>
      {playbook.why ? (
        <p className="mt-1 line-clamp-2 ui-caption text-muted-foreground">
          {tPlaybookWhy(playbook.id, playbook.why)}
        </p>
      ) : null}
      {decided && progress.total > 0 ? (
        <div className="mt-3">
          <p className="ui-caption text-muted-foreground">
            {t("seasonal.doneOfDone", { done: progress.done, total: progress.total })}
            {progress.nextTitle
              ? t("seasonal.nextTitle", { title: tDutyTitle(progress.nextTitle) })
              : ""}
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: `${Math.round(fraction * 100)}%` }} />
          </div>
        </div>
      ) : decided && progress.total === 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="ui-caption text-muted-foreground">{t("seasonal.skippedYear")}</p>
          <button type="button" className="inline-flex min-h-11 items-center ui-caption font-medium text-primary" onClick={() => onReconsider(playbook.id)}>
            {t("seasonal.reconsider")}
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-2 grid gap-1 ui-body text-muted-foreground">
            {playbook.tasks.map((task) => (
              <li key={task.title} className={covered.has(task.title) ? "text-muted-foreground/60" : undefined}>
                {tDutyTitle(task.title)}
                {covered.has(task.title) ? (
                  <span className="ml-1.5 ui-caption text-done">{t("seasonal.alreadyCovered")}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {nothingToAdd ? (
            <p className="mt-2 ui-caption text-muted-foreground">{t("seasonal.allCovered")}</p>
          ) : null}
          <div className="mt-3 flex items-center gap-2">
            {nothingToAdd ? null : (
              <Button
                className="h-9 flex-1 rounded-full bg-primary/12 text-primary shadow-none hover:bg-primary/18"
                variant="secondary"
                onClick={() => onAccept(playbook.id)}
              >
                {t("seasonal.addCompact")}
              </Button>
            )}
            <button
              type="button"
              className="inline-flex h-9 min-w-11 items-center justify-center rounded-full px-3 ui-caption font-medium text-muted-foreground active:bg-foreground/6"
              onClick={() => onDecline(playbook.id)}
            >
              {t("seasonal.skipCompact")}
            </button>
          </div>
        </>
      )}
    </li>
  );
}
