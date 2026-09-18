"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PortraitScene } from "@/components/today/portrait-scene";
import { DETAIL_KINDS, type SceneDetailKind } from "@/lib/scene/details";
import { DevLocaleOverride, useLocale } from "@/i18n/locale-provider";
import { isAppLocale, type AppLocale } from "@/i18n";
import { addDays, formatLongDate, toISODate } from "@/lib/dates";
import { todayGreeting } from "@/lib/greeting";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { dayArc } from "@/lib/momentum";
import { sceneCssVars } from "@/lib/scene/css";
import { skyGradient } from "@/lib/scene/sky";
import type { SceneWeather } from "@/lib/scene/weather";
import type { Season } from "@/lib/scene/season";
import type { SkyPhase } from "@/lib/scene/sun";
import {
  KIT_TYPES,
  PALETTE_IDS,
  type Completion,
  type Duty,
  type HomeRoom,
  type Household,
  type KitType,
  type PaletteId,
} from "@/lib/types";

const PHASES: SkyPhase[] = ["night", "dawn", "day", "golden", "dusk"];
const WEATHERS = ["clear", "cloudy", "rain", "snow", "fog"] as const;
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

function isKit(v: string | null): v is KitType {
  return Boolean(v && (KIT_TYPES as readonly string[]).includes(v));
}
function isPalette(v: string | null): v is PaletteId {
  return Boolean(v && (PALETTE_IDS as readonly string[]).includes(v));
}
function isPhase(v: string | null): v is SkyPhase {
  return Boolean(v && (PHASES as readonly string[]).includes(v));
}
function isWeather(v: string | null): v is (typeof WEATHERS)[number] {
  return Boolean(v && (WEATHERS as readonly string[]).includes(v));
}
function isSeason(v: string | null): v is Season {
  return Boolean(v && (SEASONS as readonly string[]).includes(v));
}

function duty(partial: Partial<Duty> & Pick<Duty, "id" | "title" | "room">): Duty {
  return {
    notes: "",
    nodeId: partial.room,
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "daily",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-09-01T00:00:00.000Z",
    archived: false,
    estimatedMinutes: 8,
    ...partial,
  };
}

function completion(dutyId: string, at: Date): Completion {
  return {
    id: `c-${dutyId}`,
    dutyId,
    actor: "me",
    visitId: null,
    completedAt: at.toISOString(),
  };
}

function rooms(): HomeRoom[] {
  const types: HomeRoom["type"][] = [
    "kitchen",
    "living",
    "bathroom",
    "primary_bedroom",
    "laundry",
  ];
  return types.map((type, index) => ({
    id: type,
    floorId: "main",
    name: type,
    type,
    sortOrder: index,
  }));
}

function fixtureHousehold(opts: {
  kitType: KitType;
  palette: PaletteId;
  closed: boolean;
  now: Date;
}): Household {
  const allRooms = rooms();
  const openMany = ["wipe", "bath", "beds", "laundry", "desk"].map((id, index) =>
    duty({
      id,
      title: id,
      room: allRooms[index]?.id ?? "kitchen",
      estimatedMinutes: 10,
    }),
  );
  const noon = new Date(opts.now.getFullYear(), opts.now.getMonth(), opts.now.getDate(), 12, 0, 0);
  const completions = opts.closed
    ? openMany.map((item) => completion(item.id, noon))
    : [completion("wipe", noon), completion("bath", noon)];

  return withHouseholdDefaults({
    version: 8,
    householdName: "Casa",
    ownerName: "Alex",
    cleanerName: "Ana",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: allRooms,
    assets: [],
    duties: openMany,
    completions,
    visits: [],
    supplyAutomations: [],
    location: {
      postalCode: "94110",
      lat: 37.75,
      lng: -122.42,
      placeName: "San Francisco",
    },
    homeSpec: {
      version: 2,
      kitType: opts.kitType,
      palette: opts.palette,
      windows: [],
      seed: 42,
    },
    momentum: {
      enabled: true,
      bestRun: 12,
      care: { level: "well-kept", since: toISODate(addDays(opts.now, -3)), direction: "up" },
      nightFollowsSky: true,
    },
  });
}

function weatherFor(kind: (typeof WEATHERS)[number]): SceneWeather {
  if (kind === "clear") return { kind, cloudCover: 0.05, precipIntensity: 0, source: "derived" };
  if (kind === "cloudy") return { kind, cloudCover: 0.7, precipIntensity: 0, source: "derived" };
  if (kind === "fog") return { kind, cloudCover: 0.9, precipIntensity: 0, source: "derived" };
  if (kind === "rain") return { kind, cloudCover: 0.85, precipIntensity: 0.7, source: "derived" };
  return { kind: "snow", cloudCover: 0.8, precipIntensity: 0.6, source: "derived" };
}

