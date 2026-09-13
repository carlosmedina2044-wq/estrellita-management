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
import {
  BACKUP_MAX_FILE_BYTES,
  openPassphraseError,
  passphraseError,
  passphraseHint,
} from "@/lib/backup";
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
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const hint = mode === "full" ? passphraseHint(passphrase) : null;
  const restoreBlocked = openPassphraseError(restorePassphrase) !== null;

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

  async function importFile(file: File, secret: string) {
    if (file.size > BACKUP_MAX_FILE_BYTES) {
      toast.error("That file is too large to be a Cuidala backup.");
      return;
    }
    const error = openPassphraseError(secret);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      const raw = await file.text();
      const result = await onImport(raw, secret);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Home restored");
      setRestorePassphrase("");
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
      {mode === "full" && onExport ? (
        <div className="mt-3">
          <p className="text-sm font-medium">Create a backup</p>
          <Input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Passphrase for this backup"
            className="mt-2 h-12"
            autoComplete="new-password"
          />
          <Input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="Confirm passphrase"
            className="mt-2 h-12"
            autoComplete="new-password"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Choose a phrase you don’t use anywhere else.
            {hint ? ` ${hint}` : ""}
          </p>
          <Button className="mt-3 h-12 w-full" disabled={busy} onClick={() => void exportFile()}>
            Create encrypted backup
          </Button>
        </div>
      ) : null}
      <label className="mt-3 flex h-12 cursor-pointer items-center justify-center rounded-xl bg-secondary text-sm font-medium">
        {mode === "import-only" ? "Choose backup file" : "Restore from a file"}
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (file.size > BACKUP_MAX_FILE_BYTES) {
              toast.error("That file is too large to be a Cuidala backup.");
              return;
            }
            setRestorePassphrase("");
            setPendingFile(file);
          }}
        />
      </label>
      <AlertDialog
        open={Boolean(pendingFile)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingFile(null);
            setRestorePassphrase("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will replace your current home (${replaceCounts?.chores ?? 0} chores, ${replaceCounts?.items ?? 0} items).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="password"
            value={restorePassphrase}
            onChange={(event) => setRestorePassphrase(event.target.value)}
            placeholder="Passphrase"
            className="h-12"
            autoFocus
            autoComplete="current-password"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoreBlocked || busy}
              onClick={(event) => {
                if (restoreBlocked || !pendingFile) {
                  event.preventDefault();
                  return;
                }
                void importFile(pendingFile, restorePassphrase);
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
