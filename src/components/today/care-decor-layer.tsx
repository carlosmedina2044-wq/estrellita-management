"use client";

import { motion, useReducedMotion } from "motion/react";
import { DUR_BASE, EASE_OUT, SPRING_SETTLE } from "@/lib/motion";
import type { CareDecor, CareDecorKind } from "@/lib/scene/care-decor";

/**
 * What the house has earned, standing on it all day. Separate from
 * `SceneDetails`: those come and go with the weather, the hour and the rooms,
 * and only two show at once. These are permanent — once a care level is
 * reached its decoration stays, and losing a level takes it away again. That
 * is the whole point of the layer: a "Settling in" house and a "Loved" house
 * had looked identical at noon.
 *
 * Rendered 3D props (public/props), plus the bunting, which is still inline SVG. Purely decorative: `aria-hidden`, no pointer events.
 *
 * Standing still is the rule, with exactly one exception: the piece being
 * earned right now drops onto its anchor once. A decoration that simply
 * appeared on the next render was the whole ladder paying out with no moment
 * attached to it.
 */
export function CareDecorLayer({
  decor,
  arriving,
  arrivalKey = 0,
}: {
  decor: CareDecor[];
  /** The piece earned by the level the house just reached, if that happened
   * in this session. Everything else is already standing. */
  arriving?: CareDecorKind | null;
  /** Rises per level-up so a second rise in one session plays again. */
  arrivalKey?: number;
}) {
  const reduce = useReducedMotion();
  if (decor.length === 0) return null;
  return (
    <div aria-hidden className="care-decor pointer-events-none absolute inset-0">
      {decor.map((item) => {
        const lands = !reduce && arrivalKey > 0 && item.kind === arriving;
        return (
          <div
            key={item.kind}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
          >
            {lands ? (
              <motion.span
                key={arrivalKey}
                className="relative block"
                initial={{ y: -24, scale: 0.8, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={SPRING_SETTLE}
              >
                <Decor kind={item.kind} />
                {/* The ground answering the landing. Same puff the chimney
                    uses, at a fraction of the size and once only. */}
                <motion.span
                  className="absolute left-1/2 top-full block size-3 -translate-x-1/2 rounded-full"
                  style={{ background: "rgba(235, 232, 226, 0.75)" }}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: [0, 0.7, 0], scale: [0.4, 1.6, 2.1] }}
                  transition={{ duration: DUR_BASE * 2, delay: 0.18, times: [0, 0.3, 1], ease: [[...EASE_OUT], "easeInOut"] }}
                />
              </motion.span>
            ) : (
              <Decor kind={item.kind} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DecorArt({ name, size }: { name: string; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/props/${name}.webp`} alt="" draggable={false} width={size} height={size} className="block max-w-none" />
  );
}

function Decor({ kind }: { kind: CareDecor["kind"] }) {
  switch (kind) {
    // Rendered in Blender from the same camera angle and sun as the house
    // (tools/blender/fx/props.py), so they stand on the lawn as part of the
    // same set. The squares carry transparent padding and their own contact
    // shadow; sizes are the square, not the object.
    case "planter":
      return <DecorArt name="planter" size={38} />;
    case "window-box":
      return <DecorArt name="window-box" size={44} />;
    case "bench":
      return <DecorArt name="bench" size={54} />;
    case "wreath":
      return <DecorArt name="wreath" size={26} />;
    case "bunting":
      return (
        <svg viewBox="0 0 48 10" className="h-2.5 w-12" fill="none">
          <path d="M1 2q23 6 46 0" stroke="rgba(0,0,0,0.3)" strokeWidth="0.8" fill="none" />
          {[0, 1, 2, 3, 4, 5, 6].map((index) => {
            const x = 3 + index * 7;
            const dip = Math.sin((index / 6) * Math.PI) * 2.2;
            const y = 2 + dip;
            const fill = ["#d98b9a", "#e8c06a", "#7fa8c9"][index % 3];
            return <path key={index} d={`M${x} ${y}l3 0l-1.5 4z`} fill={fill} />;
          })}
        </svg>
      );
  }
}
