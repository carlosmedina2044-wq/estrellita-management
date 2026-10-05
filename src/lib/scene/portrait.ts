import type { HomeSpec, Household, KitType, PaletteId } from "@/lib/types";
import portraitManifest from "@/lib/scene/portrait-manifest.json";
import { assignWindowRooms, needsReassignment } from "@/lib/scene/window-rooms";

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
  /** The lawn's extent in frame pixels; the lowest thing the portrait draws. */
  /** Everything the portrait draws, lawn to treetop to roof, in frame pixels. */
  bounds?: { x: number; y: number; w: number; h: number };
  groundBounds?: { x: number; y: number; w: number; h: number };
  windows: PortraitWindowRect[];
  /** Centre and size of the visible front door; `null` when the camera cannot
   * see one (kits `p`, `r`, `s` hide theirs). See `doorAnchor`. */
  door: { x: number; y: number; w?: number; h?: number } | null;
  chimney: { x: number; y: number } | null;
  windowCount: number;
  files: {
    day: Record<string, string>;
    night: Record<string, string>;
    lit: string;
    snow: string;
    /** The lawn the house stands on, opaque, lit per phase and dressed per
     * season (snow in winter). It sits under the house layers. */
    ground: Record<string, { day: string; night: string }>;
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
 * they fall back to kit `a` / classic here rather than at every call site.
 * The window-to-room map is reconciled here too: a stored assignment that no
 * longer fits (nothing assigned, a deleted room, a different kit) is redone
 * from the current rooms and duties, so the persisted spec is a cache and
 * never a source of stale windows. */
export function resolveHomeSpec(
  household: Pick<Household, "homeSpec" | "householdName" | "homeId" | "rooms" | "duties">,
): HomeSpec {
  const base =
    household.homeSpec?.version === 2
      ? household.homeSpec
      : buildHomeSpec({ kitType: "a", palette: "classic" }, household.householdName || household.homeId);
  const kit = portraitKit(base.kitType);
  return needsReassignment(base, household.rooms, kit)
    ? assignWindowRooms(base, household.rooms, household.duties, kit)
    : base;
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

/** The door, in frame pixels, with a fallback for the kits whose entrance the
 * camera never sees. Everything that hangs off the threshold — the porch light,
 * the string lights, the wreath, the doormat, the cat, the closing sparkle —
 * goes through here so the fallback lives in one place rather than being
 * re-guessed at each call site.
 *
 * The fallback comes from the eighteen doors that were measured out of the
 * renders (see scripts/derive-door-anchors.mjs). Their height is tight across
 * every kit (0.74-0.84 of the house); their horizontal placement is not, so
 * an unseen door is put on the blankest stretch of the front wall — the point
 * in the middle of the facade furthest from any window — rather than at a
 * constant that would sometimes land on the glass.
 */
export function doorAnchor(kit: PortraitKitEntry): { x: number; y: number; w: number; h: number } {
  const b = kit.houseBounds;
  const fallbackW = b.w * 0.077;
  const fallbackH = b.h * 0.188;
  if (kit.door) {
    return {
      x: kit.door.x,
      y: kit.door.y,
      w: kit.door.w ?? fallbackW,
      h: kit.door.h ?? fallbackH,
    };
  }
  let bestX = b.x + b.w * 0.6;
  let bestGap = -1;
  for (let step = 0; step <= 20; step += 1) {
    const x = b.x + b.w * (0.2 + (0.6 * step) / 20);
    const gap = kit.windows.length
      ? Math.min(...kit.windows.map((w) => Math.abs(x - (w.x + w.w / 2))))
      : Infinity;
    if (gap > bestGap) {
      bestGap = gap;
      bestX = x;
    }
  }
  return { x: bestX, y: b.y + b.h * 0.81, w: fallbackW, h: fallbackH };
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

function groundUrls(kit: PortraitKitEntry, season: string) {
  const entry = kit.files.ground[season] ?? kit.files.ground.summer;
  return { groundDay: entry.day, groundNight: entry.night ?? entry.day };
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
    snow: kit.files.snow,
    ...groundUrls(kit, season),
    ...foliageUrls(kit, season),
    frame: kit.frame,
    windows: kit.windows,
    door: kit.door,
    chimney: kit.chimney,
    windowCount: kit.windowCount || kit.windows.length,
  };
}
