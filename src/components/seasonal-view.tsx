"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ZipSheet } from "@/components/zip-prompt";
import { climateLabel, deriveClimate } from "@/lib/climate";
import { metricValue, weatherWatch, type WeatherForecast, type WeatherWatchItem } from "@/lib/weather/provider";
import { parseISODate } from "@/lib/dates";
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
import type { Household } from "@/lib/types";

const CHIP = "rounded-full px-2 py-0.5 text-[11px] font-medium";

const ATTRIBUTE_TOGGLES = [
  ["hasPool", "Pool"],
  ["hasIrrigation", "Irrigation"],
  ["hasGutters", "Gutters"],
  ["hasFireplace", "Fireplace"],
  ["hasBasement", "Basement"],
  ["hasEvaporativeCooler", "Swamp cooler"],
] as const;

function joinWatching(names: string[]): string {
  const lower = names.map((name) => name.toLowerCase());
  if (lower.length === 0) return "";
  if (lower.length === 1) return lower[0];
  if (lower.length === 2) return `${lower[0]} and ${lower[1]}`;
  return `${lower.slice(0, -1).join(", ")}, and ${lower[lower.length - 1]}`;
}

function hitMetricLine(item: WeatherWatchItem): string | null {
  if (!item.hitDay) return null;
  const metric = item.trigger.condition.metric;
  const n = Math.round(metricValue(item.hitDay, metric));
  if (metric === "tempMinF") return `Low of ${n}°F`;
  if (metric === "tempMaxF") return `High of ${n}°F`;
  if (metric === "windMph") return `Winds to ${n} mph`;
  if (metric === "precipIn") return `${n}" of rain`;
  return null;
}

function watchCaption(item: WeatherWatchItem): string {
  if (item.hitDay) {
    const weekday = new Date(parseISODate(item.hitDay.date)).toLocaleDateString("en-US", { weekday: "long" });
    const metric = hitMetricLine(item);
    return metric ? `Expected ${weekday} · ${metric}` : `Expected ${weekday}`;
  }
  return "Fired this week. Tasks were added to Today.";
}

function stateChip(state: WindowState) {
  if (state === "get_ahead") return { label: "Get ahead", className: "bg-secondary text-muted-foreground" };
  if (state === "ideal") return { label: "Ideal time", className: "bg-primary/10 text-primary" };
  if (state === "late") return { label: "Running late", className: "bg-warning/15 text-warning" };
  return null;
}

function timelineChip(
  state: TimelineEntryState,
  progress: { done: number; total: number },
): { label: string; className: string } | null {
  if (state === "done") return { label: "Done", className: "bg-success/15 text-success" };
  if (state === "in_progress") {
    return { label: `${progress.done} of ${progress.total}`, className: "bg-primary/10 text-primary" };
  }
  if (state === "planned") return { label: "Planned", className: "bg-secondary" };
  if (state === "declined") return { label: "Skipped", className: "bg-secondary text-muted-foreground" };
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
  if (n === 0) return "No seasonal tasks in your climate";
  return `${n} seasonal task${n === 1 ? "" : "s"}`;
}

