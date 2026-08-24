"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { isValidUsZip, normalizeUsZip } from "@/lib/climate";

export function ZipSheet({
  open,
  initialZip = "",
  onOpenChange,
  onSave,
}: {
  open: boolean;
  initialZip?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (zip: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [zip, setZip] = useState(initialZip);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setZip(normalizeUsZip(initialZip));
      setError("");
      setBusy(false);
    }
  }

  async function submit() {
    const next = normalizeUsZip(zip);
    if (!isValidUsZip(next)) {
      setError("Enter a 5-digit US ZIP, or skip.");
      return;
    }
    setBusy(true);
    const result = await onSave(next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save that ZIP.");
      return;
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="gap-0 rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>Add your ZIP</SheetTitle>
          <SheetDescription>Used for weather and which seasonal jobs apply. Not stored more precisely than the ZIP.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <Input
            inputMode="numeric"
            autoComplete="postal-code"
            value={zip}
            onChange={(event) => {
              setZip(normalizeUsZip(event.target.value));
              setError("");
            }}
            placeholder="ZIP code"
            className="h-14"
            aria-label="ZIP code"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="h-12 w-full" disabled={busy} onClick={() => void submit()}>
            {busy ? "Saving…" : "Save ZIP"}
          </Button>
          <button
            type="button"
            className="h-11 text-[15px] font-medium text-primary"
            onClick={() => onOpenChange(false)}
          >
            Skip for now
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ZipField({
  value,
  onSave,
}: {
  value?: string;
  onSave: (zip: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [zip, setZip] = useState(normalizeUsZip(value ?? ""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setZip(normalizeUsZip(value ?? ""));
  }

  async function submit() {
    const next = normalizeUsZip(zip);
    if (!isValidUsZip(next)) {
      setError("Enter a 5-digit US ZIP.");
      return;
    }
    setBusy(true);
    const result = await onSave(next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save that ZIP.");
      return;
    }
    setError("");
  }

  return (
    <div className="grid gap-2">
      <Input
        inputMode="numeric"
        autoComplete="postal-code"
        value={zip}
        onChange={(event) => {
          setZip(normalizeUsZip(event.target.value));
          setError("");
        }}
        placeholder="ZIP code"
        className="h-12"
        aria-label="ZIP code"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" className="h-12 w-full" disabled={busy} onClick={() => void submit()}>
        {busy ? "Saving…" : "Save ZIP"}
      </Button>
    </div>
  );
}
