"use client";

import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { CareTitle } from "@/components/today/care-title";
import { HouseOrbit } from "@/components/today/house-orbit";
import { KeptRoomsRow } from "@/components/today/kept-rooms-row";
import { RollingNumber } from "@/components/today/rolling-number";
import { RunStrip } from "@/components/today/run-strip";
import { useLocale } from "@/i18n/locale-provider";
import { formatWeekdayDate } from "@/lib/dates";
import type { CareState, Household } from "@/lib/types";
import type { DayArc } from "@/lib/momentum";
import { runStripDays } from "@/lib/momentum";
import { dayOfYear, heroCopyKey } from "@/lib/today-copy";

export function TodayHero({
  household,
  now,
  arc,
  greeting,
  secondaryLine,
  variant,
  careState,
  onOpenSettings,
  onOpenCalendar,
  children,
}: {
  household: Household;
  now: Date;
  arc: DayArc;
  greeting: string;
  secondaryLine: ReactNode;
  variant: "plain" | "momentum";
  careState?: CareState;
  onOpenSettings?: () => void;
  onOpenCalendar?: () => void;
  children?: ReactNode;
}) {
  const { t } = useLocale();
  const level = careState?.level ?? "settling-in";
  const hasName = Boolean(household.ownerName.trim());
  const dayLabel = arc.nextUp ? formatWeekdayDate(arc.nextUp) : "";
  const count = arc.state === "closed" ? arc.done : arc.open;
  const headline =
    variant === "plain"
      ? arc.open === 1
        ? t("today.headlineOne")
        : arc.open > 1
          ? t("today.headlineMany", { count: arc.open })
          : t("today.headlineClear", { day: dayLabel || "—" })
      : t(heroCopyKey(arc.state, dayOfYear(now), { hasName, count }), {
          count,
          minutes: arc.minutesLeft,
          day: dayLabel,
          name: household.ownerName.trim(),
        });

  const minutesParts = t("today.minutesLeft", { minutes: "%%" }).split("%%");
  const stripDays = runStripDays(household, now);

  return (
    <header className="relative ui-group bg-card px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="ui-card font-semibold leading-snug text-foreground">{greeting}</p>
            {onOpenSettings ? (
              <button
                type="button"
                aria-label={t("common.settings")}
                onClick={onOpenSettings}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
              >
                <Settings className="size-5" />
              </button>
            ) : null}
          </div>
          {variant === "momentum" ? <CareTitle careState={careState} now={now} /> : null}
          {children}
          <h1
            aria-live="polite"
            aria-atomic="true"
            className="ui-hero mt-1 origin-left text-foreground"
          >
            {headline}
          </h1>
          <div className="mt-1.5 ui-caption num text-muted-foreground">{secondaryLine}</div>
        </div>
        {variant === "momentum" ? (
          <div className="flex flex-col items-center gap-1">
            <HouseOrbit
              arc={arc}
              level={level}
              dimmed={careState?.direction === "down"}
              ceremony={false}
              label={t("today.houseAria", {
                level: t(`care.level.${level}` as "care.level.settling-in"),
              })}
            />
            <p className="ui-caption num text-muted-foreground">
              {minutesParts[0]}
              <RollingNumber value={arc.minutesLeft} />
              {minutesParts[1] ?? null}
            </p>
          </div>
        ) : null}
      </div>
      {variant === "momentum" ? (
        <div className="mt-3 flex flex-col gap-3">
          <RunStrip
            household={household}
            now={now}
            days={stripDays}
            onOpenCalendar={onOpenCalendar}
          />
          <KeptRoomsRow household={household} now={now} />
        </div>
      ) : null}
    </header>
  );
}
