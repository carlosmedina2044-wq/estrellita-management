"use client";

import { tActive } from "@/i18n";
import { tSpendingCategory } from "@/i18n/content";
import { useLocale } from "@/i18n/locale-provider";

import { Button } from "@/components/ui/button";
import { formatCostRange, formatMoney, monthsUntil, type ForecastItem } from "@/lib/forecast";
import type { HomeAsset, HomeRoom } from "@/lib/types";

function countdown(month: string): string {
  const months = monthsUntil(month);
  if (months <= 0) return tActive("budget.dueNow");
  if (months === 1) return tActive("budget.monthAway1");
  return tActive("budget.monthsAwayN", { count: months });
}

export function UpcomingExpenses({
  items,
  assets,
  rooms,
  onReplace,
  onDefer,
}: {
  items: ForecastItem[];
  assets: HomeAsset[];
  rooms: HomeRoom[];
  onReplace: (item: ForecastItem) => void;
  onDefer: (item: ForecastItem) => void;
}) {
  const { t } = useLocale();
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="ui-heading ui-title font-semibold">{t("budget.upcomingTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("budget.upcomingBody")}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("budget.noLarge")}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {items.map((item) => {
            const asset = assets.find((entry) => entry.id === item.assetId);
            const room = rooms.find((entry) => entry.id === asset?.roomId);
            const name = item.label.replace(/ replacement$/i, "");
            return (
              <li key={`${item.assetId}-${item.month}`} className="rounded-2xl bg-card px-4 py-4">
                <p className="font-medium">{name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {countdown(item.month)} · {formatCostRange(item.cost)}
                  {item.overdue ? t("budget.overdueSuffix") : ""}
                  {room ? ` · ${room.name}` : ""}
                </p>
                {asset?.deferReason ? (
                  <p className="mt-1 ui-caption text-muted-foreground">
                    {t("budget.waiting", { reason: asset.deferReason })}
                  </p>
                ) : null}
                {item.assetId ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button className="h-11" onClick={() => onReplace(item)}>
                      {t("budget.iReplaced")}
                    </Button>
                    <Button variant="secondary" className="h-11" onClick={() => onDefer(item)}>
                      {t("budget.illWait")}
                    </Button>
                  </div>
                ) : null}
                <p className="mt-2 ui-caption text-muted-foreground">{t("budget.loggingHint")}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function InsightsList({
  insights,
}: {
  insights: { id: string; tone: "info" | "warn" | "ok"; title: string; body: string }[];
}) {
  const { t } = useLocale();
  if (insights.length === 0) return null;
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="ui-heading ui-title font-semibold">{t("budget.whatThisMeans")}</h2>
      <ul className="mt-3 grid gap-3">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className="rounded-2xl bg-card px-4 py-4"
            data-tone={insight.tone}
          >
            <p className="font-medium">{insight.title}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{insight.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SpendingSection({
  planned,
  actual,
  months,
  categories,
  byMonth,
}: {
  planned: number;
  actual: number;
  months: number;
  categories: { category: string; actual: number; pct: number }[];
  byMonth: { month: string; actual: number }[];
}) {
  const { t, dateLocale } = useLocale();
  const logged = actual > 0;
  const delta = planned - actual;
  const planSuffix = logged && delta > 0 ? t("budget.underPlan") : logged && delta < 0 ? t("budget.overPlan") : ".";
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="ui-heading ui-title font-semibold">{t("budget.spending")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("budget.spendingSummary", {
          months,
          planned: formatMoney(planned),
          actual: formatMoney(actual),
        })}
        {planSuffix}
      </p>
      {!logged ? (
        <p className="mt-3 rounded-2xl bg-card px-4 py-4 text-sm text-muted-foreground">
          {t("budget.logHistoryHint")}
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          <ul className="rounded-2xl bg-card px-4 py-4">
            {byMonth.map((month) => {
              const [year, mon] = month.month.split("-").map(Number);
              const label = new Date(year, (mon ?? 1) - 1, 1).toLocaleDateString(dateLocale, {
                month: "short",
                year: "numeric",
              });
              return (
                <li key={month.month} className="flex items-center justify-between py-1.5 text-sm">
                  <span>{label}</span>
                  <span className="num text-muted-foreground">
                    {month.actual > 0 ? formatMoney(month.actual) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
          {categories.length > 0 ? (
            <ul className="rounded-2xl bg-card px-4 py-4">
              {categories.map((item) => (
                <li key={item.category} className="py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{tSpendingCategory(item.category)}</span>
                    <span className="text-muted-foreground">
                      {item.pct}% · {formatMoney(item.actual)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${item.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
