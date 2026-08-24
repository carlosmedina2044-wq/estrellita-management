"use client";

import { useState, type ReactNode } from "react";
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
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import { parseOptionalRetailerUrl, SavedRetailerField } from "@/components/saved-retailer-field";
import { DEFAULT_LEAD_TIME_DAYS } from "@/lib/supply";
import type { Duty, DutyDraft, Household, Room, SupplyAutomation } from "@/lib/types";

type Draft = {
  itemName: string;
  room: Room;
  leadTimeDays: string;
  onHand: string;
  reorderAt: string;
  retailerUrl: string;
};

function emptyDraft(room: Room): Draft {
  return {
    itemName: "",
    room,
    leadTimeDays: String(DEFAULT_LEAD_TIME_DAYS),
    onHand: "0",
    reorderAt: "0",
    retailerUrl: "",
  };
}

export function ConsumableForm({
  open,
  duty,
  automation,
  household,
  defaultRoom,
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
  household: Household;
  defaultRoom: Room;
  onOpenChange: (open: boolean) => void;
  onSave: (input: DutyDraft) => void;
  onDelete?: (id: string) => void;
  onMarkOrdered?: (id: string) => void;
  onMarkReceived?: (id: string, qty: number) => void;
  onSaveLink?: (id: string, url: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft(defaultRoom));
  const [formError, setFormError] = useState<string | null>(null);

  const resetKey = `${open}:${duty?.id ?? ""}:${automation?.id ?? ""}:${defaultRoom}`;
  const [prevResetKey, setPrevResetKey] = useState<string | null>(null);
  if (open && prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setFormError(null);
    setDraft(
      automation
        ? {
            itemName: automation.itemName,
            room: automation.room || duty?.room || defaultRoom,
            leadTimeDays: String(automation.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS),
            onHand: String(automation.onHand ?? 0),
            reorderAt: String(automation.reorderAt ?? 0),
            retailerUrl: automation.retailerUrl ?? "",
          }
        : emptyDraft(defaultRoom),
    );
  }

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
    const link = parseOptionalRetailerUrl(draft.retailerUrl);
    if (!link.ok) {
      setFormError(link.error);
      toast.error(link.error);
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
        reorderAt: Math.min(99, Math.max(0, Math.round(Number(draft.reorderAt)) || 0)),
        retailerUrl: link.url || automation?.retailerUrl,
        linkedDutyIds: automation?.linkedDutyIds,
      },
    });
    toast.success(automation ? "Saved" : "Added to Restock");
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
          <Field label="Where you order it">
            <SavedRetailerField
              value={draft.retailerUrl}
              saved={household.savedRetailerLinks ?? []}
              onChange={(retailerUrl) => setDraft((current) => ({ ...current, retailerUrl }))}
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
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="On hand">
              <Input
                type="number"
                min={0}
                value={draft.onHand}
                onChange={(event) => setDraft((current) => ({ ...current, onHand: event.target.value }))}
                className="h-12"
              />
            </Field>
            <Field label="Order at or below">
              <Input
                type="number"
                min={0}
                max={99}
                value={draft.reorderAt}
                onChange={(event) => setDraft((current) => ({ ...current, reorderAt: event.target.value }))}
                className="h-12"
              />
            </Field>
          </div>
          <p className="text-[13px] text-muted-foreground">
            When on hand is this many or fewer, it shows on Today with Order. 0 means order when you’re out.
          </p>
          <Field label="Lead time (days)">
            <Input
              type="number"
              min={0}
              value={draft.leadTimeDays}
              onChange={(event) => setDraft((current) => ({ ...current, leadTimeDays: event.target.value }))}
              className="h-12"
            />
          </Field>
          {automation ? (
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
