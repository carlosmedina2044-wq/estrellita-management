"use client";

import { useEffect, useMemo, useState } from "react";
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
  type TargetAndTransition,
  type Transition,
} from "motion/react";
import { Settings } from "lucide-react";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { Clouds } from "@/components/today/clouds";
import { PortraitStack } from "@/components/today/portrait-stack";
import { SkyDisc } from "@/components/today/sky-disc";
import { SceneDetails } from "@/components/today/scene-details";
import { CareDecorLayer } from "@/components/today/care-decor-layer";
import { DeliveryLayer } from "@/components/today/delivery-layer";
import { VisitorLayer } from "@/components/today/visitor-layer";
import { StatusGlyphs } from "@/components/today/status-glyphs";
import { WeatherLayer } from "@/components/today/weather-layer";
import { useLocale } from "@/i18n/locale-provider";
import { addDays, toISODate } from "@/lib/dates";
import { completionsInRange, isOverdueFor } from "@/lib/duties";
import { dutyTopic } from "@/lib/duty-topics";
import { keptRooms } from "@/lib/kept-rooms";
import { detailsFor, sceneDetails, type SceneDetailKind } from "@/lib/scene/details";
import { CARE_DECOR_AT, careDecor, decorFor, type CareDecorKind } from "@/lib/scene/care-decor";
import { deliveriesAtDoor } from "@/lib/scene/delivery";
import { visitorFor, type VisitorKind } from "@/lib/scene/visitor";
import { sceneCssVars } from "@/lib/scene/css";
import { assignWindowRooms, litWindowCount, windowStates, type WindowState } from "@/lib/scene/window-rooms";
import { houseLight } from "@/lib/scene/light";
import { daySweep, skyGradient, warmedStops } from "@/lib/scene/sky";
import {
  dayOpacityForPhase,
  doorAnchor,
  gradeOpacityForPhase,
  portraitKit,
  portraitLayerUrls,
  resolveHomeSpec,
} from "@/lib/scene/portrait";
import { CEREMONY_BEAT, DUR_AMBIENT, DUR_BASE, DUR_QUICK, EASE_OUT } from "@/lib/motion";
import { hapticTab } from "@/lib/native/haptics";
import type { MessageKey } from "@/i18n";
import { seasonFor, type Season } from "@/lib/scene/season";
import type { SkyPhase } from "@/lib/scene/sun";
import { sunPosition } from "@/lib/scene/sun";
import type { SceneWeather } from "@/lib/scene/weather";
import type { DayArc } from "@/lib/momentum";
import type { CareLevelId, Household, KitType, PaletteId } from "@/lib/types";
import { cn } from "@/lib/utils";

/** What the hearth settles to once its ceremony flare is over: warm enough to
 * read as "the house is lit" hours later, still below the windows' own light. */
const HEARTH_HOLD = 0.42;
const HEARTH_GRADIENT = "radial-gradient(closest-side, rgba(255, 196, 128, 0.55), transparent 72%)";
/* Hoisted, not inline: a fresh keyframe array on every render is a new target
 * as far as motion is concerned, so a long beat like this one restarts before
 * its delay has elapsed and never actually plays. Same reason
 * `kept-rooms-row.tsx` hoists its pulse. */
const HEARTH_SWELL: TargetAndTransition = { opacity: [0, 0.34, 0], scale: [0.9, 1.06, 1.14] };
const HEARTH_SWELL_FROM: TargetAndTransition = { opacity: 0, scale: 0.9 };
const HEARTH_SWELL_TRANSITION: Transition = {
  duration: DUR_AMBIENT * 2,
  delay: CEREMONY_BEAT.hearth,
  times: [0, 0.35, 1],
  // One easing per segment. A single four-number curve here is ambiguous
  // against motion's "array of per-segment easings" reading.
  ease: [[...EASE_OUT], "easeInOut"],
};

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
  /** Force the earned decorations (dev page); otherwise they follow the care level. */
  decor?: CareDecorKind[];
  careLevel?: CareLevelId;
  /** Force today's visitor (dev page); `"none"` suppresses it. */
  visitor?: VisitorKind | "none";
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
  /** When given, each window with a room becomes a button into that room.
   * `from` is the window's own box on screen, so the caller can carry the
   * transition out of that exact window rather than from nowhere. */
  onOpenRoom?: (roomId: string, from: DOMRect) => void;
  /** Tapping the box a delivery left on the porch: the item that came, or
   * null when more than one is waiting. Without it the box is just a picture. */
  onOpenDelivery?: (itemId: string | null) => void;
  /** Stills the detail animations (Today passes its compact-bar state). */
  paused?: boolean;
  /** One chore just committed: the house answers at that room's window (or
   * over the whole house when the chore belongs to no room). `key` rises per
   * completion so two chores ticked in a row each get their own flare
   * instead of the second one being swallowed as "same props". Today clears
   * it after the flare, so this is a moment, not a state. */
  answer?: { roomId: string | null; key: number } | null;
  /** The day is closed, so the house keeps its hearth lit. Unlike `ceremony`
   * this is the settled state, not the moment: it is true on every later open
   * of a closed day, with no replay. */
  hearth?: boolean;
  /** Called when the user taps through the ceremony rather than watching it. */
  onSkipCeremony?: () => void;
  /** Rises per care-level gain in this session; 0 when nothing was earned.
   * Drives the whole-house bloom and drops the newly earned decoration onto
   * its anchor. */
  levelUp?: number;
  /** 0-1. Leans the whole sky toward hearth colour for the beat where a day
   * is closed. The scene computes its own sky (it is rendered on pages that
   * define no `--sky-*` at all), so a caller cannot warm it by overriding the
   * variables from outside — it has to come in as a number. */
  warm?: number;
  /** This week's quest is met, so the house wears its bunting until Sunday. */
  questDone?: boolean;
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

