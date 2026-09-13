"use client";

import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";
import { useLocale } from "@/i18n/locale-provider";

export default function NotFound() {
  const { t } = useLocale();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <BrandLockup size="sm" />
      <h1 className="ui-heading mt-5 ui-display font-semibold tracking-tight">
        {t("error.notFound")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("error.notFoundBody")}</p>
      <Link href="/" className="mt-6 ui-body font-medium text-primary">
        {t("error.goHome")}
      </Link>
    </div>
  );
}
