"use client";

import { ChevronRight, Package } from "lucide-react";
import { tActive } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { RoomTypeIcon } from "@/components/room-type-icon";
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import { nodeStatus, type NodeStatus } from "@/lib/node-status";
import type { Completion, HomeRoom, Household } from "@/lib/types";
import { relativeDayLabel } from "@/lib/duties";
import { cn } from "@/lib/utils";

type RoomEntry = { room: HomeRoom; status: NodeStatus; nearReplacement: boolean; left: number };

/** Chores left in a room (see roomLeftDuties). Reorders and replacements are
 * noted under the name but never added to this count. */
function leftIn(status: NodeStatus): number {
  return status.total;
}

function roomHasExtras(entry: RoomEntry): boolean {
  return entry.status.reorderPending > 0 || entry.nearReplacement;
}

/**
 * Every room in one group, ordered by what is left: overdue first, then the
 * rooms with the most waiting, finished rooms last. Within a tie the home's own
 * order (whole home, then floor by floor) is kept.
 */
export function HomeMapView({
  household,
  now,
  selectedId,
  replacementRooms,
  onSelectRoom,
}: {
  household: Household;
  now: Date;
  selectedId?: string | null;
  replacementRooms?: Set<string>;
  onSelectRoom: (roomId: string) => void;
  /** Kept so callers need not change; the list is ordered by need, not by hand. */
  onReorder?: (floorId: string | null, orderedIds: string[]) => void;
}) {
  const { t } = useLocale();
  const seen = new Set<string>();
  const ordered: HomeRoom[] = [];
  const push = (room: HomeRoom) => {
    if (seen.has(room.id)) return;
    seen.add(room.id);
    ordered.push(room);
  };
  systemRoomList(household).forEach(push);
  floorsInOrder(household).forEach((floor) => roomsOnFloor(household, floor.id).forEach(push));
  household.rooms.filter((room) => !room.system).forEach(push);

  const entries: RoomEntry[] = ordered
    .map((room) => {
      const status = nodeStatus(household, room.id, "room", now);
      const nearReplacement = Boolean(replacementRooms?.has(room.id));
      return { room, status, nearReplacement, left: leftIn(status) };
    })
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const overdue = (b.entry.status.overdue > 0 ? 1 : 0) - (a.entry.status.overdue > 0 ? 1 : 0);
      if (overdue !== 0) return overdue;
      const left = b.entry.left + (roomHasExtras(b.entry) ? 0.5 : 0) - (a.entry.left + (roomHasExtras(a.entry) ? 0.5 : 0));
      return left !== 0 ? left : a.index - b.index;
    })
    .map(({ entry }) => entry);

  const done = entries.filter((entry) => entry.left === 0 && !roomHasExtras(entry)).length;

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
        <h2 className="ui-heading ui-card font-semibold">{t("map.rooms")}</h2>
        {entries.length > 0 ? (
          <p className="ui-caption num text-muted-foreground">
            {done === entries.length
              ? t("map.roomsEvery")
              : t("map.roomsAllDone", { done, total: entries.length })}
          </p>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <p className="rounded-[var(--r-container)] bg-card px-4 py-6 text-center ui-body text-muted-foreground">
          {t("map.noRoomsOnFloor")}
        </p>
      ) : (
        <div className="ui-group">
          {entries.map((entry) => (
            <RoomRow
              key={entry.room.id}
              entry={entry}
              selected={selectedId === entry.room.id}
              onSelect={() => onSelectRoom(entry.room.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** One line under a room's name, used by the room sheet's heading. */
export function roomCaption(
  status: NodeStatus,
  nearReplacement: boolean,
  left: number,
  lastDone: Completion | null,
  now: Date,
) {
  if (status.overdue > 0) {
    return { text: tActive("map.overdueCount", { count: status.overdue }), className: "text-overdue" };
  }
  if (left > 0) {
    return { text: tActive("map.leftCount", { count: left }), className: "text-muted-foreground" };
  }
  if (status.reorderPending > 0) {
    return { text: tActive("map.reorderCount", { count: status.reorderPending }), className: "text-muted-foreground" };
  }
  if (nearReplacement) {
    return { text: tActive("home.replacementSoon"), className: "text-muted-foreground" };
  }
  if (lastDone) {
    return {
      text: `${tActive("map.roomAllDone")} · ${tActive("map.lastDone", {
        when: relativeDayLabel(new Date(lastDone.completedAt), now),
      })}`,
      className: "text-done",
    };
  }
  return { text: tActive("map.roomAllDone"), className: "text-done" };
}

function RoomRow({
  entry,
  selected,
  onSelect,
}: {
  entry: RoomEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useLocale();
  const { room, status, nearReplacement, left } = entry;
  const finished = left === 0 && !roomHasExtras(entry);
  const late = status.overdue > 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "ui-group-row flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-left transition-colors active:bg-foreground/6",
        selected && "bg-foreground/5",
      )}
    >
      <RoomTypeIcon
        room={room}
        className={cn("size-6 shrink-0", finished ? "text-muted-foreground/50" : "text-muted-foreground")}
      />
      <span className="min-w-[7rem] flex-1 break-words">
        <span className={cn("block ui-body font-medium", finished && "text-muted-foreground")}>{room.system === "whole-home" ? t("map.wholeHome") : room.system === "exterior" ? t("content.room.exterior") : room.name}</span>
        {late ? (
          <span className="block ui-caption font-medium text-overdue">
            {t("map.overdueCount", { count: status.overdue })}
          </span>
        ) : status.reorderPending > 0 ? (
          <span className="flex items-center gap-1 ui-caption text-muted-foreground">
            <Package className="size-3.5" aria-hidden />
            {t("home.toReorderCount", { count: status.reorderPending })}
          </span>
        ) : nearReplacement ? (
          <span className="block ui-caption text-muted-foreground">{t("home.replacementSoon")}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "ml-auto text-right ui-caption num",
          finished ? "text-muted-foreground/70" : "font-semibold",
          late ? "text-overdue" : !finished && "text-foreground",
        )}
      >
        {finished ? t("map.roomAllDone") : left > 0 ? t("map.leftCount", { count: left }) : ""}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
    </button>
  );
}
