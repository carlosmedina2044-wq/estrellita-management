"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Lock } from "lucide-react";
import { HomeEditor } from "@/components/home-editor";
import { HouseLookSheet } from "@/components/house-look-sheet";
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
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { lockMethodLabel, type LockMethod } from "@/lib/native/lock-labels";
import { verifyDeviceOwner } from "@/lib/native/biometrics";
import { hapticDestructive } from "@/lib/native/haptics";
import { climateLabel, CLIMATE_ZONES, deriveClimate } from "@/lib/climate";
import { notifyPermission, plannedNotifications, requestNotifyPermission, type NotifyPermission } from "@/lib/notifications";
import { KIT_TYPES } from "@/lib/types";
import type { EveningNudgeSettings, Household, MomentumSettings, MorningBriefSettings, RestockDigestSettings } from "@/lib/types";
import { buildHomeSpec, resolveHomeSpec } from "@/lib/scene/portrait";
import { BrandMark } from "@/components/brand-logo";
import { PageHeader } from "@/components/page-header";
import {
  INLINE_INPUT,
  NavRow,
  SelectRow,
  SettingsGroup,
  SettingsRow,
  SettingsSection,
  TextRow,
  ToggleRow,
} from "@/components/settings-rows";
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
  // The diagnostic block below the message (App / iOS / Device / Counts) stays
  // English on purpose: it is read by support, not by the user.
  return `mailto:support@cuidala.app?subject=${encodeURIComponent(tActive("settings.reportSubject"))}&body=${encodeURIComponent(body)}`;
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
  canUndoRestore,
  onUndoRestore,
  canLock,
  lockMethod,
  restockDigest,
  onUpdateDigest,
  morningBrief,
  onUpdateMorningBrief,
  eveningNudge,
  onUpdateEveningNudge,
  onUpdateMomentum,
  focusAssetId,
  onFocusHandled,
  onBack,
  onOpenYear,
  backLabel,
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
  canUndoRestore?: boolean;
  onUndoRestore?: () => Promise<{ ok: true } | { ok: false; error: string }>;
  canLock: boolean;
  lockMethod: LockMethod;
  restockDigest?: RestockDigestSettings;
  onUpdateDigest?: (patch: Partial<RestockDigestSettings>) => void;
  morningBrief?: MorningBriefSettings;
  onUpdateMorningBrief?: (patch: Partial<MorningBriefSettings>) => void;
  eveningNudge?: EveningNudgeSettings;
  onUpdateEveningNudge?: (patch: Partial<EveningNudgeSettings>) => void;
  onUpdateMomentum?: (patch: Partial<MomentumSettings>) => void;
  focusAssetId?: string;
  onFocusHandled?: () => void;
  onBack?: () => void;
  /** Opens the year screen (closed days, runs, milestones, seasonal jobs). */
  onOpenYear?: () => void;
  backLabel?: string;
}) {
  const { t, preference, setPreference, dateLocale } = useLocale();
  const lockCopy = lockMethodLabel(lockMethod, t);
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(dateLocale, { weekday: "short" });
    const sunday = new Date(2026, 8, 13);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + index);
      return formatter.format(day);
    });
  }, [dateLocale]);
  const [home, setHome] = useState(household.householdName);
  const [owner, setOwner] = useState(household.ownerName);
  const [cleaner, setCleaner] = useState(household.cleanerName);
  // "Restore from file" and "Undo last restore" live on this same screen, so
  // the names these fields were seeded with can stop being the names of record
  // while the fields are still on screen; blurring one then wrote the
  // pre-restore name back over the restored one. Reset during render when the
  // source changes — the same pattern `DebouncedTextInput` uses.
  const [prevNames, setPrevNames] = useState({
    home: household.householdName,
    owner: household.ownerName,
    cleaner: household.cleanerName,
  });
  const [confirmErase, setConfirmErase] = useState(false);
  const [zipOpen, setZipOpen] = useState(false);
  const [houseLookOpen, setHouseLookOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);
  const [permission, setPermission] = useState<NotifyPermission>("prompt");
  const { theme, setTheme } = useTheme();
  const [hourSheet, setHourSheet] = useState(false);
  const [hourSheetTarget, setHourSheetTarget] = useState<"digest" | "brief" | "evening">("digest");
  const persistTimer = useRef<number | null>(null);
  if (
    prevNames.home !== household.householdName ||
    prevNames.owner !== household.ownerName ||
    prevNames.cleaner !== household.cleanerName
  ) {
    setPrevNames({
      home: household.householdName,
      owner: household.ownerName,
      cleaner: household.cleanerName,
    });
    setHome(household.householdName);
    setOwner(household.ownerName);
    setCleaner(household.cleanerName);
  }

  const HOUR_PRESETS = [
    { id: "morning", label: t("settings.morning"), hour: 8 },
    { id: "afternoon", label: t("settings.afternoon"), hour: 14 },
    { id: "evening", label: t("settings.evening"), hour: 19 },
  ] as const;

  function openHourSheet(target: "digest" | "brief" | "evening") {
    setHourSheetTarget(target);
    setHourSheet(true);
  }

  function hourPresets(hour: number, onHour: (next: number) => void, target: "digest" | "brief" | "evening") {
    return (
      <div className="flex flex-wrap gap-2">
        {HOUR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={cn(
              "h-11 rounded-full px-3.5 ui-caption font-medium",
              hour === preset.hour ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
            )}
            onClick={() => onHour(preset.hour)}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className={cn(
            "h-11 rounded-full px-3.5 ui-caption font-medium",
            !HOUR_PRESETS.some((preset) => preset.hour === hour)
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
          )}
          onClick={() => openHourSheet(target)}
        >
          {HOUR_PRESETS.some((preset) => preset.hour === hour)
            ? t("settings.hourMore")
            : `${String(hour).padStart(2, "0")}:00`}
        </button>
      </div>
    );
  }

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

  // A debounced write still holding the pre-restore names must not land after
  // the restore. Paired with the reset above; harmless when the change came
  // from our own persist, since that timer has already fired.
  useEffect(() => {
    if (persistTimer.current != null) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
  }, [household.householdName, household.ownerName, household.cleanerName]);

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

  // Appearance folds two stores into one choice: next-themes owns light/dark,
  // and `nightFollowsSky` owns the evening look the living house applies. They
  // used to be a hidden switch under the momentum group, so a user whose iPhone
  // was in Light Mode had no way to understand why the app went dark at dusk.
  const skyAppearanceAvailable = Boolean(onUpdateMomentum) && household.momentum.enabled;
  // `theme` is undefined until next-themes reads storage; "system" is both the
  // library default and the right answer in that gap, so no mount guard needed.
  const appearance =
    skyAppearanceAvailable && household.momentum.nightFollowsSky !== false
      ? "sky"
      : theme === "light" || theme === "dark"
        ? theme
        : "system";
  const appearanceLabel =
    appearance === "sky"
      ? t("settings.appearanceSky")
      : appearance === "light"
        ? t("settings.appearanceLight")
        : appearance === "dark"
          ? t("settings.appearanceDark")
          : t("settings.appearanceSystem");

  const currentHomeSpec = resolveHomeSpec(household);

  function applyAppearance(value: string) {
    if (value === "sky") {
      onUpdateMomentum?.({ nightFollowsSky: true });
      setTheme("system");
      return;
    }
    if (value !== "system" && value !== "light" && value !== "dark") return;
    onUpdateMomentum?.({ nightFollowsSky: false });
    setTheme(value);
  }

  return (
    <div className="mx-auto flex w-full max-w-[32rem] flex-col gap-5 pb-8">
      <PageHeader title={t("settings.title")} onBack={onBack} backLabel={backLabel ?? t("settings.backHome")} />
      <p className="-mt-3 flex items-center gap-2 px-1 ui-body font-medium text-foreground">
        <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {t("settings.subtitle")}
      </p>

      <SettingsSection
        title={t("settings.groupLook")}
        footer={
          <>
            <p>{t("settings.languageHelp")}</p>
            <p className="mt-1">{t("settings.appearanceHelp")}</p>
          </>
        }
      >
        <SettingsGroup>
          <SelectRow
            label={t("settings.language")}
            value={preference}
            display={languageValueLabel}
            onValueChange={(value) => {
              if (value === "system" || value === "en" || value === "es" || value === "pt-BR") {
                setPreference(value as AppLocale | "system");
              }
            }}
          >
            <SelectContent>
              <SelectItem value="system">{t("settings.languageSystem")}</SelectItem>
              <SelectItem value="en">{t("settings.languageEn")}</SelectItem>
              <SelectItem value="es">{t("settings.languageEs")}</SelectItem>
              <SelectItem value="pt-BR">{t("settings.languagePtBr")}</SelectItem>
            </SelectContent>
          </SelectRow>
          <SelectRow
            label={t("settings.appearance")}
            value={appearance}
            display={appearanceLabel}
            onValueChange={applyAppearance}
          >
            <SelectContent>
              {skyAppearanceAvailable ? (
                <SelectItem value="sky">{t("settings.appearanceSky")}</SelectItem>
              ) : null}
              <SelectItem value="system">{t("settings.appearanceSystem")}</SelectItem>
              <SelectItem value="light">{t("settings.appearanceLight")}</SelectItem>
              <SelectItem value="dark">{t("settings.appearanceDark")}</SelectItem>
            </SelectContent>
          </SelectRow>
          <NavRow
            title={t("settings.houseLook")}
            value={t(`portrait.palette.${currentHomeSpec.palette}` as "portrait.palette.classic")}
            onClick={() => setHouseLookOpen(true)}
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title={t("settings.household")} footer={t("settings.zipHelp")}>
        <SettingsGroup>
          <TextRow label={t("settings.homeName")}>
            <Input
              value={home}
              onChange={(event) => {
                const next = event.target.value;
                setHome(next);
                schedulePersist(next, owner, cleaner);
              }}
              onBlur={() => flushPersist(home, owner, cleaner)}
              placeholder={t("settings.homeNamePlaceholder")}
              className={INLINE_INPUT}
            />
          </TextRow>
          <TextRow label={t("settings.yourName")}>
            <Input
              value={owner}
              onChange={(event) => {
                const next = event.target.value;
                setOwner(next);
                schedulePersist(home, next, cleaner);
              }}
              onBlur={() => flushPersist(home, owner, cleaner)}
              placeholder={t("settings.yourNamePlaceholder")}
              className={INLINE_INPUT}
            />
          </TextRow>
          <TextRow label={t("settings.cleaner")}>
            <Input
              value={cleaner}
              onChange={(event) => {
                const next = event.target.value;
                setCleaner(next);
                schedulePersist(home, owner, next);
              }}
              onBlur={() => flushPersist(home, owner, cleaner)}
              placeholder={t("settings.cleanerPlaceholder")}
              className={INLINE_INPUT}
            />
          </TextRow>
          <NavRow
            title={t("settings.zip")}
            value={
              household.location.postalCode
                ? [household.location.placeName, household.location.postalCode].filter(Boolean).join(" · ")
                : t("settings.zipNotSet")
            }
            onClick={() => setZipOpen(true)}
          />
          <SelectRow
            label={t("settings.climate")}
            value={household.location.climateZoneOverride ?? "auto"}
            display={
              household.location.climateZoneOverride
                ? climateLabel(household.location.climateZoneOverride)
                : t("settings.climateAuto", {
                    zone: climateLabel(deriveClimate({ ...household.location, climateZoneOverride: undefined })),
                  })
            }
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
          </SelectRow>
          <NavRow
            title={t("settings.handToCleaner", {
              name: household.cleanerName || t("settings.cleanerFallback"),
            })}
            onClick={onStartCleanerVisit}
          />
        </SettingsGroup>
      </SettingsSection>

      {onChangeTree ? (
        <HomeEditor
          household={household}
          onChange={onChangeTree}
          focusAssetId={focusAssetId}
          onFocusHandled={onFocusHandled}
        />
      ) : null}

      {restockDigest && onUpdateDigest ? (
        <SettingsSection
          title={t("settings.notifications")}
          footer={
            permission === "denied" ? (
              <p className="text-destructive">{t("settings.notifDenied")}</p>
            ) : permission === "prompt" && !restockDigest.enabled && !morningBrief?.enabled ? (
              <p>{t("settings.notifPrompt")}</p>
            ) : null
          }
        >
          <SettingsGroup>
            {morningBrief && onUpdateMorningBrief ? (
              <>
                <ToggleRow
                  title={t("settings.briefTitle")}
                  help={t("settings.briefHelp")}
                  checked={morningBrief.enabled && permission === "granted"}
                  onCheckedChange={(enabled) => {
                    void (async () => {
                      if (!enabled) {
                        onUpdateMorningBrief({ enabled: false });
                        return;
                      }
                      const next = await requestNotifyPermission();
                      setPermission(next);
                      onUpdateMorningBrief({ enabled: next === "granted" });
                    })();
                  }}
                />
                {morningBrief.enabled && permission === "granted" ? (
                  <>
                    <SettingsRow>
                      {hourPresets(morningBrief.hour, (hour) => onUpdateMorningBrief({ hour }), "brief")}
                    </SettingsRow>
                    <ToggleRow
                      title={t("settings.briefWeekdays")}
                      help={t("settings.briefWeekdaysHelp")}
                      checked={morningBrief.weekdaysOnly}
                      onCheckedChange={(weekdaysOnly) => onUpdateMorningBrief({ weekdaysOnly })}
                    />
                  </>
                ) : null}
              </>
            ) : null}
            {eveningNudge && onUpdateEveningNudge ? (
              <>
                <ToggleRow
                  title={t("settings.eveningTitle")}
                  help={t("settings.eveningHelp")}
                  checked={eveningNudge.enabled && permission === "granted"}
                  onCheckedChange={(enabled) => {
                    void (async () => {
                      if (!enabled) {
                        onUpdateEveningNudge({ enabled: false });
                        return;
                      }
                      const next = await requestNotifyPermission();
                      setPermission(next);
                      onUpdateEveningNudge({ enabled: next === "granted" });
                    })();
                  }}
                />
                {eveningNudge.enabled && permission === "granted" ? (
                  <SettingsRow>
                    {hourPresets(eveningNudge.hour, (hour) => onUpdateEveningNudge({ hour }), "evening")}
                  </SettingsRow>
                ) : null}
              </>
            ) : null}
            <ToggleRow
              title={t("settings.digestTitle")}
              help={t("settings.digestHelp")}
              checked={restockDigest.enabled && permission === "granted"}
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
            {restockDigest.enabled && permission === "granted" ? (
              <SettingsRow className="grid gap-3">
                <div className="app-h-scroll -mx-1 flex flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1">
                  {weekdayLabels.map((day, index) => (
                    <button
                      key={`${day}-${index}`}
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
                {hourPresets(restockDigest.hour, (hour) => onUpdateDigest({ hour }), "digest")}
              </SettingsRow>
            ) : null}
            <ToggleRow
              title={t("settings.privateNotifTitle")}
              help={t("settings.privateNotifHelp")}
              checked={restockDigest.privateNotifications === true}
              onCheckedChange={(next) => onUpdateDigest({ privateNotifications: next })}
            />
          </SettingsGroup>
        </SettingsSection>
      ) : null}

      {onUpdateMomentum || onOpenYear ? (
        <SettingsSection title={t("settings.groupStreaks")}>
          <SettingsGroup>
            {onUpdateMomentum ? (
              <ToggleRow
                title={t("settings.momentumTitle")}
                help={t("settings.momentumHelp")}
                checked={household.momentum.enabled}
                onCheckedChange={(enabled) => onUpdateMomentum({ enabled })}
              />
            ) : null}
            {onOpenYear ? (
              <NavRow title={t("settings.yourYear")} help={t("settings.yourYearHelp")} onClick={onOpenYear} />
            ) : null}
          </SettingsGroup>
        </SettingsSection>
      ) : null}

      <SettingsSection title={t("settings.groupPrivacy")} footer={t("settings.yourDataBody")}>
        <SettingsGroup>
          <ToggleRow
            title={lockCopy.toggle}
            help={canLock ? t("settings.lockHelpOn") : t("settings.lockHelpOff")}
            checked={Boolean(household.lockSettings.requireFaceId && canLock)}
            disabled={!canLock}
            ariaLabel={lockCopy.toggle}
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
          {household.lockSettings.requireFaceId && canLock ? (
            <SettingsRow className="flex gap-2">
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
            </SettingsRow>
          ) : null}
        </SettingsGroup>
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
        {canUndoRestore && onUndoRestore ? (
          <SettingsGroup>
            <NavRow
              title={t("backup.undoLastRestore")}
              chevron={false}
              onClick={() => {
                void onUndoRestore().then((result) => {
                  if (result.ok) {
                    toast.success(t("backup.undoRestoreDone"));
                  } else {
                    toast.error(result.error);
                  }
                });
              }}
            />
          </SettingsGroup>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title={t("settings.groupHelp")}
        footer={
          <>
            {t("brand.name")} {APP_VERSION}
          </>
        }
      >
        <SettingsGroup>
          <NavRow title={t("settings.howItWorks")} onClick={() => setLegalDoc("how-it-works")} />
          <NavRow title={t("settings.privacy")} onClick={() => setLegalDoc("privacy")} />
          <NavRow title={t("settings.terms")} onClick={() => setLegalDoc("terms")} />
          <NavRow
            title={t("settings.helpContact")}
            href={`mailto:support@cuidala.app?subject=${encodeURIComponent(t("settings.helpSubject"))}`}
          />
          <NavRow title={t("settings.reportProblem")} href={problemMailto(household)} />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title={t("settings.groupErase")} footer={t("settings.advancedHelp")}>
        <SettingsGroup>
          <NavRow
            title={t("settings.eraseAll")}
            tone="destructive"
            chevron={false}
            onClick={() => setConfirmErase(true)}
          />
        </SettingsGroup>
      </SettingsSection>

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
              className="bg-destructive text-primary-foreground"
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
                    toast.success(t("settings.eraseSuccess"));
                  } else toast.error(t("shell.eraseFailed"));
                })();
              }}
            >
              {t("settings.eraseConfirm")}
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
            <SheetTitle>
              {hourSheetTarget === "brief"
                ? t("settings.briefTime")
                : hourSheetTarget === "evening"
                  ? t("settings.eveningTime")
                  : t("settings.digestTime")}
            </SheetTitle>
          </SheetHeader>
          <div className="grid gap-3 px-4 pb-4">
            <Label htmlFor="notify-hour" className="ui-caption text-muted-foreground">
              {hourSheetTarget === "brief"
                ? t("settings.briefHour")
                : hourSheetTarget === "evening"
                  ? t("settings.eveningHour")
                  : t("settings.digestHour")}
            </Label>
            <Input
              id="notify-hour"
              type="time"
              value={`${String(
                (hourSheetTarget === "brief"
                  ? morningBrief?.hour
                  : hourSheetTarget === "evening"
                    ? eveningNudge?.hour
                    : restockDigest?.hour) ?? 8,
              ).padStart(2, "0")}:00`}
              onChange={(event) => {
                const hour = Number(event.target.value.split(":")[0]);
                if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;
                if (hourSheetTarget === "brief") onUpdateMorningBrief?.({ hour });
                else if (hourSheetTarget === "evening") onUpdateEveningNudge?.({ hour });
                else onUpdateDigest?.({ hour });
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
      <HouseLookSheet
        open={houseLookOpen}
        kitType={currentHomeSpec.kitType}
        palette={currentHomeSpec.palette}
        order={[...KIT_TYPES]}
        lat={household.location.lat}
        lng={household.location.lng}
        home={household}
        onOpenChange={setHouseLookOpen}
        onChange={(next) =>
          onChangeTree?.({ ...household, homeSpec: buildHomeSpec(next, household.householdName) })
        }
      />
      <div className="mt-6 flex flex-col items-center gap-1 pb-2">
        <BrandMark size="sm" />
        <p className="ui-caption text-muted-foreground">{t("brand.name")}</p>
      </div>
    </div>
  );
}
