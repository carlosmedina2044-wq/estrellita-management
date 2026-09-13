"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { TeachingTip } from "@/components/teaching-tip";
import { useLocale } from "@/i18n/locale-provider";
import { lockMethodLabel, type LockMethod } from "@/lib/native/lock-labels";
import type { UnlockHouseholdResult } from "@/lib/storage";

/**
 * App lock. Vault decrypt happens only after ACL Keychain get succeeds.
 * Cancel / auth failure keeps the app locked; cancel ≠ missing key.
 */
export function FaceLock({
  method,
  performUnlock,
  onUnlocked,
  onUnlockFailed,
  showTip,
  onDismissTip,
  cleanerVisitActive,
}: {
  method: LockMethod;
  performUnlock: () => Promise<UnlockHouseholdResult>;
  onUnlocked: () => void;
  onUnlockFailed?: (result: Exclude<UnlockHouseholdResult, { ok: true }>) => void;
  showTip?: boolean;
  onDismissTip?: () => void;
  cleanerVisitActive?: boolean;
}) {
  const { t } = useLocale();
  const lockCopy = lockMethodLabel(method, t);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function unlock() {
    setBusy(true);
    setError("");
    const result = await performUnlock();
    setBusy(false);
    if (result.ok) {
      onUnlocked();
      return;
    }
    onUnlockFailed?.(result);
    if (result.reason === "canceled") {
      setError(t("lock.cancelError"));
      return;
    }
    if (result.reason === "auth_failed") {
      setError(t("lock.authError"));
      return;
    }
    setError(t("lock.openError"));
  }

  useEffect(() => {
    if (showTip) return;
    const timer = window.setTimeout(() => void unlock(), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTip]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-8 text-center">
      <BrandMark size="md" />
      <h1 className="ui-heading mt-10 ui-title font-semibold tracking-tight">{t("lock.title")}</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {cleanerVisitActive
          ? t("lock.cleanerVisit", { method: lockCopy.noun })
          : lockCopy.prompt}
      </p>
      <p className="mt-2 max-w-xs ui-caption text-muted-foreground">{t("lock.passcodeHint")}</p>
      {showTip ? (
        <div className="mt-4 w-full max-w-xs text-left">
          <TeachingTip onDismiss={() => onDismissTip?.()}>{t("lock.tip")}</TeachingTip>
        </div>
      ) : null}
      <Button className="mt-8 h-14 w-full max-w-xs" disabled={busy} onClick={() => void unlock()}>
        {busy ? t("lock.waiting") : t("lock.unlock")}
      </Button>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
