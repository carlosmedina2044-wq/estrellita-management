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
import { AUDIENCES, EFFORTS, FREQUENCIES, LIFESPAN_UNITS, WEEKDAYS } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { FLOORS, HOUSE_ROOMS } from "@/lib/house";
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import { parseAmazonProduct } from "@/lib/amazon";
import { AmazonOrderButton } from "@/components/amazon-order-button";
import { DEFAULT_LEAD_TIME_DAYS, DEFAULT_QUANTITY, deriveOrderByDate } from "@/lib/supply";
import type {
  Audience,
  Duty,
  DutyDraft,
  DutyKind,
  Effort,
  Frequency,
  Household,
  LifespanUnit,
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
  sku: "",
  asin: "",
  amazonProductUrl: "",
  amazonOneClick: false,
  amazonNotes: "",
  quantity: String(DEFAULT_QUANTITY),
  leadTimeDays: String(DEFAULT_LEAD_TIME_DAYS),
  installedAt: todayISO(),
  lifespanValue: "12",
  lifespanUnit: "months",
  orderByDate: deriveOrderByDate(todayISO(), 12, "months"),
  orderByDirty: false,
};

function fromDuty(duty: Duty, automation?: SupplyAutomation | null): Draft {
  const installedAt = automation?.installedAt ?? todayISO();
  const lifespanValue = automation?.lifespanValue ?? 12;
  const lifespanUnit = automation?.lifespanUnit ?? "months";
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
    sku: automation?.sku ?? "",
    asin: automation?.asin ?? "",
    amazonProductUrl: automation?.amazonProductUrl ?? "",
    amazonOneClick: false,
    amazonNotes: automation?.amazonNotes ?? "",
    quantity: String(automation?.quantity ?? DEFAULT_QUANTITY),
    leadTimeDays: String(automation?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS),
    installedAt,
    lifespanValue: String(lifespanValue),
    lifespanUnit,
    orderByDate: automation?.orderByDate ?? deriveOrderByDate(installedAt, lifespanValue, lifespanUnit),
    orderByDirty: Boolean(automation),
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
    const installedAt = todayISO();
    setDraft({
      ...emptyDraft,
      room: defaultRoom ?? "kitchen",
      dueDate: todayISO(),
      trackSupply: Boolean(defaultTrackSupply),
      kind: defaultTrackSupply ? "replacement" : "chore",
      installedAt,
      orderByDate: deriveOrderByDate(installedAt, 12, "months"),
      orderByDirty: false,
    });
  }, [open, duty, defaultRoom, supplyAutomation, defaultTrackSupply]);

  function closeAfterClick() {
    // Delay so the same click cannot hit Add duty / FAB under the closing sheet.
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
    const amazonLink = draft.amazonProductUrl.trim();
    const parsedAmazon = amazonLink ? parseAmazonProduct(amazonLink) : null;
    if (draft.trackSupply && parsedAmazon && !parsedAmazon.ok) {
      setShowSupply(true);
      setFormError(parsedAmazon.error);
      toast.error(parsedAmazon.error);
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
            label="Reorder reminder"
            hint={
              draft.trackSupply
                ? draft.itemName.trim() || "Tracking a reorder"
                : "Lead time and an Amazon link — you check out yourself"
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
                <span className="block font-medium">Track a reorder</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Reminds you before you run out. One tap opens Amazon.
                </span>
              </span>
            </label>

            {draft.trackSupply ? (
              <div className="grid gap-3">
                <Field label="Item to order / deliver">
                  <Input
                    value={draft.itemName}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, itemName: event.target.value }))
                    }
                    placeholder="Air purifier filter"
                    className="h-12"
                  />
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
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, quantity: event.target.value }))
                      }
                      className="h-12"
                    />
                  </Field>
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
                      onValueChange={(value) =>
                        patchSupply({ lifespanUnit: value as LifespanUnit })
                      }
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
                <Field label="Need by (editable)">
                  <Input
                    type="date"
                    value={draft.orderByDate}
                    onChange={(event) =>
                      patchSupply({ orderByDate: event.target.value, orderByDirty: true })
                    }
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
                {supplyAutomation && onMarkOrdered ? (
                  <AmazonOrderButton item={supplyAutomation} onOrdered={() => onMarkOrdered(supplyAutomation.id)} />
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
