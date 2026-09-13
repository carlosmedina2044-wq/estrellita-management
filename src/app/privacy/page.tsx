"use client";

import Link from "next/link";
import { BrandLockup } from "@/components/brand-logo";
import { PrivacyContent } from "@/components/legal/privacy-content";
import { useLocale } from "@/i18n/locale-provider";

export default function PrivacyPage() {
  const { t } = useLocale();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-5 pb-12 pt-[max(1.5rem,env(safe-area-inset-top))] ui-body leading-6">
      <Link href="/" className="text-sm font-medium text-primary">
        {t("common.backArrow")}
      </Link>
      <BrandLockup size="sm" />
      <h1 className="ui-heading ui-display font-semibold tracking-tight">{t("legal.privacy.title")}</h1>
      <PrivacyContent />
    </main>
  );
}
