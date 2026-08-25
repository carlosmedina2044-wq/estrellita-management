"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { passphraseError, normalizePassphrase } from "@/lib/backup";
import { toISODate } from "@/lib/dates";
import { isNative } from "@/lib/native/platform";
import { shareBackupFile, shareText } from "@/lib/native/share";

export function BackupPanel({
  mode = "full",
  onExport,
  onImport,
  replaceCounts,
}: {
  mode?: "full" | "import-only";
  onExport?: (passphrase: string) => Promise<string>;
  onImport: (raw: string, passphrase: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  replaceCounts?: { chores: number; items: number };
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  async function exportFile() {
    if (!onExport) return;
    const error = passphraseError(passphrase);
    if (error) {
      toast.error(error);
      return;
    }
    if (passphrase !== confirm) {
      toast.error("Passphrases don’t match.");
      return;
    }
    setBusy(true);
    try {
      const json = await onExport(passphrase);
      const filename = `cuidala-home-${toISODate(new Date())}.json`;
      const offered = await offerBackupFile(json, filename);
      if (offered === "failed") {
        toast.error("Couldn’t share the backup file.");
        return;
      }
      if (offered === "cancelled") return;
      toast.success(offered === "downloaded" ? "Backup saved" : "Backup file ready. Save it to Files or iCloud Drive");
      setPassphrase("");
      setConfirm("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t create a backup.");
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    if (!normalizePassphrase(passphrase)) {
      toast.error("Enter the passphrase, then choose the file.");
      return;
    }
    const error = passphraseError(passphrase);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      const raw = await file.text();
      const result = await onImport(raw, passphrase);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Home restored");
      setPassphrase("");
      setConfirm("");
    } catch {
      toast.error("Couldn’t read that file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-card p-4">
      <p className="font-medium">{mode === "import-only" ? "Restore from a backup" : "Back up my home"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Your home moves to your next iPhone with your normal iCloud backup. The passphrase file is extra
        protection if that restore is not available. Cuidala cannot recover a forgotten passphrase.
      </p>
      <Input
        type="password"
        value={passphrase}
        onChange={(event) => setPassphrase(event.target.value)}
        placeholder="Passphrase"
        className="mt-3 h-12"
        autoComplete="new-password"
      />
      {mode === "full" ? (
        <Input
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="Confirm passphrase"
          className="mt-2 h-12"
          autoComplete="new-password"
        />
      ) : null}
      <div className="mt-3 grid gap-2">
        {mode === "full" && onExport ? (
          <Button className="h-12" disabled={busy} onClick={() => void exportFile()}>
            Create encrypted backup
          </Button>
        ) : null}
        <label className="flex h-12 cursor-pointer items-center justify-center rounded-xl bg-secondary text-sm font-medium">
          {mode === "import-only" ? "Choose backup file" : "Restore from a file"}
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) setPendingFile(file);
            }}
          />
        </label>
      </div>
      <AlertDialog open={Boolean(pendingFile)} onOpenChange={(open) => { if (!open) setPendingFile(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this home?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will replace your current home (${replaceCounts?.chores ?? 0} chores, ${replaceCounts?.items ?? 0} items). Continue?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingFile) void importFile(pendingFile);
                setPendingFile(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

async function offerBackupFile(
  json: string,
  filename: string,
): Promise<"shared" | "downloaded" | "copied" | "cancelled" | "failed"> {
  if (isNative()) return shareBackupFile(json, filename);
  try {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return "downloaded";
  } catch {
    return shareText("Cuidala backup", json);
  }
}
