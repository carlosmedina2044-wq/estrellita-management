"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DutyForm } from "@/components/duty-form";
import { DutyRow } from "@/components/duty-row";
import { Input } from "@/components/ui/input";
import { floorsInOrder, roomsOnFloor, userRooms } from "@/lib/home-model";
import { useSheetOpenGuard } from "@/lib/sheet-guard";
import {
  isDoneThisPeriod,
  isOverdueFor,
  installedAtFor,
  sortDuties,
} from "@/lib/duties";
import type { Duty, DutyDraft, Household, Room } from "@/lib/types";
import { toast } from "sonner";

export function DutiesView({
  household,
  onComplete,
  onUndo,
  onSaveDuty,
  onDeleteDuty,
}: {
  household: Household;
  onComplete: (dutyId: string) => void;
  onUndo: (dutyId: string) => void;
  onSaveDuty: (duty: DutyDraft) => void;
  onDeleteDuty: (id: string) => void;
}) {
  const now = useMemo(() => new Date(), [household.completions, household.duties]);
  const [query, setQuery] = useState("");
  const [floor, setFloor] = useState<string | "all">("all");
  const [room, setRoom] = useState<Room | "all">("all");
  const [editing, setEditing] = useState<Duty | null>(null);
  const [creating, setCreating] = useState(false);
  const createGuard = useSheetOpenGuard();

  const duties = sortDuties(
    household.duties.filter((duty) => {
      if (duty.archived) return false;
      if (floor !== "all") {
        const def = household.rooms.find((item) => item.id === duty.room);
        if (!def) return false;
        if (def.floorId !== floor) return false;
      }
      if (room !== "all" && duty.room !== room) return false;
      if (query.trim() && !duty.title.toLowerCase().includes(query.trim().toLowerCase())) {
        return false;
      }
      return true;
    }),
    household,
  );

  const roomOptions = floor === "all" ? userRooms(household) : roomsOnFloor(household, floor);

  const grouped = household.rooms
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      ...item,
      label: item.name,
      duties: duties.filter((duty) => duty.room === item.id),
    }))
    .filter((group) => group.duties.length > 0);

  function toggle(duty: Duty) {
    const done = isDoneThisPeriod(
      duty,
      household.completions,
      now,
      installedAtFor(household, duty.id),
    );
    if (done) {
      onUndo(duty.id);
      toast("Marked as not done");
      return;
    }
    onComplete(duty.id);
    toast.success("Done", { description: duty.title });
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-sm text-muted-foreground">{household.householdName}</p>
        <h1 className="ui-heading text-[34px] font-semibold tracking-tight">Duties</h1>
      </header>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search duties"
        className="h-12"
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <RoomChip
          active={floor === "all"}
          onClick={() => {
            setFloor("all");
            setRoom("all");
          }}
        >
          All floors
        </RoomChip>
        {floorsInOrder(household).map((item) => (
          <RoomChip
            key={item.id}
            active={floor === item.id}
            onClick={() => {
              setFloor(item.id);
              setRoom("all");
            }}
          >
            {item.name}
          </RoomChip>
        ))}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <RoomChip active={room === "all"} onClick={() => setRoom("all")}>
          All rooms
        </RoomChip>
        {roomOptions.map((item) => (
          <RoomChip key={item.id} active={room === item.id} onClick={() => setRoom(item.id)}>
            {item.name}
          </RoomChip>
        ))}
      </div>

      {duties.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border px-5 py-10 text-center">
          <p className="font-heading text-xl">No duties yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the plus button to add the first household chore.
          </p>
          <button
            type="button"
            className="mt-4 text-sm font-medium text-primary"
            onClick={() => createGuard.tryOpen(() => setCreating(true))}
          >
            Add a duty
          </button>
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.id}>
            <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
              {group.label}
            </h2>
            <div className="ui-group">
              {group.duties.map((duty) => (
                <div key={duty.id} className="ui-group-row">
                  <DutyRow
                    duty={duty}
                    household={household}
                    now={now}
                    done={isDoneThisPeriod(
                      duty,
                      household.completions,
                      now,
                      installedAtFor(household, duty.id),
                    )}
                    overdue={isOverdueFor(duty, household, now)}
                    onToggle={() => toggle(duty)}
                    onOpen={() => setEditing(duty)}
                  />
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <DutyForm
        open={creating || Boolean(editing)}
        duty={editing}
        household={household}
        supplyAutomation={
          editing ? household.supplyAutomations.find((item) => item.dutyId === editing.id) : null
        }
        onOpenChange={(open) => {
          if (!open) {
            createGuard.markClosed();
            setCreating(false);
            setEditing(null);
          }
        }}
        onSave={onSaveDuty}
        onDelete={onDeleteDuty}
      />
    </div>
  );
}

function RoomChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "h-9 shrink-0 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground"
          : "h-9 shrink-0 rounded-full bg-secondary px-3.5 text-sm font-medium text-secondary-foreground"
      }
    >
      {children}
    </button>
  );
}
