export type SunTimes = { sunrise: Date; sunset: Date; solarNoon: Date };

export const FALLBACK_SUN = { sunriseMinutes: 390, sunsetMinutes: 1170 };

export type SkyPhase = "night" | "dawn" | "day" | "golden" | "dusk";

const ZENITH_DEG = 90.833;

function sind(d: number): number {
  return Math.sin((d * Math.PI) / 180);
}
function cosd(d: number): number {
  return Math.cos((d * Math.PI) / 180);
}
function tand(d: number): number {
  return Math.tan((d * Math.PI) / 180);
}

function dayOfYearLocal(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day.getTime() - start.getTime()) / 86_400_000);
}

function wrap360(n: number): number {
  return ((n % 360) + 360) % 360;
}

function wrap24(n: number): number {
  return ((n % 24) + 24) % 24;
}

/** NOAA / USNO sunrise-sunset approximation. Local-civil times; ±3 min is acceptable. */
function solarEventHours(lat: number, lon: number, date: Date, rising: boolean): number {
  const day = dayOfYearLocal(date);
  const lngHour = lon / 15;
  const tApprox = day + ((rising ? 6 : 18) - lngHour) / 24;
  const M = 0.9856 * tApprox - 3.289;
  let L = M + 1.916 * sind(M) + 0.02 * sind(2 * M) + 282.634;
  L = wrap360(L);
  let RA = (Math.atan(0.91764 * tand(L)) * 180) / Math.PI;
  RA = wrap360(RA);
  RA = RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90);
  RA /= 15;
  const sinDec = 0.39782 * sind(L);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH =
    (cosd(ZENITH_DEG) - sinDec * sind(lat)) / (cosDec * cosd(lat));
  const cos = Math.min(1, Math.max(-1, cosH));
  let H = (Math.acos(cos) * 180) / Math.PI;
  if (rising) H = 360 - H;
  H /= 15;
  const T = H + RA - 0.06571 * tApprox - 6.622;
  return wrap24(T - lngHour);
}

function dateFromUtcHours(date: Date, utcHours: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const localOffsetHours = -next.getTimezoneOffset() / 60;
  const localHours = utcHours + localOffsetHours;
  const ms = ((localHours % 24) + 24) % 24 * 3_600_000;
  return new Date(next.getTime() + ms);
}

export function sunTimes(lat: number, lon: number, date: Date): SunTimes {
  const riseH = solarEventHours(lat, lon, date, true);
  const setH = solarEventHours(lat, lon, date, false);
  const sunrise = dateFromUtcHours(date, riseH);
  const sunset = dateFromUtcHours(date, setH);
  const solarNoon = new Date((sunrise.getTime() + sunset.getTime()) / 2);
  return { sunrise, sunset, solarNoon };
}

export function sunPosition(
  lat: number,
  lon: number,
  at: Date,
): { altitudeDeg: number; azimuthDeg: number } {
  const times = sunTimes(lat, lon, at);
  const dayLen = times.sunset.getTime() - times.sunrise.getTime();
  const t = dayLen > 0 ? (at.getTime() - times.sunrise.getTime()) / dayLen : 0;
  // Approximate altitude as a sine through the day; azimuth sweeps 90→270.
  const altitudeDeg = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * 70 - 4;
  const azimuthDeg = 90 + Math.min(1, Math.max(0, t)) * 180;
  return { altitudeDeg, azimuthDeg };
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export type PhaseBoundaries = {
  dawnStart: number;
  dawnEnd: number;
  goldenStart: number;
  goldenEnd: number;
  duskStart: number;
  duskEnd: number;
};

/** The minutes-of-day at which the sky changes phase for `times` (or the
 * fallback sun). Shared with the lock-screen widget's timeline, so the
 * widget can paint the right sky without the household's coordinates. */
export function phaseBoundaries(times: SunTimes | null): PhaseBoundaries {
  const sunriseMin = times ? minutesOfDay(times.sunrise) : FALLBACK_SUN.sunriseMinutes;
  const sunsetMin = times ? minutesOfDay(times.sunset) : FALLBACK_SUN.sunsetMinutes;
  return {
    dawnStart: sunriseMin - 40,
    dawnEnd: sunriseMin + 25,
    goldenStart: sunsetMin - 60,
    goldenEnd: sunsetMin - 10,
    duskStart: sunsetMin - 10,
    duskEnd: sunsetMin + 35,
  };
}

export function skyPhase(now: Date, times: SunTimes | null): { phase: SkyPhase; t: number } {
  const nowMin = minutesOfDay(now);
  const { dawnStart, dawnEnd, goldenStart, goldenEnd, duskStart, duskEnd } = phaseBoundaries(times);

  const spanT = (start: number, end: number) => clamp01((nowMin - start) / Math.max(1, end - start));

  if (nowMin >= dawnStart && nowMin < dawnEnd) return { phase: "dawn", t: spanT(dawnStart, dawnEnd) };
  if (nowMin >= dawnEnd && nowMin < goldenStart) return { phase: "day", t: spanT(dawnEnd, goldenStart) };
  if (nowMin >= goldenStart && nowMin < goldenEnd) return { phase: "golden", t: spanT(goldenStart, goldenEnd) };
  if (nowMin >= duskStart && nowMin < duskEnd) return { phase: "dusk", t: spanT(duskStart, duskEnd) };
  if (nowMin >= duskEnd || nowMin < dawnStart) {
    const nightLen = (dawnStart + 1440 - duskEnd) % 1440 || 1440;
    const into = nowMin >= duskEnd ? nowMin - duskEnd : nowMin + (1440 - duskEnd);
    return { phase: "night", t: clamp01(into / nightLen) };
  }
  return { phase: "day", t: 0.5 };
}
