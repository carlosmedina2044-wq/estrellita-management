"use client";

import { AlertCircle, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { tActive } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { RoomTypeIcon } from "@/components/room-type-icon";
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import { nodeStatus, statusText, type NodeStatus } from "@/lib/node-status";
import type { HomeRoom, Household } from "@/lib/types";
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
                <StatusLine status={floorStatus} compact />
              </header>
            )}
            {rooms.length === 0 ? (
              <p className="rounded-2xl bg-card px-4 py-6 text-center ui-body text-muted-foreground">
                No rooms on this floor yet.
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

function roomCaption(status: NodeStatus, nearReplacement: boolean) {
  if (status.overdue > 0) {
    return { text: `${status.overdue} overdue`, className: "text-destructive" };
  }
  if (status.dueSoon > 0) {
    return { text: `${status.dueSoon} due soon`, className: "text-warning" };
  }
  if (status.reorderPending > 0) {
    return { text: `${status.reorderPending} to reorder`, className: "text-warning" };
  }
  if (nearReplacement) {
    return { text: tActive("home.replacementSoon"), className: "text-warning" };
  }
  if (status.total > 0) {
    return { text: `${status.total} to do`, className: "text-muted-foreground" };
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

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {rooms.map((room) => {
        const status = nodeStatus(household, room.id, "room", now);
        const nearReplacement = Boolean(replacementRooms?.has(room.id));
        const caption = roomCaption(status, nearReplacement);
        const overdue = status.overdue > 0;
        const dueSoon = !overdue && (status.dueSoon > 0 || nearReplacement);
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
              "flex min-h-20 items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left",
              overdue
                ? "border-border border-l-[3px] border-l-destructive bg-card"
                : dueSoon
                  ? "border-border border-l-[3px] border-l-warning bg-card"
                  : "border-border bg-card",
              selectedId === room.id && "ring-2 ring-primary",
            )}
          >
            <span className="flex min-w-0 items-start gap-3">
              <RoomTypeIcon room={room} className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block ui-card font-medium leading-snug">{room.name}</span>
                <span className={cn("mt-0.5 flex items-center gap-1 ui-caption", caption.className)}>
                  {overdue || dueSoon ? <AlertCircle className="size-3.5 shrink-0" aria-hidden /> : null}
                  {caption.text}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {status.reorderPending > 0 ? (
                <Package className="size-4 text-warning" aria-hidden />
              ) : null}
              {status.total > 0 ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-secondary ui-caption font-semibold text-foreground">
                  {status.total}
                </span>
              ) : null}
            </span>
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
  compact?: boolean;
}) {
  const text = statusText(status);
  return <span className="ui-caption text-muted-foreground">{text}</span>;
}
