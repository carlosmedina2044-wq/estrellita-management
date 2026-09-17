import type { MessageKey } from "@/i18n";
import { tDutyTitle, tMonthName, tPlaybookName } from "@/i18n/content";
import { addDays, formatWeekdayDate, startOfDay } from "@/lib/dates";
import { completionsInRange } from "@/lib/duties";
import { dutyTopic } from "@/lib/duty-topics";
import { PLAYBOOKS, playbookApplies, seasonYearFor, windowFor } from "@/lib/playbooks";
import { seasonFor } from "@/lib/scene/season";
import { dayOfYear } from "@/lib/today-copy";
import type { Household } from "@/lib/types";
import { monthLedger } from "@/lib/value-ledger";
import type { WeatherForecast } from "@/lib/weather/provider";

export type HouseLineSource = "weather" | "season" | "anniversary" | "ledger" | "fact";

export type HouseLine = {
  source: HouseLineSource;
  key: MessageKey;
  params?: Record<string, string | number>;
};

const WEATHER_LOOKAHEAD_DAYS = 3;
const WINDOW_LOOKAHEAD_DAYS = 14;
const GUTTER_MEMORY_DAYS = 120;
const FACTS_PER_SEASON = 4;

function dayLabel(date: Date): string {
  return formatWeekdayDate(date);
}

function weatherCandidate(household: Household, forecast: WeatherForecast | null, now: Date): HouseLine | null {
  if (!forecast) return null;
  const from = startOfDay(now);
  const to = startOfDay(addDays(now, WEATHER_LOOKAHEAD_DAYS));
  for (const day of forecast.days) {
    const at = new Date(`${day.date}T12:00:00`);
    const stamp = startOfDay(at);
    if (Number.isNaN(stamp) || stamp < from || stamp > to) continue;
    const label = dayLabel(at);
    if (day.tempMinF < 32) {
      return household.attributes.hasYard
        ? { source: "weather", key: "houseLine.freezeHoses", params: { low: Math.round(day.tempMinF), day: label } }
        : { source: "weather", key: "houseLine.freeze", params: { low: Math.round(day.tempMinF), day: label } };
    }
    if (day.precipIn > 0.5) {
      if (household.attributes.hasGutters) {
        const cleared = lastGutterClearing(household, now);
        if (cleared) {
          return {
            source: "weather",
            key: "houseLine.rainGuttersKept",
            params: { day: label, month: tMonthName(cleared.getMonth()) },
          };
        }
        return { source: "weather", key: "houseLine.rainGutters", params: { day: label } };
      }
      return { source: "weather", key: "houseLine.rain", params: { day: label } };
    }
    if (day.tempMaxF >= 95) {
      return { source: "weather", key: "houseLine.heat", params: { high: Math.round(day.tempMaxF), day: label } };
    }
    if (day.windMph >= 30) {
      return { source: "weather", key: "houseLine.wind", params: { wind: Math.round(day.windMph), day: label } };
    }
  }
  return null;
}

function lastGutterClearing(household: Household, now: Date): Date | null {
  const since = addDays(now, -GUTTER_MEMORY_DAYS);
  let latest: Date | null = null;
  for (const item of completionsInRange(household.completions, since, now)) {
    const duty = household.duties.find((entry) => entry.id === item.dutyId);
    if (!duty || dutyTopic(duty) !== "gutters-clear") continue;
    const at = new Date(item.completedAt);
    if (!latest || at > latest) latest = at;
  }
  return latest;
}

/** Days from `now` to the next first-of-month for `month` (1-12), 0 when it is this month. */
function daysUntilMonthStart(month: number, now: Date): number {
  const current = now.getMonth() + 1;
  if (month === current) return 0;
  const year = month > current ? now.getFullYear() : now.getFullYear() + 1;
  const start = new Date(year, month - 1, 1);
  return Math.round((startOfDay(start) - startOfDay(now)) / 86_400_000);
}

