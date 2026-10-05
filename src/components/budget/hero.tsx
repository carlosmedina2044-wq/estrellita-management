"use client";

import { useLocale } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Gauge } from "@/components/gauge";
import type { FundHealth } from "@/lib/budget";
import { formatMoney } from "@/lib/forecast";

export function FundHero({
  health,
  next3,
  onEditFund,
}: {
  health: FundHealth;
  /** What the next 3 months are forecast to cost. */
  next3: number;
  onEditFund: () => void;
}) {
  const { t } = useLocale();

  if (health.saved == null) {
    const headline =
      next3 > 0
        ? t("budget.heroNext3", { amount: formatMoney(Math.round(next3)) })
        : t("budget.heroNext12", { amount: formatMoney(health.needed12) });
    return (
      <section className="ui-group animate-in fade-in slide-in-from-bottom-2 px-4 py-5 duration-300">
        <h2 className="ui-heading ui-display num text-balance">{headline}</h2>
        {health.suggestedMonthly > 0 ? (
          <Button className="mt-4 h-auto min-h-12 w-full whitespace-normal py-2" onClick={onEditFund}>
            {t("budget.putAside", { amount: formatMoney(health.suggestedMonthly) })}
          </Button>
        ) : null}
        <button
          type="button"
          className="mt-2 flex min-h-11 w-full items-center ui-body font-medium text-primary"
          onClick={onEditFund}
        >
          {t("budget.alreadySaved")}
        </button>
        {health.onePercentCopy ? (
          <p className="mt-1 ui-caption leading-5 text-muted-foreground">{health.onePercentCopy}</p>
        ) : null}
      </section>
    );
  }

  const covered = health.coveragePct ?? 0;
  const coveredLabel =
    covered >= 100
      ? t("budget.coveredSet", { pct: covered })
      : covered >= 70
        ? t("budget.coveredGood", { pct: covered })
        : t("budget.coveredPct", { pct: covered });

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 ui-group px-4 py-5 duration-300">
      <p className="text-sm text-muted-foreground">{t("budget.fundTitle")}</p>
      <p className="ui-display mt-1 num">{t("budget.savedAmount", { amount: formatMoney(health.saved) })}</p>
      <p className="ui-title mt-1 font-medium text-muted-foreground">
        {t("budget.needed12", { amount: formatMoney(health.needed12) })}
      </p>
      <p className="mt-2 text-sm font-medium">{coveredLabel}</p>
      <div className="mt-3">
        <Gauge fraction={covered / 100} showCaption={false} aria-label={coveredLabel} />
      </div>
      <p className="mt-3 text-sm leading-5 text-muted-foreground">
        {t("budget.suggestedPace", { amount: formatMoney(health.suggestedMonthly) })}
      </p>
      {health.onePercentCopy ? (
        <p className="mt-2 ui-caption leading-5 text-muted-foreground">{health.onePercentCopy}</p>
      ) : null}
      <button type="button" className="mt-3 inline-flex min-h-11 items-center ui-body font-medium text-primary" onClick={onEditFund}>
        {t("budget.updateBalance")}
      </button>
    </section>
  );
}
