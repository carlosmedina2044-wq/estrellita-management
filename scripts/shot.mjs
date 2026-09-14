#!/usr/bin/env node
/**
 * Capture a URL at an iPhone-sized viewport.
 *
 * Usage:
 *   node scripts/shot.mjs --url URL --out FILE [--width 390] [--height 844] [--dark 1] [--wait-ms 0]
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/Users/medina/.local/share/node-tools/index.mjs";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const url = arg("url");
const out = arg("out");
if (!url || !out) {
  console.error("Usage: node scripts/shot.mjs --url URL --out FILE [--width 390] [--height 844] [--dark 1] [--wait-ms 0]");
  process.exit(1);
}

const width = Number(arg("width", "390"));
const height = Number(arg("height", "844"));
const dark = arg("dark", "0") === "1";
const waitMs = Number(arg("wait-ms", "0"));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 2,
});
await page.goto(url, { waitUntil: "networkidle" });
if (dark) {
  await page.evaluate(() => document.documentElement.classList.add("dark"));
}
if (waitMs > 0) await page.waitForTimeout(waitMs);
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log(out);
