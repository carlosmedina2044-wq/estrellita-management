"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildForecast } from "@/lib/forecast";
import type { Household } from "@/lib/types";
import { cn } from "@/lib/utils";

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function BudgetView({
  household,
  onReplace,
  onUpdateAsset,
}: {
  household: Household;
  onReplace: (assetId: string) => void;
  onUpdateAsset: (assetId: string, patch: { installDate?: string; replacementCostEstimate?: number }) => void;
}) {
  const [horizon, setHorizon] = useState<12 | 24 | 36>(12);
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const forecast = useMemo(() => buildForecast(household, horizon), [household, horizon]);
  const max = Math.max(1, ...forecast.monthly.map((month) => month.total));
  const selected = forecast.monthly.find((month) => month.month === openMonth);

  function exportCsv() {
    const rows = [
      ["month", "kind", "label", "low", "mid", "high", "confidence", "source"],
      ...forecast.monthly.flatMap((month) =>
        month.items.map((item) => [
          month.month,
          item.kind,
          item.label,
          String(item.cost.low),
          String(item.cost.mid),
          String(item.cost.high),
          item.confidence,
          item.source,
        ]),
      ),
    ];
    const blob = new Blob([rows.map((row) => row.join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `estrellita-forecast-${horizon}m.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-8">
      <header>
        <p className="text-sm text-muted-foreground">Maintenance forecast</p>
        <h1 className="ui-heading text-[34px] font-semibold tracking-tight">
          ${forecast.suggestedMonthlySetAside.toLocaleString()}
          <span className="ml-1 text-[17px] font-medium text-muted-foreground">/ month</span>
        </h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          Suggested monthly set-aside so you’re ready for upkeep and replacements over the next {horizon}{" "}
          months. About ${Math.round(forecast.totals.total).toLocaleString()} in that window.
        </p>
      </header>

      <div>
        <p className="mb-2 text-[13px] font-medium text-muted-foreground">Look ahead</p>
        <div className="flex rounded-full bg-secondary p-1">
          {([12, 24, 36] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setHorizon(item);
                setOpenMonth(null);
              }}
              className={cn(
                "h-11 min-h-11 flex-1 rounded-full text-[15px] font-medium",
                horizon === item ? "bg-white shadow-sm" : "text-secondary-foreground",
              )}
            >
              {item} months
            </button>
          ))}
        </div>
      </div>

      <section className="min-w-0 overflow-hidden rounded-2xl bg-white">
        <div className="flex h-44 items-end gap-1 overflow-x-auto px-3 py-3">
          {forecast.monthly.map((month) => {
            const active = openMonth === month.month;
            return (
              <button
                key={month.month}
                type="button"
                onClick={() => setOpenMonth(month.month === openMonth ? null : month.month)}
                className={cn(
                  "flex h-full min-w-3 flex-1 flex-col justify-end rounded-sm",
                  active && "ring-2 ring-primary ring-offset-2",
                )}
                aria-label={`${monthLabel(month.month)} $${Math.round(month.total)}`}
                aria-pressed={active}
              >
                <span
                  className="flex w-full min-h-1 flex-col justify-end overflow-hidden rounded-sm"
                  style={{ height: `${(month.total / max) * 100}%` }}
                >
                  <span
                    className="w-full bg-[#ff9f0a]"
                    style={{ height: `${month.total ? (month.replacements / month.total) * 100 : 0}%` }}
                  />
                  <span
                    className="w-full bg-primary"
                    style={{ height: `${month.total ? (month.recurring / month.total) * 100 : 0}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>
        <p className="px-4 pb-3 text-sm text-muted-foreground">
          Each bar is a month — tap one to see what’s due. Blue is regular upkeep. Amber is replacements.
        </p>
      </section>

      {selected ? (
        <section className="rounded-2xl bg-white px-4 py-4">
          <p className="font-medium">{monthLabel(selected.month)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            About ${Math.round(selected.total).toLocaleString()} this month.
          </p>
          {selected.items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing scheduled this month.</p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {selected.items.map((item) => (
                <li key={`${item.label}-${item.month}-${item.nodeId}`} className="text-sm leading-5">
                  <span className="font-medium">{item.label}</span>
                  <span className="block text-muted-foreground">
                    ${item.cost.low.toLocaleString()}–${item.cost.high.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="ui-heading text-[20px] font-semibold">Coming up</h2>
        <p className="mt-1 text-sm text-muted-foreground">Larger replacements we expect in this window.</p>
        {forecast.bigTicket.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No large replacements in this window.</p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {forecast.bigTicket.map((item) => {
              const asset = household.assets.find((entry) => entry.id === item.assetId);
              const room = household.rooms.find((entry) => entry.id === asset?.roomId);
              return (
                <li key={`${item.assetId}-${item.month}`} className="rounded-2xl bg-white px-4 py-4">
                  <p className="font-medium">{item.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {monthLabel(item.month)}
                    {room ? ` · ${room.name}` : ""} · ${item.cost.low.toLocaleString()}–$
                    {item.cost.high.toLocaleString()}
                  </p>
                  {item.assetId ? (
                    <div className="mt-3">
                      <Button variant="secondary" className="h-11 w-full" onClick={() => onReplace(item.assetId!)}>
                        I replaced this
                      </Button>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Marks it as new so we stop counting this one.
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {forecast.missingData.length > 0 ? (
        <section>
          <h2 className="ui-heading text-[20px] font-semibold">Make this more accurate</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A date or cost is missing, so this item isn’t in the forecast yet.
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
                            event.target.value && onUpdateAsset(item.assetId, { installDate: event.target.value })
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
                              onUpdateAsset(item.assetId, { replacementCostEstimate: value });
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

      <button type="button" className="h-11 text-[15px] font-medium text-primary" onClick={exportCsv}>
        Export CSV
      </button>
    </div>
  );
}
