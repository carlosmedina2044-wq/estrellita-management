import { isValidUsZip, normalizeUsZip, roundCoord } from "@/lib/climate";
import { OpenMeteoProvider, type WeatherForecast } from "@/lib/weather/provider";
import type { HomeLocation } from "@/lib/types";

/**
 * Client-side weather. The app has no server: coordinates are rounded to two
 * decimals (about 1 km) before they leave the device, and only the rounded
 * value is sent to Open-Meteo. ZIP geocoding uses Zippopotam (ZIP only).
 */
export type ForecastResult = WeatherForecast & { lat: number; lng: number; postalCode?: string };

export async function geocodeUsZip(
  zip: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ lat: number; lng: number } | null> {
  const postalCode = normalizeUsZip(zip);
  if (!isValidUsZip(postalCode)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(`https://api.zippopotam.us/us/${postalCode}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { places?: Array<{ latitude?: string; longitude?: string }> };
    const place = payload.places?.[0];
    const lat = Number(place?.latitude);
    const lng = Number(place?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: roundCoord(lat), lng: roundCoord(lng) };
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
  const zip = location.postalCode ? normalizeUsZip(location.postalCode) : "";
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && isValidUsZip(zip)) {
    const coords = await geocodeUsZip(zip, fetchImpl);
    if (!coords) return null;
    lat = coords.lat;
    lng = coords.lng;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const forecast = await new OpenMeteoProvider(fetchImpl).fetchForecast(roundCoord(lat), roundCoord(lng));
  return { ...forecast, lat: roundCoord(lat), lng: roundCoord(lng), postalCode: zip || undefined };
}
