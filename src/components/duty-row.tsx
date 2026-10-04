"use client";

import { Fragment, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useLocale } from "@/i18n/locale-provider";
import { tDutyTitle } from "@/i18n/content";
import { Circle, Ellipsis } from "lucide-react";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { dutySubtitle, installedAtFor } from "@/lib/duties";
import { DUR_INSTANT, DUR_QUICK, EASE_OUT, SPRING_DRAG, SPRING_PRESS } from "@/lib/motion";
import { hapticPress, hapticTab } from "@/lib/native/haptics";
import type { Duty, Household } from "@/lib/types";
import { cn } from "@/lib/utils";

/** How far a row travels before the swipe counts. Fixed pixels rather than a
 * share of the width: the gesture should feel the same on every row and on
 * every screen size, and 88px is a comfortable thumb sweep. */
const SWIPE_COMMIT = 88;
/** Past the commit point the row keeps moving, but grudgingly, so the gesture
 * has a floor you can feel instead of sliding off the screen. */
const SWIPE_MAX = 132;

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
  onSnooze,
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
  /** Swipe left to put this off a week. Without it the row only swipes one
   * way, which is correct for a row that has nothing to postpone. */
  onSnooze?: () => void;
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

  // Swipe to complete, swipe back to snooze. The check is bound to how far the
  // row has travelled rather than played on release, so the tick draws under
  // the finger and the gesture shows its own progress instead of promising
  // something that only happens once you let go.
  const reduceMotion = useReducedMotion();
  const dragX = useMotionValue(0);
  const swipeReady = Boolean(onToggle) && !done && !completing && !reduceMotion;
  const swipeState = useRef<{
    startX: number;
    startY: number;
    active: boolean | null;
    passed: boolean;
    pointerId: number;
  } | null>(null);
  const [swiping, setSwiping] = useState(false);
  const drawProgress = useTransform(dragX, [0, SWIPE_COMMIT], [0, 1], { clamp: true });
  const completeTint = useTransform(dragX, [0, SWIPE_COMMIT], [0, 1], { clamp: true });
  const snoozeTint = useTransform(dragX, [-SWIPE_COMMIT, 0], [1, 0], { clamp: true });

  function settleSwipe() {
    const state = swipeState.current;
    swipeState.current = null;
    setSwiping(false);
    if (!state?.active) return;
    const travelled = dragX.get();
    if (travelled >= SWIPE_COMMIT) {
      dragX.set(0);
      onToggle();
      return;
    }
    if (travelled <= -SWIPE_COMMIT && onSnooze) {
      dragX.set(0);
      onSnooze();
      return;
    }
    animate(dragX, 0, SPRING_DRAG);
  }

  function onSwipePointerDown(event: ReactPointerEvent) {
    if (!swipeReady || event.button !== 0) return;
    swipeState.current = {
      startX: event.clientX,
      startY: event.clientY,
      active: null,
      passed: false,
      pointerId: event.pointerId,
    };
  }

  function onSwipePointerMove(event: ReactPointerEvent) {
    const state = swipeState.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (state.active === null) {
      // Undecided until the direction is clear. Requiring the horizontal
      // component to lead by a margin keeps a slightly slanted flick of the
      // list from grabbing a row instead of scrolling.
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        swipeState.current = null;
        return;
      }
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      state.active = true;
      setSwiping(true);
      clearLongPress();
      event.currentTarget.setPointerCapture(state.pointerId);
    }
    const limit = dx < 0 && !onSnooze ? 0 : SWIPE_COMMIT;
    const clamped =
      Math.abs(dx) <= limit
        ? dx
        : Math.sign(dx) * Math.min(SWIPE_MAX, limit + (Math.abs(dx) - limit) * 0.35);
    dragX.set(clamped);
    const passed = Math.abs(clamped) >= SWIPE_COMMIT;
    if (passed !== state.passed) {
      state.passed = passed;
      // Only on the way in: a tick each time the finger wobbles across the
      // line would rattle.
      if (passed) void hapticTab();
    }
  }

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
      className="relative overflow-hidden"
      onPointerDown={(event) => {
        onRowPointerDown(event);
        onSwipePointerDown(event);
      }}
      onPointerMove={(event) => {
        onRowPointerMove(event);
        onSwipePointerMove(event);
      }}
      onPointerUp={() => {
        clearLongPress();
        settleSwipe();
      }}
      onPointerCancel={() => {
        clearLongPress();
        settleSwipe();
      }}
      onContextMenu={(event) => {
        if (!onLongPress || done || completing) return;
        event.preventDefault();
        onLongPress({ x: event.clientX, y: event.clientY });
      }}
    >
      {swiping ? (
        <>
          {/* What the row is about to do, revealed by the row moving off it. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 flex w-[132px] items-center pl-4 bg-done-soft"
            style={{ opacity: completeTint }}
          >
            <svg viewBox="0 0 24 24" className="size-5 text-done" aria-hidden>
              <motion.path
                d="M5 13l4 4L19 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pathLength: drawProgress }}
              />
            </svg>
          </motion.span>
          {onSnooze ? (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 flex w-[132px] items-center justify-end pr-4 bg-soon-soft ui-caption font-medium text-soon"
              style={{ opacity: snoozeTint }}
            >
              {t("chore.snoozeWeek")}
            </motion.span>
          ) : null}
        </>
      ) : null}
      <motion.div
        // The title already recedes on its own (text-muted-foreground +
        // line-through, below). Fading the whole row on top of that also
        // dimmed the checkmark badge — the one thing that should look
        // satisfying, not washed out — and made a "Done today" list read as
        // faint across the board instead of just quietly finished.
        className="ui-group-row relative flex items-stretch bg-card px-1"
        style={{ x: dragX }}
      >
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
                className="absolute inset-0 rounded-full bg-done"
                initial={completing && !done ? { scale: 0 } : false}
                animate={{ scale: 1 }}
                transition={{ duration: DUR_QUICK, ease: EASE_OUT }}
              />
              <svg viewBox="0 0 24 24" className="relative size-3.5 text-card" aria-hidden>
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
            <span className={cn("mt-0.5 block text-pretty ui-caption num", metaTone)}>
              {showDone && doneMeta ? (
                doneMeta
              ) : (
                // Each segment is kept whole and carries its own trailing dot,
                // so a wrapped line breaks between segments and never starts
                // with a stray "·".
                (
                  `${metaLabel && !showDone ? `${metaLabel} · ${subtitle}` : subtitle}${
                    duty.audience === "cleaner" && !showDone ? ` · ${t("audience.cleaner")}` : ""
                  }`
                )
                  .split(" · ")
                  .map((segment, index, all) => (
                    <Fragment key={index}>
                      <span className="whitespace-nowrap">
                        {segment}
                        {index < all.length - 1 ? " ·" : ""}
                      </span>
                      {index < all.length - 1 ? " " : null}
                    </Fragment>
                  ))
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
      </motion.div>
    </div>
  );
}
