#!/usr/bin/env node
/**
 * Measure Today hero heights and capture screenshots for M7-09-r2.
 *
 * Usage:
 *   node scripts/measure-hero.mjs [--base http://127.0.0.1:3456] [--shot 1]
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, sharp } from "/Users/medina/.local/share/node-tools/index.mjs";

const base = (() => {
  const i = process.argv.indexOf("--base");
  return i === -1 ? "http://127.0.0.1:3456" : process.argv[i + 1];
})();
const doShot = process.argv.includes("--shot");

const STATES = [
  "open-many",
  "open-one",
  "closed-settled",
  "clear",
  "momentum-off",
];
const EXTRA = [
  { state: "open-many", locale: "es", label: "es-open" },
  { state: "closed-settled", locale: "pt-BR", label: "pt-BR-closed" },
];

const outDir = ".verify-screenshots/M7-09-r2";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--ignore-gpu-blocklist"],
});

const results = [];

async function measure(page, state, theme, locale) {
  const params = new URLSearchParams({ state, theme });
  if (locale) params.set("locale", locale);
  const url = `${base}/dev/hero/?${params}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForSelector('[data-locale-ready="1"]', { timeout: 30_000 });
  await page.waitForSelector("[data-today-hero]", { timeout: 30_000 });
  // Let fonts/layout settle
  await page.waitForTimeout(250);
  const height = await page.evaluate(() => {
    const el = document.querySelector("[data-today-hero]");
    return el ? el.getBoundingClientRect().height : -1;
  });
  const headline = await page.evaluate(() => {
    const h1 = document.querySelector("[data-today-hero] h1");
    return h1?.textContent?.trim() ?? "";
  });
  const label = locale
    ? `${locale === "pt-BR" ? "pt-BR" : locale}-${state.startsWith("open") ? "open" : "closed"}`
    : `${state}-${theme}`;
  results.push({ state, theme, locale: locale ?? "en", height, headline, label });

  if (doShot) {
    const pngPath = path.join(outDir, `${label}.png`);
    await page.screenshot({ path: pngPath, fullPage: false });
    const webpPath = path.join(outDir, `${label}.webp`);
    await sharp(pngPath).webp({ quality: 90 }).toFile(webpPath);
  }
  return height;
}

const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

for (const theme of ["light", "dark"]) {
  for (const state of STATES) {
    await measure(page, state, theme, null);
  }
}
for (const theme of ["light", "dark"]) {
  for (const extra of EXTRA) {
    await measure(page, extra.state, theme, extra.locale);
  }
}

// Ceremony capture at ~600ms
if (doShot) {
  for (const theme of ["light", "dark"]) {
    const params = new URLSearchParams({
      state: "closed-mid-ceremony",
      theme,
    });
    await page.goto(`${base}/dev/hero/?${params}`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForSelector('[data-locale-ready="1"]');
    await page.waitForSelector("[data-today-hero]");
    await page.waitForTimeout(600);
    const label = `closed-mid-ceremony-${theme}`;
    const pngPath = path.join(outDir, `${label}.png`);
    await page.screenshot({ path: pngPath, fullPage: false });
    await sharp(pngPath)
      .webp({ quality: 90 })
      .toFile(path.join(outDir, `${label}.webp`));
    const height = await page.evaluate(() => {
      const el = document.querySelector("[data-today-hero]");
      return el ? el.getBoundingClientRect().height : -1;
    });
    results.push({
      state: "closed-mid-ceremony",
      theme,
      locale: "en",
      height,
      headline: "",
      label,
    });
  }
}

await browser.close();

const openMax = Math.max(
  ...results
    .filter((r) => r.state.startsWith("open") || r.label.includes("open"))
    .map((r) => r.height),
);
const closedMax = Math.max(
  ...results
    .filter(
      (r) =>
        r.state.startsWith("closed") ||
        r.label.includes("closed") ||
        r.state === "clear" ||
        r.state === "momentum-off",
    )
    .map((r) => r.height),
);

console.log(JSON.stringify({ results, openMax, closedMax }, null, 2));
console.log(
  `BUDGET open<=260 closed<=400 | openMax=${openMax.toFixed(1)} closedMax=${closedMax.toFixed(1)} | openOK=${openMax <= 260} closedOK=${closedMax <= 400}`,
);
