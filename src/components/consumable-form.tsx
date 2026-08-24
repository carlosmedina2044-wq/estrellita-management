"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { RestockOrderButton } from "@/components/restock-order-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FLOORS, HOUSE_ROOMS } from "@/lib/house";
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import { DEFAULT_LEAD_TIME_DAYS } from "@/lib/supply";
import type { Duty, DutyDraft, Household, Room, SupplyAutomation } from "@/lib/types";

type Draft = {
  itemName: string;
  room: Room;
  leadTimeDays: string;
  onHand: string;
};

function emptyDraft(room: Room = "living-room"): Draft {
  return {
    itemName: "",
    room,
    leadTimeDays: String(DEFAULT_LEAD_TIME_DAYS),
    onHand: "0",
  };
}

export function ConsumableForm({
  open,
  duty,
  automation,
  household,
  defaultRoom = "living-room",
  onOpenChange,
  onSave,
  onDelete,
  onMarkOrdered,
  onMarkReceived,
  onSaveLink,
}: {
  open: boolean;
  duty: Duty | null;
  automation: SupplyAutomation | null;
  household?: Household;
  defaultRoom?: Room;
  onOpenChange: (open: boolean) => void;
  onSave: (input: DutyDraft) => void;
  onDelete?: (id: string) => void;
  onMarkOrdered?: (id: string) => void;
  onMarkReceived?: (id: string, qty: number) => void;
  onSaveLink?: (id: string, url: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft(defaultRoom));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (automation) {
      setDraft({
        itemName: automation.itemName,
        room: automation.room || duty?.room || defaultRoom,
        leadTimeDays: String(automation.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS),
        onHand: String(automation.onHand ?? 0),
      });
      return;
    }
    setDraft(emptyDraft(defaultRoom));
  }, [open, duty, automation, defaultRoom]);

  function closeAfterClick() {
    window.setTimeout(() => onOpenChange(false), 250);
  }

  function submit() {
    const itemName = draft.itemName.trim();
    if (!itemName) {
      setFormError("Name the item to order.");
      toast.error("Name the item to order.");
      return;
    }
    setFormError(null);
    onSave({
      id: duty?.id,
      title: duty?.title || itemName,
      notes: duty?.notes ?? "",
      room: draft.room,
      nodeId: draft.room,
      nodeType: "room",
      audience: duty?.audience ?? "me",
      effort: duty?.effort ?? "medium",
      frequency: duty?.frequency ?? "quarterly",
      kind: "replacement",
      weekday: duty?.weekday ?? 6,
      monthDay: duty?.monthDay ?? 1,
      dueDate: duty?.dueDate ?? null,
      priority: duty?.priority ?? "medium",
      supplyAutomation: {
        id: automation?.id,
        itemName,
        leadTimeDays: Math.min(90, Math.max(0, Number(draft.leadTimeDays) || DEFAULT_LEAD_TIME_DAYS)),
        onHand: Math.max(0, Number(draft.onHand) || 0),
        retailerUrl: automation?.retailerUrl,
        linkedDutyIds: automation?.linkedDutyIds,
      },
    });
    closeAfterClick();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        size="form"
        className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle>{automation ? "Edit consumable" : "New consumable"}</SheetTitle>
        </SheetHeader>
        <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
          <Field label="Item">
            <Input
              value={draft.itemName}
              onChange={(event) => setDraft((current) => ({ ...current, itemName: event.target.value }))}
              placeholder="HVAC filter 16x25x1"
              className="h-12"
              autoFocus={!automation}
            />
          </Field>
          <Field label="Where it’s used">
            <Select
              value={draft.room}
              onValueChange={(value) => setDraft((current) => ({ ...current, room: value as Room }))}
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {household ? (
                  <>
                    {systemRoomList(household).map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
                    ))}
                    {floorsInOrder(household).map((floor) => (
                      <SelectGroup key={floor.id}>
                        <SelectLabel>{floor.name}</SelectLabel>
                        {roomsOnFloor(household, floor.id).map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </>
                ) : (
                  FLOORS.map((floor) => (
                    <SelectGroup key={floor.id}>
                      <SelectLabel>{floor.label}</SelectLabel>
                      {HOUSE_ROOMS.filter((room) => room.floor === floor.id).map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lead time (days)">
              <Input
                type="number"
                min={0}
                value={draft.leadTimeDays}
                onChange={(event) => setDraft((current) => ({ ...current, leadTimeDays: event.target.value }))}
                className="h-12"
              />
            </Field>
            <Field label="On hand">
              <Input
                type="number"
                min={0}
                value={draft.onHand}
                onChange={(event) => setDraft((current) => ({ ...current, onHand: event.target.value }))}
                className="h-12"
              />
            </Field>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Save a product link later with Share, or tap Save this link after you find it.
          </p>
          {automation && household ? (
            <RestockOrderButton
              item={automation}
              household={household}
              onOrdered={onMarkOrdered ? () => onMarkOrdered(automation.id) : undefined}
              onReceived={onMarkReceived ? (qty) => onMarkReceived(automation.id, qty) : undefined}
              onSaveLink={onSaveLink ? (url) => onSaveLink(automation.id, url) : undefined}
            />
          ) : null}
          {formError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          ) : null}
        </div>
        <SheetFooter className="shrink-0 gap-3">
          {duty && onDelete ? (
            <Button
              type="button"
              variant="destructive"
              className="h-12"
              onClick={() => {
                onDelete(duty.id);
                closeAfterClick();
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button type="button" className="h-12" onClick={submit}>
            {automation ? "Save changes" : "Add item"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
