"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Settings } from "lucide-react";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { CareTitle } from "@/components/today/care-title";
import { ClosingReward, ClosingStats } from "@/components/today/closing-ceremony";
import { HouseOrbit } from "@/components/today/house-orbit";
import { KeptRoomsRow } from "@/components/today/kept-rooms-row";
import { RollingNumber } from "@/components/today/rolling-number";
import { RunStrip } from "@/components/today/run-strip";
import { useLocale } from "@/i18n/locale-provider";
import { CEREMONY_MS, DUR_QUICK, EASE_OUT } from "@/lib/motion";
import { hapticClose, hapticSuccess } from "@/lib/native/haptics";
import type { CareState, Household } from "@/lib/types";
import type { DayArc, RunDay } from "@/lib/momentum";
import { runStripDays } from "@/lib/momentum";
import { dayOfYear, heroCopyKey, nextUpDayLabel } from "@/lib/today-copy";

export function TodayHero({
  household,
  now,
  arc,
  greeting,
  secondaryLine,
  variant,
  careState,
  ceremony,
  ceremonyStats,
  onOpenSettings,
  onOpenCalendar,
  onCeremonySettled,
  onShareClosed,
  ledgerLine,
}: {
  household: Household;
  now: Date;
  arc: DayArc;
  greeting: string;
  secondaryLine: ReactNode;
  variant: "plain" | "momentum";
  careState?: CareState;
  ceremony?: boolean;
  ceremonyStats?: { done: number; minutes: number; rooms: number };
  onOpenSettings?: () => void;
  onOpenCalendar?: () => void;
  onCeremonySettled?: () => void;
  onShareClosed?: () => void;
  ledgerLine?: string;
}) {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const level =
    arc.state === "closed" ? "loved" : (careState?.level ?? "settling-in");
  const hasName = Boolean(household.ownerName.trim());
  const dayLabel = nextUpDayLabel(arc.nextUp);
  const count = arc.state === "closed" ? arc.done : arc.open;
  const headline =
    variant === "plain"
      ? arc.open === 1
        ? t("today.headlineOne")
        : arc.open > 1
          ? t("today.headlineMany", { count: arc.open })
          : dayLabel
            ? t("today.headlineClear", { day: dayLabel })
            : t("today.heroClear3")
      : t(
          heroCopyKey(arc.state, dayOfYear(now), {
            hasName,
            count,
            nextUp: arc.nextUp,
          }),
          {
            count,
            minutes: arc.minutesLeft,
            day: dayLabel,
            name: household.ownerName.trim(),
          },
        );

  const minutesParts = t("today.minutesLeft", { minutes: "%%" }).split("%%");
  const stripDays: RunDay[] = runStripDays(household, now);
  const closed = variant === "momentum" && arc.state === "closed";
  const ceremonyOn = Boolean(ceremony) && closed;
  const ceremonyKey = ceremonyOn ? "on" : "off";
  const [phase, setPhase] = useState({ key: ceremonyKey, skipped: false, done: !ceremonyOn });
  if (phase.key !== ceremonyKey) {
    setPhase({ key: ceremonyKey, skipped: false, done: !ceremonyOn });
  }
  const settled = !ceremonyOn || phase.skipped || phase.done || Boolean(reduceMotion);
  const instant = settled;

  useEffect(() => {
    if (!ceremonyOn) return;
    if (reduceMotion) {
      void hapticSuccess();
      onCeremonySettled?.();
      return;
    }
    void hapticClose();
    const timer = window.setTimeout(() => {
      setPhase((prev) => (prev.key === "on" ? { ...prev, done: true } : prev));
      onCeremonySettled?.();
    }, CEREMONY_MS);
    return () => window.clearTimeout(timer);
  }, [ceremonyOn, onCeremonySettled, reduceMotion]);

  return (
    <header data-today-hero className="relative ui-group bg-card px-3 py-2">
      {ceremonyOn && !settled ? (
        <button
          type="button"
          className="absolute inset-0 z-20 cursor-pointer bg-transparent"
          aria-label={t("today.ceremonySkipAria")}
          onClick={() => {
            setPhase((prev) => ({ ...prev, skipped: true, done: true }));
            onCeremonySettled?.();
          }}
        />
      ) : null}

      {onOpenSettings ? (
        <button
          type="button"
          aria-label={t("common.settings")}
          onClick={onOpenSettings}
          className="absolute right-2 top-2 z-30 flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"
        >
          <Settings className="size-5" />
        </button>
      ) : null}

      <div className="pr-12">
        <p className="ui-card font-semibold leading-snug text-foreground">{greeting}</p>
      </div>

      <AnimatePresence mode="wait">
        <motion.h1
          key={arc.state}
          aria-live="polite"
          aria-atomic="true"
          className="ui-hero-serif mt-[4px] max-w-[22ch] pr-12 text-foreground"
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{
            duration: DUR_QUICK,
            ease: EASE_OUT,
            delay: ceremonyOn && !settled ? 0.15 : 0,
          }}
        >
          {headline}
        </motion.h1>
      </AnimatePresence>
      <div className="ui-caption num text-muted-foreground">{secondaryLine}</div>

      {variant === "momentum" ? (
        <>
          <div className="mt-1.5 flex items-start gap-4">
            <div className="relative w-[104px] shrink-0">
              <HouseOrbit
                size={104}
                arc={arc}
                level={level}
                dimmed={careState?.direction === "down"}
                ceremony={ceremonyOn}
                label={t("today.houseAria", {
                  level: t(`care.level.${level}` as "care.level.settling-in"),
                })}
              />
              <CareTitle
                careState={closed ? { level: "loved", since: careState?.since ?? "" } : careState}
                now={now}
                className="mt-0.5 block w-full text-center"
              />
              {ceremonyOn && !settled ? (
                <motion.div
                  className="pointer-events-none absolute left-1/2 top-[52px] -translate-x-1/2 -translate-y-1/2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: DUR_QUICK }}
                >
                  <IllustratedMoment kind="sparkle-burst" size={140} autoplay />
                </motion.div>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
              {closed && ceremonyStats ? (
                <>
                  <ClosingStats stats={ceremonyStats} instant={instant} />
                  <RunStrip
                    household={household}
                    now={now}
                    days={stripDays}
                    celebrate={!instant}
                    onOpenCalendar={onOpenCalendar}
                  />
                  {ledgerLine ? (
                    <p className="ui-caption truncate text-muted-foreground">{ledgerLine}</p>
                  ) : null}
                  <KeptRoomsRow household={household} now={now} />
                </>
              ) : (
                <>
                  <p className="ui-body font-medium num text-foreground">
                    {minutesParts[0]}
                    <RollingNumber value={arc.minutesLeft} />
                    {minutesParts[1] ?? null}
                  </p>
                  <RunStrip
                    household={household}
                    now={now}
                    days={stripDays}
                    onOpenCalendar={onOpenCalendar}
                  />
                  <KeptRoomsRow household={household} now={now} />
                </>
              )}
            </div>
          </div>
          {closed ? (
            <div className="relative z-30 mt-2">
              <ClosingReward onShare={onShareClosed} instant={instant} />
            </div>
          ) : null}
        </>
      ) : null}
    </header>
  );
}
