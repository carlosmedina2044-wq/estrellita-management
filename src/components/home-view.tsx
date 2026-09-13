"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { lockMethodLabel, type LockMethod } from "@/lib/native/lock-labels";
import { verifyDeviceOwner } from "@/lib/native/biometrics";
import { hapticDestructive } from "@/lib/native/haptics";
import { climateLabel, CLIMATE_ZONES, deriveClimate } from "@/lib/climate";
import { notifyPermission, plannedNotifications, requestNotifyPermission, type NotifyPermission } from "@/lib/notifications";
import type { Household, RestockDigestSettings } from "@/lib/types";
import { BrandMark } from "@/components/brand-logo";
import { PageHeader } from "@/components/page-header";
import { BackupPanel } from "@/components/backup-panel";
import { ZipSheet } from "@/components/zip-prompt";
import { LegalDocSheet, type LegalDocId } from "@/components/legal/legal-doc-sheet";
import { tActive, type AppLocale } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
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
    tActive("settings.reportBody"),
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
  backLabel = "Back to Home",
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
  backLabel?: string;
}) {
  const { t, preference, setPreference } = useLocale();
  const [home, setHome] = useState(household.householdName);
  const [owner, setOwner] = useState(household.ownerName);
  const [cleaner, setCleaner] = useState(household.cleanerName);
  const [confirmErase, setConfirmErase] = useState(false);
  const [zipOpen, setZipOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);
  const [permission, setPermission] = useState<NotifyPermission>("prompt");
  const [hourSheet, setHourSheet] = useState(false);
  const persistTimer = useRef<number | null>(null);

  const HOUR_PRESETS = [
    { id: "morning", label: t("settings.morning"), hour: 8 },
    { id: "afternoon", label: t("settings.afternoon"), hour: 14 },
    { id: "evening", label: t("settings.evening"), hour: 19 },
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

  useEffect(() => {
    return () => {
      if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
    };
  }, []);

  function persistNames(householdName: string, ownerName: string, cleanerName: string) {
    if (
      householdName === household.householdName &&
      ownerName === household.ownerName &&
      cleanerName === household.cleanerName
    ) {
      return;
    }
    void onUpdate({ householdName, ownerName, cleanerName });
  }

  function schedulePersist(householdName: string, ownerName: string, cleanerName: string) {
    if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      persistNames(householdName, ownerName, cleanerName);
    }, 300);
  }

  function flushPersist(householdName: string, ownerName: string, cleanerName: string) {
    if (persistTimer.current != null) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    persistNames(householdName, ownerName, cleanerName);
  }

  const languageValueLabel =
    preference === "system"
      ? t("settings.languageSystem")
      : preference === "es"
        ? t("settings.languageEs")
        : preference === "pt-BR"
          ? t("settings.languagePtBr")
          : t("settings.languageEn");

  return (
    <div className="mx-auto flex w-full max-w-[32rem] flex-col gap-5 pb-8">
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        onBack={onBack}
        backLabel={backLabel === "Back to Home" || backLabel === t("settings.backHome") ? t("settings.backHome") : backLabel}
      />
      <section>
        <h2 className="ui-heading mb-2 ui-title font-semibold">{t("settings.language")}</h2>
        <div className="ui-group">
          <div className="ui-group-row px-4 py-3">
            <p className="mb-2 ui-caption text-muted-foreground">{t("settings.languageHelp")}</p>
            <Select
              value={preference}
              onValueChange={(value) => {
                if (value === "system" || value === "en" || value === "es" || value === "pt-BR") {
                  setPreference(value as AppLocale | "system");
                }
              }}
            >
              <SelectTrigger className="h-12 w-full" aria-label={t("settings.language")}>
                <SelectValue placeholder={languageValueLabel}>{languageValueLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">{t("settings.languageSystem")}</SelectItem>
                <SelectItem value="en">{t("settings.languageEn")}</SelectItem>
                <SelectItem value="es">{t("settings.languageEs")}</SelectItem>
                <SelectItem value="pt-BR">{t("settings.languagePtBr")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
      <section>
        <h2 className="ui-heading mb-2 ui-title font-semibold">{t("settings.household")}</h2>
        <div className="ui-group">
          <div className="ui-group-row grid gap-1.5 px-4 py-3">
            <Label className="ui-caption font-medium text-muted-foreground">{t("settings.homeName")}</Label>
            <Input
              value={home}
              onChange={(event) => {
                const next = event.target.value;
                setHome(next);
                schedulePersist(next, owner, cleaner);
              }}
              onBlur={() => flushPersist(home, owner, cleaner)}
              placeholder={t("settings.homeNamePlaceholder")}
              className="h-12"
            />
          </div>
          <div className="ui-group-row grid gap-1.5 px-4 py-3">
            <Label className="ui-caption font-medium text-muted-foreground">{t("settings.yourName")}</Label>
            <Input
              value={owner}
              onChange={(event) => {
                const next = event.target.value;
                setOwner(next);
                schedulePersist(home, next, cleaner);
              }}
              onBlur={() => flushPersist(home, owner, cleaner)}
              placeholder={t("settings.yourNamePlaceholder")}
              className="h-12"
            />
          </div>
          <div className="ui-group-row grid gap-1.5 px-4 py-3">
            <Label className="ui-caption font-medium text-muted-foreground">{t("settings.cleaner")}</Label>
            <Input
              value={cleaner}
              onChange={(event) => {
                const next = event.target.value;
                setCleaner(next);
                schedulePersist(home, owner, next);
              }}
              onBlur={() => flushPersist(home, owner, cleaner)}
              placeholder={t("settings.cleanerPlaceholder")}
              className="h-12"
            />
          </div>
        </div>
      </section>
      <section>
        <h2 className="ui-heading mb-2 ui-title font-semibold">{t("settings.location")}</h2>
        <div className="ui-group">
          <button type="button" className="ui-group-row w-full px-4 py-3 text-left" onClick={() => setZipOpen(true)}>
            <p className="ui-body font-medium">{t("settings.zip")}</p>
            <p className="mt-0.5 ui-caption text-muted-foreground">
              {household.location.postalCode
                ? `${household.location.placeName ? `${household.location.placeName} · ` : ""}${climateLabel(deriveClimate(household.location))}`
                : t("settings.zipNotSet")}
            </p>
            <p className="mt-1 ui-caption text-muted-foreground">{t("settings.zipHelp")}</p>
          </button>
          <div className="ui-group-row grid gap-2 px-4 py-3">
            <Label className="ui-caption font-medium text-muted-foreground">{t("settings.climate")}</Label>
            <Select
              value={household.location.climateZoneOverride ?? "auto"}
              onValueChange={(value) => {
                if (value === "auto") {
                  void onUpdate({
                    location: {
                      ...household.location,
                      climateZoneOverride: undefined,
                      climateZone: deriveClimate({ ...household.location, climateZoneOverride: undefined }),
                    },
                  });
                  return;
                }
                const zone = value as (typeof CLIMATE_ZONES)[number];
                void onUpdate({
                  location: {
                    ...household.location,
                    climateZoneOverride: zone,
                    climateZone: zone,
                  },
                });
              }}
            >
              <SelectTrigger className="h-12 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  {t("settings.climateAuto", {
                    zone: climateLabel(deriveClimate({ ...household.location, climateZoneOverride: undefined })),
                  })}
                </SelectItem>
                {CLIMATE_ZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {climateLabel(zone)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {restockDigest && onUpdateDigest ? (
        <section>
          <h2 className="ui-heading mb-2 ui-title font-semibold">{t("settings.notifications")}</h2>
          <div className="ui-group">
            <div className="ui-group-row px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p id="digest-switch-label" className="ui-body font-medium">
                    {t("settings.digestTitle")}
                  </p>
                  <p className="mt-0.5 ui-caption text-muted-foreground">
                    {t("settings.digestHelp")}
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
                  <p id="private-notif-label" className="ui-body font-medium">
                    {t("settings.privateNotifTitle")}
                  </p>
                  <p className="mt-0.5 ui-caption text-muted-foreground">
                    {t("settings.privateNotifHelp")}
                  </p>
                </div>
                <Switch
                  checked={restockDigest.privateNotifications === true}
                  aria-labelledby="private-notif-label"
                  onCheckedChange={(next) => onUpdateDigest({ privateNotifications: next })}
                />
              </div>
              {permission === "denied" ? (
                <p className="mt-3 ui-caption text-destructive">
                  {t("settings.notifDenied")}
                </p>
              ) : permission === "prompt" && !restockDigest.enabled ? (
                <p className="mt-3 ui-caption text-muted-foreground">
                  {t("settings.notifPrompt")}
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
                          "h-11 min-w-11 shrink-0 rounded-full px-2.5 ui-caption font-medium",
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
                          "h-11 rounded-full px-3.5 ui-caption font-medium",
                          restockDigest.hour === preset.hour
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                        onClick={() => {
                          onUpdateDigest({ hour: preset.hour });
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={cn(
                        "h-11 rounded-full px-3.5 ui-caption font-medium",
                        !HOUR_PRESETS.some((p) => p.hour === restockDigest.hour)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground",
                      )}
                      onClick={() => setHourSheet(true)}
                    >
                      {HOUR_PRESETS.some((p) => p.hour === restockDigest.hour)
                        ? t("settings.hourMore")
                        : `${String(restockDigest.hour).padStart(2, "0")}:00`}
                    </button>
                  </div>
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
              <p className="ui-body font-medium">{lockMethodLabel(lockMethod).toggle}</p>
              <p className="mt-0.5 ui-caption text-muted-foreground">
                {canLock
                  ? t("settings.lockHelpOn")
                  : t("settings.lockHelpOff")}
              </p>
            </div>
            <Switch
              checked={Boolean(household.lockSettings.requireFaceId && canLock)}
              disabled={!canLock}
              aria-label={lockMethodLabel(lockMethod).toggle}
              onCheckedChange={(next) => {
                void (async () => {
                  if (!next && canLock) {
                    const ok = await verifyDeviceOwner(t("settings.turnOffLock"));
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
                    ? "h-11 flex-1 rounded-full bg-primary ui-caption text-primary-foreground"
                    : "h-11 flex-1 rounded-full bg-secondary ui-caption"
                }
                onClick={() => void onUpdate({ lockSettings: { ...household.lockSettings, lockAfter: item } })}
              >
                {item === "immediate"
                  ? t("settings.lockImmediate")
                  : item === "2min"
                    ? t("settings.lock2min")
                    : t("settings.lock15min")}
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

      <Button variant="secondary" className="h-12" onClick={onStartCleanerVisit}>
        {t("settings.handToCleaner", {
          name: household.cleanerName || t("settings.cleanerFallback"),
        })}
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

      <div className="rounded-2xl bg-card p-4">
        <p className="font-medium">{t("settings.yourData")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.yourDataBody")}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-primary">
          <button type="button" className="inline-flex min-h-11 items-center" onClick={() => setLegalDoc("how-it-works")}>
            {t("settings.howItWorks")}
          </button>
          <button type="button" className="inline-flex min-h-11 items-center" onClick={() => setLegalDoc("privacy")}>
            {t("settings.privacy")}
          </button>
          <button type="button" className="inline-flex min-h-11 items-center" onClick={() => setLegalDoc("terms")}>
            {t("settings.terms")}
          </button>
        </div>
        <a
          className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-secondary text-sm font-medium"
          href="mailto:privacy@cuidala.app?subject=Cuidala%20help"
        >
          {t("settings.helpContact")}
        </a>
        <details className="mt-3 rounded-xl bg-secondary/60 px-3 py-2">
          <summary className="cursor-pointer py-2 text-sm font-medium">{t("settings.advanced")}</summary>
          <p className="pb-2 text-xs text-muted-foreground">
            {t("settings.advancedHelp")}
          </p>
          <a
            className="mb-2 flex h-11 w-full items-center justify-center rounded-xl bg-secondary text-sm font-medium"
            href={problemMailto(household)}
          >
            {t("settings.reportProblem")}
          </a>
          <Button
            variant="secondary"
            className="h-12 w-full text-destructive"
            onClick={() => setConfirmErase(true)}
          >
            {t("settings.eraseAll")}
          </Button>
          <p className="mt-3 ui-caption text-muted-foreground">Cuidala {APP_VERSION}</p>
        </details>
      </div>

      <AlertDialog open={confirmErase} onOpenChange={setConfirmErase}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <BrandMark size="sm" className="mx-auto mb-2" />
            <AlertDialogTitle>{t("settings.eraseTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.eraseBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => {
                void (async () => {
                  if (canLock) {
                    const verified = await verifyDeviceOwner(t("settings.eraseEverything"));
                    if (!verified) {
                      toast.error(t("settings.verifyFailed"));
                      return;
                    }
                  }
                  const result = await onErase();
                  if (result.ok) {
                    void hapticDestructive();
                    toast.success(t("settings.eraseAll"));
                  } else toast.error(t("shell.eraseFailed"));
                })();
              }}
            >
              {t("common.delete")}
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
            if (result.ok) toast.success(t("zip.saved"));
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
            toast.success(t("zip.saved"));
            return { ok: true };
          }}
        />
      )}
      <Sheet open={hourSheet} onOpenChange={setHourSheet}>
        <SheetContent side="bottom" size="form" className="gap-0">
          <SheetHeader>
            <SheetTitle>{t("settings.digestTime")}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 px-4 pb-4">
            <Label htmlFor="digest-hour" className="ui-caption text-muted-foreground">
              {t("settings.digestHour")}
            </Label>
            <Input
              id="digest-hour"
              type="time"
              value={`${String(restockDigest?.hour ?? 8).padStart(2, "0")}:00`}
              onChange={(event) => {
                const hour = Number(event.target.value.split(":")[0]);
                if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;
                onUpdateDigest?.({ hour });
              }}
              className="h-12"
            />
            <Button type="button" className="h-12" onClick={() => setHourSheet(false)}>
              {t("common.done")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <LegalDocSheet doc={legalDoc} onOpenChange={(open) => !open && setLegalDoc(null)} />
      <div className="mt-6 flex flex-col items-center gap-1 pb-2">
        <BrandMark size="sm" />
        <p className="ui-caption text-muted-foreground">Cuidala</p>
      </div>
    </div>
  );
}
