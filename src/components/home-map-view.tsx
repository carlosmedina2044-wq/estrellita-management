"use client";

import { Package } from "lucide-react";
import { RoomTypeIcon } from "@/components/room-type-icon";
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import { nodeStatus, statusText, type NodeStatus } from "@/lib/node-status";
import type { HomeRoom, Household } from "@/lib/types";
import { cn } from "@/lib/utils";

export function HomeMapView({
  household,
  now,
  selectedId,
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
  const floors = floorsInOrder(household);
  const system = systemRoomList(household);
  const extraNullRooms = household.rooms.some((room) => room.floorId === null && !room.system);
  const hideFloorHeader = floors.length === 1 && !extraNullRooms;

  return (
    <div className="flex flex-col gap-5">
      {system.length > 0 ? (
        <section>
          <h2 className="ui-heading mb-2 text-[17px] font-semibold">Whole home</h2>
          <TileGrid
            rooms={system}
            household={household}
            now={now}
            selectedId={selectedId}
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
                <h2 className="ui-heading text-[17px] font-semibold">{floor.name}</h2>
                <StatusLine status={floorStatus} compact />
              </header>
            )}
            {rooms.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-6 text-center text-[15px] text-muted-foreground">
                No rooms on this floor yet.
              </p>
            ) : (
              <TileGrid
                rooms={rooms}
                household={household}
                now={now}
                selectedId={selectedId}
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

function roomCaption(status: NodeStatus) {
  if (status.overdue > 0) {
    return { text: `${status.overdue} overdue`, className: "text-destructive" };
  }
  if (status.dueSoon > 0) {
    return { text: `${status.dueSoon} due soon`, className: "text-warning" };
  }
  if (status.total > 0) {
    return { text: `${status.total} to do`, className: "text-muted-foreground" };
  }
  return { text: "All caught up", className: "text-muted-foreground" };
}

function TileGrid({
  rooms,
  household,
  now,
  selectedId,
  onSelectRoom,
  onReorder,
}: {
  rooms: HomeRoom[];
  household: Household;
  now: Date;
  selectedId?: string | null;
  onSelectRoom: (roomId: string) => void;
  onReorder?: (orderedIds: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rooms.map((room) => {
        const status = nodeStatus(household, room.id, "room", now);
        const caption = roomCaption(status);
        const overdue = status.overdue > 0;
        return (
          <button
            key={room.id}
            type="button"
            draggable={Boolean(onReorder)}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", room.id);
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => {
              if (!onReorder) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              if (!onReorder) return;
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
              overdue ? "border-destructive/30 bg-destructive/8" : "border-border bg-card",
              selectedId === room.id && "ring-2 ring-primary",
            )}
          >
            <span className="flex min-w-0 items-start gap-3">
              <RoomTypeIcon room={room} className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-[17px] font-medium leading-snug">{room.name}</span>
                <span className={cn("mt-0.5 block text-[13px]", caption.className)}>{caption.text}</span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {status.reorderPending > 0 ? (
                <Package className="size-4 text-warning" aria-label="Reorder pending" />
              ) : null}
              {status.total > 0 ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold text-foreground">
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
  compact,
}: {
  status: NodeStatus;
  compact?: boolean;
}) {
  const text = statusText(status);
  if (compact) {
    return <span className="text-[13px] text-muted-foreground">{text}</span>;
  }
  return <span className="text-[13px] text-muted-foreground">{text}</span>;
}
