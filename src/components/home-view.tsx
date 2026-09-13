"use client";

import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { lockMethodLabel, type LockMethod } from "@/lib/native/lock-labels";
import { verifyDeviceOwner } from "@/lib/native/biometrics";
import { climateLabel, CLIMATE_ZONES, deriveClimate } from "@/lib/climate";
import { notifyPermission, plannedNotifications, requestNotifyPermission, type NotifyPermission } from "@/lib/notifications";
import type { Household, RestockDigestSettings } from "@/lib/types";
import { BrandMark } from "@/components/brand-logo";
import { PageHeader } from "@/components/page-header";
import { BackupPanel } from "@/components/backup-panel";
import { ZipSheet } from "@/components/zip-prompt";
import { LegalDocSheet, type LegalDocId } from "@/components/legal/legal-doc-sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";

function problemMailto(household: Household): string {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const ios = ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace("_", ".") ?? "unknown";
  const model = ua.match(/\((iPhone[^;]*)/)?.[1] ?? "iPhone";
  const rooms = household.rooms.filter((room) => !room.system).length;
  const duties = household.duties.filter((duty) => !duty.archived).length;
  const items = household.supplyAutomations.length;
  const pending = plannedNotifications(household).length;
  const body = [
    "Describe what happened:",
    "",
    "",
    "---",
    `App ${APP_VERSION}`,
    `iOS ${ios}`,
    `Device ${model}`,
    `Counts rooms=${rooms} duties=${duties} items=${items} pendingNotifications=${pending}`,
  ].join("\n");
  return `mailto:support@cuidala.app?subject=${encodeURIComponent("Cuidala problem")}&body=${encodeURIComponent(body)}`;
}

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
  onBack,
}: {
  household: Household;
  onUpdate: (
    patch: Partial<Pick<Household, "householdName" | "ownerName" | "cleanerName" | "location" | "lockSettings">>,
  ) => void | Promise<void>;
  onSavePostalCode?: (zip: string) => Promise<{ ok: boolean; error?: string }>;
  onStartCleanerVisit: () => void;
  onChangeTree?: (next: Household) => void;
  onErase: () => Promise<{ ok: boolean }>;
  onExportBackup?: (passphrase: string) => Promise<string>;
  onImportBackup?: (raw: string, passphrase: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  canLock: boolean;
  lockMethod: LockMethod;
  restockDigest?: RestockDigestSettings;
  onUpdateDigest?: (patch: Partial<RestockDigestSettings>) => void;
  focusAssetId?: string;
  onFocusHandled?: () => void;
  onBack?: () => void;
}) {
  const [home, setHome] = useState(household.householdName);
  const [owner, setOwner] = useState(household.ownerName);
  const [cleaner, setCleaner] = useState(household.cleanerName);
  const [confirmErase, setConfirmErase] = useState(false);
  const [zipOpen, setZipOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);
  const [permission, setPermission] = useState<NotifyPermission>("prompt");
  const [hourMore, setHourMore] = useState(false);

  const HOUR_PRESETS = [
    { id: "morning", label: "Morning", hour: 8 },
    { id: "afternoon", label: "Afternoon", hour: 14 },
    { id: "evening", label: "Evening", hour: 19 },
  ] as const;

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
      <PageHeader
        title="Settings"
        subtitle="Everything stays on this iPhone."
        onBack={onBack}
        backLabel="Back to Home"
      />
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
            <p className="mt-1 text-[13px] text-muted-foreground">Used for Apple Weather and which seasonal jobs apply here.</p>
          </button>
          <div className="ui-group-row grid gap-2 px-4 py-3">
            <Label className="text-[13px] font-medium text-muted-foreground">Climate zone</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(
                  "h-11 rounded-full px-3.5 text-[13px] font-medium",
                  !household.location.climateZoneOverride
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
                onClick={() =>
                  void onUpdate({
                    location: {
                      ...household.location,
                      climateZoneOverride: undefined,
                      climateZone: deriveClimate({ ...household.location, climateZoneOverride: undefined }),
                    },
                  })
                }
              >
                Auto ({climateLabel(deriveClimate({ ...household.location, climateZoneOverride: undefined }))})
              </button>
              {CLIMATE_ZONES.map((zone) => (
                <button
                  key={zone}
                  type="button"
                  className={cn(
                    "h-11 rounded-full px-3.5 text-[13px] font-medium",
                    household.location.climateZoneOverride === zone
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                  onClick={() =>
                    void onUpdate({
                      location: {
                        ...household.location,
                        climateZoneOverride: zone,
                        climateZone: zone,
                      },
                    })
                  }
                >
                  {climateLabel(zone)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {restockDigest && onUpdateDigest ? (
        <section>
          <h2 className="ui-heading mb-2 text-[20px] font-semibold">Notifications</h2>
          <div className="ui-group">
            <div className="ui-group-row px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p id="digest-switch-label" className="text-[15px] font-medium">
                    Weekly restock digest
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    A weekly summary of what to order, only when something needs ordering.
                  </p>
                </div>
                <Switch
                  checked={restockDigest.enabled && permission === "granted"}
                  aria-labelledby="digest-switch-label"
                  onCheckedChange={(enabled) => {
                    void (async () => {
                      if (!enabled) {
                        onUpdateDigest({ enabled: false });
                        return;
                      }
                      const next = await requestNotifyPermission();
                      setPermission(next);
                      onUpdateDigest({ enabled: next === "granted" });
                    })();
                  }}
                />
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p id="private-notif-label" className="text-[15px] font-medium">
                    Hide item names on the lock screen
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Reminders still fire. Titles stay generic.
                  </p>
                </div>
                <Switch
                  checked={restockDigest.privateNotifications === true}
                  aria-labelledby="private-notif-label"
                  onCheckedChange={(next) => onUpdateDigest({ privateNotifications: next })}
                />
              </div>
              {permission === "denied" ? (
                <p className="mt-3 text-[13px] text-destructive">
                  Notifications are off for Cuidala in iOS Settings. Turn them on there to get reminders.
                </p>
              ) : permission === "prompt" && !restockDigest.enabled ? (
                <p className="mt-3 text-[13px] text-muted-foreground">
                  Turn the digest on to allow notifications when something needs ordering.
                </p>
              ) : null}
              {restockDigest.enabled && permission === "granted" ? (
                <div className="mt-3 grid gap-3">
                  <div className="-mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        className={cn(
                          "h-11 min-w-11 shrink-0 rounded-full px-2.5 text-[13px] font-medium",
                          restockDigest.weekday === index
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                        onClick={() => onUpdateDigest({ weekday: index })}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {HOUR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className={cn(
                          "h-11 rounded-full px-3.5 text-[13px] font-medium",
                          !hourMore && restockDigest.hour === preset.hour
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                        onClick={() => {
                          setHourMore(false);
                          onUpdateDigest({ hour: preset.hour });
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={cn(
                        "h-11 rounded-full px-3.5 text-[13px] font-medium",
                        hourMore || !HOUR_PRESETS.some((p) => p.hour === restockDigest.hour)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                      onClick={() => setHourMore(true)}
                    >
                      More…
                    </button>
                  </div>
                  {hourMore || !HOUR_PRESETS.some((p) => p.hour === restockDigest.hour) ? (
                    <div className="grid grid-cols-4 gap-2">
                      {Array.from({ length: 24 }, (_, hour) => (
                        <button
                          key={hour}
                          type="button"
                          className={cn(
                            "h-11 rounded-full text-[13px] font-medium",
                            restockDigest.hour === hour
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground",
                          )}
                          onClick={() => {
                            setHourMore(true);
                            onUpdateDigest({ hour });
                          }}
                        >
                          {`${String(hour).padStart(2, "0")}:00`}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="ui-group">
        <div className="ui-group-row px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-medium">{lockMethodLabel(lockMethod).toggle}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {canLock
                  ? "Locks on launch and after the app has been in the background. An app lock, not a second encryption layer."
                  : "Not available on this device. Face ID, Touch ID, or a passcode must be set up in iOS Settings."}
              </p>
            </div>
            <Switch
              checked={Boolean(household.lockSettings.requireFaceId && canLock)}
              disabled={!canLock}
              aria-label={lockMethodLabel(lockMethod).toggle}
              onCheckedChange={(next) => {
                void (async () => {
                  if (!next && canLock) {
                    const ok = await verifyDeviceOwner("Turn off app lock");
                    if (!ok) return;
                  }
                  await onUpdate({
                    lockSettings: { ...household.lockSettings, requireFaceId: next },
                  });
                })();
              }}
            />
          </div>
          {household.lockSettings.requireFaceId && canLock ? (
          <div className="mt-3 flex gap-2">
            {(["immediate", "2min", "15min"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={
                  household.lockSettings.lockAfter === item
                    ? "h-11 flex-1 rounded-full bg-primary text-[13px] text-primary-foreground"
                    : "h-11 flex-1 rounded-full bg-secondary text-[13px]"
                }
                onClick={() => void onUpdate({ lockSettings: { ...household.lockSettings, lockAfter: item } })}
              >
                {item === "immediate" ? "Immediate" : item === "2min" ? "2 min" : "15 min"}
              </button>
            ))}
          </div>
          ) : null}
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
        <BackupPanel
          mode={onExportBackup ? "full" : "import-only"}
          onExport={onExportBackup}
          onImport={onImportBackup}
          replaceCounts={{
            chores: household.duties.filter((duty) => !duty.archived).length,
            items: household.supplyAutomations.length,
          }}
        />
      ) : null}

      <section>
        <h2 className="ui-heading mb-2 text-[20px] font-semibold">Cuidala Pro</h2>
        <div className="rounded-2xl bg-card p-4">
          <p className="font-medium">Later this year — optional, one-time, no subscription.</p>
          <ul className="mt-2 list-disc pl-5 text-[13px] text-muted-foreground">
            <li>Home Report you can share with a buyer or a contractor</li>
            <li>Household sync across phones</li>
            <li>More seasonal playbook packs</li>
          </ul>
        </div>
      </section>

      <div className="rounded-2xl bg-card p-4">
        <p className="font-medium">Your data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Everything about your home is stored on this iPhone, encrypted with a key kept in the device
          Keychain. Your home moves to your next iPhone with your normal iCloud backup. The passphrase
          file is extra protection. There is no account and no server copy. Deleting the app deletes the data.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-primary">
          <button type="button" className="inline-flex min-h-11 items-center" onClick={() => setLegalDoc("how-it-works")}>
            How Cuidala works
          </button>
          <button type="button" className="inline-flex min-h-11 items-center" onClick={() => setLegalDoc("privacy")}>
            Privacy policy
          </button>
          <button type="button" className="inline-flex min-h-11 items-center" onClick={() => setLegalDoc("terms")}>
            Additional terms
          </button>
        </div>
        <a
          className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-secondary text-sm font-medium"
          href={problemMailto(household)}
        >
          Report a problem
        </a>
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
                void (async () => {
                  if (canLock) {
                    const verified = await verifyDeviceOwner("Erase everything");
                    if (!verified) {
                      toast.error("Couldn’t verify it’s you.");
                      return;
                    }
                  }
                  const result = await onErase();
                  if (result.ok) toast.success("Erased");
                  else toast.error("Couldn’t erase this home. Try again.");
                })();
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
      <LegalDocSheet doc={legalDoc} onOpenChange={(open) => !open && setLegalDoc(null)} />
      <div className="mt-6 flex flex-col items-center gap-1 pb-2">
        <BrandMark size="sm" />
        <p className="text-[11px] text-muted-foreground">Cuidala</p>
      </div>
    </div>
  );
}