function seasonCandidate(household: Household, now: Date): HouseLine | null {
  let best: { line: HouseLine; days: number } | null = null;
  for (const playbook of PLAYBOOKS) {
    if (!playbookApplies(playbook, household)) continue;
    const window = windowFor(playbook);
    if (!window) continue;
    const year = seasonYearFor(playbook, now);
    const decided = household.playbookDecisions.some(
      (item) => item.playbookId === playbook.id && item.year === year,
    );
    if (decided) continue;
    const name = tPlaybookName(playbook.id, playbook.name);
    const toIdeal = daysUntilMonthStart(window.ideal, now);
    if (toIdeal === 0) {
      const line: HouseLine = { source: "season", key: "houseLine.windowIdeal", params: { name } };
      if (!best || best.days > 0) best = { line, days: 0 };
      continue;
    }
    const toEarly = daysUntilMonthStart(window.early, now);
    if (toEarly > 0 && toEarly <= WINDOW_LOOKAHEAD_DAYS && (!best || toEarly < best.days)) {
      best = { line: { source: "season", key: "houseLine.windowOpens", params: { name, days: toEarly } }, days: toEarly };
    }
  }
  return best?.line ?? null;
}

function anniversaryCandidate(household: Household, now: Date): HouseLine | null {
  const from = addDays(now, -372);
  const to = addDays(now, -358);
  let latest: { at: Date; title: string } | null = null;
  for (const item of completionsInRange(household.completions, from, to)) {
    const duty = household.duties.find((entry) => entry.id === item.dutyId);
    if (!duty) continue;
    const at = new Date(item.completedAt);
    if (!latest || at > latest.at) latest = { at, title: duty.title };
  }
  if (!latest) return null;
  return { source: "anniversary", key: "houseLine.anniversary", params: { title: tDutyTitle(latest.title) } };
}

function ledgerCandidate(household: Household, now: Date): HouseLine | null {
  const dayOfMonth = now.getDate();
  if (dayOfMonth !== 1 && dayOfMonth !== 15) return null;
  const ledger = monthLedger(household, now);
  if (ledger.count === 0) return null;
  if (ledger.hours >= 1) return { source: "ledger", key: "houseLine.ledgerHours", params: { hours: ledger.hours } };
  return { source: "ledger", key: "houseLine.ledgerMinutes", params: { minutes: ledger.minutes } };
}

function factCandidate(household: Household, now: Date): HouseLine {
  const lat = household.location.lat ?? null;
  const season = seasonFor(now, lat);
  const index = (dayOfYear(now) % FACTS_PER_SEASON) + 1;
  return { source: "fact", key: `houseLine.fact.${season}${index}` as MessageKey };
}

/** Every line the day could carry, best first. The fact pool is always last and never empty. */
export function houseLineCandidates(
  household: Household,
  forecast: WeatherForecast | null,
  now: Date,
): HouseLine[] {
  const out: HouseLine[] = [];
  const weather = weatherCandidate(household, forecast, now);
  if (weather) out.push(weather);
  const season = seasonCandidate(household, now);
  if (season) out.push(season);
  const anniversary = anniversaryCandidate(household, now);
  if (anniversary) out.push(anniversary);
  const ledger = ledgerCandidate(household, now);
  if (ledger) out.push(ledger);
  out.push(factCandidate(household, now));
  return out;
}

/**
 * One sentence a day from the house, drawn from real data: the forecast, the
 * seasonal calendar, what was done a year ago, the month's ledger, or a
 * short house fact keyed by season. Deterministic for a given day. When the
 * same source would headline two days running (a rainy week, a month-long
 * seasonal window) it speaks on alternate days and the other voices take
 * turns in between, so the line is never the same twice in a row and no
 * source becomes wallpaper.
 */
export function houseLine(household: Household, forecast: WeatherForecast | null, now: Date): HouseLine {
  const today = houseLineCandidates(household, forecast, now);
  const yesterdayTop = houseLineCandidates(household, forecast, addDays(now, -1))[0]?.source;
  if (today[0].source !== yesterdayTop) return today[0];
  const others = today.slice(1);
  if (others.length === 0) return today[0];
  const day = dayOfYear(now);
  if (day % 2 === 0) return today[0];
  return others[(day >> 1) % others.length];
}

/** Stable per-day identity, for tests and for "don't show the same line twice" checks. */
export function houseLineId(line: HouseLine): string {
  return `${line.key}:${JSON.stringify(line.params ?? {})}`;
}

