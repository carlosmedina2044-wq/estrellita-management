import { isValidUsZip, normalizeUsZip, roundCoord } from "@/lib/climate";
import { weatherKitForecast, weatherKitGeocodeZip } from "@/lib/native/weatherkit";
import { sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";
import type { WeatherForecast, WeatherProvider } from "@/lib/weather/provider";
import type { HomeLocation } from "@/lib/types";

/**
 * Client-side weather via Apple WeatherKit (native plugin). There is no server
 * and no third-party forecast vendor. ZIP geocoding uses Apple CLGeocoder.
 * Coordinates are rounded to two decimals before they are stored.
 */
export type GeocodedPlace = { lat: number; lng: number; placeName?: string };
export type ForecastResult = WeatherForecast & GeocodedPlace & { postalCode?: string };

export const APPLE_WEATHER_ATTRIBUTION = {
  mark: "Apple Weather",
  href: "https://weatherkit.apple.com/legal-attribution.html",
} as const;

type WeatherIO = {
  fetchForecast: (lat: number, lng: number) => Promise<WeatherForecast>;
  geocodeZip: (postalCode: string) => Promise<GeocodedPlace | null>;
};

const defaultIO = (): WeatherIO => ({
  fetchForecast: weatherKitForecast,
  geocodeZip: weatherKitGeocodeZip,
});

let io: WeatherIO = defaultIO();

/** Test-only: swap weather adapters. Pass null to restore production IO. */
export function installWeatherIOForTests(next: Partial<WeatherIO> | null) {
  io = next ? { ...defaultIO(), ...next } : defaultIO();
}

export class WeatherKitProvider implements WeatherProvider {
  constructor(private readonly fetchImpl: WeatherIO["fetchForecast"] = (lat, lng) => io.fetchForecast(lat, lng)) {}

  fetchForecast(lat: number, lng: number): Promise<WeatherForecast> {
    return this.fetchImpl(lat, lng);
  }
}

export async function geocodeUsZip(
  zip: string,
  geocodeImpl: WeatherIO["geocodeZip"] = (postalCode) => io.geocodeZip(postalCode),
): Promise<GeocodedPlace | null> {
  const postalCode = normalizeUsZip(zip);
  if (!isValidUsZip(postalCode)) return null;
  try {
    const place = await geocodeImpl(postalCode);
    if (!place) return null;
    const lat = roundCoord(place.lat);
    const lng = roundCoord(place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const city = sanitizeText(place.placeName, TEXT_LIMITS.name);
    return { lat, lng, placeName: city || undefined };
  } catch {
    return null;
  }
}

export async function fetchForecastFor(
  location: Pick<HomeLocation, "lat" | "lng" | "postalCode">,
  fetchImpl: WeatherIO["fetchForecast"] = (lat, lng) => io.fetchForecast(lat, lng),
): Promise<ForecastResult | null> {
  let lat = typeof location.lat === "number" ? location.lat : Number.NaN;
  let lng = typeof location.lng === "number" ? location.lng : Number.NaN;
  let placeName: string | undefined;
  const zip = location.postalCode ? normalizeUsZip(location.postalCode) : "";
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && isValidUsZip(zip)) {
    const coords = await geocodeUsZip(zip);
    if (!coords) return null;
    lat = coords.lat;
    lng = coords.lng;
    placeName = coords.placeName;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const forecast = await new WeatherKitProvider(fetchImpl).fetchForecast(roundCoord(lat), roundCoord(lng));
  return {
    ...forecast,
    lat: roundCoord(lat),
    lng: roundCoord(lng),
    postalCode: zip || undefined,
    placeName,
  };
}
