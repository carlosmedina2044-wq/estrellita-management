"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { LIFESPAN_UNITS } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { FLOORS, HOUSE_ROOMS } from "@/lib/house";
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import type { Household } from "@/lib/types";
import { parseAmazonProduct } from "@/lib/amazon";
import { AmazonOrderButton } from "@/components/amazon-order-button";
import { DEFAULT_LEAD_TIME_DAYS, DEFAULT_QUANTITY, deriveOrderByDate } from "@/lib/supply";
import type { Duty, DutyDraft, LifespanUnit, Room, SupplyAutomation } from "@/lib/types";

type Draft = {
  itemName: string;
  room: Room;
  sku: string;
  asin: string;
  amazonProductUrl: string;
  amazonOneClick: boolean;
  amazonNotes: string;
  quantity: string;
  leadTimeDays: string;
  installedAt: string;
  lifespanValue: string;
  lifespanUnit: LifespanUnit;
  orderByDate: string;
  orderByDirty: boolean;
};

function emptyDraft(room: Room = "living-room"): Draft {
  const installedAt = todayISO();
  return {
    itemName: "",
    room,
    sku: "",
    asin: "",
    amazonProductUrl: "",
    amazonOneClick: false,
    amazonNotes: "",
    quantity: String(DEFAULT_QUANTITY),
    leadTimeDays: String(DEFAULT_LEAD_TIME_DAYS),
    installedAt,
    lifespanValue: "12",
    lifespanUnit: "months",
    orderByDate: deriveOrderByDate(installedAt, 12, "months"),
    orderByDirty: false,
  };
}

function fromAutomation(duty: Duty, automation: SupplyAutomation): Draft {
  return {
    itemName: automation.itemName,
    room: automation.room || duty.room,
    sku: automation.sku,
    asin: automation.asin,
    amazonProductUrl: automation.amazonProductUrl,
    amazonOneClick: false,
    amazonNotes: automation.amazonNotes,
    quantity: String(automation.quantity ?? DEFAULT_QUANTITY),
    leadTimeDays: String(automation.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS),
    installedAt: automation.installedAt,
    lifespanValue: String(automation.lifespanValue),
    lifespanUnit: automation.lifespanUnit,
    orderByDate: automation.orderByDate,
    orderByDirty: true,
  };
}

