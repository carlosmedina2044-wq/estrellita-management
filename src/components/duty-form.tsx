"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AUDIENCES, EFFORTS, FREQUENCIES, WEEKDAYS } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { FLOORS, HOUSE_ROOMS } from "@/lib/house";
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import { RestockOrderButton } from "@/components/restock-order-button";
import { DEFAULT_LEAD_TIME_DAYS } from "@/lib/supply";
import type {
  Audience,
  Duty,
  DutyDraft,
  DutyKind,
  Effort,
  Frequency,
  Household,
  Room,
  SupplyAutomation,
} from "@/lib/types";

type Draft = {
  title: string;
  notes: string;
  room: Room;
  audience: Audience;
  effort: Effort;
  frequency: Frequency;
  weekday: string;
  monthDay: string;
  dueDate: string;
  kind: DutyKind;
  trackSupply: boolean;
  itemName: string;
  leadTimeDays: string;
  onHand: string;
};

const emptyDraft: Draft = {
  title: "",
  notes: "",
  room: "kitchen",
  audience: "me",
  effort: "medium",
  frequency: "weekly",
  weekday: "6",
  monthDay: "1",
  dueDate: todayISO(),
  kind: "chore",
  trackSupply: false,
  itemName: "",
  leadTimeDays: String(DEFAULT_LEAD_TIME_DAYS),
  onHand: "0",
};

function fromDuty(duty: Duty, automation?: SupplyAutomation | null): Draft {
  return {
    title: duty.title,
    notes: duty.notes,
    room: duty.room,
    audience: duty.audience,
    effort: duty.effort,
    frequency: duty.frequency,
    weekday: String(duty.weekday),
    monthDay: String(duty.monthDay),
    dueDate: duty.dueDate ?? todayISO(),
    kind: duty.kind,
    trackSupply: Boolean(automation) || duty.kind === "replacement",
    itemName: automation?.itemName ?? duty.title,
    leadTimeDays: String(automation?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS),
    onHand: String(automation?.onHand ?? 0),
  };
}

