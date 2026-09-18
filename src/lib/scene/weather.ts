import type { WeatherForecast } from "@/lib/weather/provider";
import type { WeatherKind } from "@/lib/scene/sky";

export type SceneWeather = {
  kind: WeatherKind;
  cloudCover: number;
  precipIntensity: number;
  /** 0-1, from the day's wind in mph against a 25mph ceiling. The scene uses
   * it to set how hard the laundry and the trees move, so a blustery day looks
   * like one — the sway had a fixed period regardless of the forecast sitting
   * two lines above it. */
  wind: number;
  source: "native" | "derived";
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function kindFromCondition(condition: string | undefined): WeatherKind | null {
  if (!condition) return null;
  const c = condition.toLowerCase();
  if (c.includes("fog") || c.includes("haze")) return "fog";
  if (c.includes("snow") || c.includes("sleet") || c.includes("flurr") || c.includes("blizzard")) {
    return "snow";
  }
  if (c.includes("rain") || c.includes("drizzle") || c.includes("thunder")) return "rain";
  if (c.includes("cloudy") || c.includes("overcast")) return "cloudy";
  return "clear";
}

function todayDay(forecast: WeatherForecast | null, today: string) {
  return forecast?.days.find((day) => day.date === today) ?? forecast?.days[0] ?? null;
}

export function sceneWeather(forecast: WeatherForecast | null, today: string): SceneWeather {
  const current = forecast?.current;
  const day = todayDay(forecast, today);
  if (current) {
    const fromCurrent = kindFromCondition(current.condition);
    const fromDay = kindFromCondition(day?.condition);
    const kind = fromCurrent ?? fromDay ?? "clear";
    return {
      kind,
      cloudCover: clamp01(current.cloudCover),
      precipIntensity: clamp01((day?.precipIn ?? 0) / 0.5),
      wind: clamp01((day?.windMph ?? 0) / 25),
      source: "native",
    };
  }
  const precipIn = day?.precipIn ?? 0;
  const tempMaxF = day?.tempMaxF ?? 70;
  let kind: WeatherKind = "clear";
  if (precipIn >= 0.05 && tempMaxF <= 36) kind = "snow";
  else if (precipIn >= 0.05) kind = "rain";
  const cloudCover = kind === "clear" ? 0 : clamp01(precipIn * 4);
  return {
    kind,
    cloudCover,
    precipIntensity: clamp01(precipIn / 0.5),
    wind: clamp01((day?.windMph ?? 0) / 25),
    source: "derived",
  };
}
