"use client";

import { useLocale } from "@/i18n/locale-provider";

export function PrivacyContent() {
  const { t } = useLocale();
  return (
    <div className="grid gap-3 ui-body leading-6">
      <p className="text-sm text-muted-foreground">{t("legal.privacy.effective")}</p>

      <h2 className="mt-2 font-semibold">{t("legal.privacy.whatTitle")}</h2>
      <p>{t("legal.privacy.whatBody")}</p>

      <h2 className="mt-2 font-semibold">{t("legal.privacy.storedTitle")}</h2>
      <p>{t("legal.privacy.storedBody")}</p>

      <h2 className="mt-2 font-semibold">{t("legal.privacy.leavesTitle")}</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>{t("legal.privacy.weatherStrong")}</strong> {t("legal.privacy.weatherBody")}
        </li>
        <li>
          <strong>{t("legal.privacy.retailerStrong")}</strong> {t("legal.privacy.retailerBody")}
        </li>
      </ul>
      <p>{t("legal.privacy.completeList")}</p>

      <h2 className="mt-2 font-semibold">{t("legal.privacy.labelTitle")}</h2>
      <p>{t("legal.privacy.labelBody")}</p>

      <h2 className="mt-2 font-semibold">{t("legal.privacy.permTitle")}</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>{t("legal.privacy.locStrong")}</strong> {t("legal.privacy.locBody")}
        </li>
        <li>
          <strong>{t("legal.privacy.notifStrong")}</strong> {t("legal.privacy.notifBody")}
        </li>
        <li>
          <strong>{t("legal.privacy.bioStrong")}</strong> {t("legal.privacy.bioBody")}
        </li>
      </ul>

      <h2 className="mt-2 font-semibold">{t("legal.privacy.deleteTitle")}</h2>
      <p>{t("legal.privacy.deleteBody")}</p>

      <h2 className="mt-2 font-semibold">{t("legal.privacy.childrenTitle")}</h2>
      <p>{t("legal.privacy.childrenBody")}</p>

      <h2 className="mt-2 font-semibold">{t("legal.privacy.contactTitle")}</h2>
      <p>
        {t("legal.privacy.contactBody")}{" "}
        <a className="text-primary" href="mailto:privacy@cuidala.app">
          privacy@cuidala.app
        </a>
        .
      </p>
    </div>
  );
}
