"use client";

import { Button } from "@/components/ui/button";
import type { FundHealth } from "@/lib/budget";
import { formatMoney } from "@/lib/forecast";

export function FundHero({
  health,
  onEditFund,
}: {
  health: FundHealth;
  onEditFund: () => void;
}) {
  if (health.saved == null) {
    return (
      <section className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl bg-white px-4 py-5 duration-300">
        <p className="text-sm text-muted-foreground">Home maintenance fund</p>
        <p className="ui-heading mt-1 text-[28px] font-semibold tracking-tight leading-tight">
          How much do you have saved for home maintenance?
        </p>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          Suggested set-aside is {formatMoney(health.suggestedMonthly)}/month so you’re ready for the next 12 months
          ({formatMoney(health.needed12)} total).
        </p>
        <Button className="mt-4 h-11 w-full" onClick={onEditFund}>
          Set a balance
        </Button>
        {health.onePercentCopy ? (
          <p className="mt-3 text-[13px] leading-5 text-muted-foreground">{health.onePercentCopy}</p>
        ) : null}
      </section>
    );
  }

  const covered = health.coveragePct ?? 0;
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl bg-white px-4 py-5 duration-300">
      <p className="text-sm text-muted-foreground">Home maintenance fund</p>
      <p className="ui-heading mt-1 text-[28px] font-semibold tracking-tight leading-tight">
        {formatMoney(health.saved)} saved
        <span className="text-[17px] font-medium text-muted-foreground">
          {" "}
          · {formatMoney(health.needed12)} needed in the next 12 months
        </span>
      </p>
      <p className="mt-2 text-sm font-medium">
        You’re {covered}% covered
        {covered >= 100 ? ". Set for the year." : covered >= 70 ? ". In good shape." : "."}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${covered}%` }}
        />
      </div>
      <p className="mt-3 text-sm leading-5 text-muted-foreground">
        Suggested pace: {formatMoney(health.suggestedMonthly)}/month.
      </p>
      {health.onePercentCopy ? (
        <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{health.onePercentCopy}</p>
      ) : null}
      <button type="button" className="mt-3 text-[15px] font-medium text-primary" onClick={onEditFund}>
        Update balance
      </button>
    </section>
  );
}
