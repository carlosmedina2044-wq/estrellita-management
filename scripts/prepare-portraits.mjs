#!/usr/bin/env node
/**
 * Convert portrait PNGs to WebP, run halo checks, record sizes into the manifest.
 *
 * Usage: node scripts/prepare-portraits.mjs [--quality 82]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const PNG_ROOT = path.join(REPO, "tools/blender/out/portraits");
const OUT_ROOT = path.join(REPO, "public/portraits");
const MANIFEST = path.join(REPO, "src/lib/scene/portrait-manifest.json");
const CONTACT = path.join(REPO, "tools/blender/portraits");

const qualityArg = process.argv.indexOf("--quality");
let quality = qualityArg === -1 ? 82 : Number(process.argv[qualityArg + 1] ?? 82);

function warnHalo(raw, width, height, label) {
  let sum = 0;
  let count = 0;
  const border = 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onBorder =
        x < border || y < border || x >= width - border || y >= height - border;
      if (!onBorder) continue;
      sum += raw[(y * width + x) * 4 + 3];
      count++;
    }
  }
  const mean = count ? sum / count : 0;
  if (mean > 8) {
    console.warn(`WARNING: possible halo on ${label} (mean border alpha ${mean.toFixed(1)})`);
  }
  return mean;
}

function layerKey(basename) {
  // a-classic-day.webp → files.day.classic
  // a-lit.webp → files.lit
  // a-summer-day.webp → files.foliage.summer.day
  const name = basename.replace(/\.webp$/, "");
  const parts = name.split("-");
  const type = parts[0];
  if (parts[1] === "lit" || parts[1] === "shadow" || parts[1] === "snow") {
    return { type, path: ["files", parts[1]] };
  }
  if (["spring", "summer", "autumn", "winter"].includes(parts[1])) {
    // parts[2] is the phase: foliage is lit per phase, not shared.
    return { type, path: ["files", "foliage", parts[1], parts[2]] };
  }
  // type-palette-phase
  return { type, path: ["files", parts[2], parts[1]] };
}

fs.mkdirSync(OUT_ROOT, { recursive: true });
const pngs = fs.existsSync(PNG_ROOT)
  ? fs.readdirSync(PNG_ROOT).filter((f) => f.endsWith(".png"))
  : [];

let manifest = {};
if (fs.existsSync(MANIFEST)) {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
}

let totalBytes = 0;
const sizes = [];

/**
 * The shadow layer is rendered as a white ground plane with the house held out.
 * Convert it to a soft black shadow whose alpha is
 * the plane's darkening relative to its unshadowed brightness, sampled along the
 * bottom edge. Pixels the house occupied stay fully transparent.
 */
function shadowToAlpha(data, info) {
  const { width, height, channels } = info;
  const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  const refs = [];
  for (let x = 0; x < width; x += 4) {
    const i = ((height - 3) * width + x) * channels;
    if (data[i + 3] > 200) refs.push(lum(i));
  }
  refs.sort((p, q) => p - q);
  const ref = refs.length ? refs[Math.floor(refs.length * 0.9)] : 255;
  const out = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const i = p * channels;
    const o = p * 4;
    // Feather by the plane's own coverage rather than a hard alpha > 200 cut.
    // The house is held out of this layer, so its antialiased silhouette lands
    // between 0 and 200, and the hard cut left a light 1px halo tracing the
    // house and planter wherever the shadow should have met them.
    const coverage = data[i + 3] / 255;
    const dark = coverage > 0 ? Math.max(0, 1 - lum(i) / ref) : 0;
    const alpha = Math.min(1, dark * 1.3) * 0.6 * coverage;
    out[o] = 42;
    out[o + 1] = 36;
    out[o + 2] = 30;
    out[o + 3] = Math.round(alpha * 255);
  }
  return out;
}

