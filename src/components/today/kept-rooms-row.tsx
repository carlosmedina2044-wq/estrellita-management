"use client";

import { motion } from "motion/react";
import { RoomTypeIcon } from "@/components/room-type-icon";
import { useLocale } from "@/i18n/locale-provider";
import { keptRooms, wholeHouseKept, type KeptRoom } from "@/lib/kept-rooms";
import type { Household } from "@/lib/types";
import { cn } from "@/lib/utils";

function RoomGlyph({ entry }: { entry: KeptRoom }) {
  const { t } = useLocale();
  const label =
    entry.state === "fresh"
      ? t("today.roomFresh")
      : entry.state === "due"
        ? t("today.roomDue")
        : t("today.roomWaiting");
  return (
    <motion.span
      initial={entry.state === "fresh" ? { scale: 1 } : false}
      animate={entry.state === "fresh" ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.3 }}
      title={label}
      className={cn(
        "flex size-7 items-center justify-center rounded-full",
        entry.state === "fresh" && "bg-done-soft text-done",
        entry.state === "due" && "bg-soon-soft text-soon",
        entry.state === "waiting" && "bg-secondary text-muted-foreground/60",
      )}
    >
      <RoomTypeIcon room={entry.room} className="size-4" />
    </motion.span>
  );
}

export function KeptRoomsRow({ household, now }: { household: Household; now: Date }) {
  const { t } = useLocale();
  const rooms = keptRooms(household, now);
  if (rooms.length === 0) return null;
  const visible = rooms.slice(0, 8);
  const extra = rooms.length - visible.length;
  const fresh = rooms.filter((room) => room.state === "fresh").length;
  const whole = wholeHouseKept(rooms, household, now);
  return (
    <div className="flex flex-col gap-1">
      {whole ? <p className="ui-caption text-done">{t("today.wholeHouseKept")}</p> : null}
      <div
        className="flex items-center gap-1.5"
        aria-label={t("today.roomsKeptAria", { fresh, total: rooms.length })}
      >
        {visible.map((entry) => (
          <RoomGlyph key={entry.room.id} entry={entry} />
        ))}
        {extra > 0 ? (
          <span className="ui-caption rounded-full bg-secondary px-2 py-1 text-muted-foreground">
            +{extra}
          </span>
        ) : null}
      </div>
    </div>
  );
}
