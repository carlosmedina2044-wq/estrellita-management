"use client";

import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Settings } from "lucide-react";
import { SceneBoundary } from "@/components/scene-boundary";
import { HouseSheet } from "@/components/today/house-sheet";
import { PortraitScene, SCENE_HEIGHT } from "@/components/today/portrait-scene";
import { NextLookNote } from "@/components/today/next-look";
import { WindowZoomLayer, type WindowZoom } from "@/components/today/window-zoom";
import { useAnswerPlayback, type AnswerReadiness } from "@/hooks/use-house-answer";
import { useSceneScroll } from "@/hooks/use-scene-scroll";
import { useSceneSky } from "@/hooks/use-scene-sky";
import { useLocale } from "@/i18n/locale-provider";
import { careProgress, nextLookHint } from "@/lib/care-level";
import { CEREMONY_MS } from "@/lib/motion";
import { dayArc } from "@/lib/momentum";
import { hapticClose, hapticPress } from "@/lib/native/haptics";
import { requestTilt } from "@/lib/native/orientation";
import type { HouseAnswer } from "@/lib/scene/house-answer";
import type { homeSummary } from "@/lib/node-status";
import type { Household } from "@/lib/types";
import type { WeatherForecast } from "@/lib/weather/provider";
import { sceneCssVars } from "@/lib/scene/css";
import { skyGradient } from "@/lib/scene/sky";
import { cn } from "@/lib/utils";

type Translate = ReturnType<typeof useLocale>["t"];

/** What is left across the home, in the words a person would say. Empty
 * counts are left out, and a home with nothing waiting says "All done". */
export function homeStatusText(summary: ReturnType<typeof homeSummary> | null, t: Translate): string {
  if (!summary || (summary.total === 0 && summary.reorderPending === 0)) {
    return t("home.allCaughtUp");
  }
  const parts: string[] = [];
  if (summary.overdue) parts.push(t("home.overdueCount", { count: summary.overdue }));
  if (summary.dueSoon) parts.push(t("home.dueSoonCount", { count: summary.dueSoon }));
  if (summary.reorderPending) parts.push(t("home.toReorderCount", { count: summary.reorderPending }));
  return parts.join(" · ");
}

const SCENE_TOP = "calc(-1 * max(0.75rem, env(safe-area-inset-top)))";

/**
 * The Home tab's top: the same live picture Today has (sky, sun or moon,
 * clouds, weather, birds, the clay house), pinned while a rounded sheet slides
 * over it. The house's windows are the home's rooms, so tapping one opens that
 * room. Today and Home share the sky rule (`useSceneSky`) and the scroll
 * behaviour (`useSceneScroll`), so they read as one place.
 */
