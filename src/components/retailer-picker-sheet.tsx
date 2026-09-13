"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { ChevronRight } from "lucide-react";
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
import { formatWeekdayDate } from "@/lib/dates";
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
import { cn } from "@/lib/utils";

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
  embedded = false,
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
  /** Render inside a parent sheet instead of nesting another dialog. */
  embedded?: boolean;
}) {
  const { t } = useLocale();
  const href = retailerUrlFor(item);
  const size = (item.sku || item.sizeSpec || "").trim();
  const chips = orderedRetailerChips(household, item);
  const query = searchQueryFor({ itemName: item.itemName, sku: size });
  const savedLinks = sortedSavedRetailerLinks(household.savedRetailerLinks ?? [])
    .filter((entry) => entry.url !== href)
    .slice(0, 4);
  const lastChip = chips.find((chip) => chip.lastTime);
  const lastOrderedAt = item.orderedAt ? formatWeekdayDate(item.orderedAt) : null;

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

  const body = (
    <>
      <SheetHeader className={embedded ? "px-0 pt-0" : undefined}>
        <SheetTitle className="min-w-0 flex-1 truncate">{item.itemName}</SheetTitle>
        <SheetDescription className="sr-only">{t("restock.chooseStore", { name: item.itemName })}</SheetDescription>
      </SheetHeader>
      <div className={cn("grid gap-3 pb-4", embedded ? "px-0" : "px-4")}>
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
              {t("restock.noSizeAdd")}
            </button>
          ) : (
            t("restock.noSizeSaved")
          )}
        </div>

        {lastChip || href ? (
          <button
            type="button"
            className="ui-group flex w-full items-center gap-3 bg-signal-soft px-4 py-3 text-left active:bg-foreground/6"
            onClick={() => {
              if (href) {
                void shop(href, item.preferredRetailer, href);
                return;
              }
              if (lastChip) void shop(lastChip.searchUrl(query), lastChip.id);
            }}
          >
            <span className="min-w-0 flex-1">
              <span className="block ui-body font-medium text-foreground">
                {t("retailer.lastTimeRow", {
                  store: lastChip?.label ?? savedRetailerLabel(href ?? ""),
                  when: lastOrderedAt ?? t("retailer.lastTime"),
                })}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ) : null}

        <div className="ui-group">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="ui-group-row flex w-full items-center gap-3 px-4 text-left active:bg-foreground/6"
              onClick={() => void shop(chip.searchUrl(query), chip.id)}
            >
              <span className="min-w-0 flex-1 ui-body font-medium">{chip.label}</span>
              {chip.lastTime ? (
                <span className="ui-caption text-muted-foreground">{t("retailer.lastTime")}</span>
              ) : null}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          ))}
          {savedLinks.map((entry) => (
            <button
              key={entry.url}
              type="button"
              className="ui-group-row flex w-full items-center gap-3 px-4 text-left active:bg-foreground/6"
              onClick={() => void shop(entry.url, hostOf(entry.url), entry.url)}
            >
              <span className="min-w-0 flex-1 truncate ui-body font-medium">
                {savedRetailerLabel(entry.url)}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          ))}
        </div>

        <CustomStoreSearch
          itemName={item.itemName}
          sizeSpec={size || undefined}
          onSearch={(saveUrl, openUrl) => void shop(openUrl, hostOf(saveUrl), saveUrl)}
        />

        <p className="ui-caption text-muted-foreground">{t("retailer.privacy")}</p>

        {onAlreadyOrdered ? (
          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center justify-center ui-body font-medium text-primary"
            onClick={() => {
              onAlreadyOrdered();
              onOpenChange(false);
            }}
          >
            {t("restock.alreadyOrdered")}
          </button>
        ) : null}
      </div>
    </>
  );

  if (embedded) {
    if (!open) return null;
    return <div className="grid gap-0">{body}</div>;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0">
        {body}
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
      <p className="ui-caption text-muted-foreground">{t("retailer.pasteLink")}</p>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("restock.customUrlPlaceholder")}
          className="h-11 min-w-0 flex-1 rounded-[var(--r-input)]"
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
        <Button type="button" variant="secondary" className="h-11 shrink-0 px-3" onClick={go}>
          {t("common.search")}
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
