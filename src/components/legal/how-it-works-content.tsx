"use client";

import { useLocale } from "@/i18n/locale-provider";

export function HowItWorksContent() {
  const { t } = useLocale();
  return (
    <div className="grid gap-4 ui-body leading-6">
      <section>
        <h2 className="font-semibold">{t("legal.how.s1.title")}</h2>
        <p className="mt-1 text-muted-foreground">{t("legal.how.s1.body")}</p>
      </section>
      <section>
        <h2 className="font-semibold">{t("legal.how.s2.title")}</h2>
        <p className="mt-1 text-muted-foreground">{t("legal.how.s2.body")}</p>
      </section>
      <section>
        <h2 className="font-semibold">{t("legal.how.s3.title")}</h2>
        <p className="mt-1 text-muted-foreground">{t("legal.how.s3.body")}</p>
      </section>
      <section>
        <h2 className="font-semibold">{t("legal.how.s4.title")}</h2>
        <p className="mt-1 text-muted-foreground">{t("legal.how.s4.body")}</p>
      </section>
      <section>
        <h2 className="font-semibold">{t("legal.how.s5.title")}</h2>
        <p className="mt-1 text-muted-foreground">{t("legal.how.s5.body")}</p>
      </section>
      <section>
        <h2 className="font-semibold">{t("legal.how.s6.title")}</h2>
        <p className="mt-1 text-muted-foreground">{t("legal.how.s6.body")}</p>
      </section>
    </div>
  );
}
