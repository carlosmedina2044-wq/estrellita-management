"use client";

import { useTheme } from "next-themes";
import { useLocale } from "@/i18n/locale-provider";
import { APPLE_WEATHER_ATTRIBUTION } from "@/lib/weather/client";
import { openExternalUrl } from "@/lib/native/open-url";
import type { WeatherAttribution } from "@/lib/native/weatherkit";

export function AppleWeatherAttribution({
  className,
  attribution,
}: {
  className?: string;
  attribution?: WeatherAttribution | null;
}) {
  const { t } = useLocale();
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
        <img src={mark} alt={t("weather.appleWeatherAlt")} className="h-5 w-auto" height={20} />
      ) : (
        <span>{t("weather.appleWeatherMark")}</span>
      )}
      <button
        type="button"
        className="inline-flex min-h-11 items-center underline underline-offset-2"
        onClick={() => void openExternalUrl(href)}
      >
        {t("weather.otherDataSources")}
      </button>
    </p>
  );
}
