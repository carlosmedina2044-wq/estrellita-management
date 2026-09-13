"use client";

import { useLocale } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Gauge } from "@/components/gauge";
import type { FundHealth } from "@/lib/budget";
import { formatMoney } from "@/lib/forecast";

export function FundHero({
  health,
  onEditFund,
}: {
  health: FundHealth;
  onEditFund: () => void;
}) {
  const { t } = useLocale();

  if (health.saved == null) {
    return (
      <section className="animate-in fade-in slide-in-from-bottom-2 rounded-[var(--r-container)] bg-card px-4 py-5 duration-300">
        <p className="text-sm text-muted-foreground">{t("budget.fundTitle")}</p>
        <p className="ui-heading mt-1 ui-display font-semibold tracking-tight leading-tight">
          {t("budget.fundAsk")}
        </p>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {t("budget.fundSuggestedBody", {
            amount: formatMoney(health.suggestedMonthly),
            total: formatMoney(health.needed12),
          })}
        </p>
        <Button className="mt-4 h-11 w-full" onClick={onEditFund}>
          {t("budget.setBalance")}
        </Button>
        {health.onePercentCopy ? (
          <p className="mt-3 ui-caption leading-5 text-muted-foreground">{health.onePercentCopy}</p>
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
    <section className="animate-in fade-in slide-in-from-bottom-2 rounded-[var(--r-container)] bg-card px-4 py-5 duration-300">
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
