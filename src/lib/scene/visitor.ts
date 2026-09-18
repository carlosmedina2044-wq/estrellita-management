import type { Season } from "@/lib/scene/season";
import type { SkyPhase } from "@/lib/scene/sun";
import type { SceneWeather } from "@/lib/scene/weather";

export const VISITOR_KINDS = ["birds", "butterfly", "rainbow", "moth", "deer"] as const;
export type VisitorKind = (typeof VISITOR_KINDS)[number];

/** Roughly one closed day in four. Often enough to be worth opening for, rare
 * enough that it never becomes the expected state. */
export const VISITOR_ODDS = 4;

export type VisitorSignals = {
  /** Visitors only ever come to a day that was closed. Nothing about the app
   * should reward a day that was not. */
  closedToday: boolean;
  phase: SkyPhase;
  season: Season;
  weather: SceneWeather;
  /** Local ISO date. The visit is fixed for the day, so it cannot be rerolled
   * by backgrounding the app. */
  dateKey: string;
  /** The home's own seed, so two homes do not get the same visitor on the
   * same day. */
  seed: number;
};

function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function suits(kind: VisitorKind, s: VisitorSignals): boolean {
  const daylight = s.phase === "day" || s.phase === "golden";
  const lowLight = s.phase === "dawn" || s.phase === "dusk";
  const wet = s.weather.kind === "rain" || s.weather.kind === "snow";
  switch (kind) {
    case "birds":
      return daylight && s.season !== "winter" && !wet;
    case "butterfly":
      return daylight && (s.season === "spring" || s.season === "summer") && !wet;
    case "rainbow":
      return daylight && s.weather.kind === "rain";
    case "moth":
      return s.phase === "dusk" || s.phase === "night";
    case "deer":
      return lowLight && (s.season === "autumn" || s.season === "winter");
  }
}

/**
 * Who, if anyone, is at the house today.
 *
 * Everything else the house does is a rule you can learn: the windows follow
 * the rooms, the lantern follows the hour, the decorations follow the level.
 * That makes the house legible, and it also makes it completely predictable —
 * there is never a reason to look twice. This is the one thing that is not
 * promised. It is still deterministic for a given home and day, so it cannot
 * be farmed by reopening the app, and it never appears on a day that was not
 * closed.
 */
export function visitorFor(s: VisitorSignals): VisitorKind | null {
  if (!s.closedToday) return null;
  const roll = hash32(`${s.dateKey}:${s.seed}`);
  if (roll % VISITOR_ODDS !== 0) return null;
  const eligible = VISITOR_KINDS.filter((kind) => suits(kind, s));
  if (eligible.length === 0) return null;
  return eligible[Math.floor(roll / VISITOR_ODDS) % eligible.length];
}

/** Where the visitor sits, as percentages of the house stack's box. Kept away
 * from the door and the windows, which are already buttons. */
export function visitorAnchor(kind: VisitorKind): { x: number; y: number } {
  switch (kind) {
    case "birds":
      return { x: 74, y: 16 };
    case "butterfly":
      return { x: 26, y: 46 };
    case "rainbow":
      return { x: 50, y: 14 };
    case "moth":
      return { x: 62, y: 40 };
    case "deer":
      return { x: 18, y: 84 };
  }
}
