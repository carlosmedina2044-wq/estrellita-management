#!/usr/bin/env node
/**
 * Derive clay-friendly portrait colormaps from Kenney variation PNGs.
 * Desaturate 15% and warm toward #faf6ef; leave glass/foliage cells untouched.
 *
 * Usage: node scripts/portrait-palettes.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

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

/** Cream brand target for warming. */
const CREAM = { r: 0xfa / 255, g: 0xf6 / 255, b: 0xef / 255 };

function srgbToLinear(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c) {
  const x = Math.min(1, Math.max(0, c));
  const y = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, y * 255)));
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isGlass(r, g, b) {
  // Kenney glass tends toward cool mid blues / cyans.
  return b > r + 20 && b > g + 10 && b > 90 && b < 200 && r < 160;
}

function isFoliage(r, g, b) {
  return g > r + 15 && g > b + 15 && g > 70 && g < 200;
}

function transform(r, g, b) {
  if (isGlass(r, g, b) || isFoliage(r, g, b)) return [r, g, b];
  let R = srgbToLinear(r);
  let G = srgbToLinear(g);
  let B = srgbToLinear(b);
  const L = luminance(R, G, B);
  // Keep near-black (doors, solar, unused cells) untouched.
  if (L < 0.05) return [r, g, b];
  // Desaturate 15% toward luminance.
  R = L + (R - L) * 0.85;
  G = L + (G - L) * 0.85;
  B = L + (B - L) * 0.85;
  // Warm slightly toward cream (8%).
  R = R * 0.92 + CREAM.r * 0.08;
  G = G * 0.92 + CREAM.g * 0.08;
  B = B * 0.92 + CREAM.b * 0.08;
  return [linearToSrgb(R), linearToSrgb(G), linearToSrgb(B)];
}

fs.mkdirSync(OUT, { recursive: true });

for (const [palette, file] of Object.entries(MAP)) {
  const src = path.join(TEX, file);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = transform(data[i], data[i + 1], data[i + 2]);
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = data[i + 3];
  }
  const dest = path.join(OUT, `${palette}.png`);
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(dest);
  console.log("wrote", path.relative(REPO, dest), `${info.width}x${info.height}`);
}
