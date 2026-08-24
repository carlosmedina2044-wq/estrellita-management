"use client";

import { Button } from "@/components/ui/button";
import { formatCostRange, formatMoney, monthsUntil, type ForecastItem } from "@/lib/forecast";
import type { HomeAsset, HomeRoom } from "@/lib/types";

function countdown(month: string): string {
  const months = monthsUntil(month);
  if (months <= 0) return "due now";
  if (months === 1) return "~1 month away";
  return `~${months} months away`;
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
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="ui-heading text-[20px] font-semibold">Upcoming big expenses</h2>
      <p className="mt-1 text-sm text-muted-foreground">The replacements that actually move the needle.</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No large replacements in this window.</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {items.map((item) => {
            const asset = assets.find((entry) => entry.id === item.assetId);
            const room = rooms.find((entry) => entry.id === asset?.roomId);
            const name = item.label.replace(/ replacement$/i, "");
            return (
              <li key={`${item.assetId}-${item.month}`} className="rounded-2xl bg-white px-4 py-4">
                <p className="font-medium">{name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {countdown(item.month)} · {formatCostRange(item.cost)}
                  {item.overdue ? " · overdue" : ""}
                  {room ? ` · ${room.name}` : ""}
                </p>
                {asset?.deferReason ? (
                  <p className="mt-1 text-[13px] text-muted-foreground">Waiting: {asset.deferReason}</p>
                ) : null}
                {item.assetId ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button className="h-11" onClick={() => onReplace(item)}>
                      I replaced this
                    </Button>
                    <Button variant="secondary" className="h-11" onClick={() => onDefer(item)}>
                      I’ll wait
                    </Button>
                  </div>
                ) : null}
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Logging what you paid trains the forecast. Deferring pushes the date out if it’s still working.
                </p>
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
  if (insights.length === 0) return null;
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="ui-heading text-[20px] font-semibold">What this means</h2>
      <ul className="mt-3 grid gap-3">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className="rounded-2xl bg-white px-4 py-4"
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
  const logged = actual > 0;
  const delta = planned - actual;
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="ui-heading text-[20px] font-semibold">Spending</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Last {months} months: forecast {formatMoney(planned)}, actual {formatMoney(actual)}
        {logged && delta > 0 ? ". Under plan." : logged && delta < 0 ? ". Over plan." : "."}
      </p>
      {!logged ? (
        <p className="mt-3 rounded-2xl bg-white px-4 py-4 text-sm text-muted-foreground">
          Log a purchase on an upcoming item to start a history. Completions with a price already show up here.
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          <ul className="rounded-2xl bg-white px-4 py-4">
            {byMonth.map((month) => {
              const [year, mon] = month.month.split("-").map(Number);
              const label = new Date(year, (mon ?? 1) - 1, 1).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              });
              return (
                <li key={month.month} className="flex items-center justify-between py-1.5 text-sm">
                  <span>{label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {month.actual > 0 ? formatMoney(month.actual) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
          {categories.length > 0 ? (
            <ul className="rounded-2xl bg-white px-4 py-4">
              {categories.map((item) => (
                <li key={item.category} className="py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.category}</span>
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
