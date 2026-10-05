"use client";

import { useLocale } from "@/i18n/locale-provider";
import { ChevronRight } from "lucide-react";
import { forecastCardSummary, formatMoney, monthsUntil } from "@/lib/forecast";
import type { AppNavigateTarget, Household } from "@/lib/types";

export function ForecastCard({
  household,
  now,
  onNavigate,
  onAddInstallDate,
}: {
  household: Household;
  now?: Date;
  onNavigate?: (target: AppNavigateTarget) => void;
  onAddInstallDate?: () => void;
}) {
  const { t } = useLocale();
  const at = now ?? new Date();
  const summary = forecastCardSummary(household, at);

  if (summary.empty) {
    return (
      <button
        type="button"
        className="w-full rounded-[var(--r-container)] bg-card px-4 py-4 text-left"
        onClick={onAddInstallDate}
      >
        <p className="ui-body text-muted-foreground">{t("forecast.emptyBody")}</p>
        <span className="mt-3 inline-flex min-h-11 items-center ui-caption font-medium text-primary">
          {t("forecast.openAppliances")}
        </span>
      </button>
    );
  }

  const nextLine = summary.nextBigTicket
    ? `${summary.nextBigTicket.label} · ${formatMoney(summary.nextBigTicket.mid)}${
        monthsUntil(summary.nextBigTicket.month, at) <= 0
          ? t("forecast.dueNow")
          : t("forecast.inMonths", { count: monthsUntil(summary.nextBigTicket.month, at) })
      }`
    : null;

  return (
    <button
      type="button"
      className="ui-group flex w-full items-center gap-3 px-4 py-3 text-left ui-press"
      onClick={() => onNavigate?.({ tab: "budget" })}
    >
      <span className="min-w-0 flex-1">
        <span className="block ui-caption text-muted-foreground">{t("budget.moneyForRepairs")}</span>
        <span className="block ui-card num">
          {t("forecast.next3", { amount: formatMoney(Math.round(summary.next3)) })}
        </span>
        {nextLine ? <span className="mt-0.5 block ui-caption num text-muted-foreground">{nextLine}</span> : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">{t("forecast.open")}</span>
    </button>
  );
}
