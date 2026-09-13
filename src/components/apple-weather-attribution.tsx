"use client";

import { useTheme } from "next-themes";
import { APPLE_WEATHER_ATTRIBUTION } from "@/lib/weather/client";
import { openExternalUrl } from "@/lib/native/open-url";
import type { WeatherStatus } from "@/lib/types";

export function AppleWeatherAttribution({
  className,
  attribution,
}: {
  className?: string;
  attribution?: WeatherStatus["attribution"];
}) {
  const { resolvedTheme } = useTheme();
  const href = attribution?.legalPageURL || APPLE_WEATHER_ATTRIBUTION.href;
  const mark =
    resolvedTheme === "dark"
      ? attribution?.markDark || attribution?.markLight
      : attribution?.markLight || attribution?.markDark;

  return (
    <p className={className ?? "flex items-center gap-2 text-[11px] text-muted-foreground"}>
      {mark ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mark} alt="Apple Weather" className="h-4 w-auto" height={16} />
      ) : (
        <span>{"\uF8FF"} Weather</span>
      )}
      <button
        type="button"
        className="inline-flex min-h-11 items-center underline underline-offset-2"
        onClick={() => void openExternalUrl(href)}
      >
        Other data sources
      </button>
    </p>
  );
}
