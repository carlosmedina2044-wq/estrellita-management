"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { EmptyGuide } from "@/components/budget/empty-guide";
import { FundHero } from "@/components/budget/hero";
import { DeferSheet, FundSheet, LogPurchaseSheet, ViewOptionsSheet } from "@/components/budget/sheets";
import { QuarterTimeline } from "@/components/budget/timeline";
import { InsightsList, SpendingSection, UpcomingExpenses } from "@/components/budget/upcoming";
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
}: {
  household: Household;
  onChange: (updater: (current: Household) => Household) => void;
  onNavigate?: (target: AppNavigateTarget) => void;
}) {
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
    ? `Fund updated ${new Date(household.maintenanceFund.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : "Forecast updates as you log purchases";

  async function shareSummary() {
    const next = forecast.bigTicket[0];
    const lines = [
      "Cuidala home budget",
      health.saved != null
        ? `${health.saved.toLocaleString("en-US")} saved · ${health.needed12.toLocaleString("en-US")} needed in 12 months · ${health.coveragePct}% covered`
        : `Suggested set-aside ${health.suggestedMonthly.toLocaleString("en-US")}/month`,
      next
        ? `Next big expense: ${next.label.replace(/ replacement$/i, "")}, ${monthsUntil(next.month) <= 0 ? "due now" : `~${monthsUntil(next.month)} months`} · ${formatCostRange(next.cost)}`
        : null,
    ].filter(Boolean);
    const result = await shareText("Home budget", lines.join("\n"));
    if (result === "copied") toast.success("Summary copied");
    if (result === "failed") toast.error("Couldn’t share that");
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Home finances</p>
          <h1 className="ui-heading text-[34px] font-semibold tracking-tight">Budget</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{updated}</p>
        </div>
        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-full text-foreground"
          aria-label="View options"
          onClick={() => setOptionsOpen(true)}
        >
          <MoreHorizontal className="size-5" />
        </button>
      </header>

      {empty ? (
        <EmptyGuide
          assets={household.assets}
          onUpdateAsset={(assetId, patch) => onChange((current) => updateAsset(current, assetId, patch))}
          onGoHome={() => onNavigate?.({ tab: "home" })}
        />
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
          <h2 className="ui-heading text-[20px] font-semibold">Make this more accurate</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A date or cost is missing, so this item isn’t fully in the forecast yet.
          </p>
          <ul className="mt-3 grid gap-3">
            {forecast.missingData.map((item) => {
              const asset = household.assets.find((entry) => entry.id === item.assetId);
              return (
                <li key={item.assetId} className="rounded-2xl bg-white px-4 py-4">
                  <p className="font-medium">{item.name}</p>
                  <div className="mt-3 grid gap-3">
                    {item.missing.includes("installDate") ? (
                      <label className="grid gap-1.5">
                        <span className="text-sm text-muted-foreground">When was this installed or last replaced?</span>
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
                        <span className="text-sm text-muted-foreground">What would it cost to replace?</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="Replacement cost"
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
