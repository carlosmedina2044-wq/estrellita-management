"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { openExternalUrl } from "@/lib/native/open-url";
import { parseRetailerInput, retailerSearchUrl, retailerUrlFor, RETAILER_CHIPS } from "@/lib/retailer";
import { restockPlacement } from "@/lib/restock";
import { formatDueDate } from "@/lib/dates";
import type { Household, SupplyAutomation } from "@/lib/types";

export function RestockOrderButton({
  item,
  household,
  onOrdered,
  onReceived,
  onSaveLink,
  className,
}: {
  item: SupplyAutomation;
  household: Pick<Household, "duties" | "completions">;
  onOrdered?: () => void;
  onReceived?: (qty: number) => void;
  onSaveLink?: (url: string) => void;
  className?: string;
}) {
  const [ask, setAsk] = useState(false);
  const [receive, setReceive] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState(item.retailerUrl || "");
  const [qtyDraft, setQtyDraft] = useState(String(item.qtyPerOrder || 1));
  const placement = restockPlacement(item, household);
  const href = retailerUrlFor(item);
  const arriving = placement.bucket === "ordered";
  const primary = href ? "Order" : "Find it";

  async function openHref(url: string) {
    const opened = await openExternalUrl(url);
    if (!opened) {
      toast.error("Couldn’t open the retailer. Check your browser pop-up setting.");
    }
    setAsk(true);
  }

  if (arriving) {
    return (
      <div className="grid gap-2">
        <p className="text-[13px] text-muted-foreground">Arriving ~{item.expectedArrivalDate}</p>
        {onReceived ? (
          <Button type="button" className={className ?? "h-10"} onClick={() => setReceive(true)}>
            Received
          </Button>
        ) : null}
        <ReceiveDialog
          open={receive}
          qty={qtyDraft}
          onQty={setQtyDraft}
          onOpenChange={setReceive}
          onConfirm={() => onReceived?.(Math.max(1, Number(qtyDraft) || item.qtyPerOrder || 1))}
        />
      </div>
    );
  }

  return (
    <>
      {href ? (
        <Button type="button" className={className ?? "h-10"} onClick={() => void openHref(href)}>
          {primary}
        </Button>
      ) : (
        <div className="grid gap-2">
          <p className="text-[13px] font-medium">{primary}</p>
          <div className="flex flex-wrap gap-1.5">
            {RETAILER_CHIPS.map((chip) => (
              <Button
                key={chip.id}
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 rounded-full"
                onClick={() => void openHref(retailerSearchUrl(chip.id, item.itemName))}
              >
                {chip.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      {placement.nudgeArrive ? (
        <p className="mt-2 text-[13px] text-muted-foreground">Did it arrive?</p>
      ) : null}
      {placement.nudgeArrive && onReceived ? (
        <Button type="button" variant="secondary" className="mt-2 h-10" onClick={() => setReceive(true)}>
          Received
        </Button>
      ) : null}

      <AlertDialog open={ask} onOpenChange={setAsk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Did you order it?</AlertDialogTitle>
            <AlertDialogDescription>
              {item.itemName}. Yes sets expected arrival and hides it from Order now until it should be here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {savingLink ? (
            <div className="grid gap-2">
              <Input
                value={linkDraft}
                onChange={(event) => setLinkDraft(event.target.value)}
                placeholder="https://…"
                className="h-11"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const parsed = parseRetailerInput(linkDraft);
                  if (!parsed.ok) {
                    toast.error(parsed.error);
                    return;
                  }
                  onSaveLink?.(parsed.url);
                  setSavingLink(false);
                  toast.success("Link saved");
                }}
              >
                Save link
              </Button>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            {onSaveLink && !savingLink ? (
              <Button type="button" variant="secondary" onClick={() => setSavingLink(true)}>
                Save this link
              </Button>
            ) : null}
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
        onOpenChange={setReceive}
        onConfirm={() => onReceived?.(Math.max(1, Number(qtyDraft) || item.qtyPerOrder || 1))}
      />
    </>
  );
}

function ReceiveDialog({
  open,
  qty,
  onQty,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  qty: string;
  onQty: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>How many?</AlertDialogTitle>
          <AlertDialogDescription>Adds to what you have on hand and moves this back to Stocked.</AlertDialogDescription>
        </AlertDialogHeader>
        <Input type="number" min={1} value={qty} onChange={(event) => onQty(event.target.value)} className="h-11" />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              toast.success("Marked received");
            }}
          >
            Add to stock
          </AlertDialogAction>
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
    return <>Arriving ~{formatDueDate(item.expectedArrivalDate)}</>;
  }
  if (placement.orderByDate) return <>Order by {formatDueDate(placement.orderByDate)}</>;
  return <>Stocked</>;
}
