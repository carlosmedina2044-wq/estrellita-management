import { isValidUsZip, normalizeUsZip, roundCoord } from "@/lib/climate";
import { OpenMeteoProvider, type WeatherForecast } from "@/lib/weather/provider";
import { sanitizeText, TEXT_LIMITS } from "@/lib/sanitize";
import type { HomeLocation } from "@/lib/types";

/**
 * Client-side weather. The app has no server: coordinates are rounded to two
 * decimals (about 1 km) before they leave the device. ZIP geocoding and
 * forecasts both go to Open-Meteo — one vendor, no identifier attached.
 */
export type GeocodedPlace = { lat: number; lng: number; placeName?: string };
export type ForecastResult = WeatherForecast & GeocodedPlace & { postalCode?: string };

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

export async function geocodeUsZip(
  zip: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeocodedPlace | null> {
  const postalCode = normalizeUsZip(zip);
  if (!isValidUsZip(postalCode)) return null;
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("name", postalCode);
  url.searchParams.set("country", "US");
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      results?: Array<{ name?: string; admin1?: string; latitude?: number; longitude?: number }>;
    };
    const place = payload.results?.[0];
    const lat = Number(place?.latitude);
    const lng = Number(place?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const city = sanitizeText(place?.name, TEXT_LIMITS.name);
    return { lat: roundCoord(lat), lng: roundCoord(lng), placeName: city || undefined };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchForecastFor(
  location: Pick<HomeLocation, "lat" | "lng" | "postalCode">,
  fetchImpl: typeof fetch = fetch,
): Promise<ForecastResult | null> {
  let lat = typeof location.lat === "number" ? location.lat : Number.NaN;
  let lng = typeof location.lng === "number" ? location.lng : Number.NaN;
  let placeName: string | undefined;
  const zip = location.postalCode ? normalizeUsZip(location.postalCode) : "";
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && isValidUsZip(zip)) {
    const coords = await geocodeUsZip(zip, fetchImpl);
    if (!coords) return null;
    lat = coords.lat;
    lng = coords.lng;
    placeName = coords.placeName;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const forecast = await new OpenMeteoProvider(fetchImpl).fetchForecast(roundCoord(lat), roundCoord(lng));
  return {
    ...forecast,
    lat: roundCoord(lat),
    lng: roundCoord(lng),
    postalCode: zip || undefined,
    placeName,
  };
}
