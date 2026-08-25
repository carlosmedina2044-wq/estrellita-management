"use client";

import { APPLE_WEATHER_ATTRIBUTION } from "@/lib/weather/client";
import { openExternalUrl } from "@/lib/native/open-url";

export function AppleWeatherAttribution({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-[11px] text-muted-foreground"}>
      Weather:{" "}
      <button
        type="button"
        className="underline underline-offset-2"
        onClick={() => void openExternalUrl(APPLE_WEATHER_ATTRIBUTION.href)}
      >
        {APPLE_WEATHER_ATTRIBUTION.mark}
      </button>
    </p>
  );
}
