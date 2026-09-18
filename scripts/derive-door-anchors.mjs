/**
 * Re-derives the `door` anchor of every portrait kit from the rendered art.
 *
 * The Blender pass (tools/blender/portraits/render.py) took the centroid of
 * every face wearing the door colour — the back door, the jamb and the slab's
 * hidden edges included — and projected that. The result is pulled towards the
 * middle of the house and lands on the roof: the porch lantern, the string
 * lights, the wreath, the doormat, the cat and the closing-ceremony sparkle all
 * hang off that anchor, so all six sat in the wrong place. render.py now filters
 * to camera-facing faces the way the window pass always did, but the shipped
 * renders predate the fix and re-rendering needs Blender. This reads the doors
 * back out of the pixels instead.
 *
 * Two signals, because neither is enough alone:
 *
 *  - Colour. Doors are the one saturated red on an otherwise white-and-blue
 *    house. But so is the garden fence, which is the same brick-brown and sits
 *    at exactly the height a door does.
 *  - Palette. Swapping classic for slate repaints the house and leaves the
 *    props alone: the door moves ~100 in RGB, the fence moves ~5. Requiring
 *    both "red in classic" and "repainted by the palette" leaves the door.
 *
 * Then score what is left on the shape a front door has — about twice as tall
 * as it is wide, a plausible size, solid, standing on the ground rather than
 * floating — and take the best. Writes `{x, y, w, h}`: centre plus size, so
 * anchors can be placed off the door's own height instead of a guessed
 * fraction of the frame. A kit whose door the camera cannot see (`p` hides
 * its entrance under the overhang) is written as `null` and falls back to
 * `doorAnchor()` in src/lib/scene/portrait.ts.
 *
 *   node scripts/derive-door-anchors.mjs          # write the manifest
 *   node scripts/derive-door-anchors.mjs --check  # report, change nothing
 *
 * `--sheet <path>` also writes a contact sheet of every kit with the chosen
 * door boxed, which is the only honest way to confirm 21 of these at once.
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = "src/lib/scene/portrait-manifest.json";
/** Repainting the house between these two moves door pixels and not props. */
const BASE_PALETTE = "classic";
const ALT_PALETTE = "slate";
/** RGB distance between palettes that counts as "the palette repainted this". */
const REPAINTED = 40;

function isDoorRed(r, g, b) {
  return r >= 55 && r <= 215 && g <= r * 0.68 && b <= r * 0.55 && g >= b * 0.7;
}

async function raw(path) {
  return sharp(path).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
}

function doorMask(base, alt, info, kit) {
  const b = kit.houseBounds;
  const { width: W, height: H, channels: C } = info;
  const sx = W / kit.frame.w;
  const sy = H / kit.frame.h;
  // Never above the eaves: a door on the roof is the bug being fixed here.
  const x0 = Math.max(0, Math.round(b.x * sx));
  const x1 = Math.min(W, Math.round((b.x + b.w) * sx));
  const y0 = Math.max(0, Math.round((b.y + b.h * 0.35) * sy));
  const y1 = Math.min(H, Math.round((b.y + b.h) * sy));

  const mask = new Uint8Array(W * H);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * C;
      if (base[i + 3] < 200) continue;
      if (!isDoorRed(base[i], base[i + 1], base[i + 2])) continue;
      const dr = base[i] - alt[i];
      const dg = base[i + 1] - alt[i + 1];
      const db = base[i + 2] - alt[i + 2];
      if (Math.hypot(dr, dg, db) < REPAINTED) continue;
      mask[y * W + x] = 1;
    }
  }
  return { mask, W, H, sx, sy, x0, x1, y0, y1 };
}

function components({ mask, W, sx, sy, x0, x1, y0, y1 }) {
  const seen = new Uint8Array(mask.length);
  const out = [];
  const stack = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = y * W + x;
      if (!mask[p] || seen[p]) continue;
      stack.length = 0;
      stack.push(p);
      seen[p] = 1;
      let n = 0;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      while (stack.length) {
        const q = stack.pop();
        const qx = q % W;
        const qy = (q / W) | 0;
        n++;
        if (qx < minX) minX = qx;
        if (qx > maxX) maxX = qx;
        if (qy < minY) minY = qy;
        if (qy > maxY) maxY = qy;
        // 8-way: a door split by its own handle or a porch post is one door.
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const nx = qx + dx;
          const ny = qy + dy;
          if (nx < x0 || nx >= x1 || ny < y0 || ny >= y1) continue;
          const np = ny * W + nx;
          if (mask[np] && !seen[np]) {
            seen[np] = 1;
            stack.push(np);
          }
        }
      }
      const pw = maxX - minX + 1;
      const ph = maxY - minY + 1;
      out.push({ n, x: minX / sx, y: minY / sy, w: pw / sx, h: ph / sy, fill: n / (pw * ph) });
    }
  }
  return out;
}

