import { contrastRatio, isHexColor, mixHex, relativeLuminance } from "@/lib/scene/color";
import type { SkyPhase } from "@/lib/scene/sun";

export type WeatherKind = "clear" | "cloudy" | "rain" | "snow" | "fog";

export type SkyStops = {
  top: string;
  mid: string;
  horizon: string;
  ambient: string;
  textTone: "ink" | "cream";
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  exposure: number;
};

type PhaseStops = {
  top: string;
  mid: string;
  horizon: string;
  sunColor: string;
  sunIntensity: number;
  exposure: number;
  hemiGround: string;
};

const PHASE_ORDER: SkyPhase[] = ["night", "dawn", "day", "golden", "dusk"];

const BASE: Record<SkyPhase, PhaseStops> = {
  night: {
    top: "#0f1626",
    mid: "#1a2238",
    horizon: "#2a2f45",
    sunColor: "#8fa3ff",
    sunIntensity: 0.25,
    exposure: 0.7,
    hemiGround: "#2a2622",
  },
  dawn: {
    top: "#4a5a86",
    mid: "#c98a6b",
    horizon: "#f2c9a0",
    sunColor: "#ffc9a0",
    sunIntensity: 1.4,
    exposure: 0.9,
    hemiGround: "#6b5a48",
  },
  day: {
    top: "#8fb8e8",
    mid: "#c9dcf0",
    horizon: "#eef2f0",
    sunColor: "#fff4e0",
    sunIntensity: 2.4,
    exposure: 1.0,
    hemiGround: "#6b5a48",
  },
  golden: {
    top: "#6f8fc2",
    mid: "#e6a56a",
    horizon: "#f6d3a2",
    sunColor: "#ffb872",
    sunIntensity: 2.0,
    exposure: 0.95,
    hemiGround: "#6b5a48",
  },
  dusk: {
    top: "#2b3358",
    mid: "#7a5a7a",
    horizon: "#e08a6a",
    sunColor: "#ff9a6a",
    sunIntensity: 0.9,
    exposure: 0.85,
    hemiGround: "#2a2622",
  },
};

function nextPhase(phase: SkyPhase): SkyPhase {
  return PHASE_ORDER[(PHASE_ORDER.indexOf(phase) + 1) % PHASE_ORDER.length];
}

function mixStops(a: PhaseStops, b: PhaseStops, t: number): PhaseStops {
  return {
    top: mixHex(a.top, b.top, t),
    mid: mixHex(a.mid, b.mid, t),
    horizon: mixHex(a.horizon, b.horizon, t),
    sunColor: mixHex(a.sunColor, b.sunColor, t),
    sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t,
    exposure: a.exposure + (b.exposure - a.exposure) * t,
    hemiGround: mixHex(a.hemiGround, b.hemiGround, t),
  };
}

function applyWeather(stops: PhaseStops, weather: WeatherKind, cloudCover: number): PhaseStops {
  const cover = Math.min(1, Math.max(0, cloudCover));
  let { top, mid, horizon, exposure } = stops;
  if (weather === "cloudy" || weather === "rain") {
    const t = cover * 0.6;
    top = mixHex(top, "#b9bec4", t);
    mid = mixHex(mid, "#d8dbde", t);
    horizon = mixHex(horizon, "#e9ebec", t);
    if (weather === "rain") exposure -= 0.2;
  }
  if (weather === "snow") {
    const t = Math.max(0.35, cover);
    top = mixHex(top, "#dfe3e6", t);
    mid = mixHex(mid, "#eef0f2", t);
    horizon = mixHex(horizon, "#f7f8f9", t);
  }
  if (weather === "fog") {
    horizon = "#e6e4df";
    mid = mixHex(mid, "#e6e4df", 0.5);
  }
  return { ...stops, top, mid, horizon, exposure };
}

function toneFor(top: string): "ink" | "cream" {
  return relativeLuminance(top) > 0.45 ? "ink" : "cream";
}

