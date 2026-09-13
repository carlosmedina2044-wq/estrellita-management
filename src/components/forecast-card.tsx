"use client";

import { useLocale } from "@/i18n/locale-provider";
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
        className="w-full rounded-2xl bg-card px-4 py-4 text-left"
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
      className="w-full rounded-2xl border border-border/60 bg-accent px-4 py-4 text-left"
      onClick={() => onNavigate?.({ tab: "budget" })}
    >
      <p className="ui-caption font-medium text-muted-foreground">{t("budget.moneyForRepairs")}</p>
      <p className="ui-heading mt-1 ui-title font-semibold">
        {t("forecast.next90", { amount: formatMoney(Math.round(summary.next90)) })}
      </p>
      {nextLine ? <p className="mt-1 ui-caption text-muted-foreground">{nextLine}</p> : null}
      <span className="mt-3 inline-flex min-h-11 items-center ui-caption font-medium text-primary">
        {t("forecast.open")}
      </span>
    </button>
  );
}