/**
 * Once a day, on the first open, the sky catches up: it starts at first light
 * and sweeps to the hour it actually is, sun and all. The whole sky model is
 * parametric and a user otherwise only ever sees one frame of it.
 *
 * Three waypoints rather than a per-frame tween. Each step re-renders the
 * scene and recomputes the gradient, and the `--sky-*` properties are
 * registered in CSS, so the browser already tweens between the steps.
 */
function useDaySweep(
  play: boolean,
  phase: SkyPhase,
  phaseT: number,
): { phase: SkyPhase; t: number; sweeping: boolean } {
  // Captured once: the sweep is a fixed path decided when the scene first
  // mounted, not something that re-plans as the half-hour ticker moves on.
  const [waypoints] = useState(() => (play ? daySweep(phase, phaseT) : []));
  const [step, setStep] = useState(0);
  const sweeping = step < waypoints.length;
  useEffect(() => {
    if (!sweeping) return;
    // The first step lands on the next frame so the dawn sky is a real paint
    // rather than a value React coalesces away before anything is shown.
    const timer = window.setTimeout(() => setStep((current) => current + 1), step === 0 ? 60 : 420);
    return () => window.clearTimeout(timer);
  }, [step, sweeping]);
  if (!sweeping) return { phase, t: phaseT, sweeping: false };
  return { ...waypoints[step], sweeping: true };
}

function useMinuteTicker(enabled: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.hidden) return;
      setNow(new Date());
    };
    // Catch up on whatever was missed while paused or hidden.
    tick();
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

/**
 * How far each layer of the scene moves against a tilt, as a multiple of the
 * house's own travel. The point of a diorama is that the near things move more
 * than the far ones; moving only the house made the whole picture slide.
 */
