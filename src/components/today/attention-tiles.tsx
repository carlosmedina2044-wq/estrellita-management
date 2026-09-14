"use client";

import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export function AttentionTiles({
  overdue,
  dueToday,
  orderNow,
  orderNowCost,
  arriving,
  labels,
  onOverdue,
  onDueToday,
  onOrder,
  onArriving,
  onAllClear,
}: {
  overdue: number;
  dueToday: number;
  orderNow: number;
  orderNowCost: string | null;
  arriving: number;
  labels: {
    overdue: string;
    dueToday: string;
    orderNow: string;
    onTheWay: string;
    allClear: string;
    allClearHint: string;
    allClearAria: string;
  };
  onOverdue: () => void;
  onDueToday: () => void;
  onOrder: () => void;
  onArriving: () => void;
  onAllClear: () => void;
}) {
  const tiles = [
    overdue > 0
      ? {
          key: "overdue",
          count: overdue,
          label: labels.overdue,
          onClick: onOverdue,
          countClass: "text-destructive",
          className: "ring-destructive/40",
        }
      : null,
    dueToday > 0
      ? {
          key: "due",
          count: dueToday,
          label: labels.dueToday,
          onClick: onDueToday,
          countClass: "text-foreground",
        }
      : null,
    orderNow > 0
      ? {
          key: "order",
          count: orderNow,
          label: labels.orderNow,
          costLine: orderNowCost,
          onClick: onOrder,
          countClass: "text-warning",
          icon: true,
        }
      : null,
    arriving > 0
      ? {
          key: "arriving",
          count: arriving,
          label: labels.onTheWay,
          onClick: onArriving,
          countClass: "text-muted-foreground",
        }
      : null,
  ].filter((tile): tile is NonNullable<typeof tile> => Boolean(tile));

  if (tiles.length === 0) {
    return (
      <button
        type="button"
        onClick={onAllClear}
        className="flex min-h-11 w-full items-center rounded-full bg-success/10 px-4 text-left transition-transform duration-75 active:scale-[0.98]"
        aria-label={labels.allClearAria}
      >
        <span className="ui-body font-medium text-success">{labels.allClear}</span>
        <span className="ml-2 ui-caption text-muted-foreground">{labels.allClearHint}</span>
      </button>
    );
  }

  return (
    <div className="app-h-scroll -mx-1 flex gap-2 overflow-x-auto px-1">
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          onClick={tile.onClick}
          aria-label={`${tile.count} ${tile.label}`}
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-card px-3.5 ring-1 ring-border transition-transform duration-75 active:scale-[0.98]",
            "className" in tile ? tile.className : null,
          )}
        >
          {"icon" in tile && tile.icon ? <Package className="size-4 shrink-0" aria-hidden /> : null}
          <span className={cn("ui-body font-semibold num", tile.countClass)}>{tile.count}</span>
          <span className="ui-caption text-muted-foreground">
            {"costLine" in tile && tile.costLine ? `${tile.label} · ${tile.costLine}` : tile.label}
          </span>
        </button>
      ))}
    </div>
  );
}
