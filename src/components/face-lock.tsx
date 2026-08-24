"use client";

import { useEffect, useState } from "react";
import { BrandLockup } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { verifyDeviceOwner } from "@/lib/native/biometrics";
import { lockMethodLabel, type LockMethod } from "@/lib/native/lock-labels";

/**
 * App lock. Resolves only when the system confirms Face ID / Touch ID / passcode.
 * If verification fails or is cancelled the app stays locked; there is no bypass.
 */
export function FaceLock({ method, onUnlocked }: { method: LockMethod; onUnlocked: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function unlock() {
    setBusy(true);
    setError("");
    const ok = await verifyDeviceOwner("Unlock Cuidala");
    setBusy(false);
    if (ok) onUnlocked();
    else setError("Couldn’t confirm it’s you. Try again.");
  }

  useEffect(() => {
    // Prompt once on mount; the button covers retries.
    const timer = window.setTimeout(() => void unlock(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-8 text-center">
      <div className="brand-enter">
        <BrandLockup size="md" />
      </div>
      <h1 className="ui-heading mt-10 text-[22px] font-semibold tracking-tight">Locked</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{lockMethodLabel(method).prompt}</p>
      <Button className="mt-8 h-14 w-full max-w-xs" disabled={busy} onClick={() => void unlock()}>
        {busy ? "Waiting…" : "Unlock"}
      </Button>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