export function DutyForm({
  open,
  duty,
  household,
  defaultRoom,
  supplyAutomation,
  defaultTrackSupply,
  onOpenChange,
  onSave,
  onDelete,
  onMarkOrdered,
  onMarkReceived,
  onSaveLink,
}: {
  open: boolean;
  duty: Duty | null;
  household?: Household;
  defaultRoom?: Room;
  supplyAutomation?: SupplyAutomation | null;
  defaultTrackSupply?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: DutyDraft) => void;
  onDelete?: (id: string) => void;
  onMarkOrdered?: (id: string) => void;
  onMarkReceived?: (id: string, qty: number) => void;
  onSaveLink?: (id: string, url: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showSupply, setShowSupply] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (duty) {
      setDraft(fromDuty(duty, supplyAutomation));
      setShowNotes(Boolean(duty.notes.trim()));
      setShowSupply(Boolean(supplyAutomation) || duty.kind === "replacement");
      setShowAdvanced(duty.effort !== "medium");
      return;
    }
    setShowNotes(false);
    setShowSupply(Boolean(defaultTrackSupply));
    setShowAdvanced(false);
    setDraft({
      ...emptyDraft,
      room: defaultRoom ?? "kitchen",
      dueDate: todayISO(),
      trackSupply: Boolean(defaultTrackSupply),
      kind: defaultTrackSupply ? "replacement" : "chore",
    });
  }, [open, duty, defaultRoom, supplyAutomation, defaultTrackSupply]);

  function closeAfterClick() {
    // Delay so the same click cannot hit Add duty / FAB under the closing sheet.
    window.setTimeout(() => onOpenChange(false), 250);
  }

  function submit() {
    const title = draft.title.trim();
    if (!title) {
      setFormError("Give this duty a name.");
      toast.error("Give this duty a name.");
      return;
    }
    if (draft.trackSupply && !draft.itemName.trim()) {
      setShowSupply(true);
      setFormError("Name the item to order.");
      toast.error("Name the item to order.");
      return;
    }
    setFormError(null);
    onSave({
      id: duty?.id,
      title,
      notes: draft.notes.trim(),
      room: draft.room,
      audience: draft.audience,
      effort: draft.effort,
      frequency: draft.frequency,
      kind: draft.trackSupply ? "replacement" : "chore",
      weekday: Number(draft.weekday),
      nodeId: draft.room,
      nodeType: "room",
      monthDay: Math.min(31, Math.max(1, Number(draft.monthDay) || 1)),
      dueDate: draft.frequency === "once" ? draft.dueDate : null,
      priority: draft.effort === "large" ? "high" : draft.effort === "small" ? "low" : "medium",
      supplyAutomation: draft.trackSupply
        ? {
            id: supplyAutomation?.id,
            itemName: draft.itemName.trim() || title,
            leadTimeDays: Math.min(90, Math.max(0, Number(draft.leadTimeDays) || DEFAULT_LEAD_TIME_DAYS)),
            onHand: Math.max(0, Number(draft.onHand) || 0),
            retailerUrl: supplyAutomation?.retailerUrl,
            linkedDutyIds: supplyAutomation?.linkedDutyIds,
          }
        : null,
    });
    closeAfterClick();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        size="form"
        className="gap-0 rounded-t-3xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle>{duty ? "Edit duty" : "New duty"}</SheetTitle>
        </SheetHeader>
        <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3">
          <Field label="Duty">
            <Input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                  itemName: current.itemName || event.target.value,
                }))
              }
              placeholder="Replace air purifier filters"
              className="h-12"
              autoFocus={!duty}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Room">
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
                      {systemRoomList(household).length > 0 ? (
                        <SelectGroup>
                          <SelectLabel>Always</SelectLabel>
                          {systemRoomList(household).map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ) : null}
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
            <Field label="Who does this">
              <Select
                value={draft.audience}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, audience: value as Audience }))
                }
              >
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Repeats">
            <Select
              value={draft.frequency}
              onValueChange={(value) =>
                setDraft((current) => ({ ...current, frequency: value as Frequency }))
              }
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {draft.frequency === "weekly" ? (
            <Field label="Weekday">
              <Select
                value={draft.weekday}
                onValueChange={(value) => setDraft((current) => ({ ...current, weekday: value }))}
              >
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((day, index) => (
                    <SelectItem key={day} value={String(index)}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {draft.frequency === "monthly" ? (
            <Field label="Day of month">
              <Input
                type="number"
                min={1}
                max={31}
                value={draft.monthDay}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, monthDay: event.target.value }))
                }
                className="h-12"
              />
            </Field>
          ) : null}
          {draft.frequency === "once" ? (
            <Field label="Due date">
              <Input
                type="date"
                value={draft.dueDate}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, dueDate: event.target.value }))
                }
                className="h-12"
              />
            </Field>
          ) : null}

          <Disclosure
            open={showNotes}
            onOpenChange={setShowNotes}
            label="Notes"
            hint={draft.notes.trim() ? draft.notes.trim() : "Optional details for the person doing it"}
          >
            <Field label="Notes for the person doing it">
              <Textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Green cloth for stainless. Spare bags under the sink."
                className="min-h-24 text-base"
              />
            </Field>
          </Disclosure>

          <Disclosure
            open={showSupply}
            onOpenChange={setShowSupply}
            label="Consumable"
            hint={
              draft.trackSupply
                ? draft.itemName.trim() || "This task uses a consumable"
                : "This task uses a consumable"
            }
          >
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={draft.trackSupply}
                onCheckedChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    trackSupply: checked === true,
                    kind: checked === true ? "replacement" : "chore",
                    itemName: current.itemName || current.title,
                  }))
                }
              />
              <span>
                <span className="block font-medium">This task uses a consumable</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Tracks runway and when to order. Checkout stays on the retailer’s site.
                </span>
              </span>
            </label>

            {draft.trackSupply ? (
              <div className="grid gap-3">
                <Field label="Item">
                  <Input
                    value={draft.itemName}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, itemName: event.target.value }))
                    }
                    placeholder="HVAC filter 16x25x1"
                    className="h-12"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Lead time (days)">
                    <Input
                      type="number"
                      min={0}
                      value={draft.leadTimeDays}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, leadTimeDays: event.target.value }))
                      }
                      className="h-12"
                    />
                  </Field>
                  <Field label="On hand">
                    <Input
                      type="number"
                      min={0}
                      value={draft.onHand}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, onHand: event.target.value }))
                      }
                      className="h-12"
                    />
                  </Field>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  Save a product link later from Share, or after you tap Find it.
                </p>
                {supplyAutomation && household ? (
                  <RestockOrderButton
                    item={supplyAutomation}
                    household={household}
                    onOrdered={onMarkOrdered ? () => onMarkOrdered(supplyAutomation.id) : undefined}
                    onReceived={onMarkReceived ? (qty) => onMarkReceived(supplyAutomation.id, qty) : undefined}
                    onSaveLink={onSaveLink ? (url) => onSaveLink(supplyAutomation.id, url) : undefined}
                  />
                ) : null}
              </div>
            ) : null}
          </Disclosure>

          <Disclosure
            open={showAdvanced}
            onOpenChange={setShowAdvanced}
            label="More options"
            hint={EFFORTS.find((item) => item.id === draft.effort)?.label ?? "Effort"}
          >
            <Field label="Effort">
              <Select
                value={draft.effort}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, effort: value as Effort }))
                }
              >
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EFFORTS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Disclosure>
          {formError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          ) : null}
        </div>
        <SheetFooter className="shrink-0 flex-row items-center gap-2 border-t border-border/70 bg-popover/95 py-2.5 backdrop-blur-md">
          {duty && onDelete ? (
            <Button
              type="button"
              variant="destructive"
              className="h-11 min-w-24"
              onClick={() => {
                onDelete(duty.id);
                closeAfterClick();
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button type="button" className="h-11 min-w-0 flex-1" onClick={submit}>
            {duty ? "Save changes" : "Add duty"}
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

function Disclosure({
  open,
  onOpenChange,
  label,
  hint,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-muted/70">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          {hint ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{hint}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? <div className="grid gap-3 px-4 pb-4">{children}</div> : null}
    </div>
  );
}
