"use client";

import {
  CloudFog,
  CloudRain,
  CloudSnow,
  Heart,
  MoonStars,
  Plant,
  SunDim,
} from "@phosphor-icons/react";
import type { SceneWeather } from "@/lib/scene/weather";
import type { SkyPhase } from "@/lib/scene/sun";
import type { CareLevelId } from "@/lib/types";
import { cn } from "@/lib/utils";

type StatusGlyphsProps = {
  weather: SceneWeather;
  phase: SkyPhase;
  careLevel?: CareLevelId;
  className?: string;
};

export function StatusGlyphs({ weather, phase, careLevel, className }: StatusGlyphsProps) {
  const glyphs: { key: string; node: React.ReactNode }[] = [];

  if (weather.kind === "rain") {
    glyphs.push({
      key: "rain",
      node: <CloudRain weight="duotone" className="size-5" aria-hidden />,
    });
  } else if (weather.kind === "snow") {
    glyphs.push({
      key: "snow",
      node: <CloudSnow weight="duotone" className="size-5" aria-hidden />,
    });
  } else if (weather.kind === "fog") {
    glyphs.push({
      key: "fog",
      node: <CloudFog weight="duotone" className="size-5" aria-hidden />,
    });
  }

  if (phase === "night") {
    glyphs.push({
      key: "night",
      node: <MoonStars weight="duotone" className="size-5" aria-hidden />,
    });
  } else if (phase === "golden" || phase === "dusk") {
    glyphs.push({
      key: "golden",
      node: <SunDim weight="duotone" className="size-5 text-amber-500" aria-hidden />,
    });
  }

  if (careLevel === "loved" || careLevel === "cared-for") {
    glyphs.push({
      key: "care",
      node: <Heart weight="duotone" className="size-5 text-rose-500" aria-hidden />,
    });
  } else if (careLevel === "well-kept" || careLevel === "kept") {
    glyphs.push({
      key: "care",
      node: <Plant weight="duotone" className="size-5 text-emerald-600" aria-hidden />,
    });
  }

  if (glyphs.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute right-4 top-[calc(env(safe-area-inset-top)+56px)] z-20 flex gap-2 text-foreground/75",
        className,
      )}
      aria-hidden
    >
      {glyphs.slice(0, 3).map((g) => (
        <span
          key={g.key}
          className="flex size-9 items-center justify-center rounded-full bg-background/35 backdrop-blur-sm"
        >
          {g.node}
        </span>
      ))}
    </div>
  );
}
