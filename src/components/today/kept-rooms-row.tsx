"use client";

import { motion } from "motion/react";
import { Illustration } from "@/components/illustration";
import { useLocale } from "@/i18n/locale-provider";
import {
  keptRooms,
  roomTileFor,
  wholeHouseKept,
  type KeptRoom,
} from "@/lib/kept-rooms";
import type { Household } from "@/lib/types";
import { cn } from "@/lib/utils";

function RoomTile({ entry }: { entry: KeptRoom }) {
  const { t } = useLocale();
  const label =
    entry.state === "fresh"
      ? t("today.roomFresh")
      : entry.state === "due"
        ? t("today.roomDue")
        : t("today.roomWaiting");
  return (
    <motion.span
      key={`${entry.room.id}-${entry.state}`}
      initial={entry.state === "fresh" ? { scale: 1 } : false}
      animate={entry.state === "fresh" ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
      title={label}
      className={cn(
        "flex size-11 items-center justify-center rounded-xl bg-secondary",
        entry.state === "waiting" && "opacity-45 grayscale",
        entry.state === "due" && "ring-2 ring-soon/60",
        entry.state === "fresh" && "ring-2 ring-done/70",
      )}
    >
      <Illustration name={roomTileFor(entry.room)} size={40} />
    </motion.span>
  );
}

export function KeptRoomsRow({ household, now }: { household: Household; now: Date }) {
  const { t } = useLocale();
  const rooms = keptRooms(household, now);
  if (rooms.length === 0) return null;
  const visible = rooms.slice(0, 6);
  const extra = rooms.length - visible.length;
  const fresh = rooms.filter((room) => room.state === "fresh").length;
  const whole = wholeHouseKept(rooms, household, now);
  const row = (
    <div
      className="flex items-center gap-2"
      aria-label={t("today.roomsKeptAria", { fresh, total: rooms.length })}
    >
      {visible.map((entry) => (
        <RoomTile key={entry.room.id} entry={entry} />
      ))}
      {extra > 0 ? (
        <span className="ui-caption rounded-full bg-secondary px-2 py-1 text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </div>
  );
  if (!whole) return row;
  return (
    <div className="inline-flex flex-col gap-1 rounded-2xl bg-done-soft px-2 py-2">
      <p className="px-1 ui-caption font-medium text-done">{t("today.wholeHouseKept")}</p>
      {row}
    </div>
  );
}
