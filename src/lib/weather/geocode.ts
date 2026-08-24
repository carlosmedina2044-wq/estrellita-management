import { isValidUsZip, normalizeUsZip, roundCoord } from "@/lib/climate";

export async function geocodeUsZip(
  zip: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ lat: number; lng: number } | null> {
  const postalCode = normalizeUsZip(zip);
  if (!isValidUsZip(postalCode)) return null;
  try {
    const response = await fetchImpl(`https://api.zippopotam.us/us/${postalCode}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      places?: Array<{ latitude?: string; longitude?: string }>;
    };
    const place = payload.places?.[0];
    const lat = Number(place?.latitude);
    const lng = Number(place?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: roundCoord(lat), lng: roundCoord(lng) };
  } catch {
    return null;
  }
}
