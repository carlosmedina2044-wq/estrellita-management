"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Illustration } from "@/components/illustration";
import { CUTAWAY_ROOMS } from "@/lib/illustrations";
import type { KeptRoom } from "@/lib/kept-rooms";
import { DUR_BASE, EASE_OUT } from "@/lib/motion";
import type { RoomType } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROOM_ORDER = ["bedroom", "bath", "laundry", "living", "kitchen"] as const;
type CutawayKey = (typeof ROOM_ORDER)[number];

const TYPE_TO_CUTAWAY: Partial<Record<RoomType, CutawayKey>> = {
  primary_bedroom: "bedroom",
  bedroom: "bedroom",
  bathroom: "bath",
  laundry: "laundry",
  living: "living",
  dining: "living",
  kitchen: "kitchen",
};

export function keptCutawayKeys(rooms: KeptRoom[]): Set<CutawayKey> {
  const kept = new Set<CutawayKey>();
  for (const entry of rooms) {
    if (entry.state !== "fresh") continue;
    const key = TYPE_TO_CUTAWAY[entry.room.type];
    if (key) kept.add(key);
  }
  return kept;
}

export function WholeHouseCard({
  rooms,
  className,
  children,
}: {
  rooms: KeptRoom[];
  className?: string;
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const kept = keptCutawayKeys(rooms);

  return (
    <div className={cn("rounded-2xl bg-card px-4 py-3", className)}>
      <div className="relative overflow-hidden rounded-2xl bg-[var(--brand-cream)]">
        <Illustration
          name="house-cutaway"
          size={720}
          className="h-auto max-w-full"
        />
        {ROOM_ORDER.map((room, index) => {
          const lifted = kept.has(room);
          return (
            <motion.div
              key={room}
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: "var(--brand-cream)",
                clipPath: CUTAWAY_ROOMS[room],
              }}
              initial={false}
              animate={{ opacity: lifted ? 0 : 0.55 }}
              transition={{
                duration: reduceMotion ? 0 : DUR_BASE,
                delay: reduceMotion || !lifted ? 0 : index * 0.08,
                ease: EASE_OUT,
              }}
            />
          );
        })}
      </div>
      {children}
    </div>
  );
}
