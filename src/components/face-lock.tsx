"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { evaluateDeviceOwner, nativeBiometricsAvailable } from "@/lib/native/biometrics";
import { isNativeIos } from "@/lib/native/platform";
import { formatPasskeyError, hasStoredPasskey, unlockSecretWithPasskey } from "@/lib/passkey";

export function FaceLock({
  onUnlock,
}: {
  onUnlock: (secret?: string) => Promise<boolean>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function unlock() {
    setBusy(true);
    setError("");
    try {
      if (isNativeIos() && (await nativeBiometricsAvailable())) {
        await evaluateDeviceOwner();
        const ok = await onUnlock();
        if (!ok) setError("Face ID worked, but the Keychain session could not open the vault.");
        return;
      }
      if (hasStoredPasskey()) {
        const secret = await unlockSecretWithPasskey();
        const ok = await onUnlock(secret);
        if (!ok) setError("Face ID worked, but that session did not open the vault.");
        return;
      }
      setError("Face ID is not enrolled on this device. Add a passkey in Settings.");
    } catch (caught) {
      setError(formatPasskeyError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <h1 className="ui-heading text-[34px] font-semibold tracking-tight">Estrellita is locked</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use Face ID or Touch ID to open today’s list. Nothing else is visible until you unlock.
      </p>
      <Button className="mt-8 h-14" disabled={busy} onClick={() => void unlock()}>
        {busy ? "Waiting…" : "Unlock with Face ID"}
      </Button>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
