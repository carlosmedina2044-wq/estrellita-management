"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocale } from "@/i18n/locale-provider";
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
  const { t } = useLocale();
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
      setError(t("zip.errorInvalidOrSkip"));
      return;
    }
    setBusy(true);
    const result = await onSave(next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? t("zip.saveFailed"));
      return;
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        size="form"
        className="gap-0 rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle>{t("zip.addTitle")}</SheetTitle>
          <SheetDescription>{t("zip.addBody")}</SheetDescription>
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
            placeholder={t("zip.placeholder")}
            className="h-14"
            aria-label={t("zip.placeholder")}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button className="h-12 w-full" disabled={busy} onClick={() => void submit()}>
            {busy ? t("zip.saving") : t("zip.saveCta")}
          </Button>
          <button
            type="button"
            className="h-11 ui-body font-medium text-primary"
            onClick={() => onOpenChange(false)}
          >
            {t("restock.skipForNow")}
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
  const { t } = useLocale();
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
      setError(t("zip.errorInvalid"));
      return;
    }
    setBusy(true);
    const result = await onSave(next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? t("zip.saveFailed"));
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
        placeholder={t("zip.placeholder")}
        className="h-12"
        aria-label={t("zip.placeholder")}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" className="h-12 w-full" disabled={busy} onClick={() => void submit()}>
        {busy ? t("zip.saving") : t("zip.saveCta")}
      </Button>
    </div>
  );
}
