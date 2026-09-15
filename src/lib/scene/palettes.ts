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
    wall: "#f2bf99",
    roof: "#2257af",
  },
  terracotta: {
    id: "terracotta",
    labelKey: "portrait.palette.terracotta",
    wall: "#faae8a",
    roof: "#af3d23",
  },
  slate: {
    id: "slate",
    labelKey: "portrait.palette.slate",
    wall: "#a0a8c9",
    roof: "#38414f",
  },
};

export const PALETTE_LIST: PaletteSwatch[] = Object.values(PALETTES);
