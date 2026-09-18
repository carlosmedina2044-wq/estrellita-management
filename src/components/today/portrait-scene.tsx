"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion, useSpring } from "motion/react";
import { Settings } from "lucide-react";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { Clouds } from "@/components/today/clouds";
import { PortraitStack } from "@/components/today/portrait-stack";
import { SkyDisc } from "@/components/today/sky-disc";
import { SceneDetails } from "@/components/today/scene-details";
import { StatusGlyphs } from "@/components/today/status-glyphs";
import { WeatherLayer } from "@/components/today/weather-layer";
import { useLocale } from "@/i18n/locale-provider";
import { addDays } from "@/lib/dates";
import { completionsInRange, isOverdueFor } from "@/lib/duties";
import { dutyTopic } from "@/lib/duty-topics";
import { keptRooms } from "@/lib/kept-rooms";
import { detailsFor, sceneDetails, type SceneDetailKind } from "@/lib/scene/details";
import { sceneCssVars } from "@/lib/scene/css";
import { assignWindowRooms, litWindowCount, windowStates, type WindowState } from "@/lib/scene/window-rooms";
import { houseLight } from "@/lib/scene/light";
import { skyGradient } from "@/lib/scene/sky";
import {
  dayOpacityForPhase,
  gradeOpacityForPhase,
  portraitKit,
  portraitLayerUrls,
  resolveHomeSpec,
} from "@/lib/scene/portrait";
import { DUR_QUICK } from "@/lib/motion";
import { hapticTab } from "@/lib/native/haptics";
import type { MessageKey } from "@/i18n";
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
  /** Force these details (dev page); otherwise they follow the house. */
  details?: SceneDetailKind[];
};

type PortraitSceneProps = {
  household: Household;
  arc: DayArc;
  phase: SkyPhase;
  phaseT: number;
  weather: SceneWeather;
  ceremony: boolean;
  /** True only for Today's very first reveal this app launch (see
   * `useSessionArrival`) — plays the windows-warming-on stagger once, from
   * zero, instead of painting already at today's real lit count. */
  arrival?: boolean;
  greeting: string;
  secondaryLine: string;
  onOpenSettings?: () => void;
  /** When given, the house itself is a button (the "state of the house"
   * sheet on Today). Left out for the decorative uses: the welcome loop,
   * the house-look picker and the lock screen stay pictures. */
  onOpenHouse?: () => void;
  /** When given, each window with a room becomes a button into that room. */
  onOpenRoom?: (roomId: string) => void;
  /** Stills the detail animations (Today passes its compact-bar state). */
  paused?: boolean;
  overrides?: PortraitSceneOverrides;
  className?: string;
  /** Default true: Today and the lock screen sit flush at the true top of
   * the screen, so the scene reserves `env(safe-area-inset-top)` itself.
   * Pass false for a scene placed lower in an already-padded layout (the
   * onboarding welcome screen, the house-look picker) — reserving the inset
   * there would double-count the safe area and leave a dead gap. */
  insetTop?: boolean;
};

/** Arrival reveal: paint unlit → (two frames later, so the "unlit" paint is
 * real, not coalesced away) → the staggered warm-on → settle. Distinct from
 * `arrival` itself, which stays true for the rest of the session once set —
 * without this, ordinary daytime relighting later in the day would inherit
 * the stagger too. */
