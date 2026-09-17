#!/usr/bin/env node
/**
 * Build portrait colormaps from the Kenney suburban colormap.
 *
 * Kenney models share one 512×512 colormap: three bands of eight 64×128 gradient
 * cells (top of a cell is the lit tone, bottom the shaded tone). The models' UVs
 * pick a cell per part, so a palette is a set of cell overrides. Each override
 * keeps the cell's gradient (per-pixel luminance relative to the cell mean) and
 * swaps the hue, so roofs keep their plank shading and walls their trim shadow.
 *
 * Cells (face counts re-probed on building-type-a, 2026-09-16):
 *   band 1 col 0  686 faces  trim: window frames, door surround, plinth  <- "base"
 *   band 0 col 0  184 faces  roof
 *   band 1 col 3  156 faces  walls
 *   band 2 col 1  112 faces  foliage (bushes)
 *   band 0 col 5   14 faces  window panes
 *   band 1 col 1   10 faces  door
 * band 1 col 2 is unused -- the old "frames = band 1, col 2, left alone" note
 * was wrong. Frames live in the "base" cell, which is the single most-used cell
 * on the house, so its hue sets the whole portrait's temperature.
 *
 * Usage: node scripts/portrait-palettes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const TEX = path.join(REPO, "tools/blender/vendor/kenney-city-kit-suburban/Models/Textures");
const OUT = path.join(REPO, "tools/blender/portraits/colormaps");

const CELL_W = 64;
const CELL_H = 128;
const BAND_Y0 = 128; // rows above are unused (black)

export const CELLS = {
  roof: { band: 0, col: 0 },
  walls: { band: 1, col: 3 },
  base: { band: 1, col: 0 },
  door: { band: 1, col: 1 },
};

/** Target mid-tone (sRGB hex) per part per palette. Gradient shading is preserved.
 *
 * `base` covers 686 of the house's ~1174 faces, so it is the palette's real
 * temperature control. It was a cold blue-grey (#8b8b9c / #8f92a3), which put a
 * concrete cast over every warm palette; house.webp has trim a shade LIGHTER and
 * warmer than the walls, which is what these now match. */
export const PALETTES = {
  // Brand look: cream walls, terracotta roof, deep green door (house.webp).
  terracotta: { walls: "#efdcc4", roof: "#c2603f", door: "#4f5e42", base: "#fbf5ec" },
  // Soft warm white with a blue-grey roof and a brick-red door.
  classic: { walls: "#f1e9dc", roof: "#6f86a8", door: "#8a3f30", base: "#fdf8f1" },
  // Cool light grey walls, charcoal roof, ink door. Deliberately the cool option,
  // so its trim stays cool too -- just lighter than the walls, not darker.
  slate: { walls: "#dfe0e8", roof: "#4a4f5c", door: "#2e333f", base: "#f0f2f7" },
};

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

function recolorCell(data, info, cell, hex) {
  const x0 = cell.col * CELL_W;
  const y0 = BAND_Y0 + cell.band * CELL_H;
  const target = hexToRgb(hex);
  // Mean luminance of the cell (its gradient runs lit → shaded top to bottom).
  let sum = 0;
  for (let y = y0; y < y0 + CELL_H; y++) {
    for (let x = x0; x < x0 + CELL_W; x++) {
      const i = (y * info.width + x) * info.channels;
      sum += lum(data[i], data[i + 1], data[i + 2]);
    }
  }
  const mean = sum / (CELL_W * CELL_H);
  for (let y = y0; y < y0 + CELL_H; y++) {
    for (let x = x0; x < x0 + CELL_W; x++) {
      const i = (y * info.width + x) * info.channels;
      const ratio = lum(data[i], data[i + 1], data[i + 2]) / mean; // ~0.8 … 1.15
      data[i] = clamp(target[0] * ratio);
      data[i + 1] = clamp(target[1] * ratio);
      data[i + 2] = clamp(target[2] * ratio);
    }
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = path.join(TEX, "variation-b.png");
  for (const [palette, parts] of Object.entries(PALETTES)) {
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const [part, hex] of Object.entries(parts)) recolorCell(data, info, CELLS[part], hex);
    const dest = path.join(OUT, `${palette}.png`);
    await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
      .png()
      .toFile(dest);
    console.log("wrote", path.relative(REPO, dest), JSON.stringify(parts));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
