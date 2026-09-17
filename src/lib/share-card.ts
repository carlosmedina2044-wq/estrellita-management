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
  shadow: string;
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
const PANEL = "#faf6ef";
const INK = "#1d1d1f";
const INK_SOFT = "rgba(29, 29, 31, 0.62)";
const CREAM_TEXT = "#f7f3ec";

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
  const [shadow, night, day, lit, foliageDay, foliageNight, snow] = await Promise.all([
    loadImage(layers.shadow),
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
  draw(shadow);
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
  const headlinePx = fitText(ctx, model.headline, CARD_WIDTH - pad * 2, 72, 44, "700");
  ctx.fillText(model.headline, pad, y);
  y += Math.round(headlinePx * 0.8);
  ctx.fillStyle = INK_SOFT;
  fitText(ctx, model.subline, CARD_WIDTH - pad * 2, 34, 24, "500");
  ctx.fillText(model.subline, pad, y);

  // Stats
  y += 120;
  const colWidth = (CARD_WIDTH - pad * 2) / model.stats.length;
  model.stats.forEach((stat, index) => {
    const x = pad + colWidth * index;
    ctx.fillStyle = INK;
    fitText(ctx, stat.value, colWidth - 16, 84, 40, "700");
    ctx.fillText(stat.value, x, y);
    ctx.fillStyle = INK_SOFT;
    fitText(ctx, stat.label, colWidth - 16, 30, 20, "500");
    ctx.fillText(stat.label, x, y + 44);
  });

  // Footnote and brand
  const baseline = CARD_HEIGHT - 72;
  if (model.footnote) {
    ctx.fillStyle = INK;
    fitText(ctx, model.footnote, CARD_WIDTH / 2, 34, 22, "600");
    ctx.fillText(model.footnote, pad, baseline);
  }
  ctx.fillStyle = INK_SOFT;
  ctx.font = "600 30px ui-rounded, -apple-system, system-ui, sans-serif";
  const brandWidth = ctx.measureText(model.brand).width;
  ctx.fillText(model.brand, CARD_WIDTH - pad - brandWidth, baseline);

  // Sky text tone is only used for the headline over the sky in the live
  // scene; the card keeps words on the panel, so nothing else to do here.
  void CREAM_TEXT;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}
