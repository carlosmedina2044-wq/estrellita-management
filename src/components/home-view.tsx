"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HomeEditor } from "@/components/home-editor";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lockMethodLabel, type LockMethod } from "@/lib/native/lock-labels";
import type { Household, RestockDigestSettings } from "@/lib/types";
import { BrandMark } from "@/components/brand-logo";
import { PageHeader } from "@/components/page-header";
import { BackupPanel } from "@/components/backup-panel";
import { ZipSheet } from "@/components/zip-prompt";
import { climateLabel, deriveClimate } from "@/lib/climate";
import { notifyPermission, requestNotifyPermission, type NotifyPermission } from "@/lib/notifications";
import { toast } from "sonner";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";

export function HomeView({
  household,
  onUpdate,
  onSavePostalCode,
  onStartCleanerVisit,
  onChangeTree,
  onErase,
  onExportBackup,
  onImportBackup,
  canLock,
  lockMethod,
  restockDigest,
  onUpdateDigest,
  focusAssetId,
  onFocusHandled,
}: {
  household: Household;
  onUpdate: (
    patch: Partial<Pick<Household, "householdName" | "ownerName" | "cleanerName" | "location" | "lockSettings">>,
  ) => void | Promise<void>;
  onSavePostalCode?: (zip: string) => Promise<{ ok: boolean; error?: string }>;
  onStartCleanerVisit: () => void;
  onChangeTree?: (next: Household) => void;
  onErase: () => Promise<void>;
  onExportBackup?: (passphrase: string) => Promise<string>;
  onImportBackup?: (raw: string, passphrase: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  canLock: boolean;
  lockMethod: LockMethod;
  restockDigest?: RestockDigestSettings;
  onUpdateDigest?: (patch: Partial<RestockDigestSettings>) => void;
  focusAssetId?: string;
  onFocusHandled?: () => void;
}) {
  const [home, setHome] = useState(household.householdName);
  const [owner, setOwner] = useState(household.ownerName);
  const [cleaner, setCleaner] = useState(household.cleanerName);
  const [confirmErase, setConfirmErase] = useState(false);
  const [zipOpen, setZipOpen] = useState(false);
  const [permission, setPermission] = useState<NotifyPermission>("prompt");

  useEffect(() => {
    let cancelled = false;
    void notifyPermission().then((value) => {
      if (!cancelled) setPermission(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    await onUpdate({
      householdName: home,
      ownerName: owner,
      cleanerName: cleaner,
    });
    toast.success("Saved");
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader title="Settings" subtitle="Everything stays on this iPhone." />
      <section>
        <h2 className="ui-heading mb-2 text-[20px] font-semibold">Household</h2>
        <div className="ui-group">
          <div className="ui-group-row grid gap-1.5 px-4 py-3">
            <Label className="text-[13px] font-medium text-muted-foreground">Home name</Label>
            <Input
              value={home}
              onChange={(event) => setHome(event.target.value)}
              placeholder="e.g. Our house"
              className="h-12"
            />
          </div>
          <div className="ui-group-row grid gap-1.5 px-4 py-3">
            <Label className="text-[13px] font-medium text-muted-foreground">Your name</Label>
            <Input
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              placeholder="Your first name"
              className="h-12"
            />
          </div>
          <div className="ui-group-row grid gap-1.5 px-4 py-3">
            <Label className="text-[13px] font-medium text-muted-foreground">Cleaner</Label>
            <Input
              value={cleaner}
              onChange={(event) => setCleaner(event.target.value)}
              placeholder="Name or company (optional)"
              className="h-12"
            />
          </div>
        </div>
      </section>
      <section>
        <h2 className="ui-heading mb-2 text-[20px] font-semibold">Location</h2>
        <div className="ui-group">
          <button type="button" className="ui-group-row w-full px-4 py-3 text-left" onClick={() => setZipOpen(true)}>
            <p className="text-[15px] font-medium">ZIP code</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {household.location.postalCode
                ? `${household.location.placeName ? `${household.location.placeName} · ` : ""}${climateLabel(deriveClimate(household.location))}`
                : "Not set"}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">Used for weather alerts and seasonal timing.</p>
          </button>
        </div>
      </section>

      {restockDigest && onUpdateDigest ? (
        <section>
          <h2 className="ui-heading mb-2 text-[20px] font-semibold">Notifications</h2>
          <div className="rounded-2xl bg-card p-4">
            <p className="font-medium">Weekly restock digest</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              A weekly summary of what to order, sent only when something needs ordering.
            </p>
            {permission === "prompt" ? (
              <Button className="mt-3 h-11 w-full" onClick={() => void requestNotifyPermission().then(setPermission)}>
                Allow notifications
              </Button>
            ) : permission === "denied" ? (
              <p className="mt-3 text-[13px] text-destructive">
                Notifications are off for Cuidala in iOS Settings. Turn them on there to get reminders.
              </p>
            ) : null}
            <button
              type="button"
              className="mt-3 h-12 w-full rounded-xl bg-secondary text-[15px] font-medium"
              onClick={() => onUpdateDigest({ enabled: !restockDigest.enabled })}
            >
              {restockDigest.enabled ? "On" : "Off"}
            </button>
            {restockDigest.enabled ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <select
                  className="h-11 rounded-xl bg-secondary px-3 text-[15px]"
                  value={restockDigest.weekday}
                  onChange={(event) => onUpdateDigest({ weekday: Number(event.target.value) })}
                >
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
                <select
                  className="h-11 rounded-xl bg-secondary px-3 text-[15px]"
                  value={restockDigest.hour}
                  onChange={(event) => onUpdateDigest({ hour: Number(event.target.value) })}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {`${String(hour).padStart(2, "0")}:00`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="rounded-2xl bg-card p-4">
        <p className="font-medium">{lockMethodLabel(lockMethod).toggle}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {canLock
            ? "Locks the home screen on launch and after the app has been in the background. This is an app lock, not a second encryption layer. Anyone with this iPhone’s passcode can still open Cuidala."
            : "Not available on this device. Face ID, Touch ID, or a passcode must be set up in iOS Settings."}
        </p>
        <button
          type="button"
          disabled={!canLock}
          className="mt-3 h-12 w-full rounded-xl bg-secondary text-sm font-medium disabled:opacity-50"
          onClick={() =>
            void onUpdate({
              lockSettings: { ...household.lockSettings, requireFaceId: !household.lockSettings.requireFaceId },
            })
          }
        >
          {household.lockSettings.requireFaceId && canLock ? "On" : "Off"}
        </button>
        <div className="mt-3 flex gap-2">
          {(["immediate", "2min", "15min"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={
                household.lockSettings.lockAfter === item
                  ? "h-10 flex-1 rounded-full bg-primary text-[13px] text-primary-foreground"
                  : "h-10 flex-1 rounded-full bg-secondary text-[13px]"
              }
              onClick={() => void onUpdate({ lockSettings: { ...household.lockSettings, lockAfter: item } })}
            >
              {item === "immediate" ? "Immediate" : item === "2min" ? "2 min" : "15 min"}
            </button>
          ))}
        </div>
      </div>

      {onChangeTree ? (
        <HomeEditor
          household={household}
          onChange={onChangeTree}
          focusAssetId={focusAssetId}
          onFocusHandled={onFocusHandled}
        />
      ) : null}

      <Button className="h-12" onClick={save}>
        Save
      </Button>

      <Button variant="secondary" className="h-12" onClick={onStartCleanerVisit}>
        Hand phone to {household.cleanerName || "Cleaner"}
      </Button>

      {onImportBackup ? (
        <BackupPanel mode={onExportBackup ? "full" : "import-only"} onExport={onExportBackup} onImport={onImportBackup} />
      ) : null}

      <div className="rounded-2xl bg-card p-4">
        <p className="font-medium">Your data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Everything about your home is stored on this iPhone, encrypted with a key kept
          in the device Keychain. There is no account and no server copy. An iCloud device backup restores
          the encrypted home but not that key. Use Back up my home before you switch phones. Deleting the
          app deletes the data.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-primary">
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms of use</Link>
        </div>
        <Button
          variant="secondary"
          className="mt-3 h-12 w-full text-destructive"
          onClick={() => setConfirmErase(true)}
        >
          Erase all data on this iPhone
        </Button>
        <p className="mt-3 text-[11px] text-muted-foreground">Cuidala {APP_VERSION}</p>
      </div>

      <AlertDialog open={confirmErase} onOpenChange={setConfirmErase}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <BrandMark size="sm" className="mx-auto mb-2" />
            <AlertDialogTitle>Erase everything?</AlertDialogTitle>
            <AlertDialogDescription>
              Rooms, chores, items, history, and reminders on this iPhone will be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                void onErase().then(() => toast.success("Erased"));
              }}
            >
              Erase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {onSavePostalCode ? (
        <ZipSheet
          open={zipOpen}
          initialZip={household.location.postalCode}
          onOpenChange={setZipOpen}
          onSave={async (zip) => {
            const result = await onSavePostalCode(zip);
            if (result.ok) toast.success("ZIP saved");
            return result;
          }}
        />
      ) : (
        <ZipSheet
          open={zipOpen}
          initialZip={household.location.postalCode}
          onOpenChange={setZipOpen}
          onSave={async (zip) => {
            await onUpdate({ location: { ...household.location, postalCode: zip } });
            toast.success("ZIP saved");
            return { ok: true };
          }}
        />
      )}
      <div className="mt-6 flex flex-col items-center gap-1 pb-2">
        <BrandMark size="sm" />
        <p className="text-[11px] text-muted-foreground">Cuidala</p>
      </div>
    </div>
  );
}