function PortraitShotInner() {
  const params = useSearchParams();
  const { t } = useLocale();
  const kitParam = params.get("kit");
  const paletteParam = params.get("palette");
  const phaseParam = params.get("phase");
  const weatherParam = params.get("weather");
  const seasonParam = params.get("season");
  const kitType: KitType = isKit(kitParam) ? kitParam : "a";
  const palette: PaletteId = isPalette(paletteParam) ? paletteParam : "classic";
  const phase: SkyPhase = isPhase(phaseParam) ? phaseParam : "day";
  const weatherKind = isWeather(weatherParam) ? weatherParam : "clear";
  const season: Season = isSeason(seasonParam) ? seasonParam : "summer";
  const closed = params.get("closed") === "1";
  const lit = params.get("lit");
  const windowsLit = lit != null && lit !== "" ? Number(lit) : undefined;
  const detailsParam = params.get("details");
  const forcedDetails = detailsParam
    ? detailsParam.split(",").filter((kind): kind is SceneDetailKind => (DETAIL_KINDS as readonly string[]).includes(kind))
    : undefined;
  const compact = params.get("compact") === "1";
  const ceremony = params.get("ceremony") === "1";
  const weather = weatherFor(weatherKind);
  const stops = skyGradient(phase, 0.55, weather.kind, weather.cloudCover);
  const cssVars = sceneCssVars(stops);
  const nightFollows = phase === "dusk" || phase === "night";

  const now = useMemo(() => new Date(2026, 8, 14, 10, 0, 0), []);
  const household = useMemo(
    () => fixtureHousehold({ kitType, palette, closed, now }),
    [kitType, palette, closed, now],
  );
  const arc = dayArc(household, now);
  const greeting = todayGreeting(household.ownerName, 10);
  const weatherLabel = t(`scene.weather.${weatherKind}` as "scene.weather.clear");
  const secondaryLine = `${formatLongDate(now)} · ${weatherLabel}`;

  useEffect(() => {
    if (!compact) return;
    const pane = document.querySelector("[data-portrait-scroll]");
    if (pane instanceof HTMLElement) pane.scrollTop = 160;
  }, [compact]);

  return (
    <div
      data-portrait-scroll
      className="h-[844px] w-[390px] overflow-y-auto bg-background"
      data-locale-ready="1"
    >
      <div
        className={nightFollows ? "today-night today-scene-root" : "today-scene-root"}
        style={{
          ...cssVars,
          background: "color-mix(in oklab, var(--background) 96%, var(--ambient))",
        }}
      >
        <PortraitScene
          household={household}
          arc={arc}
          phase={phase}
          phaseT={0.55}
          weather={weather}
          ceremony={ceremony || closed}
          greeting={greeting}
          secondaryLine={secondaryLine}
          onOpenSettings={() => undefined}
          overrides={{
            kitType,
            palette,
            phase,
            phaseT: 0.55,
            weather,
            season,
            windowsLit: Number.isFinite(windowsLit) ? windowsLit : undefined,
            closedToday: closed || ceremony,
            details: forcedDetails,
          }}
        />
        {compact ? (
          <div className="sticky top-0 z-30 flex h-[calc(env(safe-area-inset-top)+44px)] items-end justify-between bg-background/90 px-5 pb-2 backdrop-blur-md">
            <p className="ui-caption font-medium">{t("today.compactTitle", { count: 3 })}</p>
          </div>
        ) : null}
        <div className="today-sheet relative z-10 -mt-7 flex flex-col gap-5 rounded-t-[28px] bg-background px-5 pt-4 pb-24">
          <div aria-hidden className="h-[420px] rounded-2xl bg-secondary/40" />
        </div>
      </div>
    </div>
  );
}

export function PortraitShotPage() {
  const params = useSearchParams();
  const localeParam = params.get("locale");
  const locale: AppLocale = isAppLocale(localeParam) ? localeParam : "en";

  useEffect(() => {
    const root = document.documentElement;
    if (params.get("theme") === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    if (params.get("reduced") === "1") {
      const style = document.createElement("style");
      style.id = "portrait-reduced-motion";
      style.textContent = "* { animation: none !important; transition: none !important; }";
      document.head.appendChild(style);
      return () => style.remove();
    }
    return;
  }, [params]);

  return (
    <DevLocaleOverride locale={locale}>
      <PortraitShotInner />
    </DevLocaleOverride>
  );
}
