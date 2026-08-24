import triggerSeed from "@/lib/weather/triggers.json";
import { climateLabel, deriveClimate } from "@/lib/climate";
import { addDays, toISODate } from "@/lib/dates";
import { attributesMatch, dutyFromPlaybookTask, resolvePlaybookTarget, type Playbook, type PlaybookTaskDef } from "@/lib/playbooks";
import type { HomeAttributes, HomeLocation, Household, WeatherFire } from "@/lib/types";

export type WeatherMetric = "tempMinF" | "tempMaxF" | "windMph" | "precipIn" | "aqi" | "dustAdvisory";

export type DailyWeather = {
  date: string;
  tempMinF: number;
  tempMaxF: number;
  windMph: number;
  precipIn: number;
  aqi?: number;
  dustAdvisory?: boolean;
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

function cToF(celsius: number): number {
  return (celsius * 9) / 5 + 32;
}

function mmToIn(mm: number): number {
  return mm / 25.4;
}

export class OpenMeteoProvider implements WeatherProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async fetchForecast(lat: number, lng: number): Promise<WeatherForecast> {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "7");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
      const payload = (await response.json()) as {
        daily?: {
          time?: string[];
          temperature_2m_max?: number[];
          temperature_2m_min?: number[];
          precipitation_sum?: number[];
          wind_speed_10m_max?: number[];
        };
      };
      const daily = payload.daily;
      if (!daily?.time?.length) throw new Error("Weather payload missing daily data");
      const days: DailyWeather[] = daily.time.map((date, index) => ({
        date,
        tempMaxF: cToF(daily.temperature_2m_max?.[index] ?? 0),
        tempMinF: cToF(daily.temperature_2m_min?.[index] ?? 0),
        precipIn: mmToIn(daily.precipitation_sum?.[index] ?? 0),
        windMph: daily.wind_speed_10m_max?.[index] ?? 0,
      }));
      return { days, fetchedAt: new Date().toISOString() };
    } finally {
      clearTimeout(timer);
    }
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
    case "aqi":
      return day.aqi ?? 0;
    case "dustAdvisory":
      return day.dustAdvisory ? 1 : 0;
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
  if (today.dustAdvisory) bits.push("dust advisory");
  if ((today.aqi ?? 0) > 150) bits.push("poor air");
  if (today.precipIn > 0.5) bits.push("rain");
  return bits.join(" · ");
}

export function weatherCaption(
  forecast: WeatherForecast | null,
  location: HomeLocation,
): { text: string; needsZip: boolean } {
  const today = forecast?.days[0];
  if (today) return { text: weatherLine(forecast), needsZip: false };
  if (location.postalCode) {
    return {
      text: `${climateLabel(deriveClimate(location))} · ZIP ${location.postalCode}`,
      needsZip: false,
    };
  }
  return { text: "Add your ZIP for weather", needsZip: true };
}

export function todayISOFromForecast(forecast: WeatherForecast): string {
  return forecast.days[0]?.date ?? toISODate(new Date());
}
