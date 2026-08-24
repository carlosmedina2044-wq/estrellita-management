"use client";

import { useState } from "react";
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
import { resolveRetailerEntry } from "@/lib/retailer";
import { restockPlacement, reorderAtFor } from "@/lib/restock";
import { formatDueDate } from "@/lib/dates";
import type { Household, SupplyAutomation } from "@/lib/types";

export function RestockOrderButton({
  item,
  household,
  onOrdered,
  onReceived,
  onSaveLink,
  onPreferRetailer,
  onAddSize,
  className,
  compact,
}: {
  item: SupplyAutomation;
  household: Pick<Household, "duties" | "completions" | "savedRetailerLinks" | "consumables" | "preferredRetailers">;
  onOrdered?: () => void;
  onReceived?: (qty: number, paid?: number) => void;
  onSaveLink?: (url: string) => void;
  onPreferRetailer?: (retailer: string) => void;
  onAddSize?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const [picker, setPicker] = useState(false);
  const [ask, setAsk] = useState(false);
  const [receive, setReceive] = useState(false);
  const [linkDraft, setLinkDraft] = useState(item.retailerUrl || "");
  const [qtyDraft, setQtyDraft] = useState(String(item.qtyPerOrder || 1));
  const placement = restockPlacement(item, household);
  const arriving = placement.bucket === "ordered";
  const linkedConsumable = (household.consumables ?? []).find(
    (entry) => entry.nodeId === item.nodeId || entry.assetId === item.nodeId || entry.name === item.itemName,
  );
  const suggestedCost = item.lastPaidPrice ?? item.unitCost ?? linkedConsumable?.lastPaidPrice ?? linkedConsumable?.unitCost;

  if (arriving) {
    return (
      <div className="grid gap-2">
        <p className="text-[13px] text-muted-foreground">
          Arriving {item.expectedArrivalDate ? formatDueDate(item.expectedArrivalDate) : ""}
        </p>
        {onReceived ? (
          <Button type="button" className={className ?? "h-10"} onClick={() => setReceive(true)}>
            Received
          </Button>
        ) : null}
        <ReceiveDialog
          open={receive}
          qty={qtyDraft}
          onQty={setQtyDraft}
          suggestedCost={suggestedCost}
          onOpenChange={setReceive}
          onConfirm={(qty, paid) => onReceived?.(qty, paid)}
        />
      </div>
    );
  }

  return (
    <>
      <Button type="button" className={className ?? (compact ? "h-12" : "h-10")} onClick={() => setPicker(true)}>
        Order
      </Button>
      {placement.nudgeArrive ? (
        <p className="mt-2 text-[13px] text-muted-foreground">Did it arrive?</p>
      ) : null}
      {placement.nudgeArrive && onReceived ? (
        <Button type="button" variant="secondary" className="mt-2 h-10" onClick={() => setReceive(true)}>
          Received
        </Button>
      ) : null}

      <RetailerPickerSheet
        open={picker}
        item={item}
        household={household}
        onOpenChange={setPicker}
        onSaveLink={onSaveLink}
        onPreferRetailer={onPreferRetailer}
        onAddSize={onAddSize}
        onOpened={() => setAsk(true)}
      />

      <AlertDialog open={ask} onOpenChange={setAsk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Did you order it?</AlertDialogTitle>
            <AlertDialogDescription>
              {item.itemName}
              {item.sizeSpec ? ` · ${item.sizeSpec}` : ""}. If you ordered it, we’ll hide this until it should arrive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {onSaveLink ? (
            <div className="grid gap-2">
              <Input
                value={linkDraft}
                onChange={(event) => setLinkDraft(event.target.value)}
                placeholder="ebay.com or paste the listing"
                className="h-11"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const resolved = resolveRetailerEntry(linkDraft, item.itemName, item.sizeSpec);
                  if (!resolved.ok) {
                    toast.error(resolved.error);
                    return;
                  }
                  onSaveLink(resolved.saveUrl);
                  setLinkDraft(resolved.saveUrl);
                  toast.success("Link saved");
                }}
              >
                Save this link
              </Button>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            {onOrdered ? (
              <AlertDialogAction
                onClick={() => {
                  onOrdered();
                  toast.success("Marked ordered", { description: item.itemName });
                }}
              >
                Yes
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReceiveDialog
        open={receive}
        qty={qtyDraft}
        onQty={setQtyDraft}
        suggestedCost={suggestedCost}
        onOpenChange={setReceive}
        onConfirm={(qty, paid) => onReceived?.(qty, paid)}
      />
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

export function OrderByLine({
  item,
  household,
}: {
  item: SupplyAutomation;
  household: Pick<Household, "duties" | "completions">;
}) {
  const placement = restockPlacement(item, household);
  if (placement.bucket === "ordered" && item.expectedArrivalDate) {
    return <>Arriving {formatDueDate(item.expectedArrivalDate)}</>;
  }
  if (placement.bucket === "order_now" && item.onHand <= reorderAtFor(item)) {
    return (
      <>
        On hand {item.onHand} · order now
      </>
    );
  }
  if (placement.orderByDate) return <>Order by {formatDueDate(placement.orderByDate)}</>;
  return <>Stocked</>;
}
