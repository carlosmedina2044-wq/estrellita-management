"use client";

import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/brand-logo";
import { SceneBoundary } from "@/components/scene-boundary";
import { PortraitScene } from "@/components/today/portrait-scene";
import { Button } from "@/components/ui/button";
import { TeachingTip } from "@/components/teaching-tip";
import { useLocale } from "@/i18n/locale-provider";
import { useClock } from "@/hooks/use-clock";
import { dayArc } from "@/lib/momentum";
import { lockMethodLabel, type LockMethod } from "@/lib/native/lock-labels";
import { sceneWeather } from "@/lib/scene/weather";
import { skyPhase, sunTimes } from "@/lib/scene/sun";
import type { UnlockHouseholdResult } from "@/lib/storage";
import { toISODate } from "@/lib/dates";
import type { Household } from "@/lib/types";

/**
 * App lock. Vault decrypt happens only after ACL Keychain get succeeds.
 * Cancel / auth failure keeps the app locked; cancel ≠ missing key.
 */
export function FaceLock({
  method,
  household,
  performUnlock,
  onUnlocked,
  onUnlockFailed,
  showTip,
  onDismissTip,
  cleanerVisitActive,
}: {
  method: LockMethod;
  /** The in-memory household, if one is already loaded (e.g. re-locked after
   * an earlier unlock this session) — used only to paint the ambient scene
   * behind the card. Chore counts/text never render on a locked screen. */
  household?: Household;
  performUnlock: () => Promise<UnlockHouseholdResult>;
  onUnlocked: () => void;
  onUnlockFailed?: (result: Exclude<UnlockHouseholdResult, { ok: true }>) => void;
  showTip?: boolean;
  onDismissTip?: () => void;
  cleanerVisitActive?: boolean;
}) {
  const { t } = useLocale();
  const clock = useClock();
  const clockMs = clock.getTime();
  const lat = household?.location.lat;
  const lng = household?.location.lng;
  const sceneTimes = useMemo(
    () => (lat != null && lng != null ? sunTimes(lat, lng, new Date(clockMs)) : null),
    [lat, lng, clockMs],
  );
  const scenePhase = useMemo(() => skyPhase(new Date(clockMs), sceneTimes), [clockMs, sceneTimes]);
  const sceneArc = useMemo(() => (household ? dayArc(household, clock, "all") : null), [household, clock]);
  const sceneWx = useMemo(() => sceneWeather(null, toISODate(clock)), [clock]);
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
    <div className="flex min-h-dvh w-full flex-col overflow-hidden bg-background">
      {household && sceneArc ? (
        // Purely decorative, at the scene's own natural height (same as
        // Today) rather than stretched to fill the screen — reuses the
        // established "scene up top" composition instead of a bespoke
        // full-bleed lock-screen layout. `aria-hidden` keeps its (otherwise
        // count-bearing) `role="img"` label out of the accessibility tree
        // entirely, matching the "no chore details on a locked screen"
        // stance `privateNotifications` already takes elsewhere.
        <div aria-hidden className="opacity-90 blur-[1.5px] brightness-[0.6]">
          <SceneBoundary>
            <PortraitScene
              household={household}
              arc={sceneArc}
              phase={scenePhase.phase}
              phaseT={scenePhase.t}
              weather={sceneWx}
              ceremony={false}
              greeting=""
              secondaryLine=""
            />
          </SceneBoundary>
        </div>
      ) : null}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-8 pb-12 text-center">
        <div className="ui-bevel w-full max-w-xs bg-card/95 px-6 py-8 backdrop-blur-md">
          <BrandMark size="md" className="mx-auto" />
          <h1 className="ui-heading mt-8 ui-title font-semibold tracking-tight">{t("lock.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {cleanerVisitActive
              ? t("lock.cleanerVisit", { method: lockCopy.noun })
              : lockCopy.prompt}
          </p>
          <p className="mt-2 ui-caption text-muted-foreground">{t("lock.passcodeHint")}</p>
          {showTip ? (
            <div className="mt-4 w-full text-left">
              <TeachingTip onDismiss={() => onDismissTip?.()}>{t("lock.tip")}</TeachingTip>
            </div>
          ) : null}
          <Button className="mt-8 h-14 w-full" disabled={busy} onClick={() => void unlock()}>
            {busy ? t("lock.waiting") : t("lock.unlock")}
          </Button>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
