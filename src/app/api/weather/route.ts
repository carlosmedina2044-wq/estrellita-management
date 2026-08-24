import { isValidUsZip, normalizeUsZip } from "@/lib/climate";
import { json } from "@/lib/http";
import { logEvent } from "@/lib/logger";
import { geocodeUsZip } from "@/lib/weather/geocode";
import { OpenMeteoProvider } from "@/lib/weather/provider";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const zip = normalizeUsZip(url.searchParams.get("zip") ?? "");
  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");
  let lat = latParam != null && latParam !== "" ? Number(latParam) : Number.NaN;
  let lng = lngParam != null && lngParam !== "" ? Number(lngParam) : Number.NaN;
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && isValidUsZip(zip)) {
    const coords = await geocodeUsZip(zip);
    if (!coords) return json({ error: "Unknown ZIP" }, 400);
    lat = coords.lat;
    lng = coords.lng;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: "lat and lng or a 5-digit ZIP required" }, 400);
  }
  try {
    const forecast = await new OpenMeteoProvider().fetchForecast(lat, lng);
    return json({ ...forecast, lat, lng, postalCode: zip || undefined });
  } catch (error) {
    logEvent("weather.fail", { message: error instanceof Error ? error.message : "fetch-failed" });
    return json({ error: "Weather unavailable", degraded: true }, 503);
  }
}
