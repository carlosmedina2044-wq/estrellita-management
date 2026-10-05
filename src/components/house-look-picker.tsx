"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { SceneBoundary } from "@/components/scene-boundary";
import { PortraitScene } from "@/components/today/portrait-scene";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { toISODate } from "@/lib/dates";
import { dayArc } from "@/lib/momentum";
import { SPRING_SETTLE } from "@/lib/motion";
import { hapticPress } from "@/lib/native/haptics";
import { PALETTE_LIST } from "@/lib/scene/palettes";
import { paletteLocks, paletteLocksAtLevel } from "@/lib/scene/unlocks";
import { portraitKit } from "@/lib/scene/portrait";
import { previewHousehold } from "@/lib/scene/preview-household";
import { skyPhase, sunTimes } from "@/lib/scene/sun";
import { sceneWeather } from "@/lib/scene/weather";
import type { Household, KitType, PaletteId } from "@/lib/types";
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
  home,
  onChange,
}: {
  kitType: KitType;
  palette: PaletteId;
  order: KitType[];
  now: Date;
  lat?: number;
  lng?: number;
  /** The real home, for the colours it has earned. Left out during onboarding,
   * where nothing has been earned yet — the ladder still shows there, with
   * every locked colour naming the level that opens it. */
  home?: Household;
  onChange: (next: { kitType: KitType; palette: PaletteId }) => void;
}) {
  const { t } = useLocale();
  const household = useMemo(() => previewHousehold("Casa"), []);
  const sceneTimes = useMemo(() => (lat != null && lng != null ? sunTimes(lat, lng, now) : null), [lat, lng, now]);
  const scenePhase = useMemo(() => skyPhase(now, sceneTimes), [now, sceneTimes]);
  const arc = useMemo(() => dayArc(household, now, "all"), [household, now]);
  const weather = useMemo(() => sceneWeather(null, toISODate(now)), [now]);
  // A colour nobody has earned still shows, named by the level that opens it.
  // A locked swatch with its requirement on it *is* the ladder — hiding them
  // would leave the picker looking like three choices, one of which happens
  // to be missing.
  const locks = useMemo(
    () => (home ? paletteLocks(home, now, palette) : paletteLocksAtLevel("settling-in", palette)),
    [home, now, palette],
  );
  const lockFor = (id: PaletteId) => locks.find((entry) => entry.palette === id) ?? null;
  const [explained, setExplained] = useState<PaletteId | null>(null);
  const explainedLock = explained ? lockFor(explained) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="shrink-0 overflow-hidden rounded-2xl">
        {/* The thumbnails and swatches below still work without the preview,
            so a broken render costs the picture, not the step. */}
        <SceneBoundary fallback={<div aria-hidden className="h-[272px] bg-secondary" />}>
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
        </SceneBoundary>
      </div>

      <div className="app-h-scroll -mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-1">
        {order.map((kit, index) => {
          const files = portraitKit(kit).files.day;
          const thumb = files[palette] ?? files.classic;
          const selected = kit === kitType;
          const name = t("settings.houseLookOption", { index: index + 1, total: order.length });
          return (
            <button
              key={kit}
              type="button"
              aria-pressed={selected}
              // All 21 thumbnails shared one label, so VoiceOver read the
              // same string 21 times with nothing to tell them apart.
              aria-label={name}
              onClick={() => {
                void hapticPress();
                onChange({ kitType: kit, palette });
              }}
              // Three tiles and a ~12% sliver of the fourth fill the row, so it
              // reads as scrollable. Every tile is the same size; selection is
              // an inset ring on top, never a size or background change.
              className="flex w-[calc((100%-20px)/3.12)] shrink-0 snap-start flex-col items-stretch gap-1.5"
            >
              <span className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb} alt="" draggable={false} className="size-full object-cover" />
                {selected ? (
                  <motion.span
                    layoutId="kit-ring"
                    className="pointer-events-none absolute inset-0 rounded-2xl ring-[3px] ring-inset ring-primary"
                    transition={SPRING_SETTLE}
                  />
                ) : null}
                {selected ? (
                  <span
                    aria-hidden
                    className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check className="size-3.5" />
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden
                className={cn(
                  "block min-h-[2lh] text-center ui-caption",
                  selected ? "font-medium text-primary" : "text-muted-foreground",
                )}
              >
                {name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          {PALETTE_LIST.map((swatch) => {
            const lock = lockFor(swatch.id);
            const locked = Boolean(lock && !lock.unlocked);
            const label = t(swatch.labelKey);
            const chosen = palette === swatch.id;
            return (
              <button
                key={swatch.id}
                type="button"
                aria-pressed={chosen}
                aria-label={
                  locked && lock?.needs
                    ? t("portrait.paletteLocked", {
                        palette: label,
                        level: t(`care.level.${lock.needs}` as MessageKey),
                      })
                    : label
                }
                onClick={() => {
                  void hapticPress();
                  if (locked) {
                    setExplained(swatch.id);
                    return;
                  }
                  setExplained(null);
                  onChange({ kitType, palette: swatch.id });
                }}
                className="flex min-h-11 flex-col items-center justify-start gap-1.5"
              >
                {/* Same 48px box for every swatch; the selected ring lives
                    inside it so nothing grows or shifts. */}
                <span
                  className={cn(
                    "relative flex size-12 items-center justify-center rounded-full ring-2 ring-inset",
                    chosen ? "ring-primary" : "ring-transparent",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("block size-9 overflow-hidden rounded-full", locked && "opacity-40 saturate-50")}
                    style={{ background: `linear-gradient(135deg, ${swatch.wall} 50%, ${swatch.roof} 50%)` }}
                  />
                  {locked ? (
                    <span aria-hidden className="absolute inset-0 flex items-center justify-center text-foreground/70">
                      <Lock className="size-4" />
                    </span>
                  ) : null}
                </span>
                <span className="flex flex-col items-center text-center">
                  <span className={cn("ui-caption", chosen ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {label}
                  </span>
                  {locked && lock?.needs ? (
                    <span className="ui-caption text-muted-foreground">
                      {t("portrait.paletteLockedChip", { level: t(`care.level.${lock.needs}` as MessageKey) })}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        {locks.some((entry) => !entry.unlocked) && !explainedLock?.needs ? (
          <p className="ui-caption text-center text-muted-foreground">{t("portrait.paletteLockedHelp")}</p>
        ) : null}
        {explainedLock?.needs ? (
          <p className="ui-caption text-center text-muted-foreground">
            {t("portrait.paletteLocked", {
              palette: t(`portrait.palette.${explainedLock.palette}` as MessageKey),
              level: t(`care.level.${explainedLock.needs}` as MessageKey),
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