/** How much a blob looks like a front door, 0 (not at all) upwards. */
function score(c, kit) {
  const b = kit.houseBounds;
  const aspect = c.h / c.w;
  if (aspect < 1.2 || aspect > 3.4) return 0;
  if (c.w < 16 || c.w > 80) return 0;
  if (c.h < 30 || c.h > 130) return 0;
  if (c.n < 250) return 0;
  if (c.fill < 0.3) return 0;
  // Standing on the ground floor, not hanging in the middle of the wall.
  const footing = (c.y + c.h - b.y) / b.h;
  if (footing < 0.55) return 0;
  const shape = 1 - Math.min(1, Math.abs(aspect - 2) / 1.4);
  const ground = 1 - Math.min(1, Math.abs(footing - 0.93) / 0.38);
  const size = Math.min(1, c.n / 1400);
  return shape * 1.4 + ground * 1.2 + size * 0.8 + c.fill * 0.6;
}

async function doorFor(id, kit) {
  const base = await raw(`public/portraits/${id}-${BASE_PALETTE}-day.webp`);
  const alt = await raw(`public/portraits/${id}-${ALT_PALETTE}-day.webp`);
  const ranked = components(doorMask(base.data, alt.data, base.info, kit))
    .map((c) => ({ c, s: score(c, kit) }))
    .filter((entry) => entry.s > 0)
    .sort((p, q) => q.s - p.s);
  if (!ranked.length) return null;
  const { c } = ranked[0];
  const round = (n) => Math.round(n * 10) / 10;
  return { x: round(c.x + c.w / 2), y: round(c.y + c.h / 2), w: round(c.w), h: round(c.h) };
}

async function sheet(manifest, doors, out) {
  const COL = 5;
  const CELL_W = 340;
  const CELL_H = 244;
  const ids = Object.keys(manifest).filter((id) => manifest[id].frame);
  const rows = Math.ceil(ids.length / COL);
  const tiles = [];
  for (const [i, id] of ids.entries()) {
    const kit = manifest[id];
    const d = doors[id];
    const marks = d
      ? `<rect x="${d.x - d.w / 2}" y="${d.y - d.h / 2}" width="${d.w}" height="${d.h}"
           fill="none" stroke="#ff2d78" stroke-width="5"/>
         <circle cx="${d.x}" cy="${d.y - d.h * 0.62}" r="11" fill="#ffd27f" stroke="#000" stroke-width="3"/>`
      : `<text x="${kit.frame.w / 2}" y="${kit.frame.h / 2}" fill="#ff2d78"
           font-size="70" text-anchor="middle">none</text>`;
    // Composite runs after resize in a sharp pipeline, so the overlay has to be
    // drawn at the tile's size — the frame only survives as the viewBox.
    const overlay = await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_W}" height="${CELL_H}"
              viewBox="0 0 ${kit.frame.w} ${kit.frame.h}" preserveAspectRatio="none">
           ${marks}
           <text x="16" y="60" fill="#ff2d78" font-size="52" font-family="monospace">${id}</text>
         </svg>`,
      ),
    )
      .resize(CELL_W, CELL_H, { fit: "fill" })
      .png()
      .toBuffer();
    const tile = await sharp(`public/portraits/${id}-${BASE_PALETTE}-day.webp`)
      .resize(CELL_W, CELL_H, { fit: "fill" })
      .composite([{ input: overlay }])
      .flatten({ background: { r: 24, g: 26, b: 32 } })
      .png()
      .toBuffer();
    tiles.push({ input: tile, left: (i % COL) * CELL_W, top: Math.floor(i / COL) * CELL_H });
  }
  await sharp({
    create: {
      width: COL * CELL_W,
      height: rows * CELL_H,
      channels: 4,
      background: { r: 24, g: 26, b: 32, alpha: 1 },
    },
  })
    .composite(tiles)
    .png()
    .toFile(out);
}

const args = process.argv.slice(2);
const check = args.includes("--check");
const sheetAt = args.includes("--sheet") ? args[args.indexOf("--sheet") + 1] : null;

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const doors = {};
let missing = 0;
for (const [id, kit] of Object.entries(manifest)) {
  if (!kit.frame) continue;
  const found = await doorFor(id, kit);
  doors[id] = found;
  const was = kit.door;
  if (!found) {
    missing++;
    console.log(`${id.padEnd(2)} no visible door — writing null (doorAnchor() default applies)`);
  } else {
    const moved = was ? Math.hypot(found.x - was.x, found.y - was.y).toFixed(0) : "—";
    console.log(
      `${id.padEnd(2)} ${was ? `${was.x},${was.y}` : "null"} -> ${found.x},${found.y} ` +
        `(${found.w}x${found.h}, moved ${moved}px)`,
    );
  }
  if (!check) kit.door = found;
}

if (sheetAt) {
  await sheet(manifest, doors, sheetAt);
  console.log(`\ncontact sheet: ${sheetAt}`);
}

if (!check) {
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nwrote ${MANIFEST}`);
}
if (missing) console.log(`${missing} kit(s) without a visible door`);
