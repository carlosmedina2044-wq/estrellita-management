import triggerSeed from "@/lib/weather/triggers.json";
import { tActive } from "@/i18n";
import { tTriggerName } from "@/i18n/content";
import { deriveClimate } from "@/lib/climate";
import { addDays, parseISODate, startOfDay, toISODate } from "@/lib/dates";
import { attributesMatch, dutyFromPlaybookTask, type Playbook, type PlaybookTaskDef } from "@/lib/playbooks";
import type { ClimateZone, HomeAttributes, HomeLocation, Household, WeatherFire } from "@/lib/types";

export type WeatherMetric = "tempMinF" | "tempMaxF" | "windMph" | "precipIn";

export type DailyWeather = {
  date: string;
  tempMinF: number;
  tempMaxF: number;
  windMph: number;
  precipIn: number;
  condition?: string;
  precipChance?: number;
};

export type WeatherForecast = {
  days: DailyWeather[];
  fetchedAt: string;
  current?: { condition: string; cloudCover: number; isDaylight: boolean };
};

/**
 * Zone-relative thresholds: heat and freeze feel different by climate.
 * hard-freeze is excluded from cold (hoses already drained / plants gone);
 * deep-freeze is cold-only for pipe-protection tasks.
 */
export type WeatherTrigger = {
  id: string;
  name: string;
  condition: {
    metric: WeatherMetric;
    op: "<" | ">" | ">=";
    value: number;
    withinDays: number;
    byZone?: Partial<Record<ClimateZone, number>>;
  };
  climateZones?: ClimateZone[];
  requires?: Partial<HomeAttributes>;
  cooldownDays: number;
  tasks: PlaybookTaskDef[];
};

/** Zone rationale for thresholds lives in the JSDoc on WeatherTrigger above. */
export const WEATHER_TRIGGERS = triggerSeed as WeatherTrigger[];

export interface WeatherProvider {
  fetchForecast(lat: number, lng: number): Promise<WeatherForecast>;
}

/** Test/web stand-in. Production iOS uses WeatherKitProvider. */
export class MockWeatherProvider implements WeatherProvider {
  constructor(private readonly forecast: WeatherForecast) {}

  async fetchForecast(lat: number, lng: number): Promise<WeatherForecast> {
    void lat;
    void lng;
    return this.forecast;
  }
}

export function metricValue(day: DailyWeather, metric: WeatherMetric): number {
  switch (metric) {
    case "tempMinF":
      return day.tempMinF;
    case "tempMaxF":
      return day.tempMaxF;
    case "windMph":
      return day.windMph;
    case "precipIn":
      return day.precipIn;
  }
}

export function triggerAppliesInZone(trigger: WeatherTrigger, zone: ClimateZone): boolean {
  if (!trigger.climateZones || trigger.climateZones.length === 0) return true;
  return trigger.climateZones.includes(zone);
}

export function conditionHits(
  trigger: WeatherTrigger,
  forecast: WeatherForecast,
  now = new Date(),
  zone?: ClimateZone,
): DailyWeather | null {
  // Forecast dates are yyyy-MM-dd calendar days: parse them LOCALLY. Date.parse would
  // read them as UTC midnight, which is the prior evening west of Greenwich and drops today.
  const start = startOfDay(now);
  const end = startOfDay(addDays(now, trigger.condition.withinDays));
  const window = forecast.days.filter((day) => {
    const time = parseISODate(day.date);
    if (Number.isNaN(time)) return false;
    return time >= start && time <= end;
  });
  const target = (zone && trigger.condition.byZone?.[zone]) ?? trigger.condition.value;
  for (const day of window) {
    const value = metricValue(day, trigger.condition.metric);
    const hit =
      trigger.condition.op === "<"
        ? value < target
        : trigger.condition.op === ">"
          ? value > target
          : value >= target;
    if (hit) return day;
  }
  return null;
}

export function onCooldown(trigger: WeatherTrigger, fires: WeatherFire[], now = new Date()): boolean {
  const last = fires
    .filter((item) => item.triggerId === trigger.id)
    .sort((a, b) => b.firedAt.localeCompare(a.firedAt))[0];
  if (!last) return false;
  const elapsed = (now.getTime() - Date.parse(last.firedAt)) / 86_400_000;
  return elapsed < trigger.cooldownDays;
}

