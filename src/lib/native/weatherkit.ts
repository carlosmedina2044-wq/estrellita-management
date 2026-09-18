import { registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/native/platform";
import { roundCoord } from "@/lib/climate";
import { sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";
import type { DailyWeather, WeatherForecast } from "@/lib/weather/provider";
import { weatherWatchList, type WeatherWatch } from "@/lib/weather/watch";
import type { Household } from "@/lib/types";

const FALLBACK_LEGAL = "https://weatherkit.apple.com/legal-attribution.html";

export type NativeWeatherForecast = {
  days: DailyWeather[];
  fetchedAt: string;
  current?: { condition: string; cloudCover: number; isDaylight: boolean };
};

export type NativeGeocodedZip = {
  lat: number;
  lng: number;
  placeName?: string;
};

export type WeatherAttribution = {
  legalPageURL: string;
  legalText: string;
  markLight: string;
  markDark: string;
};

type NativeWeatherKit = {
  fetchForecast(options: { latitude: number; longitude: number }): Promise<NativeWeatherForecast>;
  updateWatchList(options: WeatherWatch): Promise<void>;
  clearWatchList(): Promise<void>;
  geocodeZip(options: { postalCode: string }): Promise<NativeGeocodedZip>;
  reverseGeocode(options: { latitude: number; longitude: number }): Promise<{ placeName?: string }>;
  fetchAttribution(): Promise<WeatherAttribution>;
};

const plugin = registerPlugin<NativeWeatherKit>("CuidalaWeatherKit");

let attributionOverride: (() => Promise<WeatherAttribution | null>) | null = null;

/** Test hook — pass null to clear. */
export function installWeatherAttributionForTests(
  fetch: (() => Promise<WeatherAttribution | null>) | null,
): void {
  attributionOverride = fetch;
}

export async function weatherKitForecast(lat: number, lng: number): Promise<WeatherForecast> {
  if (!isNative()) throw new Error("WeatherKit is iOS-only");
  const result = await plugin.fetchForecast({ latitude: lat, longitude: lng });
  if (!result.days?.length) throw new Error("WeatherKit returned no days");
  return {
    fetchedAt: result.fetchedAt || new Date().toISOString(),
    days: result.days.map((day) => ({
      date: day.date,
      tempMinF: Number(day.tempMinF) || 0,
      tempMaxF: Number(day.tempMaxF) || 0,
      windMph: Number(day.windMph) || 0,
      precipIn: Number(day.precipIn) || 0,
      ...(typeof day.condition === "string" ? { condition: day.condition } : {}),
      ...(typeof day.precipChance === "number" ? { precipChance: day.precipChance } : {}),
    })),
    ...(result.current
      ? {
          current: {
            condition: String(result.current.condition ?? ""),
            cloudCover: Number(result.current.cloudCover) || 0,
            isDaylight: Boolean(result.current.isDaylight),
          },
        }
      : {}),
  };
}

export async function weatherKitGeocodeZip(postalCode: string): Promise<NativeGeocodedZip | null> {
  if (!isNative()) return null;
  try {
    const place = await plugin.geocodeZip({ postalCode });
    const lat = Number(place.lat);
    const lng = Number(place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat: roundCoord(lat),
      lng: roundCoord(lng),
      placeName: place.placeName,
    };
  } catch {
    return null;
  }
}

export async function weatherKitReverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  if (!isNative()) return undefined;
  try {
    const result = await plugin.reverseGeocode({ latitude: lat, longitude: lng });
    const name = sanitizeText(result.placeName, TEXT_LIMITS.name);
    return name || undefined;
  } catch {
    return undefined;
  }
}

export async function fetchWeatherAttribution(): Promise<WeatherAttribution | null> {
  if (attributionOverride) return attributionOverride();
  try {
    if (!isNative()) {
      return {
        legalPageURL: FALLBACK_LEGAL,
        legalText: "Apple Weather",
        markLight: "",
        markDark: "",
      };
    }
    const result = await plugin.fetchAttribution();
    return {
      legalPageURL: result.legalPageURL || FALLBACK_LEGAL,
      legalText: result.legalText || "Apple Weather",
      markLight: result.markLight || "",
      markDark: result.markDark || "",
    };
  } catch {
    return null;
  }
}

/**
 * Publishes the weather watch list for the native background refresh
 * (`WeatherRefresh.swift`). Plaintext by design, like the widget snapshot:
 * trigger thresholds, localised copy and coordinates rounded to two decimals.
 * No-op off native; a missing plugin method never breaks persist.
 */
export async function syncWeatherWatch(household: Household): Promise<void> {
  if (!isNative()) return;
  try {
    const watch = weatherWatchList(household);
    if (watch) await plugin.updateWatchList(watch);
    else await plugin.clearWatchList();
  } catch {
    // ignore
  }
}

export async function clearWeatherWatch(): Promise<void> {
  if (!isNative()) return;
  try {
    await plugin.clearWatchList();
  } catch {
    // ignore
  }
}

