import type { ClimateZone, HomeLocation } from "@/lib/types";

/**
 * Climate zone is derived from rounded lat/lng or US ZIP prefix.
 * Method: IECC-like bands plus a small ZIP prefix table for common metros.
 * Documented so Tucson vs Minneapolis matching can be tested without a vendor API.
 */
const ZIP_PREFIX: Record<string, ClimateZone> = {
  "85": "hot-arid",
  "86": "hot-arid",
  "89": "hot-arid",
  "87": "hot-arid",
  "55": "cold",
  "54": "cold",
  "53": "cold",
  "48": "cold",
  "49": "cold",
  "50": "cold",
  "56": "cold",
  "58": "cold",
  "03": "cold",
  "04": "cold",
  "30": "humid-subtropical",
  "31": "humid-subtropical",
  "32": "humid-subtropical",
  "33": "humid-subtropical",
  "70": "humid-subtropical",
  "77": "humid-subtropical",
  "98": "marine",
  "97": "marine",
};

export function normalizeUsZip(value: string): string {
  return value.replace(/\D/g, "").slice(0, 5);
}

export function isValidUsZip(value: string): boolean {
  return /^\d{5}$/.test(normalizeUsZip(value));
}

export function climateFromPostalCode(postalCode: string): ClimateZone | undefined {
  const digits = postalCode.replace(/\D/g, "");
  if (digits.length < 2) return undefined;
  return ZIP_PREFIX[digits.slice(0, 2)];
}

/** Persist a typed ZIP, re-derive climate, and keep any known coordinates. */
export function applyPostalCode(
  current: HomeLocation,
  postalCode: string,
  coords?: { lat: number; lng: number; placeName?: string },
): HomeLocation {
  const zip = normalizeUsZip(postalCode);
  const lat = coords?.lat ?? current.lat;
  const lng = coords?.lng ?? current.lng;
  const next: HomeLocation = {
    ...current,
    postalCode: zip || undefined,
    ...(typeof lat === "number" && typeof lng === "number"
      ? { lat: roundCoord(lat), lng: roundCoord(lng) }
      : {}),
    ...(coords?.placeName ? { placeName: coords.placeName } : {}),
  };
  next.climateZone = deriveClimate({ ...next, climateZone: undefined });
  return next;
}

export function climateFromCoords(lat: number, lng: number): ClimateZone {
  if (lat >= 42 && lng <= -121 && lng >= -125) return "marine";
  if (lat >= 31 && lat <= 37 && lng <= -109 && lng >= -116) return "hot-arid";
  if (lat >= 41 && lng <= -80 && lng >= -104) return "cold";
  if (lat >= 25 && lat <= 36 && lng <= -75 && lng >= -95) return "humid-subtropical";
  if (lat >= 40) return "cold";
  if (lat <= 33 && lng <= -110) return "hot-arid";
  return "mixed";
}

export function deriveClimate(location: HomeLocation): ClimateZone {
  if (location.postalCode) {
    const fromZip = climateFromPostalCode(location.postalCode);
    if (fromZip) return fromZip;
  }
  if (typeof location.lat === "number" && typeof location.lng === "number") {
    return climateFromCoords(location.lat, location.lng);
  }
  if (location.climateZone) return location.climateZone;
  return "mixed";
}

export function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

export function climateLabel(zone: ClimateZone): string {
  switch (zone) {
    case "hot-arid":
      return "Hot-arid";
    case "cold":
      return "Cold";
    case "humid-subtropical":
      return "Humid subtropical";
    case "marine":
      return "Marine / temperate";
    default:
      return "Mixed";
  }
}
