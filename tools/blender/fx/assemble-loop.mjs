#!/usr/bin/env node
/**
 * Cross-fade 2N rendered frames into an N-frame seamless loop and write a
 * horizontal sprite strip as WebP.
 *
 *   node tools/blender/fx/assemble-loop.mjs FRAMES_DIR OUT.webp [--frames 24] [--quality 80]
 *
 * G_j = (1 - j/N) * F_(j+N) + (j/N) * F_j for j in 0..N-1. At j=0 it is F_N and
 * the frame after the last (j=N) would be F_N again, so the loop closes exactly;
 * noise does not repeat on its own, this is what makes it. Frames are blended
 * premultiplied so soft alpha edges do not fringe.
 */
import path from "node:path";
import sharp from "sharp";

const [src, dst] = process.argv.slice(2, 4);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const n = arg("--frames", 24);
const quality = arg("--quality", 80);
const direct = process.argv.includes("--direct"); // frames are already periodic
const blurSigma = arg("--blur", 1.4);

const load = async (k) => {
  const { data, info } = await sharp(path.join(src, `f${String(k).padStart(3, "0")}.png`))
    .ensureAlpha()
    // The volume render is grainy at a sane sample count; smoke is soft anyway,
    // and grain is what bloats a lossy strip.
    .blur(blurSigma)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};

const frames = [];
for (let k = 0; k < (direct ? n : 2 * n); k++) frames.push(await load(k));
const { w, h } = frames[0];
const strip = Buffer.alloc(w * n * h * 4);
for (let j = 0; j < n; j++) {
  const t = direct ? 1 : j / n;
  const a = direct ? frames[j].data : frames[j + n].data;
  const b = frames[j].data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const o = (y * w * n + j * w + x) * 4;
      const aa = (a[i + 3] / 255) * (1 - t);
      const ba = (b[i + 3] / 255) * t;
      const al = aa + ba;
      for (let c = 0; c < 3; c++) {
        const premul = (a[i + c] / 255) * aa + (b[i + c] / 255) * ba;
        strip[o + c] = al > 1e-4 ? Math.round(Math.min(1, premul / al) * 255) : 0;
      }
      strip[o + 3] = Math.round(Math.min(1, al) * 255);
    }
  }
}
await sharp(strip, { raw: { width: w * n, height: h, channels: 4 } }).webp({ quality, effort: 6 }).toFile(dst);
console.log(dst, w * n, "x", h);
