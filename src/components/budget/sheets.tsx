"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { parseBudgetMoney } from "@/lib/budget";
import { parseCostInput } from "@/lib/costs";
import { todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/forecast";
import type { ForecastItem } from "@/lib/forecast";
import type { LaborKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LogPurchaseSheet({
  open,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  item: ForecastItem | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { actualCost: number; completedOn: string; laborKind?: LaborKind }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [completedOn, setCompletedOn] = useState(todayISO());
  const [laborKind, setLaborKind] = useState<LaborKind | undefined>(undefined);
  const [prev, setPrev] = useState(false);
  if (open !== prev) {
    setPrev(open);
    if (open) {
      setAmount(item ? String(item.cost.mid) : "");
      setCompletedOn(todayISO());
      setLaborKind(undefined);
    }
  }
  const parsed = parseCostInput(amount);
  const isReplacement = item?.kind === "replacement";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{isReplacement ? "I replaced this" : "Log a purchase"}</SheetTitle>
          <SheetDescription>
            {item ? item.label : "What did you pay?"} Capture the real cost so future estimates get better.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-2">
          <div className="grid gap-1.5">
            <Label htmlFor="purchase-amount">What did you pay?</Label>
            <Input
              id="purchase-amount"
              inputMode="decimal"
              className="h-12"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="purchase-date">When?</Label>
            <Input
              id="purchase-date"
              type="date"
              className="h-12"
              value={completedOn}
              onChange={(event) => setCompletedOn(event.target.value)}
            />
          </div>
          {isReplacement ? (
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Did you DIY or hire someone?</p>
              <div className="flex rounded-full bg-secondary p-1">
                {([
                  ["diy", "I did it"],
                  ["hired", "I hired help"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLaborKind(value)}
                    className={cn(
                      "h-11 min-h-11 flex-1 rounded-full text-[15px] font-medium",
                      laborKind === value ? "bg-white shadow-sm" : "text-secondary-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <SheetFooter>
          <Button
            className="h-11 w-full"
            disabled={parsed == null || parsed <= 0 || !completedOn}
            onClick={() => {
              if (parsed == null) return;
              const payload = { actualCost: parsed, completedOn, laborKind };
              onOpenChange(false);
              onSave(payload);
            }}
          >
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function DeferSheet({
  open,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  item: ForecastItem | null;
  onOpenChange: (open: boolean) => void;
  onSave: (months: 6 | 12, reason?: string) => void;
}) {
  const [months, setMonths] = useState<6 | 12>(6);
  const [reason, setReason] = useState("still working fine");
  const [prev, setPrev] = useState(false);
  if (open !== prev) {
    setPrev(open);
    if (open) {
      setMonths(6);
      setReason("still working fine");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>I’ll wait</SheetTitle>
          <SheetDescription>
            {item ? `Push ${item.label.replace(/ replacement$/i, "")} out if it’s still doing the job.` : "Push this out."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-2">
          <div className="flex rounded-full bg-secondary p-1">
            {([6, 12] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMonths(value)}
                className={cn(
                  "h-11 min-h-11 flex-1 rounded-full text-[15px] font-medium",
                  months === value ? "bg-white shadow-sm" : "text-secondary-foreground",
                )}
              >
                {value} months
              </button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="defer-reason">Why?</Label>
            <Input
              id="defer-reason"
              className="h-12"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="still working fine"
            />
          </div>
        </div>
        <SheetFooter>
          <Button
            className="h-11 w-full"
            onClick={() => {
              const nextMonths = months;
              const nextReason = reason.trim() || undefined;
              onOpenChange(false);
              onSave(nextMonths, nextReason);
            }}
          >
            Defer {months} months
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function FundSheet({
  open,
  balance,
  contribution,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  balance?: number;
  contribution?: number;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { balance: number; monthlyContribution?: number }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [monthly, setMonthly] = useState("");
  const [prev, setPrev] = useState(false);
  if (open !== prev) {
    setPrev(open);
    if (open) {
      setAmount(balance != null ? String(balance) : "");
      setMonthly(contribution != null ? String(contribution) : "");
    }
  }
  const parsed = parseBudgetMoney(amount);
  const parsedMonthly = monthly.trim() ? parseBudgetMoney(monthly) : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Home maintenance fund</SheetTitle>
          <SheetDescription>How much do you have saved for repairs and replacements?</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-2">
          <div className="grid gap-1.5">
            <Label htmlFor="fund-balance">Saved so far</Label>
            <Input
              id="fund-balance"
              inputMode="decimal"
              className="h-12"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fund-monthly">What I set aside each month (optional)</Label>
            <Input
              id="fund-monthly"
              inputMode="decimal"
              className="h-12"
              value={monthly}
              onChange={(event) => setMonthly(event.target.value)}
              placeholder="200"
            />
          </div>
        </div>
        <SheetFooter>
          <Button
            className="h-11 w-full"
            disabled={parsed == null || (monthly.trim() !== "" && parsedMonthly == null)}
            onClick={() => {
              if (parsed == null) return;
              const payload = {
                balance: parsed,
                monthlyContribution: parsedMonthly ?? undefined,
              };
              onOpenChange(false);
              onSave(payload);
            }}
          >
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function ViewOptionsSheet({
  open,
  horizon,
  threshold,
  homeValue,
  onOpenChange,
  onHorizon,
  onThreshold,
  onHomeValue,
  onShare,
}: {
  open: boolean;
  horizon: 12 | 24 | 36;
  threshold: number;
  homeValue?: number;
  onOpenChange: (open: boolean) => void;
  onHorizon: (value: 12 | 24 | 36) => void;
  onThreshold: (value: number) => void;
  onHomeValue: (value: number | null) => void;
  onShare: () => void;
}) {
  const [thresholdText, setThresholdText] = useState(String(threshold));
  const [homeText, setHomeText] = useState(homeValue != null ? String(homeValue) : "");
  const [prev, setPrev] = useState(false);
  if (open !== prev) {
    setPrev(open);
    if (open) {
      setThresholdText(String(threshold));
      setHomeText(homeValue != null ? String(homeValue) : "");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>View options</SheetTitle>
          <SheetDescription>Look-ahead, big-expense threshold, and home value for the 1% rule.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">Look ahead</p>
            <div className="flex rounded-full bg-secondary p-1">
              {([12, 24, 36] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onHorizon(item)}
                  className={cn(
                    "h-11 min-h-11 flex-1 rounded-full text-[15px] font-medium",
                    horizon === item ? "bg-white shadow-sm" : "text-secondary-foreground",
                  )}
                >
                  {item} mo
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="threshold">Show as a big expense above</Label>
            <Input
              id="threshold"
              inputMode="decimal"
              className="h-12"
              value={thresholdText}
              onChange={(event) => setThresholdText(event.target.value)}
              onBlur={() => {
                const parsed = parseCostInput(thresholdText);
                if (parsed != null && parsed >= 50) onThreshold(parsed);
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="home-value">Home value (for the 1% rule)</Label>
            <Input
              id="home-value"
              inputMode="decimal"
              className="h-12"
              value={homeText}
              onChange={(event) => setHomeText(event.target.value)}
              onBlur={() => {
                if (!homeText.trim()) {
                  onHomeValue(null);
                  return;
                }
                const parsed = parseBudgetMoney(homeText, 100_000_000);
                if (parsed != null && parsed > 0) onHomeValue(parsed);
              }}
              placeholder="425000"
            />
          </div>
          <button type="button" className="h-11 text-left text-[15px] font-medium text-primary" onClick={onShare}>
            Share a summary
          </button>
          <p className="text-[13px] text-muted-foreground">
            Big expenses currently start at {formatMoney(threshold)}.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