export function AutomationForm({
  open,
  duty,
  automation,
  household,
  defaultRoom = "living-room",
  onOpenChange,
  onSave,
  onDelete,
  onMarkOrdered,
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
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft(defaultRoom));
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (duty && automation) {
      setDraft(fromAutomation(duty, automation));
      return;
    }
    setDraft(emptyDraft(defaultRoom));
  }, [open, duty, automation, defaultRoom]);

  function closeAfterClick() {
    // Delay so the same click cannot hit Add new under the closing sheet.
    window.setTimeout(() => onOpenChange(false), 250);
  }

  function patchSupply(
    next: Partial<Pick<Draft, "installedAt" | "lifespanValue" | "lifespanUnit" | "orderByDate" | "orderByDirty">>,
  ) {
    setDraft((current) => {
      const merged = { ...current, ...next };
      if (merged.orderByDirty && next.orderByDate === undefined) return merged;
      if (next.orderByDate !== undefined) return merged;
      merged.orderByDate = deriveOrderByDate(
        merged.installedAt,
        Number(merged.lifespanValue) || 1,
        merged.lifespanUnit,
      );
      return merged;
    });
  }

  function submit() {
    const itemName = draft.itemName.trim();
    if (!itemName) {
      setFormError("Name the item to order.");
      toast.error("Name the item to order.");
      return;
    }
    const amazonLink = draft.amazonProductUrl.trim();
    const parsedAmazon = amazonLink ? parseAmazonProduct(amazonLink) : null;
    if (parsedAmazon && !parsedAmazon.ok) {
      setFormError(parsedAmazon.error);
      toast.error(parsedAmazon.error);
      return;
    }

    setFormError(null);
    onSave({
      id: duty?.id,
      title: itemName,
      notes: duty?.notes ?? "",
      room: draft.room,
      nodeId: draft.room,
      nodeType: "room",
      audience: duty?.audience ?? "me",
      effort: duty?.effort ?? "medium",
      frequency: duty?.frequency ?? "once",
      kind: "replacement",
      weekday: duty?.weekday ?? 6,
      monthDay: duty?.monthDay ?? 1,
      dueDate: duty?.dueDate ?? draft.orderByDate,
      priority: duty?.priority ?? "medium",
      supplyAutomation: {
        id: automation?.id,
        itemName,
        sku: draft.sku.trim(),
        asin: draft.asin.trim() || (parsedAmazon?.ok ? parsedAmazon.asin ?? "" : ""),
        amazonProductUrl: amazonLink,
        amazonOneClick: false,
        amazonNotes: draft.amazonNotes.trim(),
        quantity: Math.min(99, Math.max(1, Number(draft.quantity) || DEFAULT_QUANTITY)),
        leadTimeDays: Math.min(90, Math.max(0, Number(draft.leadTimeDays) || DEFAULT_LEAD_TIME_DAYS)),
        installedAt: draft.installedAt,
        lifespanValue: Math.max(1, Number(draft.lifespanValue) || 1),
        lifespanUnit: draft.lifespanUnit,
        orderByDate: draft.orderByDate,
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
          <SheetTitle>{automation ? "Edit rule" : "New rule"}</SheetTitle>
        </SheetHeader>
        <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
          <Field label="Item to order">
            <Input
              value={draft.itemName}
              onChange={(event) => setDraft((current) => ({ ...current, itemName: event.target.value }))}
              placeholder="Air purifier filter"
              className="h-12"
              autoFocus={!automation}
            />
          </Field>
          <Field label="Where it lives">
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
          <Field label="Amazon product link or ASIN">
            <Input
              value={draft.amazonProductUrl || draft.asin}
              onChange={(event) => {
                const value = event.target.value;
                const parsed = value.trim() ? parseAmazonProduct(value) : null;
                setDraft((current) => ({
                  ...current,
                  amazonProductUrl: value,
                  asin: parsed?.ok ? parsed.asin ?? current.asin : current.asin,
                }));
              }}
              placeholder="https://www.amazon.com/dp/… or B0…"
              className="h-12"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">
              <Input
                type="number"
                min={1}
                value={draft.quantity}
                onChange={(event) => setDraft((current) => ({ ...current, quantity: event.target.value }))}
                className="h-12"
              />
            </Field>
            <Field label="Lead time (days)">
              <Input
                type="number"
                min={0}
                value={draft.leadTimeDays}
                onChange={(event) => setDraft((current) => ({ ...current, leadTimeDays: event.target.value }))}
                className="h-12"
              />
            </Field>
          </div>
          <Field label="Installed / last replaced">
            <Input
              type="date"
              value={draft.installedAt}
              onChange={(event) => patchSupply({ installedAt: event.target.value })}
              className="h-12"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lasts">
              <Input
                type="number"
                min={1}
                value={draft.lifespanValue}
                onChange={(event) => patchSupply({ lifespanValue: event.target.value })}
                className="h-12"
              />
            </Field>
            <Field label="Unit">
              <Select
                value={draft.lifespanUnit}
                onValueChange={(value) => patchSupply({ lifespanUnit: value as LifespanUnit })}
              >
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFESPAN_UNITS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Order by">
            <Input
              type="date"
              value={draft.orderByDate}
              onChange={(event) => patchSupply({ orderByDate: event.target.value, orderByDirty: true })}
              className="h-12"
            />
          </Field>
          <Field label="Notes">
            <Textarea
              value={draft.amazonNotes}
              onChange={(event) =>
                setDraft((current) => ({ ...current, amazonNotes: event.target.value }))
              }
              placeholder="Size, Subscribe & Save, spare under the sink."
              className="min-h-20 text-base"
            />
          </Field>
          {automation && onMarkOrdered ? (
            <AmazonOrderButton item={automation} onOrdered={() => onMarkOrdered(automation.id)} />
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
            {automation ? "Save changes" : "Add rule"}
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
