"use client";

import { tActive } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { spikeLabel } from "@/lib/budget";
import { getActiveDateLocale } from "@/lib/dates";
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

function shortMonth(key: string, locale: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, 1).toLocaleDateString(locale, { month: "short" });
}

function longMonth(key: string, locale: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function windowLabel(months: ForecastMonth[], locale: string) {
  if (months.length === 0) return "";
  const first = months[0].month;
  const last = months[months.length - 1].month;
  const start = new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, 1);
  const end = new Date(Number(last.slice(0, 4)), Number(last.slice(5, 7)) - 1, 1);
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString(locale, { month: "short" })}–${end.toLocaleDateString(locale, { month: "short" })} ${end.getFullYear()}`;
  }
  return `${start.toLocaleDateString(locale, { month: "short", year: "numeric" })}–${end.toLocaleDateString(locale, { month: "short", year: "numeric" })}`;
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
  const { t, dateLocale } = useLocale();
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
  const biggest = windowMonths.flatMap((month) => {
    const label = month.total >= avg * 2 && month.total > 0 ? spikeLabel(month.items) : null;
    return label ? [{ month: shortMonth(month.month, dateLocale), label }] : [];
  });
  const defaultMonth = windowMonths.find((month) => month.total >= avg * 2 && month.total > 0)?.month ?? windowMonths[0]?.month ?? "";
  const monthInWindow = windowMonths.some((month) => month.month === openMonth);
  if (!monthInWindow && defaultMonth && openMonth !== defaultMonth) {
    setOpenMonth(defaultMonth);
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between gap-2">
        <h2 className="ui-heading ui-title font-semibold">{t("budget.next3Title")}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full text-foreground disabled:text-muted-foreground"
            aria-label={t("budget.prev3")}
            disabled={offset <= 0}
            onClick={() => setOffset((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="min-w-28 text-center text-sm font-medium">{windowLabel(windowMonths, dateLocale)}</p>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full text-foreground disabled:text-muted-foreground"
            aria-label={t("budget.next3")}
            disabled={offset >= maxOffset}
            onClick={() => setOffset((value) => Math.min(maxOffset, value + 1))}
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="ui-group mt-3 px-3 pb-3 pt-3">
        <div className="flex h-48 items-end gap-3">
          {windowMonths.map((month) => {
            const active = selected?.month === month.month;
            const urgent = month.items.some((item) => item.overdue);
            const height = month.total ? Math.max(4, (month.total / max) * 100) : 6;
            return (
              <button
                key={month.month}
                type="button"
                onClick={() => setOpenMonth(month.month)}
                className={cn(
                  "flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-xl px-1 pb-1",
                  active && "bg-secondary",
                )}
                aria-pressed={active}
                aria-label={`${longMonth(month.month, dateLocale)} ${formatCostRange({ low: month.total, mid: month.total, high: month.total })}`}
              >
                <span className="ui-caption font-medium num">
                  {month.total ? `$${Math.round(month.total).toLocaleString(getActiveDateLocale())}` : "—"}
                </span>
                {/* The track is the only thing the percentage is measured against, so
                    a bar half the size of another really is half as tall. */}
                <span className="flex min-h-0 w-full flex-1 items-end">
                  <span
                    className={cn("w-full rounded-md", urgent ? "bg-warning" : "bg-primary")}
                    style={{ height: `${height}%` }}
                  />
                </span>
                <span className="ui-caption text-muted-foreground">{shortMonth(month.month, dateLocale)}</span>
              </button>
            );
          })}
        </div>
        {biggest.length > 0 ? (
          <ul className="mt-2 grid gap-1 px-1">
            {biggest.map((entry) => (
              <li key={entry.month} className="ui-caption text-muted-foreground">
                {t("budget.biggestIn", { month: entry.month, label: entry.label })}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {selected ? (
        <MonthDetail
          month={selected}
          dateLocale={dateLocale}
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
  dateLocale,
  onLogPurchase,
  onUpdateEstimate,
  onNavigate,
}: {
  month: ForecastMonth;
  dateLocale: string;
  onLogPurchase: (item: ForecastItem) => void;
  onUpdateEstimate: (assetId: string, amount: number) => void;
  onNavigate?: (target: AppNavigateTarget) => void;
}) {
  const replacements = month.items.filter((item) => item.kind === "replacement");
  const supplies = month.items.filter((item) => item.kind !== "replacement");
  const [open, setOpen] = useState({ replacements: true, supplies: true });
  const [showAll, setShowAll] = useState({ replacements: false, supplies: false });
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="ui-group mt-3 px-4 py-4">
      <p className="font-medium">{longMonth(month.month, dateLocale)}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {month.total ? tActive("budget.aboutThisMonth", { amount: Math.round(month.total).toLocaleString(getActiveDateLocale()) }) : tActive("budget.nothingThisMonth")}
      </p>
      {month.items.length === 0 ? null : (
        <div className="mt-3 grid gap-3">
          {replacements.length > 0 ? (
            <Group
              title={tActive("budget.replacements", { amount: Math.round(replacements.reduce((sum, item) => sum + item.cost.mid, 0)).toLocaleString(getActiveDateLocale()) })}
              open={open.replacements}
              total={replacements.length}
              expanded={showAll.replacements}
              onExpand={() => setShowAll((value) => ({ ...value, replacements: !value.replacements }))}
              onToggle={() => setOpen((value) => ({ ...value, replacements: !value.replacements }))}
            >
              {(showAll.replacements ? byCost(replacements) : byCost(replacements).slice(0, 3)).map((item) => (
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
              title={tActive("budget.routineSupplies", { amount: Math.round(supplies.reduce((sum, item) => sum + item.cost.mid, 0)).toLocaleString(getActiveDateLocale()) })}
              open={open.supplies}
              total={supplies.length}
              expanded={showAll.supplies}
              onExpand={() => setShowAll((value) => ({ ...value, supplies: !value.supplies }))}
              onToggle={() => setOpen((value) => ({ ...value, supplies: !value.supplies }))}
            >
              {(showAll.supplies ? byCost(supplies) : byCost(supplies).slice(0, 3)).map((item) => (
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

function byCost(items: ForecastItem[]): ForecastItem[] {
  return [...items].sort((a, b) => b.cost.mid - a.cost.mid);
}

function Group({
  title,
  open,
  total,
  expanded,
  onExpand,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  total: number;
  expanded: boolean;
  onExpand: () => void;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <div>
      <button type="button" className="flex min-h-11 w-full items-center justify-between py-1 text-left" onClick={onToggle}>
        <span className="text-sm font-medium">{title}</span>
        <span className="ui-caption text-muted-foreground">{open ? t("budget.hide") : t("budget.show")}</span>
      </button>
      {open ? (
        <>
          <p className="mt-1 ui-caption text-muted-foreground">{t("budget.tapToLog")}</p>
          <ul className="mt-1 grid gap-1">{children}</ul>
          {total > 3 ? (
            <button type="button" className="flex min-h-11 items-center ui-body font-medium text-primary" onClick={onExpand}>
              {expanded ? t("budget.showFewer") : t("budget.seeAll", { count: total })}
            </button>
          ) : null}
        </>
      ) : null}
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
  const { t } = useLocale();
  const target = targetFor(item);
  const [estimate, setEstimate] = useState("");

  return (
    <li>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="min-h-11 min-w-0 flex-1 py-1.5 text-left"
          onClick={onLogPurchase}
        >
          <span className="block text-sm font-medium">{item.label}</span>
          <span className="block text-sm text-muted-foreground num">{formatCostRange(item.cost)}</span>
          {item.source === "catalog" && item.kind === "replacement" ? null : (
            <span className="block ui-caption text-muted-foreground">
              {item.source === "catalog" ? tActive("budget.typicalSupply") : forecastSourceTag(item.source)}
            </span>
          )}
        </button>
        {target && onNavigate ? (
          <button
            type="button"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary"
            aria-label={t("budget.open")}
            onClick={() => onNavigate(target)}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>
      {item.source === "catalog" && item.kind === "replacement" ? (
        <button type="button" className="inline-flex min-h-11 items-center text-left ui-caption leading-4 text-muted-foreground" onClick={onEdit}>
          {forecastSourceBlurb(item.source)}
        </button>
      ) : null}
      {editing && onSaveEstimate ? (
        <div className="mt-1 flex gap-2">
          <Input
            inputMode="decimal"
            className="h-11"
            placeholder={tActive("budget.yourEstimate")}
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
            {t("common.save")}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
