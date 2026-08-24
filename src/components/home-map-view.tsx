"use client";

import { Package } from "lucide-react";
import { RoomTypeIcon } from "@/components/room-type-icon";
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import { homeSummary, nodeStatus, statusTone, type NodeStatus } from "@/lib/node-status";
import type { HomeRoom, Household } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE: Record<ReturnType<typeof statusTone>, string> = {
  green: "border-[#34c759]/50 bg-[#34c759]/8",
  amber: "border-[#ff9f0a]/50 bg-[#ff9f0a]/10",
  red: "border-destructive/50 bg-destructive/8",
};

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
  const summary = homeSummary(household, now);
  const floors = floorsInOrder(household);
  const system = systemRoomList(household);

  return (
    <div className="flex flex-col gap-5">
      <StatusLine status={summary} label="Whole house" />
      {system.length > 0 ? (
        <section>
          <h2 className="ui-heading mb-2 text-[17px] font-semibold">Whole Home & Exterior</h2>
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
            <header className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="ui-heading text-[17px] font-semibold">{floor.name}</h2>
              <StatusLine status={floorStatus} compact />
            </header>
            {rooms.length === 0 ? (
              <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-muted-foreground">
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
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {rooms.map((room) => {
        const status = nodeStatus(household, room.id, "room", now);
        const tone = statusTone(status);
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
              TONE[tone],
              selectedId === room.id && "ring-2 ring-primary",
            )}
          >
            <span className="flex min-w-0 items-start gap-3">
              <RoomTypeIcon room={room} className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-[17px] font-medium leading-snug">{room.name}</span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                  {status.total === 0
                    ? room.system
                      ? "Always here"
                      : "No outstanding tasks"
                    : `${status.total} outstanding`}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {replacementRooms?.has(room.id) ? (
                <span className="text-[13px] font-semibold text-[#ff9f0a]" aria-label="Replacement in next 6 months">
                  $
                </span>
              ) : null}
              {status.reorderPending > 0 ? (
                <Package className="size-4 text-[#ff9f0a]" aria-label="Reorder pending" />
              ) : null}
              {status.total > 0 ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-white text-[12px] font-semibold">
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
  label,
  compact,
}: {
  status: NodeStatus;
  label?: string;
  compact?: boolean;
}) {
  const tone = statusTone(status);
  const text =
    status.total === 0 && status.reorderPending === 0
      ? "All clear"
      : `${status.overdue ? `${status.overdue} overdue` : ""}${
          status.overdue && status.dueSoon ? " · " : ""
        }${status.dueSoon ? `${status.dueSoon} due soon` : ""}${
          status.reorderPending ? ` · ${status.reorderPending} to reorder` : ""
        }`.replace(/^[ ·]+/, "");
  if (compact) {
    return <span className="text-[13px] text-muted-foreground">{text}</span>;
  }
  return (
    <div className={cn("rounded-2xl border px-4 py-3", TONE[tone])}>
      {label ? <p className="text-[13px] font-medium text-muted-foreground">{label}</p> : null}
      <p className="ui-heading text-[22px] font-semibold">{text}</p>
    </div>
  );
}
