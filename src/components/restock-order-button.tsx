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
import {
  resolveRetailerEntry,
  retailerSearchUrl,
  retailerUrlFor,
  RETAILER_CHIPS,
  savedRetailerLabel,
  sortedSavedRetailerLinks,
} from "@/lib/retailer";
import { restockPlacement, reorderAtFor } from "@/lib/restock";
import { formatDueDate } from "@/lib/dates";
import type { Household, SupplyAutomation } from "@/lib/types";

export function RestockOrderButton({
  item,
  household,
  onOrdered,
  onReceived,
  onSaveLink,
  className,
  compact,
}: {
  item: SupplyAutomation;
  household: Pick<Household, "duties" | "completions" | "savedRetailerLinks">;
  onOrdered?: () => void;
  onReceived?: (qty: number) => void;
  onSaveLink?: (url: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const [ask, setAsk] = useState(false);
  const [receive, setReceive] = useState(false);
  const [linkDraft, setLinkDraft] = useState(item.retailerUrl || "");
  const [qtyDraft, setQtyDraft] = useState(String(item.qtyPerOrder || 1));
  const placement = restockPlacement(item, household);
  const href = retailerUrlFor(item);
  const arriving = placement.bucket === "ordered";
  const savedLinks = sortedSavedRetailerLinks(household.savedRetailerLinks ?? []).filter(
    (entry) => entry.url !== href,
  );

  async function openHref(url: string) {
    const opened = await openExternalUrl(url);
    if (!opened) {
      toast.error("Couldn’t open the retailer. Check your browser pop-up setting.");
    }
    setAsk(true);
  }

  function applyEntry(saveUrl: string, openUrl: string) {
    setLinkDraft(saveUrl);
    onSaveLink?.(saveUrl);
    void openHref(openUrl);
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
        <Button type="button" className={className ?? (compact ? "h-12" : "h-10")} onClick={() => void openHref(href)}>
          Order
        </Button>
      ) : (
        <p className="text-[13px] font-medium">Find it</p>
      )}
      {href && compact ? null : (
      <div className="mt-2 grid gap-2">
        <div className="flex flex-wrap gap-1.5">
          {!href
            ? RETAILER_CHIPS.map((chip) => (
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
              ))
            : null}
          {savedLinks.slice(0, 6).map((entry) => (
            <Button
              key={entry.url}
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 max-w-full rounded-full"
              onClick={() => applyEntry(entry.url, entry.url)}
            >
              <span className="truncate">{savedRetailerLabel(entry.url)}</span>
            </Button>
          ))}
        </div>
        <CustomStoreSearch itemName={item.itemName} onSearch={applyEntry} />
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
              {item.itemName}. If you ordered it, we’ll hide this until it should arrive.
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
                  const resolved = resolveRetailerEntry(linkDraft, item.itemName);
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
        onOpenChange={setReceive}
        onConfirm={() => onReceived?.(Math.max(1, Number(qtyDraft) || item.qtyPerOrder || 1))}
      />
    </>
  );
}

function CustomStoreSearch({
  itemName,
  onSearch,
}: {
  itemName: string;
  onSearch: (saveUrl: string, openUrl: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function go() {
    const resolved = resolveRetailerEntry(draft, itemName);
    if (!resolved.ok) {
      toast.error(resolved.error);
      return;
    }
    onSearch(resolved.saveUrl, resolved.openUrl);
    setDraft("");
  }

  return (
    <div className="grid gap-1.5">
      <p className="text-[13px] text-muted-foreground">Or any other store</p>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="ebay.com or paste a link"
          className="h-10 min-w-0 flex-1"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              go();
            }
          }}
        />
        <Button type="button" variant="secondary" className="h-10 shrink-0 px-3" onClick={go}>
          Search
        </Button>
      </div>
    </div>
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
