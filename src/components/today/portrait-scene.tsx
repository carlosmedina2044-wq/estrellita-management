"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion, useSpring } from "motion/react";
import { CalendarDays, Settings } from "lucide-react";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { Clouds } from "@/components/today/clouds";
import { PortraitStack } from "@/components/today/portrait-stack";
import { SkyDisc } from "@/components/today/sky-disc";
import { StatusGlyphs } from "@/components/today/status-glyphs";
import { WeatherLayer } from "@/components/today/weather-layer";
import { useLocale } from "@/i18n/locale-provider";
import { houseLight } from "@/lib/scene/light";
import {
  dayOpacityForPhase,
  gradeOpacityForPhase,
  portraitKit,
  portraitLayerUrls,
  resolveHomeSpec,
} from "@/lib/scene/portrait";
import { seasonFor, type Season } from "@/lib/scene/season";
import type { SkyPhase } from "@/lib/scene/sun";
import { sunPosition } from "@/lib/scene/sun";
import type { SceneWeather } from "@/lib/scene/weather";
import type { DayArc } from "@/lib/momentum";
import type { CareLevelId, Household, KitType, PaletteId } from "@/lib/types";
import { cn } from "@/lib/utils";

const CARE_TO_GARDEN: Record<CareLevelId, 0 | 1 | 2 | 3 | 4> = {
  "settling-in": 0,
  kept: 1,
  "well-kept": 2,
  "cared-for": 3,
  loved: 4,
};

export type PortraitSceneOverrides = {
  kitType?: KitType;
  palette?: PaletteId;
  phase?: SkyPhase;
  phaseT?: number;
  weather?: SceneWeather;
  season?: Season;
  windowsLit?: number;
  closedToday?: boolean;
};

type PortraitSceneProps = {
  household: Household;
  arc: DayArc;
  phase: SkyPhase;
  phaseT: number;
  weather: SceneWeather;
  ceremony: boolean;
  greeting: string;
  secondaryLine: string;
  onOpenSettings?: () => void;
  onOpenCalendar?: () => void;
  overrides?: PortraitSceneOverrides;
  className?: string;
};

function useMinuteTicker(enabled: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.hidden) return;
      setNow(new Date());
    };
    const id = window.setInterval(tick, 30_000);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled]);
  return now;
}

