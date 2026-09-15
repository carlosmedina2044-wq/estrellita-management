#!/usr/bin/env node
/**
 * Portrait colormaps = Kenney variation PNGs, unchanged.
 * Earlier passes desaturated/cream-washed them and the houses read faded;
 * keep Kenney chroma and tune exposure in the Blender render instead.
 *
 * Usage: node scripts/portrait-palettes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const TEX = path.join(
  REPO,
  "tools/blender/vendor/kenney-city-kit-suburban/Models/Textures",
);
const OUT = path.join(REPO, "tools/blender/portraits/colormaps");

const MAP = {
  classic: "variation-a.png",
  terracotta: "variation-b.png",
  slate: "variation-c.png",
};

fs.mkdirSync(OUT, { recursive: true });

for (const [palette, file] of Object.entries(MAP)) {
  const src = path.join(TEX, file);
  const dest = path.join(OUT, `${palette}.png`);
  fs.copyFileSync(src, dest);
  console.log("wrote", path.relative(REPO, dest), "(verbatim Kenney)");
}
