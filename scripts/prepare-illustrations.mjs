#!/usr/bin/env node
/**
 * Slice Cuidala asset-pack PNG sheets into WebP stills and ship Lottie moments
 * with WebP image layers. Idempotent.
 *
 * Usage: node scripts/prepare-illustrations.mjs [assetPackRoot]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_ROOT = path.join(REPO_ROOT, "public", "illustrations");
const DEFAULT_PACK = "/Users/medina/Downloads/CuidalaAssets-v1.0";

// Handoff asked for q82 / full poster widths, but that blew the ≤500 KB
// public/illustrations budget (~717 KB). Judgment call: keep room width 192,
// nudge sys/season to 280, posters to house 400 / shelf 640 / cutaway 720,
// and quality 70 so the committed pack stays under budget.
const WEBP_STILL_QUALITY = 70;
const WEBP_LAYER_QUALITY = 70;
const WIDTHS = {
  room: 192,
  sys: 280,
  season: 280,
  cutaway: 720,
  house: 400,
  shelf: 640,
};

/** @type {{ name: string; bytes: number; width: number; height: number }[]} */
const outputs = [];

/**
 * @param {string} filePath
 * @param {Buffer} buffer
 * @param {number} width
 * @param {number} height
 */
function writeOutput(filePath, buffer, width, height) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  outputs.push({
    name: path.relative(REPO_ROOT, filePath),
    bytes: buffer.length,
    width,
    height,
  });
}

/**
 * Sample mean alpha along a 2 px border. Warn if > 8 (possible halo).
 * @param {Buffer} raw
 * @param {number} width
 * @param {number} height
 * @param {string} label
 */
function warnHalo(raw, width, height, label) {
  let sum = 0;
  let count = 0;
  const border = 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onBorder =
        x < border || y < border || x >= width - border || y >= height - border;
      if (!onBorder) continue;
      const alpha = raw[(y * width + x) * 4 + 3];
      sum += alpha;
      count++;
    }
  }
  const mean = count ? sum / count : 0;
  if (mean > 8) {
    console.warn(`WARNING: possible halo on ${label} (mean border alpha ${mean.toFixed(1)})`);
  }
}

/**
 * @param {import('sharp').Sharp} image
 * @param {number} targetWidth
 * @param {string} outPath
 * @param {string} label
 */
/**
 * @param {Buffer | import('sharp').Sharp} input
 * @param {number} targetWidth
 * @param {string} outPath
 * @param {string} label
 */
async function encodeStill(input, targetWidth, outPath, label) {
  // Materialize first so extract()+trim() cannot fight over the pipeline.
  const pngBuf = Buffer.isBuffer(input)
    ? input
    : await input.png().toBuffer();

  let trimmed;
  try {
    trimmed = await sharp(pngBuf).trim().ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
  } catch {
    trimmed = await sharp(pngBuf).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });
  }
  warnHalo(trimmed.data, trimmed.info.width, trimmed.info.height, label);

  const { data, info } = await sharp(trimmed.data, {
    raw: {
      width: trimmed.info.width,
      height: trimmed.info.height,
      channels: 4,
    },
  })
    .resize({
      width: targetWidth,
      fit: "inside",
      withoutEnlargement: false,
    })
    .webp({ quality: WEBP_STILL_QUALITY, alphaQuality: 90, effort: 6 })
    .toBuffer({ resolveWithObject: true });

  writeOutput(outPath, data, info.width, info.height);
  return { width: info.width, height: info.height };
}

/**
 * @param {string} sheetPath
 * @param {number} cols
 * @param {number} rows
 * @param {number} cellW
 * @param {number} cellH
 * @param {string[]} names
 * @param {number} width
 */
async function sliceSheet(sheetPath, cols, rows, cellW, cellH, names, width) {
  if (names.length !== cols * rows) {
    throw new Error(`Expected ${cols * rows} names, got ${names.length}`);
  }
  const meta = await sharp(sheetPath).metadata();
  if (!meta.width || !meta.height) throw new Error(`No dimensions for ${sheetPath}`);

  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const name = names[i++];
      const left = col * cellW;
      const top = row * cellH;
      const cellBuf = await sharp(sheetPath)
        .extract({
          left,
          top,
          width: Math.min(cellW, meta.width - left),
          height: Math.min(cellH, meta.height - top),
        })
        .png()
        .toBuffer();
      await encodeStill(cellBuf, width, path.join(OUT_ROOT, `${name}.webp`), name);
    }
  }
}

/**
 * @param {string} packRoot
 * @param {string} id
 */
