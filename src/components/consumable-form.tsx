"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { RestockOrderButton, restockButtonProps } from "@/components/restock-order-flow";
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
import { sizePlaceholder } from "@/lib/item-label";
import { toISODate } from "@/lib/dates";
import { DEFAULT_LEAD_TIME_DAYS } from "@/lib/supply";
import { CHECKIN_LEVELS, CHECKIN_OPTIONS, ratePerDayFor, type CheckinLevel, type RestockFlowHandlers } from "@/lib/restock";
import type { Duty, DutyDraft, Household, Room, SupplyAutomation } from "@/lib/types";

type Draft = {
  itemName: string;
  sizeSpec: string;
  room: Room;
  leadTimeDays: string;
  onHand: string;
  reorderAt: string;
  retailerUrl: string;
  checkin?: CheckinLevel;
  lifespanMonths: 1 | 3 | 6 | 12 | null;
};

const LIFESPAN_PILLS: { months: 1 | 3 | 6 | 12; label: string }[] = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "A year" },
];

function lifespanFromAutomation(automation: SupplyAutomation | null): 1 | 3 | 6 | 12 | null {
  if (!automation) return null;
  let months = automation.lifespanValue;
  if (automation.lifespanUnit === "years") months = automation.lifespanValue * 12;
  if (automation.lifespanUnit === "days") months = automation.lifespanValue / 30;
  const options: Array<1 | 3 | 6 | 12> = [1, 3, 6, 12];
  return options.reduce((best, n) => (Math.abs(n - months) < Math.abs(best - months) ? n : best));
}