function useArrivalReveal(play: boolean): { litNow: boolean; staggering: boolean } {
  const [phase, setPhase] = useState<"pending" | "revealing" | "done">(play ? "pending" : "done");
  useEffect(() => {
    if (phase !== "pending") return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPhase("revealing"));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [phase]);
  useEffect(() => {
    if (phase !== "revealing") return;
    // Longest per-window stagger delay plus its own fade, with headroom.
    const timer = window.setTimeout(() => setPhase("done"), 1200);
    return () => window.clearTimeout(timer);
  }, [phase]);
  return { litNow: phase !== "pending", staggering: phase === "revealing" };
}

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
  arrival,
  greeting,
  secondaryLine,
  onOpenSettings,
  onOpenHouse,
  onOpenRoom,
  paused,
  overrides,
  className,
  insetTop = true,
}: PortraitSceneProps) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const arrivalReveal = useArrivalReveal(Boolean(arrival) && !reduce);
  const minuteNow = useMinuteTicker(true);
  const homeSpec = useMemo(() => {
    const base = resolveHomeSpec(household);
    const kitType = overrides?.kitType ?? base.kitType;
    const palette = overrides?.palette ?? base.palette;
    if (kitType === base.kitType) return { ...base, palette };
    // A previewed kit has its own windows; map the rooms onto those instead
    // of carrying ids from a kit that is no longer on screen.
    return assignWindowRooms({ ...base, kitType, palette }, household.rooms, household.duties, portraitKit(kitType));
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
  const careLevel = household.momentum.care?.level ?? "settling-in";
  const gardenLevel = CARE_TO_GARDEN[careLevel];
  const light = houseLight(arc, phase, closedToday, season, gardenLevel, windowCount);
  // Windows follow rooms (E1-02): a fresh room lit, a due room dark, a room
  // nobody has touched within its cadence dim. A closed day and the ceremony
  // still light every window; the arrival reveal still starts from none.
  const kept = useMemo(() => keptRooms(household, minuteNow), [household, minuteNow]);
  const roomStates = useMemo(
    () => windowStates(homeSpec, kit, kept, light.windowsLit),
    [homeSpec, kit, kept, light.windowsLit],
  );
  const allLit = kit.windows.map((): WindowState => "lit");
  const allOff = kit.windows.map((): WindowState => "off");
  const states: WindowState[] | undefined =
    overrides?.windowsLit != null
      ? undefined
      : ceremony || closedToday
        ? allLit
        : arrivalReveal.litNow
          ? roomStates
          : allOff;
  const litCount = overrides?.windowsLit ?? litWindowCount(states ?? allOff);
  const staggerWindows = ceremony || arrivalReveal.staggering;

  // Small living details (E4-01), two at most, from the same signals the
  // lights use plus the rooms and the season.
  const forcedDetails = overrides?.details;
  const details = useMemo(() => {
    if (forcedDetails) return detailsFor(forcedDetails, kit);
    const guttersOverdue = household.duties.some(
      (duty) => !duty.archived && dutyTopic(duty) === "gutters-clear" && isOverdueFor(duty, household, minuteNow),
    );
    const laundryFresh = kept.some((entry) => entry.room.type === "laundry" && entry.state === "fresh");
    const irrigationRecent = completionsInRange(household.completions, addDays(minuteNow, -3), minuteNow).some(
      (item) => {
        const duty = household.duties.find((entry) => entry.id === item.dutyId);
        return Boolean(duty && (dutyTopic(duty) ?? "").startsWith("irrigation"));
      },
    );
    return sceneDetails(
      { light, phase, season, weather, careLevel, laundryFresh, guttersOverdue, irrigationRecent },
      kit,
    );
  }, [forcedDetails, kit, household, minuteNow, kept, light, phase, season, weather, careLevel]);

  // The scene owns its sky. Today's root sets the same variables so the sky
  // colour can bleed into the sheet below it, but the welcome screen, the
  // house-look picker and the lock screen render this component on a plain
  // page where nothing defines `--sky-*`, and the gradient below painted as
  // `none`: a house floating on the page background with a sun over it.
  const skyStops = useMemo(
    () => skyGradient(phase, phaseT, weather.kind, weather.cloudCover),
    [phase, phaseT, weather.kind, weather.cloudCover],
  );
  const skyVars = sceneCssVars(skyStops);

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
      // A `role="img"` makes its children presentational, which would hide
      // the house button from assistive tech; with a tappable house the
      // section is a labelled region and the button carries its own label.
      role={onOpenHouse ? undefined : "img"}
      aria-label={ariaLabel}
      data-home-scene
      className={cn(
        "relative w-full overflow-hidden",
        className,
      )}
      style={{
        ...skyVars,
        // 300px put the first chore 611px down a 716px pane — one visible task
        // row. 256px freed the fold but left nothing between the header, the
        // sky and the roof. 272px keeps three chores above the fold and gives
        // the composition room to breathe.
        height: insetTop ? "calc(env(safe-area-inset-top) + 272px)" : "272px",
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
        {onOpenHouse ? (
          <button
            type="button"
            aria-label={t("today.houseAria", { level: t(`care.level.${careLevel}` as MessageKey) })}
            onClick={() => {
              void hapticTab();
              onOpenHouse();
            }}
            className="pointer-events-auto block w-full rounded-3xl transition-transform duration-75 active:scale-[0.98]"
          >
            <PortraitStack
              kitType={homeSpec.kitType}
              palette={homeSpec.palette}
              season={season}
              dayOpacity={dayOpacity}
              litCount={litCount}
              windowStates={states}
              showSnow={showSnow}
              stagger={staggerWindows}
              className="w-full"
            />
          </button>
        ) : (
          <PortraitStack
            kitType={homeSpec.kitType}
            palette={homeSpec.palette}
            season={season}
            dayOpacity={dayOpacity}
            litCount={litCount}
            windowStates={states}
            showSnow={showSnow}
            stagger={staggerWindows}
            className="w-full"
          />
        )}
        {onOpenRoom
          ? kit.windows.map((w) => {
              const roomId = homeSpec.windows.find((entry) => entry.id === w.id)?.roomId ?? null;
              const room = roomId ? household.rooms.find((entry) => entry.id === roomId) : undefined;
              if (!room) return null;
              const keptState = kept.find((entry) => entry.room.id === room.id)?.state ?? "waiting";
              const stateLabel =
                keptState === "fresh"
                  ? t("today.roomFresh")
                  : keptState === "due"
                    ? t("today.roomDue")
                    : t("today.roomWaiting");
              // Siblings of the house button, never children: a button inside
              // a button is invalid, and these need to sit above it. At least
              // 44pt each way even for a small window.
              return (
                <button
                  key={w.id}
                  type="button"
                  aria-label={t("scene.window", { room: room.name, state: stateLabel })}
                  onClick={() => {
                    void hapticTab();
                    onOpenRoom(room.id);
                  }}
                  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-lg"
                  style={{
                    left: `${(((w.x + w.w / 2) / kit.frame.w) * 100).toFixed(2)}%`,
                    top: `${(((w.y + w.h / 2) / kit.frame.h) * 100).toFixed(2)}%`,
                    width: `max(44px, ${((w.w / kit.frame.w) * 100).toFixed(2)}%)`,
                    height: `max(44px, ${((w.h / kit.frame.h) * 100).toFixed(2)}%)`,
                  }}
                />
              );
            })
          : null}
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
          <motion.div
            className="pointer-events-none absolute"
            style={{
              left: `${(door.x / kit.frame.w) * 100}%`,
              top: `${(door.y / kit.frame.h) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
            // Lands after the windows warm on (their own 500ms fade, staggered
            // up to ~350ms past that in PortraitStack) instead of firing the
            // instant the day closes — one beat in a sequence, not everything
            // happening at once. Matches the delay TodayHero's momentum
            // variant already uses for the same beat.
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 0.5, duration: DUR_QUICK }}
          >
            <IllustratedMoment kind="sparkle-burst" size={72} autoplay />
          </motion.div>
        ) : null}
        <SceneDetails details={details} paused={paused} asleep={light.companion === "asleep"} />
      </motion.div>

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
          paddingTop: insetTop ? "calc(env(safe-area-inset-top) + 12px)" : "12px",
          color: "var(--scene-text)",
        }}
      >
        <div className="min-w-0">
          <p className="ui-title text-[1.35rem] font-semibold tracking-tight">{greeting}</p>
          <p className="ui-caption mt-0.5 opacity-80">{secondaryLine}</p>
        </div>
        <div className="flex shrink-0 gap-2">
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