export function HomeScene({
  household,
  forecast,
  now,
  summary,
  active,
  paused,
  onOpenSettings,
  onOpenRoom,
  onOpenDelivery,
  onSeeYear,
  answer = null,
  levelUp = 0,
  children,
}: {
  household: Household;
  forecast: WeatherForecast | null;
  now: Date;
  summary: ReturnType<typeof homeSummary> | null;
  /** This tab is the one showing; the scene stills itself when it is not. */
  active: boolean;
  /** A sheet is up over the scene. */
  paused: boolean;
  onOpenSettings: () => void;
  onOpenRoom: (roomId: string) => void;
  /** Tapping the box left on the porch: the item that came, or null for several. */
  onOpenDelivery?: (itemId: string | null) => void;
  /** "See the year" inside the house sheet. */
  onSeeYear?: () => void;
  /** The house's latest answer to a finished chore, from any screen. */
  answer?: HouseAnswer | null;
  /** Non-zero while the house blooms for a care level it just reached. */
  levelUp?: number;
  children: ReactNode;
}) {
  const { t } = useLocale();
  const { resolvedTheme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const compactBar = useSceneScroll(rootRef, true);
  const { scenePhase, scenePhaseEffective, weather } = useSceneSky(household, forecast, now);
  const arc = useMemo(() => dayArc(household, now, "all"), [household, now]);
  const statusText = homeStatusText(summary, t);

  // The answer to a finished chore plays here once this scene is the thing on
  // screen: not at all when the tab is hidden, and held until the sheet closes
  // when a room sheet is up (the chore was ticked in it, so the glow would
  // otherwise play behind it where nobody sees it). When that chore finished
  // the day, the closing beat plays too.
  const [ceremonyPlaying, setCeremonyPlaying] = useState(false);
  const readiness: AnswerReadiness = !active ? "skip" : paused ? "defer" : "play";
  const answerShown = useAnswerPlayback(answer, readiness, (played) => {
    if (!played.closesDay) return;
    setCeremonyPlaying(true);
    void hapticClose();
  });
  useEffect(() => {
    if (!ceremonyPlaying) return;
    const timer = window.setTimeout(() => setCeremonyPlaying(false), CEREMONY_MS);
    return () => window.clearTimeout(timer);
  }, [ceremonyPlaying]);

  // What is left before the house gets its next touch. Only for a home that
  // is keeping score at all.
  const momentumOn = household.momentum.enabled;
  const nextLook = useMemo(
    () => (momentumOn ? nextLookHint(household, now, arc.state === "closed") : null),
    [momentumOn, household, now, arc.state],
  );
  const careNext = useMemo(() => (momentumOn ? careProgress(household, now) : null), [momentumOn, household, now]);

  // Tapping the house opens the same sheet Today opens.
  const [houseOpen, setHouseOpen] = useState(false);
  const tiltAsked = useRef(false);

  const [windowZoom, setWindowZoom] = useState<WindowZoom | null>(null);
  const zoomKey = useRef(0);
  useEffect(() => {
    if (!windowZoom) return;
    const timer = window.setTimeout(() => setWindowZoom(null), 520);
    return () => window.clearTimeout(timer);
  }, [windowZoom]);

  const stops = useMemo(
    () => skyGradient(scenePhaseEffective.phase, scenePhaseEffective.t, weather.kind, weather.cloudCover),
    [scenePhaseEffective.phase, scenePhaseEffective.t, weather.kind, weather.cloudCover],
  );
  const nightFollows =
    household.momentum.nightFollowsSky !== false &&
    (scenePhase.phase === "dusk" || scenePhase.phase === "night");
  const sheetIsDark = resolvedTheme === "dark" || nightFollows;

  return (
    <div
      ref={rootRef}
      className="today-scene-root -mx-4 -mt-[max(0.75rem,env(safe-area-inset-top))]"
      style={{
        ...sceneCssVars(stops),
        background: "color-mix(in oklab, var(--background) 96%, var(--ambient))",
      }}
    >
      <WindowZoomLayer zoom={windowZoom} />
      {/* Zero-height, like Today's, so the bar takes no slot in the flow. */}
      <div className="sticky z-30 h-0" style={{ top: SCENE_TOP }}>
        <div
          className={cn(
            "absolute inset-x-0 top-0 flex h-[calc(env(safe-area-inset-top)+52px)] items-end justify-between bg-background/90 px-5 pb-1 backdrop-blur-md transition-opacity duration-200",
            compactBar ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={!compactBar}
        >
          <p className="min-w-0 flex-1 truncate pb-3 pr-2 ui-caption font-medium">{household.householdName}</p>
          <button
            type="button"
            aria-label={t("common.settings")}
            tabIndex={compactBar ? 0 : -1}
            onClick={onOpenSettings}
            // Fixed 44pt: a rem size grew to ~90pt at accessibility text sizes and rode up into the status bar.
            className="flex size-[44px] shrink-0 items-center justify-center rounded-full bg-secondary"
          >
            <Settings className="size-5" />
          </button>
        </div>
      </div>
      <div className="sticky z-0" style={{ top: SCENE_TOP }}>
        <SceneBoundary
          fallback={
            <div
              aria-hidden
              style={{ height: `calc(env(safe-area-inset-top) + ${SCENE_HEIGHT})` }}
            />
          }
        >
          <PortraitScene
            household={household}
            arc={arc}
            phase={scenePhaseEffective.phase}
            phaseT={scenePhaseEffective.t}
            weather={weather}
            ceremony={ceremonyPlaying}
            greeting={household.householdName}
            secondaryLine={statusText}
            onOpenSettings={onOpenSettings}
            onOpenHouse={() => {
              // Same as Today: WebKit hands out no tilt events until this is
              // asked for from inside a tap. Declined just means no lean.
              if (!tiltAsked.current) {
                tiltAsked.current = true;
                void requestTilt();
              }
              void hapticPress();
              setHouseOpen(true);
            }}
            onOpenRoom={(roomId, from) => {
              void hapticPress();
              zoomKey.current += 1;
              setWindowZoom({ x: from.left, y: from.top, w: from.width, h: from.height, key: zoomKey.current });
              onOpenRoom(roomId);
            }}
            onOpenDelivery={onOpenDelivery}
            answer={answerShown}
            levelUp={levelUp}
            paused={!active || paused || compactBar || houseOpen}
            hearth={arc.state === "closed"}
          />
        </SceneBoundary>
      </div>
      <div
        className="relative z-10 -mt-[28px] flex flex-col gap-4 rounded-t-[28px] bg-background px-5 pt-5"
        style={{
          boxShadow: `0 -10px 28px -8px color-mix(in oklab, var(--ambient) ${sheetIsDark ? 45 : 30}%, transparent)`,
        }}
      >
        {careNext && nextLook ? (
          <NextLookNote hint={nextLook} next={careNext.next} fraction={careNext.fraction} />
        ) : null}
        {children}
      </div>
      <HouseSheet
        open={houseOpen}
        onOpenChange={setHouseOpen}
        household={household}
        now={now}
        arc={arc}
        onSeeYear={() => {
          setHouseOpen(false);
          if (onSeeYear) window.setTimeout(onSeeYear, 350);
        }}
      />
    </div>
  );
}