export function evaluateTriggers(
  household: Pick<Household, "attributes" | "weatherFires" | "rooms" | "assets" | "duties" | "location"> &
    Partial<Pick<Household, "completions">>,
  forecast: WeatherForecast,
  now = new Date(),
): { duties: Array<Omit<Household["duties"][number], "id" | "createdAt">>; fires: WeatherFire[] } {
  const zone = deriveClimate(household.location);
  const duties: Array<Omit<Household["duties"][number], "id" | "createdAt">> = [];
  const fires: WeatherFire[] = [];
  const completedDutyIds = new Set((household.completions ?? []).map((item) => item.dutyId));
  for (const trigger of WEATHER_TRIGGERS) {
    if (!triggerAppliesInZone(trigger, zone)) continue;
    if (!attributesMatch(trigger.requires, household.attributes)) continue;
    if (onCooldown(trigger, household.weatherFires, now)) continue;
    const day = conditionHits(trigger, forecast, now, zone);
    if (!day) continue;
    const playbook: Playbook = {
      id: trigger.id,
      name: trigger.name,
      season: "any",
      climateZones: "all",
      tasks: trigger.tasks,
    };
    for (const task of trigger.tasks) {
      // A live duty blocks a repeat; a completed one-off does not, so the next freeze
      // of the winter re-creates the job (mirrors liveDuties in duty-topics).
      const already = household.duties.some((duty) => {
        if (duty.weatherTriggerId !== trigger.id || duty.title !== task.title) return false;
        if (duty.archived) return false;
        if (duty.frequency === "once") return !completedDutyIds.has(duty.id);
        return true;
      });
      if (already) continue;
      duties.push({
        ...dutyFromPlaybookTask(household, playbook, task, day.date, "weather"),
        weatherTriggerId: trigger.id,
        notes: `${task.description ?? ""} Forecast: ${trigger.name} on ${day.date}`.trim(),
      });
    }
    fires.push({ triggerId: trigger.id, firedAt: now.toISOString() });
  }
  return { duties, fires };
}

export function weatherLine(forecast: WeatherForecast | null, fallback?: string): string {
  const today = forecast?.days[0];
  if (!today) return fallback ?? tActive("weather.addZip");
  const bits = [tActive("weather.tempToday", { n: Math.round(today.tempMaxF) })];
  if (today.precipIn > 0.5) bits.push(tActive("weather.rain"));
  return bits.join(" · ");
}

export function weatherCaption(
  forecast: WeatherForecast | null,
  location: HomeLocation,
): { text: string; needsZip: boolean } {
  const today = forecast?.days[0];
  if (today) return { text: weatherLine(forecast), needsZip: false };
  if (location.placeName && location.postalCode) {
    return { text: location.placeName, needsZip: false };
  }
  if (location.postalCode) {
    return {
      text: location.placeName || location.postalCode,
      needsZip: false,
    };
  }
  return { text: tActive("weather.addZip"), needsZip: true };
}

export type WeatherWatchItem = {
  trigger: WeatherTrigger;
  hitDay: DailyWeather | null;
  recentlyFired: boolean;
};

export function weatherWatch(
  forecast: WeatherForecast | null,
  household: Pick<Household, "attributes" | "weatherFires" | "location">,
  now: Date = new Date(),
): { active: WeatherWatchItem[]; watching: string[] } {
  const zone = deriveClimate(household.location);
  const applicable = WEATHER_TRIGGERS.filter(
    (trigger) => triggerAppliesInZone(trigger, zone) && attributesMatch(trigger.requires, household.attributes),
  );
  const watching = applicable.map((trigger) => tTriggerName(trigger.id, trigger.name));
  const active: WeatherWatchItem[] = [];
  for (const trigger of applicable) {
    const hitDay = forecast ? conditionHits(trigger, forecast, now, zone) : null;
    const recentlyFired = onCooldown(trigger, household.weatherFires, now);
    if (!hitDay && !recentlyFired) continue;
    active.push({ trigger, hitDay, recentlyFired });
  }
  active.sort((a, b) => {
    if (a.hitDay && b.hitDay) return a.hitDay.date.localeCompare(b.hitDay.date);
    if (a.hitDay) return -1;
    if (b.hitDay) return 1;
    return 0;
  });
  return { active, watching };
}

export function todayISOFromForecast(forecast: WeatherForecast): string {
  return forecast.days[0]?.date ?? toISODate(new Date());
}
