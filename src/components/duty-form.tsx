"use client";

import { useState, type ReactNode } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { seedTitleForSave, tDutyTitle } from "@/i18n/content";
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
import { audienceOptions, effortOptions, frequencyOptions, weekdayLabel } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import { RestockOrderButton, restockButtonProps } from "@/components/restock-order-flow";
import { parseOptionalRetailerUrl, SavedRetailerField } from "@/components/saved-retailer-field";
import { sizePlaceholder } from "@/lib/item-label";
import { DEFAULT_LEAD_TIME_DAYS } from "@/lib/supply";
import { isQuoteOnlyDuty } from "@/lib/costs/quotes";
import type { RestockFlowHandlers } from "@/lib/restock";
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
  sizeSpec: string;
  leadTimeDays: string;
  onHand: string;
  reorderAt: string;
  retailerUrl: string;
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
  sizeSpec: "",
  leadTimeDays: String(DEFAULT_LEAD_TIME_DAYS),
  onHand: "0",
  reorderAt: "0",
  retailerUrl: "",
};

function fromDuty(duty: Duty, automation?: SupplyAutomation | null): Draft {
  return {
    title: tDutyTitle(duty.title),
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
    sizeSpec: automation?.sizeSpec ?? "",
    leadTimeDays: String(automation?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS),
    onHand: String(automation?.onHand ?? 0),
    reorderAt: String(automation?.reorderAt ?? 0),
    retailerUrl: automation?.retailerUrl ?? "",
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
  ...restock
}: {
  open: boolean;
  duty: Duty | null;
  household: Household;
  defaultRoom?: Room;
  supplyAutomation?: SupplyAutomation | null;
  defaultTrackSupply?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: DutyDraft) => void;
  onDelete?: (id: string) => void;
} & RestockFlowHandlers) {
  const { t } = useLocale();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showSupply, setShowSupply] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [orderStep, setOrderStep] = useState(false);

  // Reset the draft whenever the sheet opens for a different duty. Adjusting
  // state during render (instead of in an effect) avoids a flash of stale data.
  const resetKey = `${open}:${duty?.id ?? ""}:${supplyAutomation?.id ?? ""}:${defaultRoom ?? ""}:${defaultTrackSupply ?? ""}`;
  const [prevResetKey, setPrevResetKey] = useState<string | null>(null);
  if (open && prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setFormError(null);
    setOrderStep(false);
    if (duty) {
      setDraft(fromDuty(duty, supplyAutomation));
      setShowNotes(Boolean(duty.notes.trim()));
      setShowSupply(Boolean(supplyAutomation) || duty.kind === "replacement");
      setShowAdvanced(duty.effort !== "medium");
    } else {
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
    }
  }

  function closeAfterClick() {
    // Delay so the same click cannot hit Add duty / FAB under the closing sheet.
    window.setTimeout(() => onOpenChange(false), 250);
  }

  function submit() {
    const title = seedTitleForSave(draft.title.trim(), duty?.title);
    if (!title) {
      setFormError(t("chore.giveName"));
      toast.error(t("chore.giveName"));
      return;
    }
    if (draft.trackSupply && !draft.itemName.trim()) {
      setShowSupply(true);
      setFormError(t("restock.nameRequired"));
      toast.error(t("restock.nameRequired"));
      return;
    }
    const link = draft.trackSupply ? parseOptionalRetailerUrl(draft.retailerUrl) : { ok: true as const, url: "" };
    if (!link.ok) {
      setShowSupply(true);
      setShowAdvanced(true);
      setFormError(link.error);
      toast.error(link.error);
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
            sizeSpec: draft.sizeSpec.trim() || undefined,
            leadTimeDays: Math.min(90, Math.max(0, Number(draft.leadTimeDays) || DEFAULT_LEAD_TIME_DAYS)),
            onHand: Math.max(0, Number(draft.onHand) || 0),
            reorderAt: Math.min(99, Math.max(0, Math.round(Number(draft.reorderAt)) || 0)),
            retailerUrl: link.url || supplyAutomation?.retailerUrl,
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
          <SheetTitle>
            {orderStep
              ? t("common.order")
              : duty
                ? t("chore.edit")
                : t("chore.new")}
          </SheetTitle>
        </SheetHeader>
        {orderStep && supplyAutomation ? (
          <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3">
            <Button type="button" variant="ghost" className="h-11 w-fit px-0" onClick={() => setOrderStep(false)}>
              {t("common.back")}
            </Button>
            <RestockOrderButton
              item={supplyAutomation}
              household={household}
              embedded
              autoPicker
              onFlowFinished={() => setOrderStep(false)}
              onFlowCancelled={() => setOrderStep(false)}
              {...restockButtonProps(supplyAutomation, restock)}
            />
          </div>
        ) : (
        <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-3">
          <Field label={t("chore.field.chore")}>
            <Input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                  itemName: current.itemName || event.target.value,
                }))
              }
              placeholder={t("chore.placeholder")}
              className="h-12"
              autoFocus={!duty}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("duty.field.room")}>
              <Select
                value={draft.room}
                onValueChange={(value) => setDraft((current) => ({ ...current, room: value as Room }))}
              >
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                                        {systemRoomList(household).length > 0 ? (
                        <SelectGroup>
                          <SelectLabel>{t("duty.field.always")}</SelectLabel>
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
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("chore.whoDoes")}>
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
                  {audienceOptions().map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={t("chore.repeats")}>
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
                {frequencyOptions().map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {draft.frequency === "weekly" ? (
            <Field label={t("chore.weekday")}>
              <Select
                value={draft.weekday}
                onValueChange={(value) => setDraft((current) => ({ ...current, weekday: value }))}
              >
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6].map((index) => (
                    <SelectItem key={index} value={String(index)}>
                      {weekdayLabel(index)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          {draft.frequency === "monthly" ? (
            <Field label={t("chore.dayOfMonth")}>
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
            <Field label={t("chore.dueDate")}>
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

          {duty?.caution ? (
            <p className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
              {t("duty.cautionDisclaimer", { work: duty.caution })}
              {isQuoteOnlyDuty(duty) ? t("duty.quoteOnlySuffix") : ""}
            </p>
          ) : null}

          <Disclosure
            open={showNotes}
            onOpenChange={setShowNotes}
            label={t("chore.notes")}
            hint={draft.notes.trim() ? draft.notes.trim() : t("chore.notesHint")}
          >
            <Field label={t("chore.notesLabel")}>
              <Textarea
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                placeholder={t("chore.notesPlaceholder")}
                className="min-h-24 text-base"
              />
            </Field>
          </Disclosure>

          <Disclosure
            open={showSupply}
            onOpenChange={setShowSupply}
            label={t("duty.field.item")}
            hint={
              draft.trackSupply
                ? draft.itemName.trim() || t("chore.usesItem")
                : t("chore.usesItem")
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
                <span className="block font-medium">{t("duty.usesItem")}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t("restock.emptyBodyAlt1")}
                </span>
              </span>
            </label>

            {draft.trackSupply ? (
              <div className="grid gap-3">
                <Field label={t("duty.field.item")}>
                  <Input
                    value={draft.itemName}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, itemName: event.target.value }))
                    }
                    placeholder={t("restock.itemPlaceholder")}
                    className="h-12"
                  />
                </Field>
                <Field label={t("restock.field.size")}>
                  <Input
                    value={draft.sizeSpec}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, sizeSpec: event.target.value }))
                    }
                    placeholder={sizePlaceholder(draft.itemName)}
                    maxLength={40}
                    className="h-12"
                  />
                </Field>
                {supplyAutomation ? (
                  <Button type="button" className="h-12" onClick={() => setOrderStep(true)}>
                    {t("common.order")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Disclosure>

          <Disclosure
            open={showAdvanced}
            onOpenChange={setShowAdvanced}
            label={t("duty.advanced")}
            hint={
              draft.trackSupply
                ? t("chore.moreOptions")
                : (effortOptions().find((item) => item.id === draft.effort)?.label ?? t("chore.effort"))
            }
          >
            <Field label={t("chore.effort")}>
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
                  {effortOptions().map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {draft.trackSupply ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("restock.field.onHand")}>
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
                  <Field label={t("restock.field.orderAtOrBelow")}>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      value={draft.reorderAt}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, reorderAt: event.target.value }))
                      }
                      className="h-12"
                    />
                  </Field>
                </div>
                <Field label={t("restock.field.leadTime")}>
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
                <Field label={t("restock.field.whereOrder")}>
                  <SavedRetailerField
                    value={draft.retailerUrl}
                    saved={household.savedRetailerLinks ?? []}
                    onChange={(retailerUrl) => setDraft((current) => ({ ...current, retailerUrl }))}
                  />
                </Field>
              </>
            ) : null}
          </Disclosure>
          {formError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {formError}
            </p>
          ) : null}
        </div>
        )}
        {orderStep ? null : (
        <SheetFooter className="shrink-0 flex-row items-center gap-2 border-t border-border/70 bg-popover/95 py-2.5 backdrop-blur-md">
          {duty && onDelete ? (
            <Button
              type="button"
              variant="destructive"
              className="h-11 min-w-24"
              onClick={() => {
                closeAfterClick();
                onDelete(duty.id);
              }}
            >
              {t("common.delete")}
            </Button>
          ) : null}
          <Button type="button" className="h-11 min-w-0 flex-1" onClick={submit}>
            {duty ? t("chore.saveChanges") : t("chore.add")}
          </Button>
        </SheetFooter>
        )}
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
