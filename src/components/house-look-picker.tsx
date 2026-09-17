"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { PortraitScene } from "@/components/today/portrait-scene";
import { useLocale } from "@/i18n/locale-provider";
import { toISODate } from "@/lib/dates";
import { dayArc } from "@/lib/momentum";
import { SPRING_SETTLE } from "@/lib/motion";
import { hapticPress } from "@/lib/native/haptics";
import { PALETTE_LIST } from "@/lib/scene/palettes";
import { portraitKit } from "@/lib/scene/portrait";
import { previewHousehold } from "@/lib/scene/preview-household";
import { skyPhase, sunTimes } from "@/lib/scene/sun";
import { sceneWeather } from "@/lib/scene/weather";
import type { KitType, PaletteId } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Live preview + picker for the house's style and palette. The preview
 * household's own `homeSpec` is never touched here — `overrides` on
 * `PortraitScene` already takes priority over it, so a fixed placeholder
 * household is enough and the whole thing stays reactive to `kitType`/
 * `palette` without rebuilding anything.
 */
export function HouseLookPicker({
  kitType,
  palette,
  order,
  now,
  lat,
  lng,
  onChange,
}: {
  kitType: KitType;
  palette: PaletteId;
  order: KitType[];
  now: Date;
  lat?: number;
  lng?: number;
  onChange: (next: { kitType: KitType; palette: PaletteId }) => void;
}) {
  const { t } = useLocale();
  const household = useMemo(() => previewHousehold("Casa"), []);
  const sceneTimes = useMemo(() => (lat != null && lng != null ? sunTimes(lat, lng, now) : null), [lat, lng, now]);
  const scenePhase = useMemo(() => skyPhase(now, sceneTimes), [now, sceneTimes]);
  const arc = useMemo(() => dayArc(household, now, "all"), [household, now]);
  const weather = useMemo(() => sceneWeather(null, toISODate(now)), [now]);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl">
        <PortraitScene
          household={household}
          arc={arc}
          phase={scenePhase.phase}
          phaseT={scenePhase.t}
          weather={weather}
          ceremony={false}
          greeting=""
          secondaryLine=""
          insetTop={false}
          overrides={{ kitType, palette, windowsLit: 0 }}
        />
      </div>

      <div className="app-h-scroll -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
        {order.map((kit) => {
          const files = portraitKit(kit).files.day;
          const thumb = files[palette] ?? files.classic;
          const selected = kit === kitType;
          return (
            <button
              key={kit}
              type="button"
              aria-pressed={selected}
              aria-label={t("settings.houseLook")}
              onClick={() => {
                void hapticPress();
                onChange({ kitType: kit, palette });
              }}
              className="relative size-[104px] shrink-0 snap-center overflow-hidden rounded-2xl bg-secondary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="" draggable={false} className="size-full object-cover" />
              {selected ? (
                <motion.div
                  layoutId="kit-ring"
                  className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-primary"
                  transition={SPRING_SETTLE}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-5">
        {PALETTE_LIST.map((swatch) => (
          <button
            key={swatch.id}
            type="button"
            aria-pressed={palette === swatch.id}
            onClick={() => {
              void hapticPress();
              onChange({ kitType, palette: swatch.id });
            }}
            className="flex flex-col items-center gap-1.5"
          >
            <span
              aria-hidden
              className={cn(
                "block size-10 overflow-hidden rounded-full ring-2 ring-offset-2 ring-offset-background",
                palette === swatch.id ? "ring-primary" : "ring-transparent",
              )}
              style={{ background: `linear-gradient(135deg, ${swatch.wall} 50%, ${swatch.roof} 50%)` }}
            />
            <span className="ui-caption text-muted-foreground">{t(swatch.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