const TILT_DEPTH = { sky: 0.3, clouds: 0.5, house: 1, ground: 1.3 } as const;

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
  onOpenDelivery,
  paused,
  answer,
  hearth,
  onSkipCeremony,
  levelUp = 0,
  warm = 0,
  questDone,
  overrides,
  className,
  insetTop = true,
}: PortraitSceneProps) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const arrivalReveal = useArrivalReveal(Boolean(arrival) && !reduce);
  // Every mounted scene re-rendered every 30 seconds regardless of `paused`,
  // including the ones sitting behind a sheet or in a hidden keep-alive pane.
  const minuteNow = useMinuteTicker(!paused);
  const homeSpec = useMemo(() => {
    const base = resolveHomeSpec(household);
    const kitType = overrides?.kitType ?? base.kitType;
    const palette = overrides?.palette ?? base.palette;
    if (kitType === base.kitType) return { ...base, palette };
    // A previewed kit has its own windows; map the rooms onto those instead
    // of carrying ids from a kit that is no longer on screen.
    return assignWindowRooms({ ...base, kitType, palette }, household.rooms, household.duties, portraitKit(kitType));
  }, [household, overrides?.kitType, overrides?.palette]);

  const sweep = useDaySweep(
    Boolean(arrival) && !reduce && !overrides,
    overrides?.phase ?? phaseProp,
    overrides?.phaseT ?? phaseTProp,
  );
  const phase = sweep.phase;
  const phaseT = sweep.t;
  const weather = overrides?.weather ?? weatherProp;
  const lat = household.location.lat;
  const season =
    overrides?.season ?? seasonFor(minuteNow, lat != null ? lat : null);
  const kit = portraitKit(homeSpec.kitType);
  const windowCount = kit.windowCount || kit.windows.length || 1;
  const closedToday = overrides?.closedToday ?? arc.state === "closed";
  const careLevel = overrides?.careLevel ?? household.momentum.care?.level ?? "settling-in";
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

  // What the house has earned (E5-02). Unlike the details above these do not
  // come and go with the hour or the weather: a level's decoration stands all
  // day, which is what makes the care ladder visible at noon rather than only
  // as a word in a sheet.
  // The day's visitor (E5-06). Read from the same signals the rest of the
  // scene uses, so the picture and the day's line always name the same guest.
  const forcedVisitor = overrides?.visitor;
  const visitor = useMemo(() => {
    if (forcedVisitor) return forcedVisitor === "none" ? null : forcedVisitor;
    return visitorFor({
      closedToday,
      phase,
      season,
      weather,
      dateKey: toISODate(minuteNow),
      seed: homeSpec.seed,
    });
  }, [forcedVisitor, closedToday, phase, season, weather, minuteNow, homeSpec.seed]);

  const forcedDecor = overrides?.decor;
  const decor = useMemo(
    () =>
      forcedDecor
        ? decorFor(forcedDecor, kit)
        : careDecor(careLevel, kit, { questDone: Boolean(questDone) }),
    [forcedDecor, careLevel, kit, questDone],
  );

  // The scene owns its sky. Today's root sets the same variables so the sky
  // colour can bleed into the sheet below it, but the welcome screen, the
  // house-look picker and the lock screen render this component on a plain
  // page where nothing defines `--sky-*`, and the gradient below painted as
  // `none`: a house floating on the page background with a sun over it.
  const skyStops = useMemo(
    () => warmedStops(skyGradient(phase, phaseT, weather.kind, weather.cloudCover), warm),
    [phase, phaseT, weather.kind, weather.cloudCover, warm],
  );
  const skyVars = sceneCssVars(skyStops);

  const dayOpacity = dayOpacityForPhase(phase, phaseT);
  const gradeOpacity = gradeOpacityForPhase(phase, phaseT);
  const showSnow = weather.kind === "snow";
  const precip =
    weather.kind === "rain" || weather.kind === "snow" ? Math.max(0.35, weather.precipIntensity) : 0;

  // Stilled while a sheet is over the scene or the compact bar has taken the
  // top of the screen: a picture drifting behind a sheet reads as a bug.
  const gyro = useGyroOffset(!reduce && !paused);
  const skyX = useTransform(gyro.x, (value) => value * TILT_DEPTH.sky);
  const skyY = useTransform(gyro.y, (value) => value * TILT_DEPTH.sky);
  const cloudX = useTransform(gyro.x, (value) => value * TILT_DEPTH.clouds);
  const cloudY = useTransform(gyro.y, (value) => value * TILT_DEPTH.clouds);
  // Applied on top of the house's own offset, so the ground layer ends up at
  // TILT_DEPTH.ground overall.
  const groundX = useTransform(gyro.x, (value) => value * (TILT_DEPTH.ground - TILT_DEPTH.house));
  const groundY = useTransform(gyro.y, (value) => value * (TILT_DEPTH.ground - TILT_DEPTH.house));
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

  const door = doorAnchor(kit);
  // Supplies marked on the way whose day has come: a box on the porch, and on
  // the day itself a courier who brings it.
  const deliveries = useMemo(
    () => deliveriesAtDoor(household.supplyAutomations, minuteNow),
    [household.supplyAutomations, minuteNow],
  );

  // Under the house's own footprint, a little wider than the house and half
  // as tall, so it reads as light spilling onto the ground.
  const hearthBox = {
    left: `${((kit.houseBounds.x + kit.houseBounds.w / 2) / kit.frame.w) * 100}%`,
    top: `${((kit.houseBounds.y + kit.houseBounds.h * 0.86) / kit.frame.h) * 100}%`,
    width: `${(kit.houseBounds.w / kit.frame.w) * 100 * 1.35}%`,
    aspectRatio: "2 / 1",
    translateX: "-50%",
    translateY: "-50%",
  } as const;

  // Where the house answers a completed chore. A room with a window answers
  // at that window; anything else (a whole-home chore, a room this kit has no
  // window for) answers as a soft wash over the house, so every tick gets an
  // answer rather than only the lucky ones.
  const answerFlare = useMemo(() => {
    if (!answer) return null;
    const windowId = answer.roomId
      ? (homeSpec.windows.find((entry) => entry.roomId === answer.roomId)?.id ?? null)
      : null;
    const rect = windowId ? (kit.windows.find((w) => w.id === windowId) ?? null) : null;
    if (rect) {
      return {
        kind: "window" as const,
        left: ((rect.x + rect.w / 2) / kit.frame.w) * 100,
        top: ((rect.y + rect.h / 2) / kit.frame.h) * 100,
        // Four times the window's longest side: a glow the size of the window
        // itself reads as the window merely changing colour.
        width: (Math.max(rect.w, rect.h) / kit.frame.w) * 100 * 4,
      };
    }
    const bounds = kit.houseBounds;
    return {
      kind: "house" as const,
      left: ((bounds.x + bounds.w / 2) / kit.frame.w) * 100,
      top: ((bounds.y + bounds.h / 2) / kit.frame.h) * 100,
      width: (bounds.w / kit.frame.w) * 100 * 1.25,
    };
  }, [answer, homeSpec.windows, kit]);

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
        // sky and the roof. 272px was fine in a browser pane, but on a real
        // iPhone the safe area and the four cards above the list left one
        // chore showing, so the art gives up another 40px.
        // 232px at the default text size, growing with Dynamic Type (rem) up
        // to a cap, so a larger greeting has sky of its own instead of
        // landing on the roof.
        height: insetTop
          ? "calc(env(safe-area-inset-top) + min(clamp(232px, 13.65rem, 340px), 34dvh))"
          : "min(clamp(232px, 13.65rem, 340px), 34dvh)",
        background:
          "linear-gradient(var(--sky-top), var(--sky-mid) 55%, var(--sky-horizon))",
      }}
    >
      <motion.div className="pointer-events-none absolute inset-0" style={{ x: skyX, y: skyY }}>
        <SkyDisc phase={phase} t={phaseT} sun={sun} />
      </motion.div>
      <motion.div className="pointer-events-none absolute inset-0" style={{ x: cloudX, y: cloudY }}>
        <Clouds cover={weather.cloudCover} />
      </motion.div>

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
        // Today reads this box to know where on screen the house stands, so
        // the ceremony's embers can rise from its footprint rather than from
        // a guessed point.
        data-house-stack
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
        {/* The hearth, in two layers on purpose.
            The steady one is simply on whenever the day is closed: it is what
            makes "we finished" readable at a glance hours later rather than
            only in the moment. The swell is the ceremony's own beat over the
            top of it.
            Two elements rather than one with three keyframes: a single layer
            animating 0 -> flare -> hold has to change its `animate` from a
            number to an array mid-life, and motion settles straight to the
            last value instead of playing it. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute"
          style={{ ...hearthBox, background: HEARTH_GRADIENT }}
          initial={false}
          animate={{ opacity: hearth ? HEARTH_HOLD : 0 }}
          transition={{ duration: reduce ? 0 : DUR_AMBIENT, ease: EASE_OUT }}
        />
        {ceremony && hearth && !reduce ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute"
            style={{ ...hearthBox, background: HEARTH_GRADIENT }}
            initial={HEARTH_SWELL_FROM}
            animate={HEARTH_SWELL}
            transition={HEARTH_SWELL_TRANSITION}
          />
        ) : null}
        {onOpenHouse ? (
          <button
            type="button"
            aria-label={t("today.houseAria", { level: t(`care.level.${careLevel}` as MessageKey) })}
            onClick={() => {
              void hapticTab();
              onOpenHouse();
            }}
            className="pointer-events-auto block w-full rounded-3xl ui-press"
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
                  onClick={(event) => {
                    void hapticTab();
                    onOpenRoom(room.id, event.currentTarget.getBoundingClientRect());
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
        {answerFlare && answer && !reduce ? (
          <motion.div
            // Keyed by the completion, not by the room: ticking two chores in
            // the same room has to flare twice.
            key={answer.key}
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: `${answerFlare.left}%`,
              top: `${answerFlare.top}%`,
              width: `${answerFlare.width}%`,
              aspectRatio: "1",
              translateX: "-50%",
              translateY: "-50%",
              // Plain alpha rather than `screen`: a screen-blended warm glow
              // all but disappears against a bright noon sky, and this is
              // feedback for something the user just did, not ambience.
              background:
                answerFlare.kind === "window"
                  ? "radial-gradient(closest-side, rgba(255, 214, 150, 0.9), rgba(255, 214, 150, 0.3) 45%, transparent 72%)"
                  : "radial-gradient(closest-side, rgba(255, 226, 184, 0.5), transparent 70%)",
            }}
            initial={{ opacity: 0, scale: 0.55 }}
            animate={{ opacity: [0, 1, 0], scale: [0.55, 1, 1.25] }}
            // Two segments with their own curves, not one ease across the
            // whole run: a single `EASE_OUT` front-loads the fall as well as
            // the rise, which measured as a ~180ms blink — over before the
            // eye reaches the house. Rising fast and falling slowly is what
            // makes it read as a light coming on rather than a flash.
            transition={{
              // About a second and a half in all: quick to come on, slow to
              // settle. The old 0.6s run was over before a thumb had left the
              // glass, so the answer was missed on a real phone.
              duration: DUR_AMBIENT * 2.4,
              times: [0, 0.2, 1],
              ease: [EASE_OUT, "easeInOut"],
            }}
          />
        ) : null}
        {ceremony ? (
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
            transition={{ delay: reduce ? 0 : CEREMONY_BEAT.sparkle, duration: DUR_QUICK }}
          >
            <IllustratedMoment kind="sparkle-burst" size={72} autoplay />
          </motion.div>
        ) : null}
        {levelUp > 0 && !reduce ? (
          <motion.div
            key={`level-${levelUp}`}
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: `${((kit.houseBounds.x + kit.houseBounds.w / 2) / kit.frame.w) * 100}%`,
              top: `${((kit.houseBounds.y + kit.houseBounds.h / 2) / kit.frame.h) * 100}%`,
              width: `${(kit.houseBounds.w / kit.frame.w) * 100 * 1.5}%`,
              aspectRatio: "1",
              translateX: "-50%",
              translateY: "-50%",
              background: "radial-gradient(closest-side, rgba(255, 233, 196, 0.62), transparent 68%)",
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.8, 1.05, 1.2] }}
            transition={{ duration: DUR_AMBIENT, times: [0, 0.3, 1], ease: [[...EASE_OUT], "easeInOut"] }}
          />
        ) : null}
        <motion.div className="pointer-events-none absolute inset-0" style={{ x: groundX, y: groundY }}>
        <CareDecorLayer
          decor={decor}
          // Whatever this level itself added, on top of everything the levels
          // below it had already earned.
          arriving={CARE_DECOR_AT[careLevel]}
          arrivalKey={levelUp}
        />
        <VisitorLayer visitor={visitor} paused={paused} />
        <DeliveryLayer
          deliveries={deliveries}
          door={{
            x: (door.x / kit.frame.w) * 100,
            y: ((door.y + door.h * 0.32) / kit.frame.h) * 100,
            w: (door.w / kit.frame.w) * 100,
          }}
          now={minuteNow}
          paused={paused}
          onOpen={onOpenDelivery}
        />
        <SceneDetails
          details={details}
          paused={paused}
          asleep={light.companion === "asleep"}
          wind={weather.wind}
        />
        </motion.div>
      </motion.div>

      {ceremony && onSkipCeremony && !reduce ? (
        // Ported from TodayHero's momentum variant, which the live app cannot
        // reach: a ceremony the user cannot get out of is a ceremony that
        // annoys on the second viewing. Above the scene, below the greeting
        // row and the settings button so neither is blocked.
        <button
          type="button"
          className="absolute inset-0 z-[5] cursor-pointer bg-transparent"
          aria-label={t("today.ceremonySkipAria")}
          onClick={onSkipCeremony}
        />
      ) : null}

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
        {/* The greeting lands with the sky rather than sitting over a sunrise
            that is not the hour it claims. */}
        <motion.div
          className="min-w-0"
          initial={false}
          animate={{ opacity: sweep.sweeping ? 0 : 1 }}
          transition={{ duration: DUR_BASE, ease: EASE_OUT }}
        >
          {/* Over the art, so the type grows with Dynamic Type only up to a
              cap: past it the greeting would land on the roof. */}
          <p className="ui-display ui-page-title text-[min(1.647rem,32px)]">{greeting}</p>
          <p className="ui-caption mt-0.5 text-[min(0.8rem,14px)] opacity-80">{secondaryLine}</p>
        </motion.div>
        <div className="flex shrink-0 gap-2">
          {onOpenSettings ? (
            <button
              type="button"
              aria-label={t("common.settings")}
              onClick={onOpenSettings}
              className="flex size-[44px] items-center justify-center rounded-full bg-background/25 backdrop-blur-sm"
            >
              <Settings className="size-5" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
