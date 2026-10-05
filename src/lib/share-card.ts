import type { SkyStops } from "@/lib/scene/sky";
import type { PortraitWindowRect } from "@/lib/scene/portrait";
import type { WindowState } from "@/lib/scene/window-rooms";

/** Everything the composer needs that is not a picture. Pure, so it is testable. */
export type ShareCardModel = {
  headline: string;
  subline: string;
  stats: Array<{ value: string; label: string }>;
  footnote: string | null;
  brand: string;
};

export type ShareCardLayers = {
  groundDay: string;
  groundNight: string;
  night: string;
  day: string;
  lit: string;
  foliageDay: string;
  foliageNight: string;
  snow: string;
  frame: { w: number; h: number };
  windows: PortraitWindowRect[];
};

export type ShareCardScene = {
  layers: ShareCardLayers;
  sky: SkyStops;
  /** 0 at night, 1 by day (the same value the live scene crossfades on). */
  dayOpacity: number;
  windowStates: WindowState[];
  snow: boolean;
};

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
/** The sky takes the top of the card; the panel below carries the words. */
export const SKY_HEIGHT = Math.round(CARD_HEIGHT * 0.62);
const STACK_WIDTH_FRACTION = 0.78;
const PANEL = "#f4f1ec";
const INK = "#1d1d1f";
const INK_SOFT = "rgba(29, 29, 31, 0.62)";
const CREAM_TEXT = "#f7f3ec";
/** Matches `--primary` / `--brand` in light mode (globals.css) — the card's
 * panel is always the light cream regardless of the app's own theme, so the
 * accent is fixed rather than read from CSS. */
const ACCENT = "#2f5d8a";
const DIVIDER = "rgba(29, 29, 31, 0.12)";
const BRAND_MARK_SRC = "/brand/cuidala-mark.webp";

export type StackBox = { x: number; y: number; w: number; h: number };

/** Where the house stack sits on the card: centred, its visible base a
 * little above the panel edge, sized from the kit's frame aspect. */
export function stackBox(frame: { w: number; h: number }): StackBox {
  const w = Math.round(CARD_WIDTH * STACK_WIDTH_FRACTION);
  const h = Math.round((w * frame.h) / frame.w);
  const x = Math.round((CARD_WIDTH - w) / 2);
  const y = SKY_HEIGHT - h + Math.round(h * 0.06);
  return { x, y, w, h };
}

/** A window rect from kit-frame coordinates onto the card. */
export function windowOnCard(rect: PortraitWindowRect, frame: { w: number; h: number }, box: StackBox): StackBox {
  return {
    x: box.x + (rect.x / frame.w) * box.w,
    y: box.y + (rect.y / frame.h) * box.h,
    w: (rect.w / frame.w) * box.w,
    h: (rect.h / frame.h) * box.h,
  };
}

export function closedDayCardModel(input: {
  home: string;
  headline: string;
  done: number;
  minutes: number;
  rooms: number;
  labels: { done: string; minutes: string; rooms: string };
  runLine: string | null;
  careLine: string;
  brand: string;
  privateMode: boolean;
}): ShareCardModel {
  return {
    headline: input.headline,
    subline: input.privateMode ? input.careLine : `${input.home} · ${input.careLine}`,
    stats: [
      { value: String(input.done), label: input.labels.done },
      { value: String(input.minutes), label: input.labels.minutes },
      { value: String(input.rooms), label: input.labels.rooms },
    ],
    footnote: input.runLine,
    brand: input.brand,
  };
}

export function yearCardModel(input: {
  home: string;
  headline: string;
  closedDays: number;
  bestRun: number;
  hoursText: string;
  labels: { closed: string; best: string; hours: string };
  careLine: string;
  brand: string;
  privateMode: boolean;
}): ShareCardModel {
  return {
    headline: input.headline,
    subline: input.privateMode ? input.careLine : `${input.home} · ${input.careLine}`,
    stats: [
      { value: String(input.closedDays), label: input.labels.closed },
      { value: String(input.bestRun), label: input.labels.best },
      { value: input.hoursText, label: input.labels.hours },
    ],
    footnote: null,
    brand: input.brand,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed: ${src}`));
    img.src = src;
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, minPx: number, weight: string): number {
  let px = startPx;
  while (px > minPx) {
    ctx.font = `${weight} ${px}px ui-rounded, -apple-system, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 2;
  }
  return px;
}

/**
 * Draws the house in its current sky over a cream panel with the day's or the
 * year's numbers, at 1080 by 1350 (the 4:5 that every feed keeps whole).
 * Browser only: the callers hand the blob to the share sheet.
 */
