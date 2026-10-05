"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useLocale } from "@/i18n/locale-provider";
import { DUR_NONE, DUR_QUICK, EASE_OUT, SPRING_SETTLE } from "@/lib/motion";
import { hapticPress } from "@/lib/native/haptics";
import {
  arrivalKey,
  MAX_PORCH_BOXES,
  pickCourierWalk,
  type Delivery,
} from "@/lib/scene/delivery";
import { markArrivalWalked, walkedArrivals } from "@/lib/scene/delivery-seen";

/** Seconds: in from the left, a beat at the step, back out. */
const WALK_IN = 2.2;
const DROP = 0.7;
const WALK_OUT = 1.8;
const WALK_TOTAL = WALK_IN + DROP + WALK_OUT;

/**
 * A supply that was marked on the way and has come due, shown as a box on the
 * porch; and, on the day it is due, a small courier who walks up to the door,
 * leaves it, and walks off again.
 *
 * Built from the same pieces as the care decor and the visitor: CSS and inline
 * SVG, positioned as percentages of the house stack, sitting in the ground
 * layer so it leans with the house. The box is the only part that stays. It is
 * not a timer: it is drawn from the supply list itself, so it is there while
 * the item is "on the way" and gone the moment it is marked arrived.
 *
 * The walk plays once per arrival, in whichever scene is on screen first
 * (Today and Home both draw this), then every scene just shows the box. Under
 * Reduce Motion there is no courier at all, only the box.
 *
 * Decorative unless `onOpen` is given. The Restock row carries the same fact
 * in words, so the scene never has to be the only place it is said.
 */
