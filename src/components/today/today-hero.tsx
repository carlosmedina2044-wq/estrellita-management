"use client";

import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { HouseOrbit } from "@/components/today/house-orbit";
import { RollingNumber } from "@/components/today/rolling-number";
import { useLocale } from "@/i18n/locale-provider";
import { formatWeekdayDate } from "@/lib/dates";
import type { CareState, Household } from "@/lib/types";
import type { DayArc } from "@/lib/momentum";
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
              label={t("today.dayArcAria", { done: arc.done, total: arc.total })}
            />
            <p className="ui-caption num text-muted-foreground">
              {minutesParts[0]}
              <RollingNumber value={arc.minutesLeft} />
              {minutesParts[1] ?? null}
            </p>
          </div>
        ) : null}
      </div>
    </header>
  );
}