/** If contrast fails, nudge the top stop toward a safer neighbour and keep the test. */
function ensureContrast(top: string, tone: "ink" | "cream"): string {
  const ink = "#1d1d1f";
  const cream = "#f7f3ec";
  const text = tone === "ink" ? ink : cream;
  if (contrastRatio(top, text) >= 4.5) return top;
  const safer = tone === "ink" ? "#c5d6ea" : "#141a28";
  for (let t = 0.15; t <= 1; t += 0.15) {
    const mixed = mixHex(top, safer, t);
    if (contrastRatio(mixed, text) >= 4.5) return mixed;
  }
  return safer;
}

export function skyGradient(
  phase: SkyPhase,
  t: number,
  weather: WeatherKind,
  cloudCover: number,
): SkyStops {
  const u = Math.min(1, Math.max(0, t));
  const edge = u < 0.18 ? u / 0.18 : u > 0.82 ? (u - 0.82) / 0.18 : -1;
  let mixed =
    edge < 0
      ? BASE[phase]
      : u < 0.18
        ? mixStops(
            BASE[PHASE_ORDER[(PHASE_ORDER.indexOf(phase) + PHASE_ORDER.length - 1) % PHASE_ORDER.length]],
            BASE[phase],
            0.5 + edge * 0.5,
          )
        : mixStops(BASE[phase], BASE[nextPhase(phase)], edge * 0.5);
  mixed = applyWeather(mixed, weather, cloudCover);
  const textTone = toneFor(mixed.top);
  const top = ensureContrast(mixed.top, textTone);
  return {
    top,
    mid: mixed.mid,
    horizon: mixed.horizon,
    ambient: mixed.mid,
    textTone,
    sunColor: mixed.sunColor,
    sunIntensity: mixed.sunIntensity,
    hemiSky: top,
    hemiGround: mixed.hemiGround,
    exposure: mixed.exposure,
  };
}

export function assertValidStops(stops: SkyStops): void {
  for (const key of ["top", "mid", "horizon", "ambient", "sunColor", "hemiSky", "hemiGround"] as const) {
    if (!isHexColor(stops[key])) throw new Error(`invalid hex ${key}`);
  }
  const text = stops.textTone === "ink" ? "#1d1d1f" : "#f7f3ec";
  if (contrastRatio(stops.top, text) < 4.5) {
    throw new Error(`contrast ${contrastRatio(stops.top, text).toFixed(2)}`);
  }
}

/** The colour the sky leans toward while a day is being closed. Warm, but
 * still a sky: mixing all the way to a lamp colour turned dusk orange and
 * midday peach, which read as a bug rather than a moment. */
const HEARTH = "#ffb872";

/**
 * A one-off warming of the sky, for the beat where the day closes. Applied
 * on top of whatever `skyGradient` already produced, so it works at any hour
 * and in any weather rather than only at dusk.
 *
 * `amount` is 0 (untouched) to 1. The top stop is deliberately warmed less
 * than the horizon: the greeting sits against the top, and that text is only
 * guaranteed readable because `skyGradient` ran `ensureContrast` on it. The
 * result is re-checked here and backed off rather than trusted, so a warm
 * pulse can never push the greeting below 4.5:1 for the second it lasts.
 */
export function warmedStops(stops: SkyStops, amount: number): SkyStops {
  const a = Math.min(1, Math.max(0, amount));
  if (a === 0) return stops;
  const text = stops.textTone === "ink" ? "#1d1d1f" : "#f7f3ec";
  let top = mixHex(stops.top, HEARTH, a * 0.28);
  if (contrastRatio(top, text) < 4.5) {
    // Step back toward the original until the greeting is readable again.
    for (let i = 4; i >= 0; i--) {
      const candidate = mixHex(stops.top, HEARTH, a * 0.28 * (i / 5));
      if (contrastRatio(candidate, text) >= 4.5) {
        top = candidate;
        break;
      }
      top = stops.top;
    }
  }
  return {
    ...stops,
    top,
    mid: mixHex(stops.mid, HEARTH, a * 0.4),
    horizon: mixHex(stops.horizon, HEARTH, a * 0.5),
    ambient: mixHex(stops.ambient, HEARTH, a * 0.4),
  };
}
