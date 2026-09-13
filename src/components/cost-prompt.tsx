"use client";

import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { parseCostInput } from "@/lib/costs";

export function CostPrompt({
  suggested,
  onSave,
  onSkip,
}: {
  suggested?: number;
  onSave: (amount: number) => void;
  onSkip: () => void;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState(suggested != null ? String(suggested) : "");
  const parsed = parseCostInput(value);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="ui-caption text-muted-foreground">{t("cost.optional")}</span>
      <MoneyInput
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="0.00"
        className="h-11 w-24"
        aria-label={t("cost.whatDidItCost")}
      />
      <Button
        type="button"
        variant="secondary"
        className="h-11 px-3"
        disabled={parsed == null}
        onClick={() => {
          if (parsed != null) onSave(parsed);
        }}
      >
        {parsed == null ? t("cost.enterAmount") : t("common.save")}
      </Button>
      <Button type="button" className="h-11 px-3" onClick={onSkip}>
        {t("common.skip")}
      </Button>
    </div>
  );
}
