"use client";

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
  const at = now ?? new Date();
  const summary = forecastCardSummary(household, at);

  if (summary.empty) {
    return (
      <button
        type="button"
        className="w-full rounded-2xl bg-card px-4 py-4 text-left"
        onClick={onAddInstallDate}
      >
        <p className="ui-body text-muted-foreground">
          Add an install date to any appliance to see what&apos;s coming
        </p>
        <span className="mt-3 inline-flex min-h-11 items-center ui-caption font-medium text-primary">
          Open appliances
        </span>
      </button>
    );
  }

  const nextLine = summary.nextBigTicket
    ? `${summary.nextBigTicket.label} · ${formatMoney(summary.nextBigTicket.mid)}${
        monthsUntil(summary.nextBigTicket.month, at) <= 0
          ? " · due now"
          : ` · in ${monthsUntil(summary.nextBigTicket.month, at)} mo`
      }`
    : null;

  return (
    <button
      type="button"
      className="w-full rounded-2xl border border-border/60 bg-accent px-4 py-4 text-left"
      onClick={() => onNavigate?.({ tab: "budget" })}
    >
      <p className="ui-caption font-medium text-muted-foreground">Replacement forecast</p>
      <p className="ui-heading mt-1 ui-title font-semibold">
        Next 90 days: ~{formatMoney(Math.round(summary.next90))}
      </p>
      {nextLine ? <p className="mt-1 ui-caption text-muted-foreground">{nextLine}</p> : null}
      <span className="mt-3 inline-flex min-h-11 items-center ui-caption font-medium text-primary">
        Open forecast
      </span>
    </button>
  );
}
