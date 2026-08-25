"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { spikeLabel } from "@/lib/budget";
import {
  formatCostRange,
  forecastSourceBlurb,
  forecastSourceTag,
  type ForecastItem,
  type ForecastMonth,
  type ForecastResult,
} from "@/lib/forecast";
import type { AppNavigateTarget } from "@/lib/types";
import { cn } from "@/lib/utils";

function shortMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

function longMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function windowLabel(months: ForecastMonth[]) {
  if (months.length === 0) return "";
  const first = months[0].month;
  const last = months[months.length - 1].month;
  const start = new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, 1);
  const end = new Date(Number(last.slice(0, 4)), Number(last.slice(5, 7)) - 1, 1);
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString("en-US", { month: "short" })}–${end.toLocaleDateString("en-US", { month: "short" })} ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString("en-US", { month: "short", year: "numeric" })}–${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
}

function targetFor(item: ForecastItem): AppNavigateTarget | null {
  if (item.kind === "consumable" && item.automationId) {
    return { tab: "restock", itemId: item.automationId };
  }
  if (item.kind === "task" && item.dutyId) {
    return { tab: "today", dutyId: item.dutyId };
  }
  return null;
}

export function QuarterTimeline({
  forecast,
  onLogPurchase,
  onUpdateEstimate,
  onNavigate,
}: {
  forecast: ForecastResult;
  onLogPurchase: (item: ForecastItem) => void;
  onUpdateEstimate: (assetId: string, amount: number) => void;
  onNavigate?: (target: AppNavigateTarget) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [openMonth, setOpenMonth] = useState<string>(forecast.monthly[0]?.month ?? "");
  const maxOffset = Math.max(0, Math.ceil(forecast.monthly.length / 3) - 1);
  const windowMonths = useMemo(
    () => forecast.monthly.slice(offset * 3, offset * 3 + 3),
    [forecast.monthly, offset],
  );
  const avg = useMemo(() => {
    const priced = forecast.monthly.filter((month) => month.total > 0);
    return priced.reduce((sum, month) => sum + month.total, 0) / Math.max(1, priced.length) || 1;
  }, [forecast.monthly]);
  const max = Math.max(1, ...windowMonths.map((month) => month.total));
  const selected = forecast.monthly.find((month) => month.month === openMonth) ?? windowMonths[0];
  const defaultMonth = windowMonths.find((month) => month.total >= avg * 2 && month.total > 0)?.month ?? windowMonths[0]?.month ?? "";
  const monthInWindow = windowMonths.some((month) => month.month === openMonth);
  if (!monthInWindow && defaultMonth && openMonth !== defaultMonth) {
    setOpenMonth(defaultMonth);
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between gap-2">
        <h2 className="ui-heading text-[20px] font-semibold">Next 3 months</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full text-foreground disabled:text-muted-foreground"
            aria-label="Previous 3 months"
            disabled={offset <= 0}
            onClick={() => setOffset((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="min-w-28 text-center text-sm font-medium">{windowLabel(windowMonths)}</p>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full text-foreground disabled:text-muted-foreground"
            aria-label="Next 3 months"
            disabled={offset >= maxOffset}
            onClick={() => setOffset((value) => Math.min(maxOffset, value + 1))}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-white px-3 pb-4 pt-3">
        <div className="flex h-52 items-end gap-3">
          {windowMonths.map((month) => {
            const active = selected?.month === month.month;
            const spike = month.total >= avg * 2 && month.total > 0;
            const label = spike ? spikeLabel(month.items) : null;
            const height = month.total ? Math.max(12, (month.total / max) * 100) : 6;
            return (
              <button
                key={month.month}
                type="button"
                onClick={() => setOpenMonth(month.month)}
                className={cn(
                  "flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-xl px-1",
                  active && "bg-muted/70",
                )}
                aria-pressed={active}
                aria-label={`${longMonth(month.month)} ${formatCostRange({ low: month.total, mid: month.total, high: month.total })}`}
              >
                {label ? (
                  <span className="line-clamp-2 text-center text-[11px] leading-tight text-primary">{label}</span>
                ) : (
                  <span className="h-7" />
                )}
                <span className="text-[13px] font-medium tabular-nums">
                  {month.total ? `$${Math.round(month.total).toLocaleString()}` : "—"}
                </span>
                <span
                  className={cn("w-full rounded-md", spike ? "bg-warning" : "bg-primary")}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[13px] text-muted-foreground">{shortMonth(month.month)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selected ? (
        <MonthDetail
          month={selected}
          onLogPurchase={onLogPurchase}
          onUpdateEstimate={onUpdateEstimate}
          onNavigate={onNavigate}
        />
      ) : null}
    </section>
  );
}

function MonthDetail({
  month,
  onLogPurchase,
  onUpdateEstimate,
  onNavigate,
}: {
  month: ForecastMonth;
  onLogPurchase: (item: ForecastItem) => void;
  onUpdateEstimate: (assetId: string, amount: number) => void;
  onNavigate?: (target: AppNavigateTarget) => void;
}) {
  const replacements = month.items.filter((item) => item.kind === "replacement");
  const supplies = month.items.filter((item) => item.kind !== "replacement");
  const [open, setOpen] = useState({ replacements: true, supplies: true });
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="mt-3 rounded-2xl bg-white px-4 py-4">
      <p className="font-medium">{longMonth(month.month)}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {month.total ? `About $${Math.round(month.total).toLocaleString()} this month.` : "Nothing scheduled this month."}
      </p>
      {month.items.length === 0 ? null : (
        <div className="mt-3 grid gap-3">
          {replacements.length > 0 ? (
            <Group
              title={`Replacements ($${Math.round(replacements.reduce((sum, item) => sum + item.cost.mid, 0)).toLocaleString()})`}
              open={open.replacements}
              onToggle={() => setOpen((value) => ({ ...value, replacements: !value.replacements }))}
            >
              {replacements.map((item) => (
                <ForecastRow
                  key={`${item.assetId}-${item.label}`}
                  item={item}
                  editing={editingId === item.assetId}
                  onEdit={() => item.assetId && setEditingId(item.assetId)}
                  onSaveEstimate={(amount) => {
                    if (item.assetId) onUpdateEstimate(item.assetId, amount);
                    setEditingId(null);
                  }}
                  onLogPurchase={() => onLogPurchase(item)}
                  onNavigate={onNavigate}
                />
              ))}
            </Group>
          ) : null}
          {supplies.length > 0 ? (
            <Group
              title={`Routine supplies ($${Math.round(supplies.reduce((sum, item) => sum + item.cost.mid, 0)).toLocaleString()})`}
              open={open.supplies}
              onToggle={() => setOpen((value) => ({ ...value, supplies: !value.supplies }))}
            >
              {supplies.map((item) => (
                <ForecastRow
                  key={`${item.kind}-${item.automationId ?? item.dutyId ?? item.nodeId}-${item.label}`}
                  item={item}
                  editing={false}
                  onLogPurchase={() => onLogPurchase(item)}
                  onNavigate={onNavigate}
                />
              ))}
            </Group>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button type="button" className="flex w-full items-center justify-between py-1 text-left" onClick={onToggle}>
        <span className="text-sm font-medium">{title}</span>
        <span className="text-[13px] text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <ul className="mt-2 grid gap-3">{children}</ul> : null}
    </div>
  );
}

function ForecastRow({
  item,
  editing,
  onEdit,
  onSaveEstimate,
  onLogPurchase,
  onNavigate,
}: {
  item: ForecastItem;
  editing: boolean;
  onEdit?: () => void;
  onSaveEstimate?: (amount: number) => void;
  onLogPurchase: () => void;
  onNavigate?: (target: AppNavigateTarget) => void;
}) {
  const target = targetFor(item);
  const [estimate, setEstimate] = useState("");

  return (
    <li className="border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-medium">{item.label}</p>
      <p className="text-sm text-muted-foreground">{formatCostRange(item.cost)}</p>
      {item.source === "catalog" && item.kind === "replacement" ? (
        <button type="button" className="mt-1 text-left text-[13px] leading-4 text-muted-foreground" onClick={onEdit}>
          {forecastSourceBlurb(item.source)}
        </button>
      ) : (
        <p className="mt-1 text-[13px] text-muted-foreground">
          {item.source === "catalog" ? "Typical supply price." : forecastSourceTag(item.source)}
        </p>
      )}
      {editing && onSaveEstimate ? (
        <div className="mt-2 flex gap-2">
          <Input
            inputMode="decimal"
            className="h-11"
            placeholder="Your estimate"
            value={estimate}
            onChange={(event) => setEstimate(event.target.value)}
          />
          <Button
            className="h-11"
            onClick={() => {
              const value = Number(estimate);
              if (Number.isFinite(value) && value > 0) onSaveEstimate(value);
            }}
          >
            Save
          </Button>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" className="h-11" onClick={onLogPurchase}>
          Log a purchase
        </Button>
        {target && onNavigate ? (
          <Button variant="ghost" className="h-11" onClick={() => onNavigate(target)}>
            Open
          </Button>
        ) : null}
      </div>
    </li>
  );
}