export function DeliveryLayer({
  deliveries,
  door,
  now,
  paused,
  onOpen,
}: {
  deliveries: Delivery[];
  /** The front door, as percentages of the stack's box, plus its width. */
  door: { x: number; y: number; w: number };
  now: Date;
  paused?: boolean;
  /** Tapping the boxes: the one item, or null when more than one is waiting. */
  onOpen?: (itemId: string | null) => void;
}) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const [walking, setWalking] = useState<string | null>(null);

  // The arrival that has not had its walk yet. Read during render (cheap, and
  // it is what lets the courier start on the very render the scene shows),
  // marked as walked in an effect so no other scene plays it again.
  const pending = paused ? null : pickCourierWalk(deliveries, walkedArrivals(), now);
  const pendingKey = pending ? arrivalKey(pending) : null;
  if (pendingKey && !reduce && walking !== pendingKey) setWalking(pendingKey);
  useEffect(() => {
    if (pendingKey) markArrivalWalked(pendingKey);
  }, [pendingKey]);

  if (deliveries.length === 0) return null;

  // The step in front of the door, and the spot the courier stops short of.
  const boxX = door.x + door.w * 1.15;
  const boxY = door.y;
  const startX = Math.max(2, door.x - 34);
  const stopX = boxX - door.w * 0.9;
  const shown = deliveries.slice(0, MAX_PORCH_BOXES);
  const walkingNow = walking != null && shown.some((entry) => arrivalKey(entry) === walking);
  const label =
    deliveries.length === 1
      ? t("scene.delivery", { item: deliveries[0].itemName })
      : t("scene.deliveries", { count: String(deliveries.length) });

  const boxes = (
    <motion.span
      className="relative block"
      initial={walkingNow && !reduce ? { opacity: 0, y: -5 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce
          ? { duration: DUR_NONE }
          : walkingNow
            ? { ...SPRING_SETTLE, delay: WALK_IN, opacity: { duration: DUR_QUICK, delay: WALK_IN } }
            : { duration: DUR_QUICK, ease: EASE_OUT }
      }
    >
        {shown.map((entry, index) => (
          <span
            key={entry.itemId}
            className="absolute left-1/2 top-1/2 block"
            style={{ transform: `translate(calc(-50% + ${index * -3}px), calc(-50% - ${index * 6}px))` }}
          >
            <Box />
          </span>
        ))}
        <span className="block h-3.5 w-4" />
    </motion.span>
  );

  return (
    <div
      aria-hidden={onOpen ? undefined : true}
      className="scene-delivery pointer-events-none absolute inset-0"
      data-paused={paused ? "true" : "false"}
    >
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${boxX}%`, top: `${boxY}%` }}
      >
        {onOpen ? (
          <button
            type="button"
            aria-label={label}
            onClick={() => {
              void hapticPress();
              onOpen(deliveries.length === 1 ? deliveries[0].itemId : null);
            }}
            // 44pt either way, centred on the box, whatever the box measures.
            className="pointer-events-auto flex size-11 items-center justify-center"
          >
            {boxes}
          </button>
        ) : (
          boxes
        )}
      </div>
      {walkingNow ? (
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-full"
          style={{ top: `calc(${boxY}% + 7px)` }}
          initial={{ left: `${startX}%`, opacity: 0 }}
          animate={{
            left: [`${startX}%`, `${stopX}%`, `${stopX}%`, `${startX}%`],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: WALK_TOTAL,
            times: [0, WALK_IN / WALK_TOTAL, (WALK_IN + DROP) / WALK_TOTAL, 1],
            ease: ["linear", "linear", "linear"],
            opacity: {
              duration: WALK_TOTAL,
              times: [0, 0.12, 0.9, 1],
              ease: "linear",
            },
          }}
          onAnimationComplete={() => setWalking(null)}
        >
          <motion.span
            className="block"
            animate={{ scaleX: [1, 1, -1, -1] }}
            transition={{
              duration: WALK_TOTAL,
              times: [0, (WALK_IN + DROP * 0.5) / WALK_TOTAL, (WALK_IN + DROP * 0.5) / WALK_TOTAL + 0.001, 1],
              ease: "linear",
            }}
          >
            <span className="delivery-step block">
              <Courier />
            </span>
          </motion.span>
        </motion.div>
      ) : null}
    </div>
  );
}

function Box() {
  return (
    <svg viewBox="0 0 16 14" className="h-3.5 w-4" fill="none" aria-hidden>
      <path d="M1.5 4.2 8 1.5l6.5 2.7v7.6L8 12.5l-6.5-2.7z" fill="#c9985f" />
      <path d="M1.5 4.2 8 6.9l6.5-2.7" stroke="#a87a45" strokeWidth="0.8" />
      <path d="M8 6.9v5.6" stroke="#a87a45" strokeWidth="0.8" />
      <path d="M5.2 2.6 11 5" stroke="#efe3cf" strokeWidth="1.1" />
    </svg>
  );
}

/** A tiny courier, facing right, with the box held out in front until it is
 * set down. Shapes only: a cap, a slate coat, two legs. */
function Courier() {
  return (
    <svg viewBox="0 0 20 28" className="h-7 w-5" fill="none" aria-hidden>
      <circle cx="9" cy="6" r="3.2" fill="#e6bf9d" />
      <path d="M5.6 5.2c.4-3.2 5.6-3.6 6.8 0z" fill="#3f5f86" />
      <path d="M11.6 5.4h3" stroke="#3f5f86" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.5 10h7v8h-7z" fill="#5a7ea8" />
      <path d="M6.5 18v7M11.5 18v7" stroke="#34455c" strokeWidth="1.8" strokeLinecap="round" />
      <motion.g
        initial={{ opacity: 1 }}
        animate={{ opacity: [1, 1, 0, 0] }}
        transition={{
          duration: WALK_TOTAL,
          times: [0, WALK_IN / WALK_TOTAL, (WALK_IN + DROP * 0.4) / WALK_TOTAL, 1],
          ease: "linear",
        }}
      >
        <path d="M11 11.5 14.5 12.5" stroke="#5a7ea8" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12.5 11 17.5 12.5v4.5l-5 1.2z" fill="#c9985f" />
      </motion.g>
    </svg>
  );
}
