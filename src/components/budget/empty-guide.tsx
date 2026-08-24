"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { catalogEntry, normalizeAssetType } from "@/lib/asset-catalog";
import { formatMoney } from "@/lib/forecast";
import type { HomeAsset } from "@/lib/types";

export function EmptyGuide({
  assets,
  onUpdateAsset,
  onGoHome,
}: {
  assets: HomeAsset[];
  onUpdateAsset: (assetId: string, patch: { installDate?: string; replacementCostEstimate?: number }) => void;
  onGoHome?: () => void;
}) {
  const ranked = [...assets].sort((a, b) => {
    const aCost = catalogEntry(normalizeAssetType(a.type)).defaultReplacementCost.mid;
    const bCost = catalogEntry(normalizeAssetType(b.type)).defaultReplacementCost.mid;
    return bCost - aCost;
  }).slice(0, 3);

  if (ranked.length === 0) {
    return (
      <section className="rounded-2xl bg-white px-4 py-5">
        <p className="font-medium">Nothing priced yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a date or cost on Home so we can estimate upkeep and replacements.
        </p>
        <Button className="mt-4 h-11 w-full" onClick={onGoHome}>
          Go to Home
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white px-4 py-5">
      <p className="font-medium">Price a few big items to get a forecast</p>
      <p className="mt-1 text-sm text-muted-foreground">
        A date and a replacement cost is enough. We’ll fill typical ranges if you skip the price.
      </p>
      <ul className="mt-4 grid gap-4">
        {ranked.map((asset) => {
          const catalog = catalogEntry(normalizeAssetType(asset.type));
          return (
            <li key={asset.id} className="grid gap-2">
              <p className="font-medium">{asset.name}</p>
              <label className="grid gap-1.5">
                <span className="text-sm text-muted-foreground">When was this installed or last replaced?</span>
                <Input
                  type="date"
                  className="h-12"
                  defaultValue={asset.installDate}
                  onBlur={(event) =>
                    event.target.value && onUpdateAsset(asset.id, { installDate: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm text-muted-foreground">
                  Replacement cost (typical {formatMoney(catalog.defaultReplacementCost.low)}–
                  {formatMoney(catalog.defaultReplacementCost.high)})
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder={String(catalog.defaultReplacementCost.mid)}
                  className="h-12"
                  defaultValue={asset.replacementCostEstimate ?? asset.purchasePrice ?? ""}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value) && value > 0) {
                      onUpdateAsset(asset.id, { replacementCostEstimate: value });
                    }
                  }}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