function useGyroOffset(enabled: boolean) {
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 120, damping: 20 });
  const y = useSpring(0, { stiffness: 120, damping: 20 });

  useEffect(() => {
    if (!enabled || reduce) {
      x.set(0);
      y.set(0);
      return;
    }
    const onOrient = (event: DeviceOrientationEvent) => {
      const beta = event.beta ?? 0;
      const gamma = event.gamma ?? 0;
      const clamp = (n: number, max: number) => Math.max(-max, Math.min(max, n));
      x.set(clamp(gamma, 4) * (6 / 4));
      y.set(clamp(beta - 45, 4) * (6 / 4));
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [enabled, reduce, x, y]);

  return { x, y };
}

export function PortraitScene({
  household,
  arc,
  phase: phaseProp,
  phaseT: phaseTProp,
  weather: weatherProp,
  ceremony,
  greeting,
  secondaryLine,
  onOpenSettings,
  onOpenCalendar,
  overrides,
  className,
}: PortraitSceneProps) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const minuteNow = useMinuteTicker(true);
  const homeSpec = useMemo(() => {
    const base = resolveHomeSpec(household);
    return {
      ...base,
      kitType: overrides?.kitType ?? base.kitType,
      palette: overrides?.palette ?? base.palette,
    };
  }, [household, overrides?.kitType, overrides?.palette]);

  const phase = overrides?.phase ?? phaseProp;
  const phaseT = overrides?.phaseT ?? phaseTProp;
  const weather = overrides?.weather ?? weatherProp;
  const lat = household.location.lat;
  const season =
    overrides?.season ?? seasonFor(minuteNow, lat != null ? lat : null);
  const kit = portraitKit(homeSpec.kitType);
  const windowCount = kit.windowCount || kit.windows.length || 1;
  const closedToday = overrides?.closedToday ?? arc.state === "closed";
  const gardenLevel = CARE_TO_GARDEN[household.momentum.care?.level ?? "settling-in"];
  const light = houseLight(arc, phase, closedToday, season, gardenLevel, windowCount);
  const litCount =
    overrides?.windowsLit ?? (ceremony ? windowCount : light.windowsLit);

  const dayOpacity = dayOpacityForPhase(phase, phaseT);
  const gradeOpacity = gradeOpacityForPhase(phase, phaseT);
  const showSnow = weather.kind === "snow";
  const precip =
    weather.kind === "rain" || weather.kind === "snow" ? Math.max(0.35, weather.precipIntensity) : 0;

  const gyro = useGyroOffset(!reduce);
  const sun =
    lat != null && household.location.lng != null
      ? sunPosition(lat, household.location.lng, minuteNow)
      : null;

  const ariaLabel = t("scene.label", {
    phase: t(`scene.phase.${phase}`),
    weather: t(`scene.weather.${weather.kind}`),
    lit: String(litCount),
    windows: String(windowCount),
    count: String(Math.max(0, arc.open)),
  });

  const door = kit.door;
  const stackWidthPct = 62;
  // Transparent padding beneath the house inside its own render, as a fraction
  // of the image box, converted to viewport width so it can offset the box.
  const houseBelowFrac = Math.max(
    0,
    1 - (kit.houseBounds.y + kit.houseBounds.h) / kit.frame.h,
  );
  const belowVw = houseBelowFrac * stackWidthPct * (kit.frame.h / kit.frame.w);

  // The phase grading has to be masked to the artwork. Painted as a plain
  // rectangle it tints the portrait's whole bounding box — including all the
  // transparent sky around the house — which rendered as a hard-edged dark
  // box over the sky at dusk and night. Masking with the night layer (the
  // house silhouette) plus the current foliage layer (the trees) means the
  // grade lands only where there are actually pixels to grade.
  const layerUrls = portraitLayerUrls(homeSpec.kitType, homeSpec.palette, season);
  const artMask: React.CSSProperties = {
    WebkitMaskImage: `url("${layerUrls.night}"), url("${layerUrls.foliageDay}")`,
    maskImage: `url("${layerUrls.night}"), url("${layerUrls.foliageDay}")`,
    WebkitMaskSize: "100% 100%, 100% 100%",
    maskSize: "100% 100%, 100% 100%",
    WebkitMaskRepeat: "no-repeat, no-repeat",
    maskRepeat: "no-repeat, no-repeat",
    WebkitMaskComposite: "source-over",
    maskComposite: "add",
  };

  return (
    <section
      role="img"
      aria-label={ariaLabel}
      data-home-scene
      className={cn(
        "relative w-full overflow-hidden",
        className,
      )}
      style={{
        // 300px put the first chore 611px down a 716px pane — one visible task
        // row. 256px freed the fold but left nothing between the header, the
        // sky and the roof. 272px keeps three chores above the fold and gives
        // the composition room to breathe.
        height: "calc(env(safe-area-inset-top) + 272px)",
        background:
          "linear-gradient(var(--sky-top), var(--sky-mid) 55%, var(--sky-horizon))",
      }}
    >
      <SkyDisc phase={phase} t={phaseT} sun={sun} />
      <Clouds cover={weather.cloudCover} />

      {/* Stars at night */}
      {(phase === "night" || (phase === "dusk" && phaseT > 0.5)) && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 10% 20%, white, transparent)," +
              "radial-gradient(1px 1px at 30% 40%, white, transparent)," +
              "radial-gradient(1.5px 1.5px at 50% 15%, white, transparent)," +
              "radial-gradient(1px 1px at 70% 35%, white, transparent)," +
              "radial-gradient(1px 1px at 85% 22%, white, transparent)," +
              "radial-gradient(1px 1px at 20% 55%, white, transparent)," +
              "radial-gradient(1px 1px at 60% 50%, white, transparent)," +
              "radial-gradient(1.5px 1.5px at 40% 10%, white, transparent)",
            backgroundSize: "100% 100%",
            opacity: phase === "night" ? 0.85 : 0.4 * phaseT,
          }}
        />
      )}

      <motion.div
        className="pointer-events-none absolute left-1/2"
        style={{
          width: `${stackWidthPct}%`,
          // Anchored by the house's visible bounds rather than its image box.
          // Each render carries transparent padding below the house for the
          // shadow, and that padding differs by house type (16%-24% of the
          // box). Positioning the box left the house floating well above where
          // it should sit and crowding the greeting — and by a different amount
          // for every home. `belowVw` is that padding expressed in viewport
          // width, so the visible base of the house lands a consistent 44px
          // above the scene's bottom edge whatever the home or screen size,
          // just clear of the 40px the sheet covers.
          bottom: `calc(44px - ${belowVw.toFixed(2)}vw)`,
          x: gyro.x,
          y: gyro.y,
          translateX: "-50%",
        }}
      >
        <PortraitStack
          kitType={homeSpec.kitType}
          palette={homeSpec.palette}
          season={season}
          dayOpacity={dayOpacity}
          litCount={litCount}
          showSnow={showSnow}
          className="w-full"
        />
        {/* Grade overlays */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-multiply"
          style={{
            background: "var(--sky-mid)",
            opacity: gradeOpacity,
            ...artMask,
          }}
        />
        {(phase === "golden" || (phase === "dusk" && phaseT < 0.4)) && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-soft-light"
            style={{
              background: "#ffb872",
              opacity: phase === "golden" ? 0.1 + phaseT * 0.15 : 0.12,
              ...artMask,
            }}
          />
        )}
        {ceremony && door ? (
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${(door.x / kit.frame.w) * 100}%`,
              top: `${(door.y / kit.frame.h) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <IllustratedMoment kind="sparkle-burst" size={72} autoplay />
          </div>
        ) : null}
      </motion.div>

      {/* RiveLayer stub — wired in P3 */}
      <div data-rive-layer aria-hidden className="pointer-events-none absolute inset-0" />

      <WeatherLayer kind={weather.kind} intensity={precip} />
      <StatusGlyphs weather={weather} careLevel={household.momentum.care?.level} />

      {/* Top scrim + text overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[45%]"
        style={{
          background:
            "linear-gradient(color-mix(in oklab, var(--sky-top) 70%, transparent), transparent 45%)",
        }}
      />
      <div
        data-scene-blur
        className="pointer-events-none absolute inset-0"
        style={{
          WebkitMaskImage: "linear-gradient(black, transparent)",
          maskImage: "linear-gradient(black, transparent)",
        }}
      />

      <div
        className="relative z-10 flex items-start justify-between gap-3 px-5"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 12px)",
          color: "var(--scene-text)",
        }}
      >
        <div className="min-w-0">
          <p className="ui-title text-[1.35rem] font-semibold tracking-tight">{greeting}</p>
          <p className="ui-caption mt-0.5 opacity-80">{secondaryLine}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {onOpenCalendar ? (
            <button
              type="button"
              aria-label={t("today.pickDay")}
              onClick={onOpenCalendar}
              className="flex size-11 items-center justify-center rounded-full bg-background/25 backdrop-blur-sm"
            >
              <CalendarDays className="size-5" />
            </button>
          ) : null}
          {onOpenSettings ? (
            <button
              type="button"
              aria-label={t("common.settings")}
              onClick={onOpenSettings}
              className="flex size-11 items-center justify-center rounded-full bg-background/25 backdrop-blur-sm"
            >
              <Settings className="size-5" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
