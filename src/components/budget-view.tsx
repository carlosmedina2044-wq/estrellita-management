"use client";

import { useMemo, useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { EmptyGuide } from "@/components/budget/empty-guide";
import { TeachingTip } from "@/components/teaching-tip";
import { FundHero } from "@/components/budget/hero";
import { DeferSheet, FundSheet, LogPurchaseSheet, ViewOptionsSheet } from "@/components/budget/sheets";
import { QuarterTimeline } from "@/components/budget/timeline";
import { InsightsList, SpendingSection, UpcomingExpenses } from "@/components/budget/upcoming";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import {
  applyDeferAsset,
  applyLogPurchase,
  applySetBigTicketThreshold,
  applySetHomeValue,
  applySetMaintenanceFund,
  budgetInsights,
  fundHealth,
  spendingSummary,
} from "@/lib/budget";
import { BIG_TICKET_THRESHOLD, buildForecast, formatCostRange, monthsUntil, type ForecastItem } from "@/lib/forecast";
import { shareText } from "@/lib/native/share";
import { hasSeenTip, markTipSeen, TIP_BUDGET_PRICES } from "@/lib/teaching";
import type { AppNavigateTarget, Household } from "@/lib/types";

function updateAsset(
  household: Household,
  assetId: string,
  patch: { installDate?: string; replacementCostEstimate?: number },
): Household {
  return {
    ...household,
    assets: household.assets.map((asset) => (asset.id === assetId ? { ...asset, ...patch } : asset)),
  };
}

export function BudgetView({
  household,
  onChange,
  onNavigate,
  onBack,
  backLabel,
}: {
  household: Household;
  onChange: (updater: (current: Household) => Household) => void;
  onNavigate?: (target: AppNavigateTarget) => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const { t, dateLocale } = useLocale();
  const [horizon, setHorizon] = useState<12 | 24 | 36>(12);
  const [fundOpen, setFundOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [logItem, setLogItem] = useState<ForecastItem | null>(null);
  const [deferItem, setDeferItem] = useState<ForecastItem | null>(null);
  const threshold = household.bigTicketThreshold ?? BIG_TICKET_THRESHOLD;
  const forecast = useMemo(
    () => buildForecast(household, horizon, new Date(), { bigTicketThreshold: threshold }),
    [household, horizon, threshold],
  );
  const forecast12 = useMemo(
    () => (horizon === 12 ? forecast : buildForecast(household, 12, new Date(), { bigTicketThreshold: threshold })),
    [forecast, household, horizon, threshold],
  );
  const health = useMemo(() => fundHealth(household, forecast12), [household, forecast12]);
  const insights = useMemo(() => budgetInsights(household, forecast12), [household, forecast12]);
  const spending = useMemo(
    () => spendingSummary(household, { months: 6, plannedMonthly: forecast12.suggestedMonthlySetAside }),
    [household, forecast12],
  );
  const empty = forecast.totals.total === 0;
  const updated = household.maintenanceFund?.updatedAt
    ? t("budget.fundUpdated", {
        date: new Date(household.maintenanceFund.updatedAt).toLocaleDateString(dateLocale, {
          month: "short",
          day: "numeric",
        }),
      })
    : t("budget.forecastUpdates");

  async function shareSummary() {
    const next = forecast.bigTicket[0];
    const lines = [
      t("budget.shareTitle"),
      health.saved != null
        ? t("budget.savedNeeded", {
            saved: health.saved.toLocaleString(dateLocale),
            needed: health.needed12.toLocaleString(dateLocale),
            pct: health.coveragePct ?? 0,
          })
        : t("budget.suggestedSetAside", { amount: health.suggestedMonthly.toLocaleString(dateLocale) }),
      next
        ? t("budget.nextBig", {
            label: next.label.replace(/ replacement$/i, ""),
            when: monthsUntil(next.month) <= 0 ? t("budget.dueNow") : t("budget.monthsAway", { count: monthsUntil(next.month) }),
            cost: formatCostRange(next.cost),
          })
        : null,
    ].filter(Boolean);
    const result = await shareText(t("budget.homeBudget"), lines.join("\n"));
    if (result === "copied") toast.success(t("budget.summaryCopied"));
    if (result === "failed") toast.error(t("budget.shareFailed"));
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-8">
      <PageHeader
        title={t("budget.title")}
        subtitle={updated}
        onBack={onBack}
        backLabel={backLabel}
        action={
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full text-foreground"
            aria-label={t("budget.viewOptions")}
            onClick={() => setOptionsOpen(true)}
          >
            <MoreHorizontal className="size-5" />
          </button>
        }
      />

      {empty ? (
        <>
          {!hasSeenTip(household, TIP_BUDGET_PRICES) ? (
            <TeachingTip onDismiss={() => onChange((current) => markTipSeen(current, TIP_BUDGET_PRICES))}>
              Add a date or a replacement cost on a big item and this tab becomes a forecast.
            </TeachingTip>
          ) : null}
          <EmptyGuide
            assets={household.assets}
            onUpdateAsset={(assetId, patch) => onChange((current) => updateAsset(current, assetId, patch))}
            onGoHome={() => onNavigate?.({ tab: "home" })}
          />
        </>
      ) : (
        <>
          <FundHero health={health} onEditFund={() => setFundOpen(true)} />
          <UpcomingExpenses
            items={forecast.bigTicket}
            assets={household.assets}
            rooms={household.rooms}
            onReplace={(item) => setLogItem(item)}
            onDefer={(item) => setDeferItem(item)}
          />
          <InsightsList insights={insights} />
          <QuarterTimeline
            forecast={forecast}
            onLogPurchase={(item) => setLogItem(item)}
            onUpdateEstimate={(assetId, amount) =>
              onChange((current) => updateAsset(current, assetId, { replacementCostEstimate: amount }))
            }
            onNavigate={onNavigate}
          />
          <SpendingSection
            planned={spending.planned}
            actual={spending.actual}
            months={spending.months}
            categories={spending.byCategory}
            byMonth={spending.byMonth}
          />
        </>
      )}

      {forecast.missingData.length > 0 && !empty ? (
        <section>
          <h2 className="ui-heading ui-title font-semibold">{t("budget.makeAccurate")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("budget.missingBody")}
          </p>
          <ul className="mt-3 grid gap-3">
            {forecast.missingData.map((item) => {
              const asset = household.assets.find((entry) => entry.id === item.assetId);
              return (
                <li key={item.assetId} className="rounded-2xl bg-card px-4 py-4">
                  <p className="font-medium">{item.name}</p>
                  <div className="mt-3 grid gap-3">
                    {item.missing.includes("installDate") ? (
                      <label className="grid gap-1.5">
                        <span className="text-sm text-muted-foreground">{t("budget.whenInstalled")}</span>
                        <Input
                          type="date"
                          className="h-12"
                          defaultValue={asset?.installDate}
                          onBlur={(event) =>
                            event.target.value &&
                            onChange((current) => updateAsset(current, item.assetId, { installDate: event.target.value }))
                          }
                        />
                      </label>
                    ) : null}
                    {item.missing.includes("cost") ? (
                      <label className="grid gap-1.5">
                        <span className="text-sm text-muted-foreground">{t("budget.whatWouldCost")}</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder={t("budget.whatWouldCost")}
                          className="h-12"
                          onBlur={(event) => {
                            const value = Number(event.target.value);
                            if (Number.isFinite(value) && value > 0) {
                              onChange((current) =>
                                updateAsset(current, item.assetId, { replacementCostEstimate: value }),
                              );
                            }
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <FundSheet
        open={fundOpen}
        balance={household.maintenanceFund?.balance}
        contribution={household.maintenanceFund?.monthlyContribution}
        onOpenChange={setFundOpen}
        onSave={(input) => onChange((current) => applySetMaintenanceFund(current, input))}
      />
      <LogPurchaseSheet
        open={Boolean(logItem)}
        item={logItem}
        onOpenChange={(open) => {
          if (!open) setLogItem(null);
        }}
        onSave={(input) => {
          if (!logItem) return;
          onChange((current) =>
            applyLogPurchase(current, {
              ...input,
              label: logItem.label,
              kind: logItem.kind,
              dutyId: logItem.dutyId,
              assetId: logItem.assetId,
              automationId: logItem.automationId,
              plannedCost: logItem.cost.mid,
              replacedAsset: logItem.kind === "replacement",
            }),
          );
        }}
      />
      <DeferSheet
        open={Boolean(deferItem)}
        item={deferItem}
        onOpenChange={(open) => {
          if (!open) setDeferItem(null);
        }}
        onSave={(months, reason) => {
          if (!deferItem?.assetId) return;
          onChange((current) => applyDeferAsset(current, deferItem.assetId!, months, reason));
        }}
      />
      <ViewOptionsSheet
        open={optionsOpen}
        horizon={horizon}
        threshold={threshold}
        homeValue={household.homeValueEstimate}
        onOpenChange={setOptionsOpen}
        onHorizon={setHorizon}
        onThreshold={(value) => onChange((current) => applySetBigTicketThreshold(current, value))}
        onHomeValue={(value) => onChange((current) => applySetHomeValue(current, value))}
        onShare={() => {
          void shareSummary();
        }}
      />
    </div>
  );
}
