"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { defaultRoomName, ROOM_TYPES, systemRooms, type HomeTreeDraft } from "@/lib/home-model";
import { draftFromTemplate, HOME_TEMPLATES, type HomeTemplateId } from "@/lib/home-templates";
import type { HomeFloor, HomeRoom, RoomType } from "@/lib/types";

type Path = "guided" | "template";

export function HomeWizard({
  homeName,
  initial,
  onDone,
  onBack,
}: {
  homeName: string;
  initial?: HomeTreeDraft | null;
  onDone: (draft: HomeTreeDraft) => void;
  onBack: () => void;
}) {
  const [path, setPath] = useState<Path | null>(initial ? "guided" : null);
  const [draft, setDraft] = useState<HomeTreeDraft>(
    () => initial ?? { homeName, floors: [{ id: "main", name: "Main", sortOrder: 0 }], rooms: systemRooms() },
  );
  const [floorCount, setFloorCount] = useState(Math.max(1, draft.floors.length));
  const [activeFloor, setActiveFloor] = useState(0);

  const userRooms = draft.rooms.filter((room) => !room.system);
  const floors = useMemo(
    () =>
      Array.from({ length: floorCount }, (_, index) => {
        const existing = draft.floors[index];
        return {
          id: existing?.id ?? `floor-${index}`,
          name: existing?.name ?? (index === 0 ? "Main" : index === 1 ? "Upstairs" : `Floor ${index + 1}`),
          sortOrder: index,
        } satisfies HomeFloor;
      }),
    [draft.floors, floorCount],
  );

  function commitFloors(nextCount: number, names?: string[]) {
    const nextFloors = Array.from({ length: nextCount }, (_, index) => ({
      id: draft.floors[index]?.id ?? `floor-${index}`,
      name: names?.[index] ?? draft.floors[index]?.name ?? (index === 0 ? "Main" : `Floor ${index + 1}`),
      sortOrder: index,
    }));
    const kept = new Set(nextFloors.map((floor) => floor.id));
    setFloorCount(nextCount);
    setDraft((current) => ({
      ...current,
      floors: nextFloors,
      rooms: current.rooms.filter((room) => room.system || (room.floorId && kept.has(room.floorId))),
    }));
  }

  function toggleType(floorId: string, type: RoomType) {
    setDraft((current) => {
      const existing = current.rooms.find((room) => room.floorId === floorId && room.type === type && !room.system);
      if (existing) {
        return { ...current, rooms: current.rooms.filter((room) => room.id !== existing.id) };
      }
      const room: HomeRoom = {
        id: crypto.randomUUID(),
        floorId,
        name: defaultRoomName(type, current.rooms),
        type,
        sortOrder: current.rooms.length,
      };
      return { ...current, rooms: [...current.rooms, room] };
    });
  }

  function addAnother(floorId: string, type: RoomType) {
    setDraft((current) => ({
      ...current,
      rooms: [
        ...current.rooms,
        {
          id: crypto.randomUUID(),
          floorId,
          name: defaultRoomName(type, current.rooms),
          type,
          sortOrder: current.rooms.length,
        },
      ],
    }));
  }

  if (!path) {
    return (
      <div className="flex flex-1 flex-col pt-8">
        <h1 className="ui-heading text-3xl font-semibold tracking-tight">Your home’s rooms</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Two minutes. Toggle rooms by hand — no document upload.
        </p>
        <div className="mt-6 grid gap-2">
          <Button className="h-12" onClick={() => setPath("guided")}>
            Guided setup
          </Button>
          <Button variant="secondary" className="h-12" onClick={() => setPath("template")}>
            Start from a template
          </Button>
        </div>
        <Button variant="secondary" className="mt-auto h-12" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  if (path === "template") {
    return (
      <div className="flex flex-1 flex-col pt-8">
        <h1 className="ui-heading text-3xl font-semibold tracking-tight">Pick a starting layout</h1>
        <div className="mt-5 grid gap-2">
          {HOME_TEMPLATES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="rounded-2xl bg-white px-4 py-3 text-left"
              onClick={() => {
                const next = draftFromTemplate(item, homeName);
                setDraft(next);
                setFloorCount(next.floors.length);
                setPath("guided");
                setActiveFloor(next.floors.length);
              }}
            >
              <span className="block font-medium">{item.name}</span>
              <span className="text-sm text-muted-foreground">{item.hint}</span>
            </button>
          ))}
        </div>
        <Button variant="secondary" className="mt-auto h-12" onClick={() => setPath(null)}>
          Back
        </Button>
      </div>
    );
  }

  const review = activeFloor >= floors.length;

  if (review) {
    return (
      <div className="flex flex-1 flex-col pt-8">
        <h1 className="ui-heading text-3xl font-semibold tracking-tight">Looks right?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Whole Home and Exterior are always on the map. You can edit rooms later in Settings.
        </p>
        <div className="mt-5 grid gap-3">
          {floors.map((floor) => (
            <div key={floor.id} className="rounded-2xl bg-white px-4 py-3">
              <p className="font-medium">{floor.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {userRooms
                  .filter((room) => room.floorId === floor.id)
                  .map((room) => room.name)
                  .join(" · ") || "No rooms yet"}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-auto flex gap-3 pt-8">
          <Button variant="secondary" className="h-12 flex-1" onClick={() => setActiveFloor(Math.max(0, floors.length - 1))}>
            Back
          </Button>
          <Button
            className="h-12 flex-1"
            onClick={() => onDone({ homeName, floors, rooms: draft.rooms })}
          >
            Use this home
          </Button>
        </div>
      </div>
    );
  }

  const floor = floors[activeFloor];
  const selectedTypes = new Set(
    userRooms.filter((room) => room.floorId === floor.id).map((room) => room.type),
  );

  return (
    <div className="flex flex-1 flex-col pt-8">
      {activeFloor === 0 ? (
        <>
          <h1 className="ui-heading text-3xl font-semibold tracking-tight">Floors</h1>
          <p className="mt-2 text-sm text-muted-foreground">How many levels, and what you call them.</p>
          <Input
            type="number"
            min={1}
            max={6}
            value={floorCount}
            onChange={(event) => commitFloors(Math.min(6, Math.max(1, Number(event.target.value) || 1)))}
            className="mt-5 h-12"
          />
          <div className="mt-3 grid gap-2">
            {floors.map((item, index) => (
              <Input
                key={item.id}
                value={item.name}
                onChange={(event) => {
                  const names = floors.map((floorItem) => floorItem.name);
                  names[index] = event.target.value;
                  commitFloors(floorCount, names);
                }}
                className="h-12"
              />
            ))}
          </div>
        </>
      ) : null}

      <h2 className="ui-heading mt-6 text-[22px] font-semibold">{floor.name} rooms</h2>
      <p className="mt-1 text-sm text-muted-foreground">Check what’s on this floor. Add another for duplicates.</p>
      <div className="mt-4 grid gap-2">
        {ROOM_TYPES.map((item) => {
          const count = userRooms.filter((room) => room.floorId === floor.id && room.type === item.id).length;
          return (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2">
              <Checkbox
                checked={selectedTypes.has(item.id)}
                onCheckedChange={() => toggleType(floor.id, item.id)}
              />
              <span className="flex-1 text-sm font-medium">
                {item.label}
                {count > 1 ? ` · ${count}` : ""}
              </span>
              <button
                type="button"
                className="text-[13px] font-medium text-primary"
                onClick={() => addAnother(floor.id, item.id)}
              >
                + add another
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-auto flex gap-3 pt-8">
        <Button
          variant="secondary"
          className="h-12 flex-1"
          onClick={() => {
            if (activeFloor === 0) setPath(null);
            else setActiveFloor((current) => current - 1);
          }}
        >
          Back
        </Button>
        <Button className="h-12 flex-1" onClick={() => setActiveFloor((current) => current + 1)}>
          {activeFloor === floors.length - 1 ? "Review" : "Next floor"}
        </Button>
      </div>
    </div>
  );
}

export type { HomeTemplateId };
