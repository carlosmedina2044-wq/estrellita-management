"use client";

import { ChevronRight, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { tActive } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { RoomTypeIcon } from "@/components/room-type-icon";
import { lastDoneInRoom, relativeDayLabel } from "@/lib/duties";
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import { nodeStatus, statusText, type NodeStatus } from "@/lib/node-status";
import type { Completion, HomeRoom, Household } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HomeMapView({
  household,
  now,
  selectedId,
  replacementRooms,
  onSelectRoom,
  onReorder,
}: {
  household: Household;
  now: Date;
  selectedId?: string | null;
  replacementRooms?: Set<string>;
  onSelectRoom: (roomId: string) => void;
  onReorder?: (floorId: string | null, orderedIds: string[]) => void;
}) {
  const { t } = useLocale();
  const floors = floorsInOrder(household);
  const system = systemRoomList(household);
  const extraNullRooms = household.rooms.some((room) => room.floorId === null && !room.system);
  const hideFloorHeader = floors.length === 1 && !extraNullRooms;

  return (
    <div className="flex flex-col gap-5">
      {system.length > 0 ? (
        <section>
          <h2 className="ui-heading mb-2 ui-card font-semibold">{t("map.wholeHome")}</h2>
          <TileGrid
            rooms={system}
            household={household}
            now={now}
            selectedId={selectedId}
            replacementRooms={replacementRooms}
            onSelectRoom={onSelectRoom}
            onReorder={onReorder ? (ids) => onReorder(null, ids) : undefined}
          />
        </section>
      ) : null}
      {floors.map((floor) => {
        const rooms = roomsOnFloor(household, floor.id);
        const floorStatus = nodeStatus(household, floor.id, "floor", now);
        return (
          <section key={floor.id}>
            {hideFloorHeader ? null : (
              <header className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="ui-heading ui-card font-semibold">{floor.name}</h2>
                <StatusLine status={floorStatus} />
              </header>
            )}
            {rooms.length === 0 ? (
              <p className="rounded-[var(--r-container)] bg-card px-4 py-6 text-center ui-body text-muted-foreground">
                {t("map.noRoomsOnFloor")}
              </p>
            ) : (
              <TileGrid
                rooms={rooms}
                household={household}
                now={now}
                selectedId={selectedId}
                replacementRooms={replacementRooms}
                onSelectRoom={onSelectRoom}
                onReorder={onReorder ? (ids) => onReorder(floor.id, ids) : undefined}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

export function roomCaption(
  status: NodeStatus,
  nearReplacement: boolean,
  lastDone: Completion | null,
  now: Date,
) {
  if (status.overdue > 0) {
    return { text: tActive("map.overdueCount", { count: status.overdue }), className: "text-overdue" };
  }
  if (status.dueSoon > 0) {
    return { text: tActive("map.dueSoonCount", { count: status.dueSoon }), className: "text-soon" };
  }
  if (status.reorderPending > 0) {
    return { text: tActive("map.reorderCount", { count: status.reorderPending }), className: "text-soon" };
  }
  if (nearReplacement) {
    return { text: tActive("home.replacementSoon"), className: "text-soon" };
  }
  if (status.total > 0) {
    return { text: tActive("map.toDoCount", { count: status.total }), className: "text-muted-foreground" };
  }
  if (lastDone) {
    return {
      text: tActive("map.lastDone", { when: relativeDayLabel(new Date(lastDone.completedAt), now) }),
      className: "text-done",
    };
  }
  return { text: tActive("home.allCaughtUp"), className: "text-muted-foreground" };
}

function TileGrid({
  rooms,
  household,
  now,
  selectedId,
  replacementRooms,
  onSelectRoom,
  onReorder,
}: {
  rooms: HomeRoom[];
  household: Household;
  now: Date;
  selectedId?: string | null;
  replacementRooms?: Set<string>;
  onSelectRoom: (roomId: string) => void;
  onReorder?: (orderedIds: string[]) => void;
}) {
  const [finePointer, setFinePointer] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(pointer: fine)");
    const sync = () => setFinePointer(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const canDrag = Boolean(onReorder) && finePointer;

  // Rooms that need something come first, so the list opens on what to act on
  // and the "all caught up" rooms trail behind. Stable, so each group keeps its
  // own order. Skipped where rooms can be dragged, since the order is then the
  // person's own.
  const needsAttention = (room: HomeRoom) => {
    const status = nodeStatus(household, room.id, "room", now);
    return status.overdue + status.dueSoon + status.reorderPending > 0 || Boolean(replacementRooms?.has(room.id));
  };
  const shown = canDrag
    ? rooms
    : [...rooms.filter(needsAttention), ...rooms.filter((room) => !needsAttention(room))];

  return (
    <div className="ui-group">
      {shown.map((room) => {
        const status = nodeStatus(household, room.id, "room", now);
        const nearReplacement = Boolean(replacementRooms?.has(room.id));
        const caption = roomCaption(status, nearReplacement, lastDoneInRoom(household, room.id), now);
        return (
          <button
            key={room.id}
            type="button"
            draggable={canDrag}
            onDragStart={(event) => {
              if (!canDrag) return;
              event.dataTransfer.setData("text/plain", room.id);
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => {
              if (!canDrag) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              if (!canDrag || !onReorder) return;
              event.preventDefault();
              const from = event.dataTransfer.getData("text/plain");
              if (!from || from === room.id) return;
              const ids = rooms.map((item) => item.id);
              const fromIndex = ids.indexOf(from);
              const toIndex = ids.indexOf(room.id);
              if (fromIndex < 0 || toIndex < 0) return;
              ids.splice(fromIndex, 1);
              ids.splice(toIndex, 0, from);
              onReorder(ids);
            }}
            onClick={() => onSelectRoom(room.id)}
            className={cn(
              "ui-group-row flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-left transition-colors active:bg-foreground/6",
              selectedId === room.id && "bg-primary/5",
            )}
          >
            <RoomTypeIcon room={room} className="size-6 shrink-0 text-muted-foreground" />
            <span className="min-w-[7rem] flex-1 break-words ui-body font-medium">
              {room.name}
              {status.reorderPending > 0 ? (
                <span className="mt-0.5 flex items-center gap-1 ui-caption font-normal text-muted-foreground">
                  <Package className="size-3.5" aria-hidden />
                  {tActive("home.toReorderCount", { count: status.reorderPending })}
                </span>
              ) : null}
            </span>
            <span className={cn("ml-auto flex items-center gap-1.5 text-right ui-caption font-medium num", caption.className)}>
              {caption.text}
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function StatusLine({
  status,
}: {
  status: NodeStatus;
}) {
  const text = statusText(status);
  return <span className="ui-caption text-muted-foreground">{text}</span>;
}
