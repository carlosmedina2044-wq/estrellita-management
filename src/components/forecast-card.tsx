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
  const summary = forecastCardSummary(household, now ?? new Date());

  if (summary.empty) {
    return (
      <section className="rounded-2xl bg-card px-4 py-4">
        <p className="text-[15px] text-muted-foreground">
          Add an install date to any appliance to see what&apos;s coming
        </p>
        {onAddInstallDate ? (
          <button type="button" className="mt-3 inline-flex min-h-11 items-center text-[13px] font-medium text-primary" onClick={onAddInstallDate}>
            Open appliances
          </button>
        ) : null}
      </section>
    );
  }

  const nextLine = summary.nextBigTicket
    ? `${summary.nextBigTicket.label} · ${formatMoney(summary.nextBigTicket.mid)}${
        monthsUntil(summary.nextBigTicket.month, now ?? new Date()) <= 0
          ? " · due now"
          : ` · in ${monthsUntil(summary.nextBigTicket.month, now ?? new Date())} mo`
      }`
    : null;

  return (
    <section className="rounded-2xl bg-card px-4 py-4">
      <p className="text-[13px] font-medium text-muted-foreground">Replacement forecast</p>
      <p className="mt-1 text-[17px] font-medium">
        Next 90 days: ~{formatMoney(Math.round(summary.next90))}
      </p>
      {nextLine ? <p className="mt-1 text-[13px] text-muted-foreground">{nextLine}</p> : null}
      <button
        type="button"
        className="mt-3 inline-flex min-h-11 items-center text-[13px] font-medium text-primary"
        onClick={() => onNavigate?.({ tab: "budget" })}
      >
        Open forecast
      </button>
    </section>
  );
}
