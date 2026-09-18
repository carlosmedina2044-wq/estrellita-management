import { bestCareLevel, careLevelIndex } from "@/lib/care-level";
import { PALETTE_IDS, type CareLevelId, type Household, type PaletteId } from "@/lib/types";

/**
 * The care level each palette arrives at. The house *shape* is never locked —
 * it is chosen at onboarding to resemble the home you actually live in, and
 * holding that back would stop someone depicting their own house. Colour is
 * pure decoration, so colour is what the ladder pays out.
 */
export const PALETTE_UNLOCK: Record<PaletteId, CareLevelId> = {
  classic: "settling-in",
  terracotta: "kept",
  slate: "well-kept",
};

export { bestCareLevel };

export type PaletteLock = {
  palette: PaletteId;
  unlocked: boolean;
  /** The level that opens it, or null once it is open. */
  needs: CareLevelId | null;
};

/**
 * Every palette with its state, for a home that has reached `level`.
 * `chosen` is always unlocked: a home that picked a colour before this
 * shipped, or restored a backup from one, never loses the look it is already
 * wearing.
 */
export function paletteLocksAtLevel(level: CareLevelId, chosen?: PaletteId): PaletteLock[] {
  const reached = careLevelIndex(level);
  return PALETTE_IDS.map((palette) => {
    const needs = PALETTE_UNLOCK[palette];
    const unlocked = palette === chosen || careLevelIndex(needs) <= reached;
    return { palette, unlocked, needs: unlocked ? null : needs };
  });
}

/** Every palette with its state for a real home. */
export function paletteLocks(
  household: Household,
  now = new Date(),
  chosen?: PaletteId,
): PaletteLock[] {
  return paletteLocksAtLevel(bestCareLevel(household, now), chosen);
}

export function unlockedPalettes(household: Household, now = new Date(), chosen?: PaletteId): PaletteId[] {
  return paletteLocks(household, now, chosen)
    .filter((entry) => entry.unlocked)
    .map((entry) => entry.palette);
}
