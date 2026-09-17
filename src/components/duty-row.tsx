"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion } from "motion/react";
import { useLocale } from "@/i18n/locale-provider";
import { tDutyTitle } from "@/i18n/content";
import { Circle, Ellipsis } from "lucide-react";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { dutySubtitle, installedAtFor } from "@/lib/duties";
import { DUR_INSTANT, DUR_QUICK, EASE_OUT, SPRING_PRESS } from "@/lib/motion";
import { hapticPress } from "@/lib/native/haptics";
import type { Duty, Household } from "@/lib/types";
import { cn } from "@/lib/utils";

function DelayedSparkle({
  onComplete,
  onError,
}: {
  onComplete: () => void;
  onError: () => void;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 200);
    return () => window.clearTimeout(timer);
  }, []);
  if (!show) return null;
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <IllustratedMoment
        kind="sparkle-burst"
        size={96}
        autoplay
        onComplete={onComplete}
        onError={onError}
      />
    </span>
  );
}

export function DutyRow({
  duty,
  household,
  now,
  done,
  doneMeta,
  overdue,
  upcoming,
  partChip,
  onPartChip,
  missingPartHint,
  hideOverdueChip,
  completing,
  onPressStart,
  onLongPress,
  onMore,
  onToggle,
  onOpen,
  onSparkleError,
}: {
  duty: Duty;
  household?: Household;
  now?: Date;
  done?: boolean;
  doneMeta?: string;
  overdue?: boolean;
  upcoming?: boolean;
  partChip?: { kind: string; label: string } | null;
  onPartChip?: () => void;
  missingPartHint?: boolean;
  hideOverdueChip?: boolean;
  completing?: boolean;
  onPressStart?: () => void;
  onLongPress?: (point: { x: number; y: number }) => void;
  onMore?: (point: { x: number; y: number }) => void;
  onToggle: () => void;
  onOpen?: () => void;
  onSparkleError?: (point: { x: number; y: number }) => void;
}) {
  const { t } = useLocale();
  const longPressTimer = useRef<number | null>(null);
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);
  const checkRef = useRef<HTMLButtonElement>(null);
  const showDone = Boolean(done || completing);
  const title = tDutyTitle(duty.title);
  let subtitle = missingPartHint
    ? t("chore.noPart")
    : household
      ? dutySubtitle(duty, household.completions, now, installedAtFor(household, duty.id), household, overdue)
      : dutySubtitle(duty, [], now, undefined, undefined, overdue);
  if (
    overdue &&
    (partChip?.kind === "install_today" || partChip?.kind === "part_on_hand")
  ) {
    subtitle = t("chore.suppliesOnHand", { subtitle });
  }

  const metaTone = overdue && !hideOverdueChip
    ? "text-overdue"
    : partChip && partChip.kind === "install_today"
      ? "text-done"
      : partChip && partChip.kind === "arriving"
        ? "text-soon"
        : upcoming
          ? "text-muted-foreground"
          : "text-muted-foreground";
  const circleTone = overdue && !hideOverdueChip
    ? "text-overdue"
    : partChip && partChip.kind === "install_today"
      ? "text-done"
      : upcoming
        ? "text-soon"
        : "text-foreground/55";
  const metaLabel = overdue && !hideOverdueChip
    ? t("chore.overdue")
    : partChip && (partChip.kind === "arriving" || partChip.kind === "install_today")
      ? partChip.label
      : upcoming
        ? t("chore.upcoming")
        : null;

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressOrigin.current = null;
  }

  function onRowPointerDown(event: ReactPointerEvent) {
    if (!onLongPress || done || completing || event.button !== 0) return;
    longPressOrigin.current = { x: event.clientX, y: event.clientY };
    longPressTimer.current = window.setTimeout(() => {
      const origin = longPressOrigin.current;
      longPressTimer.current = null;
      if (!origin) return;
      void hapticPress();
      onLongPress(origin);
    }, 480);
  }

  function onRowPointerMove(event: ReactPointerEvent) {
    const origin = longPressOrigin.current;
    if (!origin || longPressTimer.current == null) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 12) {
      clearLongPress();
    }
  }

  return (
    <div
      className="overflow-hidden"
      onPointerDown={onRowPointerDown}
      onPointerMove={onRowPointerMove}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onContextMenu={(event) => {
        if (!onLongPress || done || completing) return;
        event.preventDefault();
        onLongPress({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className={cn("ui-group-row flex items-stretch bg-transparent px-1", showDone && "opacity-60")}>
        <motion.button
          ref={checkRef}
          type="button"
          onClick={onToggle}
          onPointerDown={() => {
            onPressStart?.();
            void hapticPress();
          }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING_PRESS}
          className="relative flex size-11 shrink-0 items-center justify-center text-primary active:bg-foreground/6"
          aria-label={showDone ? t("chore.undoAria", { title }) : t("chore.completeAria", { title })}
        >
          {showDone ? (
            <span className="relative flex size-6 items-center justify-center">
              <motion.span
                className="absolute inset-0 rounded-full bg-primary"
                initial={completing && !done ? { scale: 0 } : false}
                animate={{ scale: 1 }}
                transition={{ duration: DUR_QUICK, ease: EASE_OUT }}
              />
              <svg viewBox="0 0 24 24" className="relative size-3.5 text-primary-foreground" aria-hidden>
                <motion.path
                  d="M5 13l4 4L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={completing && !done ? { pathLength: 0 } : false}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: DUR_QUICK, delay: completing && !done ? DUR_QUICK : 0, ease: EASE_OUT }}
                />
                {completing && !done ? (
                  <>
                    <motion.path
                      d="M17 4l2 2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 1 }}
                      animate={{ pathLength: 1, opacity: 0 }}
                      transition={{ duration: DUR_INSTANT, delay: DUR_QUICK, ease: EASE_OUT }}
                    />
                    <motion.path
                      d="M20 7l1.5 1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 1 }}
                      animate={{ pathLength: 1, opacity: 0 }}
                      transition={{ duration: DUR_INSTANT, delay: DUR_QUICK, ease: EASE_OUT }}
                    />
                  </>
                ) : null}
              </svg>
            </span>
          ) : (
            <Circle className={cn("size-6 stroke-[2.2]", circleTone)} />
          )}
          {completing ? (
            <DelayedSparkle
              onComplete={() => {}}
              onError={() => {
                const rect = checkRef.current?.getBoundingClientRect();
                if (rect) {
                  onSparkleError?.({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                  });
                }
              }}
            />
          ) : null}
        </motion.button>
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen || completing}
          className="relative flex min-w-0 flex-1 items-center py-2.5 pr-3 text-left active:bg-foreground/6"
        >
          <span className="min-w-0 flex-1">
            <span className="relative block w-full">
              <span
                className={cn(
                  "block w-full ui-body font-medium leading-snug",
                  done && "text-muted-foreground line-through",
                  completing && !done && "text-muted-foreground",
                )}
              >
                {title}
              </span>
              {completing && !done ? (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-1/2 h-px w-full origin-left bg-muted-foreground"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: DUR_QUICK, delay: DUR_QUICK, ease: EASE_OUT }}
                />
              ) : null}
            </span>
            <span className={cn("mt-0.5 block truncate ui-caption num", metaTone)}>
              {showDone && doneMeta ? (
                doneMeta
              ) : (
                <>
                  {metaLabel && !showDone ? `${metaLabel} · ${subtitle}` : subtitle}
                  {duty.audience === "cleaner" && !showDone
                    ? ` · ${t("audience.cleaner")}`
                    : ""}
                </>
              )}
            </span>
          </span>
        </button>
        {partChip && !showDone && partChip.kind === "order_first" ? (
          <button
            type="button"
            onClick={onPartChip}
            className="flex min-h-11 items-center self-center pr-3"
          >
            <span className="inline-flex h-8 items-center rounded-full bg-signal-soft px-3 ui-caption font-medium text-signal">
              {partChip.label}
            </span>
          </button>
        ) : null}
        {onMore && !showDone ? (
          <button
            type="button"
            className="flex size-11 shrink-0 items-center justify-center text-muted-foreground active:bg-foreground/6"
            aria-label={t("chore.moreAria", { title })}
            aria-haspopup="menu"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onMore({ x: rect.left, y: rect.bottom });
            }}
          >
            <Ellipsis className="size-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