async function convertOne(file) {
  const src = path.join(PNG_ROOT, file);
  const destName = file.replace(/\.png$/, ".webp");
  const dest = path.join(OUT_ROOT, destName);
  const img = sharp(src);
  let { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let source = sharp(src);
  if (/-shadow\.png$/.test(file)) {
    data = shadowToAlpha(data, info);
    info = { ...info, channels: 4 };
    source = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  }
  warnHalo(data, info.width, info.height, destName);
  let buf = await source.webp({ quality }).toBuffer();
  fs.writeFileSync(dest, buf);
  totalBytes += buf.length;
  sizes.push({ name: destName, bytes: buf.length, w: info.width, h: info.height });

  const key = layerKey(destName);
  manifest[key.type] = manifest[key.type] || { files: {} };
  let cursor = manifest[key.type];
  for (let i = 0; i < key.path.length - 1; i++) {
    const p = key.path[i];
    cursor[p] = cursor[p] || {};
    cursor = cursor[p];
  }
  cursor[key.path[key.path.length - 1]] = `/portraits/${destName}`;
}

for (const file of pngs) {
  await convertOne(file);
}

if (totalBytes > 6 * 1024 * 1024 && quality > 76) {
  console.warn(`Budget exceeded (${(totalBytes / 1024 / 1024).toFixed(2)} MB). Re-encoding at q76.`);
  quality = 76;
  totalBytes = 0;
  for (const file of pngs) {
    await convertOne(file);
  }
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  `portraits: ${sizes.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB, q${quality}`,
);

// Contact sheet: terracotta day+lit+foliage summer+shadow for all 21, plus house.webp first cell.
async function contactSheet() {
  const cellW = 260;
  const cellH = Math.round((cellW * 560) / 780);
  const cols = 4;
  const types = [..."abcdefghijklmnopqrstu"];
  const rows = Math.ceil((types.length + 1) / cols);
  const canvas = sharp({
    create: {
      width: cols * cellW,
      height: rows * cellH,
      channels: 4,
      background: { r: 250, g: 246, b: 239, alpha: 1 },
    },
  });

  async function compositeStack(kitType) {
    const layers = [
      path.join(OUT_ROOT, `${kitType}-shadow.webp`),
      path.join(OUT_ROOT, `${kitType}-terracotta-day.webp`),
      path.join(OUT_ROOT, `${kitType}-lit.webp`),
      path.join(OUT_ROOT, `${kitType}-summer-day.webp`),
    ].filter((p) => fs.existsSync(p));
    if (!layers.length) return null;
    let base = sharp(layers[0]).resize(cellW, cellH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
    const comps = [];
    for (let i = 1; i < layers.length; i++) {
      const isLit = layers[i].includes("-lit");
      let layer = sharp(layers[i]).resize(cellW, cellH, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
      // Full 'add' blows pale roofs white on the contact sheet; keep a soft glow.
      if (isLit) layer = layer.ensureAlpha(0.45);
      const buf = await layer.toBuffer();
      comps.push({ input: buf, blend: isLit ? "screen" : "over" });
    }
    if (comps.length) base = base.composite(comps);
    return base.png().toBuffer();
  }

  const composites = [];
  // First cell: house.webp reference
  const house = path.join(REPO, "public/illustrations/house.webp");
  if (fs.existsSync(house)) {
    const buf = await sharp(house)
      .resize(cellW, cellH, { fit: "contain", background: { r: 250, g: 246, b: 239, alpha: 1 } })
      .png()
      .toBuffer();
    composites.push({ input: buf, left: 0, top: 0 });
  }

  for (let i = 0; i < types.length; i++) {
    const buf = await compositeStack(types[i]);
    if (!buf) continue;
    const slot = i + 1;
    const left = (slot % cols) * cellW;
    const top = Math.floor(slot / cols) * cellH;
    composites.push({ input: buf, left, top });
  }

  const outPath = path.join(CONTACT, "contact.webp");
  await canvas.composite(composites).webp({ quality: 85 }).toFile(outPath);
  console.log("wrote", path.relative(REPO, outPath));

  // Palette sheet for type a
  const palCols = ["classic", "terracotta", "slate"];
  const phases = ["day", "night"];
  const pw = 260;
  const ph = Math.round((pw * 560) / 780);
  const palCanvas = sharp({
    create: {
      width: palCols.length * pw,
      height: phases.length * ph,
      channels: 4,
      background: { r: 250, g: 246, b: 239, alpha: 1 },
    },
  });
  const palComps = [];
  for (let y = 0; y < phases.length; y++) {
    for (let x = 0; x < palCols.length; x++) {
      const file = path.join(OUT_ROOT, `a-${palCols[x]}-${phases[y]}.webp`);
      if (!fs.existsSync(file)) continue;
      const buf = await sharp(file)
        .resize(pw, ph, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      palComps.push({ input: buf, left: x * pw, top: y * ph });
    }
  }
  const palOut = path.join(CONTACT, "contact-palettes.webp");
  await palCanvas.composite(palComps).webp({ quality: 85 }).toFile(palOut);
  console.log("wrote", path.relative(REPO, palOut));
}

await contactSheet();
