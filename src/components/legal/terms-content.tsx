"use client";

import { useLocale } from "@/i18n/locale-provider";

export function TermsContent() {
  const { t } = useLocale();
  return (
    <div className="grid gap-3 ui-body leading-6">
      <p className="text-sm text-muted-foreground">{t("legal.terms.effective")}</p>
      <p>{t("legal.terms.p1")}</p>
      <p>{t("legal.terms.p2")}</p>
      <p>{t("legal.terms.p3")}</p>
      <p>{t("legal.terms.p4")}</p>
      <p>{t("legal.terms.p5")}</p>
      <p>{t("legal.terms.p6")}</p>
      <p>
        {t("legal.terms.p7")}{" "}
        <a className="text-primary" href="mailto:support@cuidala.app">
          {t("legal.terms.email")}
        </a>
        .
      </p>
    </div>
  );
}