function emptyDraft(room: Room): Draft {
  return {
    itemName: "",
    sizeSpec: "",
    room,
    leadTimeDays: String(DEFAULT_LEAD_TIME_DAYS),
    onHand: "0",
    reorderAt: "0",
    retailerUrl: "",
    lifespanMonths: null,
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
  focusField,
  ...restock
}: {
  open: boolean;
  duty: Duty | null;
  automation: SupplyAutomation | null;
  household: Household;
  defaultRoom: Room;
  onOpenChange: (open: boolean) => void;
  onSave: (input: DutyDraft) => void;
  onDelete?: (id: string) => void;
  focusField?: "sizeSpec";
} & RestockFlowHandlers) {
  const [draft, setDraft] = useState<Draft>(emptyDraft(defaultRoom));
  const [formError, setFormError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

  const resetKey = `${open}:${duty?.id ?? ""}:${automation?.id ?? ""}:${defaultRoom}`;
  const [prevResetKey, setPrevResetKey] = useState<string | null>(null);
  if (open && prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setFormError(null);
    setAdvanced(false);
    setDraft(
      automation
        ? {
            itemName: automation.itemName,
            sizeSpec: automation.sizeSpec ?? "",
            room: automation.room || duty?.room || defaultRoom,
            leadTimeDays: String(automation.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS),
            onHand: String(automation.onHand ?? 0),
            reorderAt: String(automation.reorderAt ?? 0),
            retailerUrl: automation.retailerUrl ?? "",
            lifespanMonths: lifespanFromAutomation(automation),
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
    const typedOnHand = Math.max(0, Number(draft.onHand) || 0);
    const pack = Math.max(1, Math.round(typedOnHand) || 1);
    const level = !automation ? draft.checkin : undefined;
    const onHand = level === "out" ? 0 : level ? pack : typedOnHand;
    const confirmedLevel =
      level === "plenty" ? pack : level === "out" ? 0 : level ? CHECKIN_LEVELS[level] * pack : undefined;
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
        sizeSpec: draft.sizeSpec.trim() || undefined,
        sku: automation?.sku?.trim() || draft.sizeSpec.trim() || "",
        leadTimeDays: Math.min(90, Math.max(0, Number(draft.leadTimeDays) || DEFAULT_LEAD_TIME_DAYS)),
        onHand,
        reorderAt: Math.min(99, Math.max(0, Math.round(Number(draft.reorderAt)) || 0)),
        retailerUrl: link.url || automation?.retailerUrl,
        linkedDutyIds: automation?.linkedDutyIds,
        ...(confirmedLevel != null
          ? { lastConfirmedLevel: confirmedLevel, lastConfirmedAt: toISODate(new Date()) }
          : {}),
        ...(draft.lifespanMonths != null
          ? { lifespanValue: draft.lifespanMonths, lifespanUnit: "months" as const }
          : {}),
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
          <SheetTitle>{automation ? "Edit item" : "New item"}</SheetTitle>
        </SheetHeader>
        <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4">
          <Field label="Item">
            <Input
              value={draft.itemName}
              onChange={(event) => setDraft((current) => ({ ...current, itemName: event.target.value }))}
              placeholder="HVAC filter"
              className="h-12"
              autoFocus={!automation && focusField !== "sizeSpec"}
            />
          </Field>
          <Field label="Size or spec">
            <Input
              value={draft.sizeSpec}
              onChange={(event) => setDraft((current) => ({ ...current, sizeSpec: event.target.value }))}
              placeholder={sizePlaceholder(draft.itemName)}
              maxLength={40}
              className="h-12"
              autoFocus={focusField === "sizeSpec"}
            />
          </Field>
          <div className="grid gap-1.5">
            <p className="text-[13px] font-medium">One usually lasts</p>
            <div className="flex flex-wrap gap-1.5">
              {LIFESPAN_PILLS.map((item) => (
                <button
                  key={item.months}
                  type="button"
                  className={
                    draft.lifespanMonths === item.months
                      ? "h-9 rounded-full bg-primary px-3 text-[13px] font-medium text-primary-foreground"
                      : "h-9 rounded-full bg-secondary px-3 text-[13px] font-medium"
                  }
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      lifespanMonths: current.lifespanMonths === item.months ? null : item.months,
                    }))
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Used in">
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
          {automation ? (
            <Field label="On hand">
              <Input
                type="number"
                min={0}
                value={draft.onHand}
                onChange={(event) => setDraft((current) => ({ ...current, onHand: event.target.value }))}
                className="h-12"
              />
            </Field>
          ) : (
            <div className="grid gap-1.5">
              <p className="text-[13px] font-medium">On hand</p>
              <div className="grid grid-cols-2 gap-2">
                {CHECKIN_OPTIONS.map((option) => (
                  <Button
                    key={option.level}
                    type="button"
                    variant={draft.checkin === option.level ? "default" : "secondary"}
                    className="h-11"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        checkin: current.checkin === option.level ? undefined : option.level,
                      }))
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {automation ? <EstimatedUseLine item={automation} household={household} /> : null}
          {automation ? (
            <RestockOrderButton
              item={automation}
              household={household}
              {...restockButtonProps(automation, restock)}
            />
          ) : null}
          <button
            type="button"
            className="text-left text-[13px] font-medium text-primary"
            onClick={() => setAdvanced((current) => !current)}
          >
            Advanced
          </button>
          {advanced ? (
            <>
              <Field label="Where you order it">
                <SavedRetailerField
                  value={draft.retailerUrl}
                  saved={household.savedRetailerLinks ?? []}
                  onChange={(retailerUrl) => setDraft((current) => ({ ...current, retailerUrl }))}
                />
                <p className="text-[13px] text-muted-foreground">
                  Optional. You can also pick a store the first time you order.
                </p>
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
                <p className="text-[13px] text-muted-foreground">
                  Optional. Also flag for ordering at this count, on top of the automatic timing.
                </p>
              </Field>
              <Field label="Lead time (days)">
                <Input
                  type="number"
                  min={0}
                  value={draft.leadTimeDays}
                  onChange={(event) => setDraft((current) => ({ ...current, leadTimeDays: event.target.value }))}
                  className="h-12"
                />
                <p className="text-[13px] text-muted-foreground">
                  Learned from your deliveries automatically. Set only to override.
                </p>
              </Field>
            </>
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

function EstimatedUseLine({
  item,
  household,
}: {
  item: SupplyAutomation;
  household: Household;
}) {
  const resolved = ratePerDayFor(item, household);
  if (!resolved) return null;
  const n = Math.max(1, Math.round(1 / resolved.rate));
  return (
    <p className="text-[13px] text-muted-foreground">
      Estimated use: about 1 every {n} days
      {resolved.source === "observed" ? " (from your orders)" : ""}
    </p>
  );
}
