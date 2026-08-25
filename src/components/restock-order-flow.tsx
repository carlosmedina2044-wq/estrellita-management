"use client";

import { useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { toast } from "sonner";
import { RetailerPickerSheet } from "@/components/retailer-picker-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { addDays, formatDueDate, formatWeekdayDate, toISODate } from "@/lib/dates";
import { isNative } from "@/lib/native/platform";
import { RETAILER_CHIPS } from "@/lib/retailer";
import {
  ARRIVAL_OFFSETS,
  closestArrivalOffset,
  observedLeadTimeDays,
  orderNowOnHandCaption,
  reorderAtFor,
  restockPlacement,
  shouldOfferLeadTime,
  type MarkOrderedDetails,
  type RestockFlowHandlers,
} from "@/lib/restock";
import { leadTimeDaysFor } from "@/lib/supply";
import type { Household, SupplyAutomation } from "@/lib/types";
import { cn } from "@/lib/utils";

const LOOKING_MS = 30 * 60 * 1000;
const lookingUntil = new Map<string, number>();

export function restockButtonProps(item: SupplyAutomation, handlers: RestockFlowHandlers) {
  return {
    onOrdered: handlers.onMarkOrdered
      ? (details: MarkOrderedDetails) => handlers.onMarkOrdered?.(item.id, details)
      : undefined,
    onReceived: handlers.onMarkReceived
      ? (qty: number, paid?: number) => handlers.onMarkReceived?.(item.id, qty, paid)
      : undefined,
    onSaveLink: handlers.onSaveLink ? (url: string) => handlers.onSaveLink?.(item.id, url) : undefined,
    onPreferRetailer: handlers.onPreferRetailer
      ? (retailer: string) => handlers.onPreferRetailer?.(item.id, retailer)
      : undefined,
    onStillWaiting: handlers.onStillWaiting ? () => handlers.onStillWaiting?.(item.id) : undefined,
    onNeverCame: handlers.onNeverCame ? () => handlers.onNeverCame?.(item.id) : undefined,
    onChangeArrival: handlers.onChangeArrival
      ? (date: string) => handlers.onChangeArrival?.(item.id, date)
      : undefined,
    onApplyLeadTime: handlers.onApplyLeadTime
      ? (days: number) => handlers.onApplyLeadTime?.(item.id, days)
      : undefined,
  };
}

export function RestockOrderButton({
  item,
  household,
  onOrdered,
  onReceived,
  onSaveLink,
  onPreferRetailer,
  onStillWaiting,
  onNeverCame,
  onChangeArrival,
  onApplyLeadTime,
  onAddSize,
  className,
  compact,
  autoReceive,
  autoPicker,
  onPickerOpenChange,
  subdued,
}: {
  item: SupplyAutomation;
  household: Pick<Household, "duties" | "completions" | "savedRetailerLinks" | "consumables" | "preferredRetailers" | "restockSafetyBufferDays">;
  onOrdered?: (details: MarkOrderedDetails) => void;
  onReceived?: (qty: number, paid?: number) => void;
  onSaveLink?: (url: string) => void;
  onPreferRetailer?: (retailer: string) => void;
  onStillWaiting?: () => void;
  onNeverCame?: () => void;
  onChangeArrival?: (date: string) => void;
  onApplyLeadTime?: (days: number) => void;
  onAddSize?: () => void;
  className?: string;
  compact?: boolean;
  autoReceive?: boolean;
  autoPicker?: boolean;
  onPickerOpenChange?: (open: boolean) => void;
  subdued?: boolean;
}) {
  const [picker, setPicker] = useState(false);
  const [ask, setAsk] = useState(false);
  const [receive, setReceive] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const [changeDate, setChangeDate] = useState(false);
  const [waitingResume, setWaitingResume] = useState(false);
  const [qtyDraft, setQtyDraft] = useState(String(item.qtyPerOrder || 1));
  const [pendingRetailer, setPendingRetailer] = useState<string | undefined>();
  const pendingRetailerRef = useRef<string | undefined>(undefined);
  if (autoReceive && !receive) setReceive(true);
  if (autoPicker && !picker) setPicker(true);
  const placement = restockPlacement(item, household);
  const arriving = placement.bucket === "ordered";
  const linkedConsumable = (household.consumables ?? []).find(
    (entry) => entry.nodeId === item.nodeId || entry.assetId === item.nodeId || entry.name === item.itemName,
  );
  const suggestedCost = item.lastPaidPrice ?? item.unitCost ?? linkedConsumable?.lastPaidPrice ?? linkedConsumable?.unitCost;

  function rememberRetailer(retailer?: string) {
    const value = retailer ?? item.preferredRetailer;
    pendingRetailerRef.current = value;
    setPendingRetailer(value);
  }

  function maybeAsk(retailer?: string) {
    const until = lookingUntil.get(item.id) ?? 0;
    if (until > Date.now()) return;
    rememberRetailer(retailer);
    setAsk(true);
  }

  function finishReceive(qty: number, paid?: number) {
    const observed = observedLeadTimeDays(item);
    const lead = leadTimeDaysFor(item);
    onReceived?.(qty, paid);
    if (observed != null && shouldOfferLeadTime(lead, observed) && onApplyLeadTime) {
      toast.message(`Took ${observed} days, not ${lead}. Use ${observed} next time?`, {
        duration: 10_000,
        action: {
          label: `Use ${observed}`,
          onClick: () => onApplyLeadTime(observed),
        },
      });
    }
  }

  useEffect(() => {
    if (!waitingResume) return;
    const go = () => {
      setWaitingResume(false);
      const until = lookingUntil.get(item.id) ?? 0;
      if (until > Date.now()) return;
      setAsk(true);
    };
    const onVis = () => {
      if (document.visibilityState === "visible") go();
    };
    document.addEventListener("visibilitychange", onVis);
    const handles: Array<{ remove: () => Promise<void> }> = [];
    let cancelled = false;
    if (isNative()) {
      void import("@capacitor/app").then(({ App }) =>
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) go();
        }).then((l) => {
          if (!cancelled) handles.push(l);
          else void l.remove();
        }),
      );
      void import("@capacitor/browser").then(({ Browser }) =>
        Browser.addListener("browserFinished", go).then((l) => {
          if (!cancelled) handles.push(l);
          else void l.remove();
        }),
      );
    }
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      for (const h of handles) void h.remove();
    };
  }, [waitingResume, item.id]);

  const receiveDialog = (
    <ReceiveDialog
      open={receive}
      qty={qtyDraft}
      onQty={setQtyDraft}
      suggestedCost={suggestedCost}
      onOpenChange={setReceive}
      onConfirm={finishReceive}
    />
  );

  if (placement.nudgeArrive) {
    return (
      <div className="grid gap-2">
        <p className="text-[13px] text-muted-foreground">Did it arrive?</p>
        {onReceived ? (
          <Button type="button" className={className ?? (compact ? "h-9 w-auto self-start px-4" : "h-10")} onClick={() => setReceive(true)}>
            Received
          </Button>
        ) : null}
        {onStillWaiting ? (
          <Button type="button" variant="secondary" className="h-10" onClick={onStillWaiting}>
            Still waiting
          </Button>
        ) : null}
        {onNeverCame ? (
          <Button type="button" variant="ghost" className="h-10" onClick={onNeverCame}>
            Never came
          </Button>
        ) : null}
        {receiveDialog}
      </div>
    );
  }

  if (arriving) {
    return (
      <div className="grid gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] text-muted-foreground">{arrivalLine(item)}</p>
          {onChangeArrival || onNeverCame ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label="More"
              onClick={() => setOverflow(true)}
            >
              <Ellipsis className="size-4" />
            </Button>
          ) : null}
        </div>
        {onReceived ? (
          <Button type="button" className={className ?? (compact ? "h-9 w-auto self-start px-4" : "h-10")} onClick={() => setReceive(true)}>
            Received
          </Button>
        ) : null}
        {receiveDialog}
        <Sheet open={overflow} onOpenChange={setOverflow}>
          <SheetContent side="bottom" className="gap-0">
            <SheetHeader>
              <SheetTitle>On the way</SheetTitle>
              <SheetDescription>{item.itemName}</SheetDescription>
            </SheetHeader>
            <div className="grid gap-2 px-4 pb-4">
              {onChangeArrival ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12"
                  onClick={() => {
                    setOverflow(false);
                    setChangeDate(true);
                  }}
                >
                  Change date
                </Button>
              ) : null}
              {onNeverCame ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12"
                  onClick={() => {
                    setOverflow(false);
                    onNeverCame();
                  }}
                >
                  Didn’t order after all
                </Button>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
        {onChangeArrival ? (
          <ChangeDateSheet
            open={changeDate}
            item={item}
            onOpenChange={setChangeDate}
            onConfirm={(date) => {
              onChangeArrival(date);
              setChangeDate(false);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={subdued ? "secondary" : "default"}
        className={className ?? (compact ? "h-9 w-auto self-start px-4" : "h-10")}
        onClick={() => setPicker(true)}
      >
        Order
      </Button>

      <RetailerPickerSheet
        open={picker}
        item={item}
        household={household}
        onOpenChange={(open) => {
          setPicker(open);
          onPickerOpenChange?.(open);
        }}
        onSaveLink={onSaveLink}
        onPreferRetailer={onPreferRetailer}
        onAddSize={onAddSize}
        onAlreadyOrdered={() => {
          rememberRetailer();
          setAsk(true);
        }}
        onOpened={(retailer) => {
          rememberRetailer(retailer);
          if (!isNative() && document.visibilityState === "visible") {
            maybeAsk(retailer);
            return;
          }
          setWaitingResume(true);
        }}
      />

      <OrderConfirmSheet
        open={ask}
        item={item}
        retailer={pendingRetailer}
        onOpenChange={setAsk}
        onJustLooking={() => {
          lookingUntil.set(item.id, Date.now() + LOOKING_MS);
          setAsk(false);
        }}
        onConfirm={(details) => {
          onOrdered?.(details);
          setAsk(false);
          toast.success("Marked ordered", { description: item.itemName });
        }}
      />
      {receiveDialog}
    </>
  );
}

function OrderConfirmSheet({
  open,
  item,
  retailer,
  onOpenChange,
  onJustLooking,
  onConfirm,
}: {
  open: boolean;
  item: SupplyAutomation;
  retailer?: string;
  onOpenChange: (open: boolean) => void;
  onJustLooking: () => void;
  onConfirm: (details: MarkOrderedDetails) => void;
}) {
  const [step, setStep] = useState<"a" | "b">("a");
  const defaultOffset = closestArrivalOffset(leadTimeDaysFor(item));
  const [offset, setOffset] = useState<number | "date">(defaultOffset);
  const [dateDraft, setDateDraft] = useState(() => toISODate(addDays(new Date(), defaultOffset)));
  const [qty, setQty] = useState(Math.max(1, item.qtyPerOrder || 1));
  const size = (item.sku || item.sizeSpec || "").trim();
  const resetKey = `${open}:${item.id}:${item.qtyPerOrder}:${item.leadTimeDays}`;
  const [prevKey, setPrevKey] = useState(resetKey);
  if (open && prevKey !== resetKey) {
    setPrevKey(resetKey);
    setStep("a");
    const next = closestArrivalOffset(leadTimeDaysFor(item));
    setOffset(next);
    setDateDraft(toISODate(addDays(new Date(), next)));
    setQty(Math.max(1, item.qtyPerOrder || 1));
  }

  function arrivalDate() {
    if (offset === "date") return dateDraft;
    return toISODate(addDays(new Date(), offset));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0">
        {step === "a" ? (
          <>
            <SheetHeader>
              <SheetTitle>Did you order it?</SheetTitle>
              <SheetDescription>
                {item.itemName}
                {size ? ` · ${size}` : ""}
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-2 px-4 pb-4">
              <Button type="button" className="h-12" onClick={() => setStep("b")}>
                Yes, ordered
              </Button>
              <Button type="button" variant="secondary" className="h-12" onClick={() => onOpenChange(false)}>
                Not yet
              </Button>
              <Button type="button" variant="ghost" className="h-12" onClick={onJustLooking}>
                Just looking
              </Button>
            </div>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>When does it arrive?</SheetTitle>
              <SheetDescription>We’ll check in the day after it arrives.</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4 pb-4">
              <ArrivalChips
                offset={offset}
                dateDraft={dateDraft}
                onOffset={setOffset}
                onDate={setDateDraft}
              />
              <div className="grid gap-1.5">
                <p className="text-[13px] font-medium">How many?</p>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 w-10"
                    onClick={() => setQty((current) => Math.max(1, current - 1))}
                  >
                    −
                  </Button>
                  <span className="min-w-8 text-center text-[17px] font-medium">{qty}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 w-10"
                    onClick={() => setQty((current) => Math.min(99, current + 1))}
                  >
                    +
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                className="h-12"
                onClick={() =>
                  onConfirm({
                    expectedArrivalDate: arrivalDate(),
                    qty,
                    retailer: retailer || item.preferredRetailer,
                  })
                }
              >
                Done
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ChangeDateSheet({
  open,
  item,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  item: SupplyAutomation;
  onOpenChange: (open: boolean) => void;
  onConfirm: (date: string) => void;
}) {
  const defaultOffset = closestArrivalOffset(leadTimeDaysFor(item));
  const [offset, setOffset] = useState<number | "date">(item.expectedArrivalDate ? "date" : defaultOffset);
  const [dateDraft, setDateDraft] = useState(
    () => item.expectedArrivalDate ?? toISODate(addDays(new Date(), defaultOffset)),
  );
  const resetKey = `${open}:${item.id}:${item.expectedArrivalDate ?? ""}`;
  const [prevKey, setPrevKey] = useState(resetKey);
  if (open && prevKey !== resetKey) {
    setPrevKey(resetKey);
    setOffset(item.expectedArrivalDate ? "date" : defaultOffset);
    setDateDraft(item.expectedArrivalDate ?? toISODate(addDays(new Date(), defaultOffset)));
  }

  const arrivalDate = offset === "date" ? dateDraft : toISODate(addDays(new Date(), offset));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle>When does it arrive?</SheetTitle>
          <SheetDescription>{item.itemName}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <ArrivalChips offset={offset} dateDraft={dateDraft} onOffset={setOffset} onDate={setDateDraft} />
          <Button type="button" className="h-12" onClick={() => onConfirm(arrivalDate)}>
            Save date
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ArrivalChips({
  offset,
  dateDraft,
  onOffset,
  onDate,
}: {
  offset: number | "date";
  dateDraft: string;
  onOffset: (value: number | "date") => void;
  onDate: (value: string) => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {ARRIVAL_OFFSETS.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={offset === option.days ? "default" : "secondary"}
            className={cn("h-8 rounded-full")}
            onClick={() => {
              onOffset(option.days);
              onDate(toISODate(addDays(new Date(), option.days)));
            }}
          >
            {option.label}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={offset === "date" ? "default" : "secondary"}
          className="h-8 rounded-full"
          onClick={() => onOffset("date")}
        >
          Pick a date
        </Button>
      </div>
      {offset === "date" ? (
        <Input type="date" value={dateDraft} onChange={(event) => onDate(event.target.value)} className="h-11" />
      ) : null}
    </>
  );
}

function ReceiveDialog({
  open,
  qty,
  onQty,
  suggestedCost,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  qty: string;
  onQty: (value: string) => void;
  suggestedCost?: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (qty: number, paid?: number) => void;
}) {
  const [costDraft, setCostDraft] = useState(suggestedCost != null ? String(suggestedCost) : "");
  const parsedCost = Number(costDraft);
  const paid = Number.isFinite(parsedCost) && parsedCost >= 0 ? Math.round(parsedCost * 100) / 100 : undefined;

  function confirm(withCost: boolean) {
    const amount = Math.max(1, Number(qty) || 1);
    onConfirm(amount, withCost ? paid : undefined);
    toast.success("Marked received");
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>How many?</AlertDialogTitle>
          <AlertDialogDescription>Adds to what you have on hand and moves this back to Stocked.</AlertDialogDescription>
        </AlertDialogHeader>
        <Input type="number" min={1} value={qty} onChange={(event) => onQty(event.target.value)} className="h-11" />
        <p className="text-[13px] text-muted-foreground">What did it cost?</p>
        <Input
          inputMode="decimal"
          value={costDraft}
          onChange={(event) => setCostDraft(event.target.value)}
          placeholder="0.00"
          className="h-11"
          aria-label="What did it cost?"
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => confirm(false)}>Skip</AlertDialogAction>
          <AlertDialogAction onClick={() => confirm(true)}>Add to stock</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function retailerCaption(value?: string): string {
  if (!value) return "";
  return RETAILER_CHIPS.find((chip) => chip.id === value)?.label ?? value;
}

function arrivalLine(item: SupplyAutomation): string {
  if (!item.expectedArrivalDate) return "On the way";
  const store = retailerCaption(typeof item.preferredRetailer === "string" ? item.preferredRetailer : undefined);
  return `Arriving ${formatWeekdayDate(item.expectedArrivalDate)}${store ? ` · ${store}` : ""}`;
}

export function OrderByLine({
  item,
  household,
}: {
  item: SupplyAutomation;
  household: Pick<Household, "duties" | "completions" | "restockSafetyBufferDays">;
}) {
  const placement = restockPlacement(item, household);
  if (placement.bucket === "ordered" && item.expectedArrivalDate) {
    return <>{arrivalLine(item)}</>;
  }
  if (placement.bucket === "order_now" && item.onHand <= reorderAtFor(item)) {
    return (
      <>
        {orderNowOnHandCaption(item.onHand)}
      </>
    );
  }
  if (placement.orderByDate) return <>Order by {formatDueDate(placement.orderByDate)}</>;
  return <>Stocked</>;
}
