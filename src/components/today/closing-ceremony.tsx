"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { CountUp } from "@/components/today/count-up";
import { RunStrip } from "@/components/today/run-strip";
import { useLocale } from "@/i18n/locale-provider";
import { CEREMONY_MS, EASE_OUT } from "@/lib/motion";
import { hapticClose, hapticSuccess } from "@/lib/native/haptics";
import type { RunDay } from "@/lib/momentum";
import type { Household } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ClosingCeremony({
  household,
  now,
  stats,
  runDays,
  ceremony,
  onSettled,
  onShare,
  ledgerLine,
}: {
  household: Household;
  now: Date;
  stats: { done: number; minutes: number; rooms: number };
  runDays: RunDay[];
  ceremony: boolean;
  onSettled?: () => void;
  onShare?: () => void;
  ledgerLine?: string;
}) {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const [skipped, setSkipped] = useState(false);
  const [settled, setSettled] = useState(!ceremony);
  const instant = skipped || !ceremony || Boolean(reduceMotion);
  const duration = instant ? 0 : undefined;

  useEffect(() => {
    if (!ceremony) return;
    if (reduceMotion) {
      void hapticSuccess();
      const timer = window.setTimeout(() => {
        setSettled(true);
        onSettled?.();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    void hapticClose();
    const timer = window.setTimeout(() => {
      setSettled(true);
      onSettled?.();
    }, CEREMONY_MS);
    return () => window.clearTimeout(timer);
  }, [ceremony, onSettled, reduceMotion]);

  function skip() {
    if (!ceremony || settled) return;
    setSkipped(true);
    setSettled(true);
    onSettled?.();
  }

  return (
    <div className="relative" onPointerDown={ceremony && !settled ? skip : undefined}>
      {ceremony && !settled ? (
        <button
          type="button"
          className="absolute inset-0 z-20 cursor-pointer bg-transparent"
          aria-label={t("today.ceremonySkipAria")}
          onClick={skip}
        />
      ) : null}
      <motion.div
        className="pointer-events-none absolute inset-0 -mx-4 -my-2 rounded-[var(--r-container)] bg-[radial-gradient(closest-side,var(--brand-cream),transparent)]"
        initial={{ opacity: instant ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: duration ?? 0.3 }}
      />
      <div className="relative z-10 flex flex-col gap-3">
        <AnimatePresence mode="wait">
          <motion.h1
            key="closed"
            className="ui-hero text-foreground"
            aria-live="polite"
            initial={instant ? false : { y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: duration ?? 0.25, delay: instant ? 0 : 0.15 }}
          >
            {t("today.heroClosed1")}
          </motion.h1>
        </AnimatePresence>
        <div className="relative flex items-end gap-4">
          <motion.div
            className="absolute -left-2 bottom-0 -z-10 opacity-40 dark:opacity-12"
            initial={instant ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: duration ?? 0.4, delay: instant ? 0 : 0.7, ease: EASE_OUT }}
          >
            <IllustratedMoment
              kind="shelf-scene"
              size={180}
              loop
              autoplay
              playing={settled || !ceremony}
            />
          </motion.div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <CountUp to={stats.done} duration={instant ? 0 : 0.5} className="ui-title font-semibold" />
              <p className="ui-caption text-muted-foreground">{t("today.ceremonyThings")}</p>
            </div>
            <div>
              <CountUp to={stats.minutes} duration={instant ? 0 : 0.5} className="ui-title font-semibold" />
              <p className="ui-caption text-muted-foreground">{t("today.ceremonyMinutes")}</p>
            </div>
            <div>
              <CountUp to={stats.rooms} duration={instant ? 0 : 0.5} className="ui-title font-semibold" />
              <p className="ui-caption text-muted-foreground">{t("today.ceremonyRooms")}</p>
            </div>
          </div>
        </div>
        <RunStrip household={household} now={now} days={runDays} celebrate={!instant} />
        {ledgerLine ? (
          <motion.p
            className="ui-caption text-muted-foreground"
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: instant ? 0 : 0.9, duration: duration ?? 0.2 }}
          >
            {ledgerLine}
          </motion.p>
        ) : null}
        {onShare ? (
          <motion.button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onShare();
            }}
            className={cn(
              "relative z-30 h-10 self-start rounded-full bg-secondary px-4 ui-caption font-medium",
            )}
            initial={instant ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: instant ? 0 : 0.9, duration: duration ?? 0.2 }}
          >
            {t("today.ceremonyShare")}
          </motion.button>
        ) : null}
      </div>
    </div>
  );
}
