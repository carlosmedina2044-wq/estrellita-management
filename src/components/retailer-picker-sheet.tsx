"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { openExternalUrl } from "@/lib/native/open-url";
import {
  isProductPageUrl,
  orderedRetailerChips,
  resolveRetailerEntry,
  retailerUrlFor,
  savedRetailerLabel,
  searchQueryFor,
  sortedSavedRetailerLinks,
} from "@/lib/retailer";
import type { Household, SupplyAutomation } from "@/lib/types";

export function RetailerPickerSheet({
  open,
  item,
  household,
  onOpenChange,
  onSaveLink,
  onPreferRetailer,
  onAddSize,
  onOpened,
}: {
  open: boolean;
  item: SupplyAutomation;
  household: Pick<Household, "preferredRetailers" | "savedRetailerLinks">;
  onOpenChange: (open: boolean) => void;
  onSaveLink?: (url: string) => void;
  onPreferRetailer?: (retailer: string) => void;
  onAddSize?: () => void;
  onOpened?: (retailer?: string) => void;
}) {
  const href = retailerUrlFor(item);
  const size = (item.sku || item.sizeSpec || "").trim();
  const chips = orderedRetailerChips(household, item);
  const query = searchQueryFor({ itemName: item.itemName, sku: size });
  const savedLinks = sortedSavedRetailerLinks(household.savedRetailerLinks ?? [])
    .filter((entry) => entry.url !== href)
    .slice(0, 4);

  async function shop(openUrl: string, retailer?: string, saveUrl?: string) {
    if (retailer) onPreferRetailer?.(retailer);
    if (saveUrl && isProductPageUrl(saveUrl)) onSaveLink?.(saveUrl);
    const opened = await openExternalUrl(openUrl);
    if (!opened) {
      toast.error("Couldn’t open the retailer. Check your browser pop-up setting.");
      return;
    }
    onOpenChange(false);
    onOpened?.(retailer);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle>{item.itemName}</SheetTitle>
          <SheetDescription className="sr-only">Choose a store to order {item.itemName}.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          <div className="text-[13px] text-muted-foreground">
            {size ? (
              size
            ) : onAddSize ? (
              <button
                type="button"
                className="text-left text-primary"
                onClick={() => {
                  onOpenChange(false);
                  onAddSize();
                }}
              >
                No size saved · Add
              </button>
            ) : (
              "No size saved"
            )}
          </div>
          {href ? (
            <div className="grid gap-1">
              <Button type="button" className="h-12 w-full" onClick={() => void shop(href, item.preferredRetailer, href)}>
                Open saved link
              </Button>
              <p className="text-center text-[13px] text-muted-foreground">{savedRetailerLabel(href)}</p>
            </div>
          ) : null}
          <div className="grid gap-2">
            <p className="text-[13px] font-medium">Stores</p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span key={chip.id} className="grid justify-items-center gap-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 rounded-full"
                    onClick={() => void shop(chip.searchUrl(query), chip.id)}
                  >
                    {chip.label}
                  </Button>
                  {chip.lastTime ? (
                    <span className="text-[11px] text-muted-foreground">Last time</span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
          {savedLinks.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {savedLinks.map((entry) => (
                <Button
                  key={entry.url}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 max-w-full rounded-full"
                  onClick={() => void shop(entry.url, hostOf(entry.url), entry.url)}
                >
                  <span className="truncate">{savedRetailerLabel(entry.url)}</span>
                </Button>
              ))}
            </div>
          ) : null}
          <CustomStoreSearch
            itemName={item.itemName}
            sizeSpec={size || undefined}
            onSearch={(saveUrl, openUrl) => void shop(openUrl, hostOf(saveUrl), saveUrl)}
          />
          <p className="text-[13px] text-muted-foreground">
            You check out on the store’s site. Cuidala never sees your payment.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function CustomStoreSearch({
  itemName,
  sizeSpec,
  onSearch,
}: {
  itemName: string;
  sizeSpec?: string;
  onSearch: (saveUrl: string, openUrl: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function go() {
    const resolved = resolveRetailerEntry(draft, itemName, sizeSpec);
    if (!resolved.ok) {
      toast.error(resolved.error);
      return;
    }
    onSearch(resolved.saveUrl, resolved.openUrl);
    setDraft("");
  }

  return (
    <div className="grid gap-1.5">
      <p className="text-[13px] text-muted-foreground">Any other store</p>
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

function hostOf(value: string): string | undefined {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.replace(/^www\./i, "");
  } catch {
    return undefined;
  }
}