async function prepareLottie(packRoot, id) {
  const srcDir = path.join(packRoot, "animations", id);
  const srcJson = path.join(srcDir, `cuidala-${id}.json`);
  const outDir = path.join(OUT_ROOT, "lottie", id);
  const outJson = path.join(outDir, `${id}.json`);

  const raw = fs.readFileSync(srcJson, "utf8");
  /** @type {any} */
  const data = JSON.parse(raw);
  const assets = Array.isArray(data.assets) ? data.assets : [];

  for (const asset of assets) {
    const p = typeof asset.p === "string" ? asset.p : "";
    if (!p.endsWith(".png")) continue;
    const srcPng = path.join(srcDir, "images", p);
    if (!fs.existsSync(srcPng)) {
      throw new Error(`Missing Lottie layer ${srcPng}`);
    }
    const baset = path.basename(p, ".png");
    const webpName = `${baset}.webp`;
    const outWebp = path.join(outDir, "images", webpName);
    const { data: buf, info } = await sharp(srcPng)
      .webp({ quality: WEBP_LAYER_QUALITY, alphaQuality: 90, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    writeOutput(outWebp, buf, info.width, info.height);
    asset.p = webpName;
    // u stays images/
  }

  if (id === "breathing-loop") {
    for (const layer of Array.isArray(data.layers) ? data.layers : []) {
      if (layer?.nm === "Breathing sun") layer.hd = true;
    }
  }

  const jsonBuf = Buffer.from(JSON.stringify(data), "utf8");
  writeOutput(outJson, jsonBuf, data.w ?? 0, data.h ?? 0);
}

/**
 * Transparent poster from first image asset of a Lottie folder.
 * @param {string} packRoot
 * @param {string} animId
 * @param {string} outName
 * @param {number} width
 */
async function transparentPoster(packRoot, animId, outName, width) {
  const srcDir = path.join(packRoot, "animations", animId);
  const json = JSON.parse(
    fs.readFileSync(path.join(srcDir, `cuidala-${animId}.json`), "utf8"),
  );
  const assets = Array.isArray(json.assets) ? json.assets : [];
  const first = assets.find((a) => typeof a?.p === "string" && a.p.endsWith(".png"));
  if (!first) throw new Error(`No image asset for poster from ${animId}`);
  const srcPng = path.join(srcDir, "images", first.p);
  await encodeStill(sharp(srcPng), width, path.join(OUT_ROOT, `${outName}.webp`), outName);
}

async function main() {
  const packRoot = path.resolve(process.argv[2] ?? DEFAULT_PACK);
  if (!fs.existsSync(packRoot)) {
    console.error(`Asset pack not found: ${packRoot}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT_ROOT, { recursive: true });

  await sliceSheet(
    path.join(packRoot, "rooms/cuidala-rooms-sheet.png"),
    2,
    3,
    627,
    418,
    [
      "room-kitchen",
      "room-living",
      "room-bedroom",
      "room-bath",
      "room-laundry",
      "room-outdoors",
    ],
    WIDTHS.room,
  );

  await sliceSheet(
    path.join(packRoot, "appliances/cuidala-home-systems-sheet.png"),
    3,
    2,
    418,
    627,
    [
      "sys-water-heater",
      "sys-fridge",
      "sys-laundry",
      "sys-hvac",
      "sys-pool",
      "sys-irrigation",
    ],
    WIDTHS.sys,
  );

  await sliceSheet(
    path.join(packRoot, "seasonal/cuidala-seasonal-weather-sheet.png"),
    2,
    2,
    627,
    627,
    ["season-rain", "season-freeze", "season-summer", "season-fall"],
    WIDTHS.season,
  );

  const onboarding = path.join(packRoot, "onboarding/cuidala-onboarding-home-overview.png");
  await encodeStill(
    sharp(onboarding).extract({ left: 0, top: 0, width: 1254, height: 903 }),
    WIDTHS.cutaway,
    path.join(OUT_ROOT, "house-cutaway.webp"),
    "house-cutaway",
  );

  for (const id of ["sparkle-burst", "living-house", "shelf-scene", "breathing-loop"]) {
    await prepareLottie(packRoot, id);
  }

  await transparentPoster(packRoot, "living-house", "house", WIDTHS.house);
  await transparentPoster(packRoot, "shelf-scene", "shelf", WIDTHS.shelf);

  // Summary table
  const nameW = Math.max(...outputs.map((o) => o.name.length), 4);
  console.log(
    `${"file".padEnd(nameW)}  ${"bytes".padStart(8)}  ${"w".padStart(4)}  ${"h".padStart(4)}`,
  );
  let total = 0;
  for (const o of outputs.sort((a, b) => a.name.localeCompare(b.name))) {
    total += o.bytes;
    console.log(
      `${o.name.padEnd(nameW)}  ${String(o.bytes).padStart(8)}  ${String(o.width).padStart(4)}  ${String(o.height).padStart(4)}`,
    );
  }
  console.log(`\nTotal ${outputs.length} files, ${(total / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
