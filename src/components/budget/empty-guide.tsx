"use client";

import { useLocale } from "@/i18n/locale-provider";

import { BrandMark } from "@/components/brand-logo";
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
  const { t } = useLocale();
  const ranked = [...assets].sort((a, b) => {
    const aCost = catalogEntry(normalizeAssetType(a.type)).defaultReplacementCost.mid;
    const bCost = catalogEntry(normalizeAssetType(b.type)).defaultReplacementCost.mid;
    return bCost - aCost;
  }).slice(0, 3);

  if (ranked.length === 0) {
    return (
      <section className="rounded-2xl bg-card px-5 py-10 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-cream">
          <BrandMark size="sm" />
        </span>
        <p className="ui-heading mt-4 ui-title font-semibold">{t("budget.nothingPriced")}</p>
        <p className="mt-1 ui-body text-muted-foreground">
          {t("budget.nothingPricedBody")}
        </p>
        <Button className="mt-5 h-11 w-full" onClick={onGoHome}>
          {t("budget.goHome")}
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-card px-4 py-5">
      <p className="font-medium">{t("budget.priceBigItems")}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("budget.priceBigBody")}
      </p>
      <ul className="mt-4 grid gap-4">
        {ranked.map((asset) => {
          const catalog = catalogEntry(normalizeAssetType(asset.type));
          return (
            <li key={asset.id} className="grid gap-2">
              <p className="font-medium">{asset.name}</p>
              <label className="grid gap-1.5">
                <span className="text-sm text-muted-foreground">{t("budget.whenInstalled")}</span>
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
                  {t("budget.replacementTypical", {
                    low: formatMoney(catalog.defaultReplacementCost.low),
                    high: formatMoney(catalog.defaultReplacementCost.high),
                  })}
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
