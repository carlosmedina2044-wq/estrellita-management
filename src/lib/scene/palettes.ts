import type { PaletteId } from "@/lib/types";

export type PaletteSwatch = {
  id: PaletteId;
  labelKey: `portrait.palette.${PaletteId}`;
  wall: string;
  roof: string;
};

/** Representative wall/roof hexes for ambient UI (sampled from generated colormaps). */
export const PALETTES: Record<PaletteId, PaletteSwatch> = {
  classic: {
    id: "classic",
    labelKey: "portrait.palette.classic",
    wall: "#eec6ab",
    roof: "#6c6e75",
  },
  terracotta: {
    id: "terracotta",
    labelKey: "portrait.palette.terracotta",
    wall: "#f3b89f",
    roof: "#d0897b",
  },
  slate: {
    id: "slate",
    labelKey: "portrait.palette.slate",
    wall: "#abb1c9",
    roof: "#515566",
  },
};

export const PALETTE_LIST: PaletteSwatch[] = Object.values(PALETTES);
