import type { HomeSpec, Household, KitType, PaletteId } from "@/lib/types";
import portraitManifest from "@/lib/scene/portrait-manifest.json";

export type PortraitWindowRect = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PortraitKitEntry = {
  features: {
    storeys: 1 | 2;
    garage: number;
    dormers: number;
    solar: boolean;
    porch: boolean;
    footprint: "compact" | "standard" | "wide";
    roof: string;
  };
  frame: { w: number; h: number };
  houseBounds: PortraitWindowRect | { x: number; y: number; w: number; h: number };
  windows: PortraitWindowRect[];
  door: { x: number; y: number } | null;
  chimney: { x: number; y: number } | null;
  windowCount: number;
  files: {
    day: Record<string, string>;
    night: Record<string, string>;
    lit: string;
    shadow: string;
    snow: string;
    /** season -> phase -> url. Foliage is lit per phase; legacy manifests stored
     * one shared url per season, which portraitLayerUrls still tolerates. */
    foliage: Record<string, { day: string; night: string } | string>;
  };
};

export const PORTRAIT_MANIFEST = portraitManifest as unknown as Record<string, PortraitKitEntry>;

export function portraitKit(kitType: KitType): PortraitKitEntry {
  const entry = PORTRAIT_MANIFEST[kitType];
  if (entry?.frame && entry?.files) return entry;
  return PORTRAIT_MANIFEST.a;
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Builds a stored `HomeSpec` from a chosen kit/palette — used both to persist
 * an onboarding pick and to fall back a pre-existing household that never
 * made one (see `resolveHomeSpec`). */
export function buildHomeSpec(pick: { kitType: KitType; palette: PaletteId }, seedText: string): HomeSpec {
  const kit = portraitKit(pick.kitType);
  return {
    version: 2,
    kitType: pick.kitType,
    palette: pick.palette,
    windows: kit.windows.map((w) => ({ id: w.id, roomId: null })),
    seed: hashSeed(seedText),
  };
}

/** Households from before the house-look picker shipped never set `homeSpec`;
 * they fall back to kit `a` / classic here rather than at every call site. */
export function resolveHomeSpec(household: Household): HomeSpec {
  if (household.homeSpec?.version === 2) return household.homeSpec;
  return buildHomeSpec({ kitType: "a", palette: "classic" }, household.householdName || household.homeId);
}

export function dayOpacityForPhase(phase: string, t: number): number {
  switch (phase) {
    case "day":
      return 1;
    case "night":
      return 0;
    case "dawn":
      return 0.15 + t * 0.85;
    case "golden":
      return 1 - t * 0.35;
    case "dusk":
      return 0.65 * (1 - t);
    default:
      return 1;
  }
}

export function gradeOpacityForPhase(phase: string, t: number): number {
  switch (phase) {
    case "day":
      return 0;
    case "golden":
      return 0.1 + t * 0.15;
    case "dusk":
      return 0.35 + t * 0.15;
    case "night":
      return 0.5;
    case "dawn":
      return 0.35 * (1 - t);
    default:
      return 0;
  }
}

/** Foliage used to be one shared, day-lit image per season, which made the trees
 * read as daylight cutouts against the night sky. It is now rendered per phase and
 * crossfaded on the same dayOpacity as the house. A string here means a manifest
 * from before that change. */
function foliageUrls(kit: PortraitKitEntry, season: string) {
  const entry = kit.files.foliage[season] ?? kit.files.foliage.summer;
  if (typeof entry === "string") return { foliageDay: entry, foliageNight: entry };
  return { foliageDay: entry.day, foliageNight: entry.night ?? entry.day };
}

export function portraitLayerUrls(
  kitType: KitType,
  palette: PaletteId,
  season: "spring" | "summer" | "autumn" | "winter",
) {
  const kit = portraitKit(kitType);
  return {
    day: kit.files.day[palette] ?? kit.files.day.classic,
    night: kit.files.night[palette] ?? kit.files.night.classic,
    lit: kit.files.lit,
    shadow: kit.files.shadow,
    snow: kit.files.snow,
    ...foliageUrls(kit, season),
    frame: kit.frame,
    windows: kit.windows,
    door: kit.door,
    chimney: kit.chimney,
    windowCount: kit.windowCount || kit.windows.length,
  };
}
