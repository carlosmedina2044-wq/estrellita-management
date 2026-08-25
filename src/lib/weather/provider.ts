import triggerSeed from "@/lib/weather/triggers.json";
import { climateLabel, deriveClimate } from "@/lib/climate";
import { addDays, toISODate } from "@/lib/dates";
import { attributesMatch, dutyFromPlaybookTask, resolvePlaybookTarget, type Playbook, type PlaybookTaskDef } from "@/lib/playbooks";
import type { HomeAttributes, HomeLocation, Household, WeatherFire } from "@/lib/types";

export type WeatherMetric = "tempMinF" | "tempMaxF" | "windMph" | "precipIn";

export type DailyWeather = {
  date: string;
  tempMinF: number;
  tempMaxF: number;
  windMph: number;
  precipIn: number;
};

export type WeatherForecast = {
  days: DailyWeather[];
  fetchedAt: string;
};

export type WeatherTrigger = {
  id: string;
  name: string;
  condition: { metric: WeatherMetric; op: "<" | ">" | ">="; value: number; withinDays: number };
  requires?: Partial<HomeAttributes>;
  cooldownDays: number;
  tasks: PlaybookTaskDef[];
};

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

export function conditionHits(trigger: WeatherTrigger, forecast: WeatherForecast, now = new Date()): DailyWeather | null {
  const window = forecast.days.filter((day) => {
    const time = Date.parse(day.date);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = addDays(now, trigger.condition.withinDays).getTime();
    return time >= start && time <= end;
  });
  for (const day of window) {
    const value = metricValue(day, trigger.condition.metric);
    const target = trigger.condition.value;
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
  household: Pick<Household, "attributes" | "weatherFires" | "rooms" | "assets" | "duties">,
  forecast: WeatherForecast,
  now = new Date(),
): { duties: Array<Omit<Household["duties"][number], "id" | "createdAt">>; fires: WeatherFire[] } {
  const duties: Array<Omit<Household["duties"][number], "id" | "createdAt">> = [];
  const fires: WeatherFire[] = [];
  for (const trigger of WEATHER_TRIGGERS) {
    if (!attributesMatch(trigger.requires, household.attributes)) continue;
    if (onCooldown(trigger, household.weatherFires, now)) continue;
    const day = conditionHits(trigger, forecast, now);
    if (!day) continue;
    const playbook: Playbook = {
      id: trigger.id,
      name: trigger.name,
      season: "any",
      climateZones: "all",
      tasks: trigger.tasks,
    };
    for (const task of trigger.tasks) {
      const already = household.duties.some(
        (duty) => duty.weatherTriggerId === trigger.id && duty.title === task.title && !duty.archived,
      );
      if (already) continue;
      duties.push({
        ...dutyFromPlaybookTask(household, playbook, task, day.date, "weather"),
        weatherTriggerId: trigger.id,
        notes: `${task.description ?? ""} Forecast: ${trigger.name} on ${day.date}`.trim(),
      });
      void resolvePlaybookTarget;
    }
    fires.push({ triggerId: trigger.id, firedAt: now.toISOString() });
  }
  return { duties, fires };
}

export function weatherLine(forecast: WeatherForecast | null, fallback = "Add your ZIP for weather"): string {
  const today = forecast?.days[0];
  if (!today) return fallback;
  const bits = [`${Math.round(today.tempMaxF)}° today`];
  if (today.precipIn > 0.5) bits.push("rain");
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
      text: climateLabel(deriveClimate(location)),
      needsZip: false,
    };
  }
  return { text: "Add your ZIP for weather", needsZip: true };
}

export type WeatherWatchItem = {
  trigger: WeatherTrigger;
  hitDay: DailyWeather | null;
  recentlyFired: boolean;
};

export function weatherWatch(
  forecast: WeatherForecast | null,
  household: Pick<Household, "attributes" | "weatherFires">,
  now: Date = new Date(),
): { active: WeatherWatchItem[]; watching: string[] } {
  const applicable = WEATHER_TRIGGERS.filter((trigger) =>
    attributesMatch(trigger.requires, household.attributes),
  );
  const watching = applicable.map((trigger) => trigger.name);
  const active: WeatherWatchItem[] = [];
  for (const trigger of applicable) {
    const hitDay = forecast ? conditionHits(trigger, forecast, now) : null;
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
