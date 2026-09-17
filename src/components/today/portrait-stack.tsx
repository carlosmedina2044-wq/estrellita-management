"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { PaletteId } from "@/lib/types";
import type { Season } from "@/lib/scene/season";
import { portraitLayerUrls, type PortraitWindowRect } from "@/lib/scene/portrait";
import { DUR_AMBIENT } from "@/lib/motion";
import { cn } from "@/lib/utils";

type PortraitStackProps = {
  kitType: string;
  palette: PaletteId;
  season: Season;
  dayOpacity: number;
  litCount: number;
  showSnow: boolean;
  /** True only for a live "just closed" or "just arrived" moment (not a
   * persisted closed day on reload, nor ordinary re-renders) — see
   * PortraitScene. Staggers the per-window fade so lights warm on
   * left-to-right instead of every lit window snapping/fading in sync, which
   * is otherwise indistinguishable from ordinary daytime progress lighting
   * one more window as chores get done. */
  stagger?: boolean;
  className?: string;
  /** Display width in CSS px; height follows manifest aspect. */
  widthPx?: number;
  style?: React.CSSProperties;
};

function windowClipPaths(
  windows: PortraitWindowRect[],
  litCount: number,
  frameW: number,
  frameH: number,
): string {
  const n = Math.max(0, Math.min(litCount, windows.length));
  if (n === 0) return "inset(50%)";
  const parts = windows.slice(0, n).map((w) => {
    const top = (w.y / frameH) * 100;
    const left = (w.x / frameW) * 100;
    const right = 100 - ((w.x + w.w) / frameW) * 100;
    const bottom = 100 - ((w.y + w.h) / frameH) * 100;
    return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
  });
  // CSS clip-path doesn't union easily; use a single expanded box covering lit windows.
  if (parts.length === 1) return parts[0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const w of windows.slice(0, n)) {
    minX = Math.min(minX, w.x);
    minY = Math.min(minY, w.y);
    maxX = Math.max(maxX, w.x + w.w);
    maxY = Math.max(maxY, w.y + w.h);
  }
  const top = (minY / frameH) * 100;
  const left = (minX / frameW) * 100;
  const right = 100 - (maxX / frameW) * 100;
  const bottom = 100 - (maxY / frameH) * 100;
  // Prefer per-window polygons via SVG mask when multiple — for Motion-friendly CSS,
  // stack separate clipped layers instead.
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}

export function PortraitStack({
  kitType,
  palette,
  season,
  dayOpacity,
  litCount,
  showSnow,
  stagger,
  className,
  widthPx,
  style,
}: PortraitStackProps) {
  const reduce = useReducedMotion();
  const layers = portraitLayerUrls(kitType as never, palette, season);
  const { frame, windows } = layers;
  const aspect = `${frame.w} / ${frame.h}`;

  return (
    <div
      className={cn("relative overflow-visible", className)}
      style={{ width: widthPx, aspectRatio: aspect, ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={layers.shadow}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={layers.night}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={layers.day}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        style={{ opacity: dayOpacity }}
      />

      {windows.length === 0 ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={layers.lit}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain mix-blend-screen transition-opacity duration-500"
            style={{ opacity: layers.windowCount ? litCount / layers.windowCount : 0 }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={layers.lit}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain mix-blend-screen blur-[6px] transition-opacity duration-500"
            style={{
              opacity: (layers.windowCount ? litCount / layers.windowCount : 0) * 0.6,
            }}
          />
        </>
      ) : (
        windows.map((w, i) => {
          const on = i < litCount;
          const clip = windowClipPaths([w], on ? 1 : 0, frame.w, frame.h);
          // Staggered only during a live ceremony or arrival — otherwise
          // every window that's already lit would carry a delay on ordinary
          // re-renders (e.g. the daily fraction ticking up), which reads as
          // lag, not choreography.
          const delay = stagger && !reduce ? `${i * 70}ms` : "0ms";
          return (
            <span key={w.id} className="contents">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={layers.lit}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain mix-blend-screen transition-opacity duration-500"
                style={{ clipPath: clip, opacity: on ? 1 : 0, transitionDelay: delay }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={layers.lit}
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full object-contain mix-blend-screen blur-[6px] transition-opacity duration-500"
                style={{ clipPath: clip, opacity: on ? 0.6 : 0, transitionDelay: delay }}
              />
            </span>
          );
        })
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={season}
          className="pointer-events-none absolute inset-0"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: reduce ? 0 : DUR_AMBIENT }}
        >
          {/* Night foliage underneath, day crossfaded over it on the same
              dayOpacity as the house layers — otherwise the trees stay lit for
              noon while the house goes dark. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={layers.foliageNight}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={layers.foliageDay}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ opacity: dayOpacity }}
          />
        </motion.div>
      </AnimatePresence>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={layers.snow}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-700"
        style={{ opacity: showSnow ? 1 : 0 }}
      />
    </div>
  );
}