export async function renderShareCard(scene: ShareCardScene, model: ShareCardModel): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, SKY_HEIGHT);
  sky.addColorStop(0, scene.sky.top);
  sky.addColorStop(0.55, scene.sky.mid);
  sky.addColorStop(1, scene.sky.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CARD_WIDTH, SKY_HEIGHT);

  // House
  const { layers } = scene;
  const box = stackBox(layers.frame);
  const [groundNight, groundDay, night, day, lit, foliageDay, foliageNight, snow] = await Promise.all([
    loadImage(layers.groundNight),
    loadImage(layers.groundDay),
    loadImage(layers.night),
    loadImage(layers.day),
    loadImage(layers.lit),
    loadImage(layers.foliageDay),
    loadImage(layers.foliageNight),
    loadImage(layers.snow),
  ]);
  const draw = (img: HTMLImageElement, alpha = 1) => {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, box.x, box.y, box.w, box.h);
    ctx.globalAlpha = 1;
  };
  draw(groundNight);
  draw(groundDay, scene.dayOpacity);
  draw(night);
  draw(day, scene.dayOpacity);
  layers.windows.forEach((rect, index) => {
    const state = scene.windowStates[index] ?? "off";
    if (state === "off") return;
    const on = windowOnCard(rect, layers.frame, box);
    ctx.save();
    ctx.beginPath();
    ctx.rect(on.x, on.y, on.w, on.h);
    ctx.clip();
    ctx.globalCompositeOperation = "screen";
    draw(lit, state === "dim" ? 0.35 : 1);
    ctx.restore();
  });
  draw(foliageNight);
  draw(foliageDay, scene.dayOpacity);
  if (scene.snow) draw(snow);

  // Panel
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, SKY_HEIGHT, CARD_WIDTH, CARD_HEIGHT - SKY_HEIGHT);
  const pad = 72;
  let y = SKY_HEIGHT + 96;
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  const headlinePx = fitText(ctx, model.headline, CARD_WIDTH - pad * 2, 76, 44, "700");
  ctx.fillText(model.headline, pad, y);
  y += Math.round(headlinePx * 0.8);
  ctx.fillStyle = INK_SOFT;
  fitText(ctx, model.subline, CARD_WIDTH - pad * 2, 34, 24, "500");
  ctx.fillText(model.subline, pad, y);

  // A thin rule separates the headline from the numbers, so the card reads
  // as one thing said, then the count of it — not a wall of equal-weight text.
  y += 56;
  ctx.strokeStyle = DIVIDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(CARD_WIDTH - pad, y);
  ctx.stroke();

  // Stats: the number carries the brand color, so the eye lands on what was
  // accomplished before it reads what the number means. A vertical rule
  // between columns keeps three numbers from reading as one long one.
  y += 108;
  const colWidth = (CARD_WIDTH - pad * 2) / model.stats.length;
  model.stats.forEach((stat, index) => {
    const x = pad + colWidth * index;
    if (index > 0) {
      ctx.strokeStyle = DIVIDER;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 8, y - 84);
      ctx.lineTo(x - 8, y + 40);
      ctx.stroke();
    }
    ctx.fillStyle = ACCENT;
    fitText(ctx, stat.value, colWidth - 24, 88, 40, "700");
    ctx.fillText(stat.value, x, y);
    ctx.fillStyle = INK_SOFT;
    fitText(ctx, stat.label, colWidth - 24, 30, 20, "500");
    ctx.fillText(stat.label, x, y + 44);
  });

  // Footnote, drawn as an earned badge — a streak is worth more than a line
  // of small text can say, and a plain sentence here read as an
  // afterthought rather than something to be glad about.
  const baseline = CARD_HEIGHT - 76;
  if (model.footnote) {
    ctx.font = "600 32px ui-rounded, -apple-system, system-ui, sans-serif";
    const textWidth = ctx.measureText(model.footnote).width;
    const badgeH = 64;
    const badgeW = textWidth + 56;
    const badgeY = baseline - badgeH + 16;
    const radius = badgeH / 2;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.moveTo(pad + radius, badgeY);
    ctx.arcTo(pad + badgeW, badgeY, pad + badgeW, badgeY + badgeH, radius);
    ctx.arcTo(pad + badgeW, badgeY + badgeH, pad, badgeY + badgeH, radius);
    ctx.arcTo(pad, badgeY + badgeH, pad, badgeY, radius);
    ctx.arcTo(pad, badgeY, pad + badgeW, badgeY, radius);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = CREAM_TEXT;
    ctx.fillText(model.footnote, pad + 28, baseline - 16);
  }

  // Brand lockup: the real mark, not just its name in small type — a shared
  // card with no visible logo reads as a generic screenshot, not something
  // from an app the person is glad to be using.
  try {
    const mark = await loadImage(BRAND_MARK_SRC);
    const markSize = 52;
    ctx.font = "600 34px ui-rounded, -apple-system, system-ui, sans-serif";
    const brandWidth = ctx.measureText(model.brand).width;
    const lockupWidth = markSize + 16 + brandWidth;
    const markX = CARD_WIDTH - pad - lockupWidth;
    ctx.drawImage(mark, markX, baseline - markSize + 10, markSize, markSize);
    ctx.fillStyle = INK;
    ctx.fillText(model.brand, markX + markSize + 16, baseline);
  } catch {
    // No mark (offline asset load failed, or a non-browser test runner) —
    // the wordmark alone still identifies the card.
    ctx.fillStyle = INK;
    ctx.font = "600 34px ui-rounded, -apple-system, system-ui, sans-serif";
    const brandWidth = ctx.measureText(model.brand).width;
    ctx.fillText(model.brand, CARD_WIDTH - pad - brandWidth, baseline);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}
