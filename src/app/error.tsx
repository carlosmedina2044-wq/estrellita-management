"use client";

import { useEffect } from "react";
import { BrandLockup } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <BrandLockup size="sm" />
      <h1 className="ui-heading mt-5 ui-display font-semibold tracking-tight">
        {t("error.somethingWrong")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("error.loadFailedBody")}
      </p>
      <Button className="mt-6 h-12" onClick={() => retry()}>
        {t("error.tryAgain")}
      </Button>
    </div>
  );
}