function scrollToPlaybook(id: string) {
  document.getElementById(`seasonal-playbook-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function SeasonalView({
  household,
  forecast,
  weatherLine,
  needsZip,
  weatherError,
  onSavePostalCode,
  onAccept,
  onDecline,
  onReconsider,
  onToggleAttribute,
}: {
  household: Household;
  forecast: WeatherForecast | null;
  weatherLine: string;
  needsZip?: boolean;
  weatherError: string | null;
  onSavePostalCode?: (zip: string) => Promise<{ ok: boolean; error?: string }>;
  onAccept: (playbookId: string, titles?: string[]) => void;
  onDecline: (playbookId: string) => void;
  onReconsider: (playbookId: string) => void;
  onToggleAttribute: (
    key: "hasPool" | "hasIrrigation" | "hasGutters" | "hasFireplace" | "hasBasement" | "hasEvaporativeCooler",
  ) => void;
}) {
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

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div>
        <PageHeader title="Seasonal" subtitle={subtitle} />
        {forecast ? <AppleWeatherAttribution className="mt-1 text-[11px] text-muted-foreground" /> : null}
        {showWeatherError ? (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Couldn&apos;t refresh weather. Seasonal lists still work.
          </p>
        ) : null}
        {missingZip && onSavePostalCode ? (
          <button
            type="button"
            className="mt-3 w-full rounded-2xl bg-white px-4 py-4 text-left"
            onClick={() => setZipOpen(true)}
          >
            <p className="font-medium text-primary">Add your ZIP</p>
            <p className="mt-1 text-[15px] text-muted-foreground">
              We’ll use it for weather and which seasonal jobs apply here.
            </p>
          </button>
        ) : null}
      </div>

      {watch.active.length > 0 ? (
        <ul className="grid gap-3">
          {watch.active.slice(0, 2).map((item) => (
            <li key={item.trigger.id} className="rounded-2xl bg-card px-4 py-4">
              <p className="text-[17px] font-medium">{item.trigger.name}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{watchCaption(item)}</p>
            </li>
          ))}
        </ul>
      ) : showWatchingLine ? (
        <p className="text-[13px] text-muted-foreground">Watching your forecast for {joinWatching(watch.watching)}.</p>
      ) : null}

      <section>
        <h2 className="ui-heading text-[20px] font-semibold">Do now</h2>
        {suggested.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">Nothing needs starting right now. Your year is below.</p>
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
        <h2 className="ui-heading text-[20px] font-semibold">Your year</h2>
        <ul className="mt-3 grid gap-3">
          {timeline
            .filter((row) => row.entries.length > 0)
            .map((row) => {
              const isCurrent = row.month === now.getMonth() + 1 && row.year === now.getFullYear();
              return (
                <li key={`${row.year}-${row.month}`} className="flex gap-3">
                  <p className="w-14 shrink-0 text-[13px] text-muted-foreground">{row.label}</p>
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
                              <span className={`text-[15px] ${isCurrent ? "font-medium" : ""}`}>
                                {entry.playbook.name}
                              </span>
                              {chip ? <span className={`${CHIP} ${chip.className}`}>{chip.label}</span> : null}
                            </button>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[15px] ${isCurrent ? "font-medium" : ""}`}>
                                {entry.playbook.name}
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
        className="text-left text-[13px] font-medium text-primary"
        onClick={() => setAttrsOpen(true)}
      >
        Not seeing something? Tell us about your home
      </button>

      <Sheet open={attrsOpen} onOpenChange={setAttrsOpen}>
        <SheetContent side="bottom" className="gap-0 rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle className="text-[20px]">Your home</SheetTitle>
          </SheetHeader>
          <div className="ui-group mx-4 mb-4">
            {ATTRIBUTE_TOGGLES.map(([key, label]) => (
              <div key={key} className="ui-group-row flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-medium">{label}</p>
                  <p className="text-[13px] text-muted-foreground">{attributeCaption(key, household)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleAttribute(key)}
                  className={
                    household.attributes[key]
                      ? "h-10 shrink-0 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-foreground"
                      : "h-10 shrink-0 rounded-full bg-secondary px-3 text-[13px] font-medium"
                  }
                >
                  {label}
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
  const chip = stateChip(state);
  const progress = playbookProgress(household, playbook.id, seasonYearFor(playbook, now));
  const fraction = progress.total > 0 ? progress.done / progress.total : 0;

  return (
    <li id={`seasonal-playbook-${playbook.id}`} className="rounded-2xl bg-card px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[17px] font-medium">{playbook.name}</p>
        {chip ? <span className={`${CHIP} shrink-0 ${chip.className}`}>{chip.label}</span> : null}
      </div>
      {playbook.why ? (
        <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{playbook.why}</p>
      ) : null}
      {decided && progress.total > 0 ? (
        <div className="mt-3">
          <p className="text-[13px] text-muted-foreground">
            {progress.done} of {progress.total} done
            {progress.nextTitle ? ` · next: ${progress.nextTitle}` : ""}
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: `${Math.round(fraction * 100)}%` }} />
          </div>
        </div>
      ) : decided && progress.total === 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">Skipped this year.</p>
          <button type="button" className="text-[13px] font-medium text-primary" onClick={() => onReconsider(playbook.id)}>
            Reconsider
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-2 grid gap-1 text-[15px] text-muted-foreground">
            {playbook.tasks.map((task) => (
              <li key={task.title}>{task.title}</li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button className="h-10 flex-1" onClick={() => onAccept(playbook.id)}>
              Add to my year
            </Button>
            <Button variant="secondary" className="h-10 flex-1" onClick={() => onDecline(playbook.id)}>
              Skip this year
            </Button>
          </div>
        </>
      )}
    </li>
  );
}
