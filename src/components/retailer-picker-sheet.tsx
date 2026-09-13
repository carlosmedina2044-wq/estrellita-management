"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
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
  onAlreadyOrdered,
}: {
  open: boolean;
  item: SupplyAutomation;
  household: Pick<Household, "preferredRetailers" | "savedRetailerLinks">;
  onOpenChange: (open: boolean) => void;
  onSaveLink?: (url: string) => void;
  onPreferRetailer?: (retailer: string) => void;
  onAddSize?: () => void;
  onOpened?: (retailer?: string) => void;
  onAlreadyOrdered?: () => void;
}) {
  const { t } = useLocale();
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
      toast.error(t("restock.retailerOpenError"));
      return;
    }
    onOpened?.(retailer);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle>{item.itemName}</SheetTitle>
          <SheetDescription className="sr-only">Choose a store to order {item.itemName}.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4 pb-4">
          {onAlreadyOrdered ? (
            <Button
              type="button"
              variant="secondary"
              className="h-12 w-full"
              onClick={() => {
                onAlreadyOrdered();
                onOpenChange(false);
              }}
            >
              I already ordered it
            </Button>
          ) : null}
          <div className="ui-caption text-muted-foreground">
            {size ? (
              size
            ) : onAddSize ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center text-left text-primary"
                onClick={() => {
                  onOpenChange(false);
                  onAddSize();
                }}
              >
                No size saved · Add
              </button>
            ) : (
              t("restock.noSizeSaved")
            )}
          </div>
          {href ? (
            <div className="grid gap-1">
              <Button type="button" className="h-12 w-full" onClick={() => void shop(href, item.preferredRetailer, href)}>
                {t("retailer.openSaved")}
              </Button>
              <p className="text-center ui-caption text-muted-foreground">{savedRetailerLabel(href)}</p>
            </div>
          ) : null}
          <div className="grid gap-2">
            <p className="ui-caption font-medium">{t("retailer.stores")}</p>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span key={chip.id} className="grid justify-items-center gap-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-11 rounded-full"
                    onClick={() => void shop(chip.searchUrl(query), chip.id)}
                  >
                    {chip.label}
                  </Button>
                  {chip.lastTime ? (
                    <span className="ui-caption text-muted-foreground">{t("retailer.lastTime")}</span>
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
                  className="h-11 max-w-full rounded-full"
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
          <p className="ui-caption text-muted-foreground">
            {t("retailer.privacy")}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CustomStoreSearch({
  itemName,
  sizeSpec,
  onSearch,
}: {
  itemName: string;
  sizeSpec?: string;
  onSearch: (saveUrl: string, openUrl: string) => void;
}) {
  const { t } = useLocale();
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
      <p className="ui-caption text-muted-foreground">Any other store</p>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("restock.customUrlPlaceholder")}
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
