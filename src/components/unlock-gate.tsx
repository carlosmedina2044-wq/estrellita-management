"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPasskeyError, hasStoredPasskey, unlockSecretWithPasskey } from "@/lib/passkey";
import type { Gate } from "@/lib/storage";

export function UnlockGate({
  gate,
  onUnlock,
  onWrap,
  onJoin,
}: {
  gate: Gate;
  onUnlock: (secret: string) => Promise<boolean>;
  onWrap: (secret: string) => Promise<boolean>;
  onJoin: (vaultId: string, secret: string) => Promise<boolean>;
}) {
  const [pin, setPin] = useState("");
  const [vaultId, setVaultId] = useState("");
  const [joining, setJoining] = useState(false);
  const showJoin = gate === "empty" || joining;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [passkeyReady, setPasskeyReady] = useState(false);

  useEffect(() => {
    setPasskeyReady(gate === "locked" && !showJoin && hasStoredPasskey());
  }, [gate, showJoin]);

  const title =
    gate === "needs-wrap"
      ? "Encrypt this household"
      : showJoin
        ? "Open on this phone"
        : "Unlock Estrellita";

  const copy =
    gate === "needs-wrap"
      ? "Enter your owner PIN. Duties, SKUs, and notes are encrypted on this device before they sync."
      : showJoin
        ? "Paste the sync code from Settings on your other phone, then enter the same PIN."
        : passkeyReady
          ? "Unlock with Face ID on this iPhone, or enter your PIN."
          : "Household data on this phone is encrypted. Your PIN stays on the device and unlocks it here.";

  async function submit() {
    setBusy(true);
    setError("");
    const ok =
      gate === "needs-wrap"
        ? await onWrap(pin)
        : showJoin
          ? await onJoin(vaultId, pin)
          : await onUnlock(pin);
    setBusy(false);
    if (!ok) {
      setError(
        showJoin
          ? "Could not open that household. Check the sync code and PIN."
          : "That PIN did not unlock the household.",
      );
    }
  }

  function unlockWithPasskey() {
    const startedAt = Date.now();
    setBusy(true);
    setError("");
    const unlocking = unlockSecretWithPasskey();
    void (async () => {
      try {
        const secret = await unlocking;
        const ok = await onUnlock(secret);
        if (!ok) setError("Face ID worked, but that secret did not open the vault. Use your PIN.");
      } catch (error) {
        setError(formatPasskeyError(error, startedAt));
      }
      setBusy(false);
    })();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 pb-[calc(1.5rem+var(--keyboard-inset,0px)+env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <h1 className="ui-heading text-[28px] font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
      {showJoin ? (
        <Input
          value={vaultId}
          onChange={(event) => setVaultId(event.target.value)}
          placeholder="Sync code"
          autoComplete="off"
          className="mt-6 h-12"
        />
      ) : null}
      {passkeyReady ? (
        <Button type="button" className="mt-6 h-12" disabled={busy} onClick={unlockWithPasskey}>
          {busy ? "Waiting for Face ID…" : "Unlock with Face ID"}
        </Button>
      ) : null}
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(event) => setPin(event.target.value)}
        placeholder={passkeyReady ? "PIN fallback" : "Owner PIN"}
        className={showJoin || passkeyReady ? "mt-3 h-12" : "mt-6 h-12"}
      />
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <Button
        type="button"
        className={passkeyReady ? "mt-3 h-12" : "mt-6 h-12"}
        variant={passkeyReady ? "secondary" : "default"}
        disabled={busy || pin.trim().length < 4}
        onClick={() => void submit()}
      >
        {busy
          ? "Working…"
          : gate === "needs-wrap"
            ? "Encrypt and continue"
            : passkeyReady
              ? "Unlock with PIN"
              : "Unlock"}
      </Button>
      {gate === "locked" ? (
        <button
          type="button"
          className="mt-4 text-[13px] font-medium text-primary"
          onClick={() => {
            setJoining((current) => !current);
            setError("");
          }}
        >
          {joining ? "Back" : "Open a household from another phone"}
        </button>
      ) : null}
    </div>
  );
}
