"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Home, Leaf, Package, Settings, Sun, Wallet } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { PageHeader } from "@/components/page-header";
import { BackupPanel } from "@/components/backup-panel";
import { BudgetView } from "@/components/budget-view";
import { CleanerVisit } from "@/components/cleaner-visit";
import { FaceLock } from "@/components/face-lock";
import { HomeMapView } from "@/components/home-map-view";
import { HomeView } from "@/components/home-view";
import { HouseMapSheet } from "@/components/house-map-sheet";
import { Onboarding } from "@/components/onboarding";
import { RestockView } from "@/components/restock-view";
import { SeasonalView } from "@/components/seasonal-view";
import { TodayView } from "@/components/today-view";
import { Button } from "@/components/ui/button";
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
import { useHousehold } from "@/hooks/use-household";
import { digestPayload } from "@/lib/digest";
import { OPEN_RESTOCK_EVENT, overdueChoreCount, showLocalNotification } from "@/lib/notifications";
import { groupRestock } from "@/lib/restock";
import { applyPostalCode } from "@/lib/climate";
import { next90DaysSpend, roomsWithNearReplacement } from "@/lib/forecast";
import { homeSummary } from "@/lib/node-status";
import { detectLockMethod, verifyDeviceOwner, type LockMethod } from "@/lib/native/biometrics";
import { isNative } from "@/lib/native/platform";
import { fetchForecastFor } from "@/lib/weather/client";
import { evaluateTriggers, weatherCaption, type WeatherForecast } from "@/lib/weather/provider";
import { forCleanerSession, PERSIST_FAILED_EVENT } from "@/lib/storage";
import { hasSeenTip, markTipSeen, teachingCardVisible, TIP_LOCK_REENGAGE, withTeaching } from "@/lib/teaching";
import type { AppNavigateTarget, Tab } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const LOCK_MS = { immediate: 0, "2min": 120_000, "15min": 900_000 } as const;

export function AppShell() {
  const {
    household,
    hydrated,
    completeOnboarding,
    saveDuty,
    markSupplyOrdered,
    markSupplyReceived,
    checkinSupply,
    saveSupplyLink,
    preferSupplyRetailer,
    stillWaitingSupply,
    neverCameSupply,
    changeSupplyArrival,
    applySupplyLeadTime,
    updateRestockDigest,
    deleteDuty,
    completeDuty,
    recordCompletionCost,
    undoCompletion,
    updateHome,
    savePostalCode,
    updateTree,
    startCleanerVisit,
    endCleanerVisit,
    loadError,
    retryLoad,
    eraseEverything,
    exportBackup,
    importBackup,
    applyRestockWalk,
    acceptPlaybook,
    declinePlaybook,
    reconsiderPlaybook,
  } = useHousehold();
  const [tab, setTab] = useState<Tab>(() => initialTab());
  const [nav, setNav] = useState<AppNavigateTarget | null>(null);
  const navigate = useCallback((target: AppNavigateTarget) => {
    setTab(target.tab);
    setNav(target);
  }, []);
  const handleFocusHandled = useCallback(() => {
    setNav((current) =>
      current
        ? { tab: current.tab, section: current.section, itemId: current.itemId }
        : null,
    );
  }, []);
  // Start locked; unlock only after the device reports no biometric/passcode
  // capability or the user passes the system prompt.
  const [locked, setLocked] = useState(true);
  const [lockMethod, setLockMethod] = useState<LockMethod | null>(null);
  const canLock = lockMethod === null ? null : lockMethod !== "none";
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [roomOpen, setRoomOpen] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || isNative()) return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    void detectLockMethod().then((method) => {
      if (cancelled) return;
      setLockMethod(method);
      if (method === "none") setLocked(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!household.onboarded || !household.lockSettings?.requireFaceId || !canLock) return;
    if (household.mode === "cleaner") return;
    const ms = LOCK_MS[household.lockSettings.lockAfter];
    let hiddenAt: number | null = null;

    const onInactive = () => {
      hiddenAt = Date.now();
      if (household.lockSettings.lockAfter === "immediate") setLocked(true);
    };
    const onActive = () => {
      if (hiddenAt == null) return;
      if (Date.now() - hiddenAt >= ms) setLocked(true);
      hiddenAt = null;
    };

    const onVis = () => {
      if (document.hidden) onInactive();
      else onActive();
    };
    document.addEventListener("visibilitychange", onVis);

    let removeNative: (() => void) | undefined;
    if (isNative()) {
      void import("@capacitor/app").then(({ App }) =>
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) onActive();
          else onInactive();
        }).then((handle) => {
          removeNative = () => void handle.remove();
        }),
      );
    }

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      removeNative?.();
    };
  }, [household.onboarded, household.lockSettings, household.mode, canLock]);

  useEffect(() => {
    const onFail = () => toast.error("Couldn’t save. Try again, or back up in Settings.");
    window.addEventListener(PERSIST_FAILED_EVENT, onFail);
    return () => window.removeEventListener(PERSIST_FAILED_EVENT, onFail);
  }, []);

  useEffect(() => {
    if (tab !== "restock" || household.teaching.openedRestock) return;
    updateTree((current) => withTeaching(current, { openedRestock: true }));
  }, [tab, household.teaching.openedRestock, updateTree]);

  useEffect(() => {
    if (!household.onboarded) return;
    const { lat, lng, postalCode: zip } = household.location ?? {};
    if (lat == null && lng == null && !zip) return;
    let cancelled = false;
    void (async () => {
      try {
        const payload = await fetchForecastFor({ lat, lng, postalCode: zip });
        if (cancelled) return;
        if (!payload) throw new Error("Weather unavailable");
        setForecast(payload);
        setWeatherError(null);
        const needsCoords = (lat == null || lng == null) && zip;
        updateTree((current) => {
          const { duties, fires } = evaluateTriggers(current, payload);
          return {
            ...current,
            duties:
              duties.length > 0
                ? [
                    ...current.duties,
                    ...duties.map((duty) => ({ ...duty, id: crypto.randomUUID(), createdAt: new Date().toISOString() })),
                  ]
                : current.duties,
            weatherFires: fires.length > 0 ? [...current.weatherFires, ...fires] : current.weatherFires,
            weatherStatus: { lastSuccessAt: payload.fetchedAt, lastError: null },
            location: needsCoords
              ? applyPostalCode(current.location, zip, {
                  lat: payload.lat,
                  lng: payload.lng,
                  placeName: payload.placeName,
                })
              : current.location,
          };
        });
      } catch {
        if (cancelled) return;
        setWeatherError("Could not refresh weather");
        updateTree((current) => ({
          ...current,
          weatherStatus: { ...current.weatherStatus, lastError: "Weather provider failed" },
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // Fetch once per location, not on every household mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household.location?.lat, household.location?.lng, household.location?.postalCode, household.onboarded]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "open-restock") navigate({ tab: "restock" });
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [navigate]);

  useEffect(() => {
    if (!isNative()) return;
    let remove: (() => void) | undefined;
    void import("@capacitor/local-notifications").then(async ({ LocalNotifications }) => {
      const handle = await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
        const extra = event.notification.extra as { tab?: string; itemId?: string; action?: string } | undefined;
        if (extra?.tab === "restock") {
          navigate({
            tab: "restock",
            itemId: extra.itemId,
            action: extra.action === "receive" ? "receive" : undefined,
            section: extra.action === "receive" ? "ordered" : undefined,
          });
        }
        if (extra?.tab === "home") navigate({ tab: "home" });
      });
      remove = () => void handle.remove();
    });
    return () => remove?.();
  }, [navigate]);

  useEffect(() => {
    const onOpen = () => navigate({ tab: "restock" });
    window.addEventListener(OPEN_RESTOCK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_RESTOCK_EVENT, onOpen);
  }, [navigate]);

  useEffect(() => {
    if (!household.onboarded || isNative()) return;
    const payload = digestPayload(household, new Date(), overdueChoreCount(household));
    if (!payload.shouldSend) return;
    if (showLocalNotification(payload.title, payload.body)) {
      updateRestockDigest({ lastSentOn: payload.sentOn });
    }
  }, [household, household.onboarded, updateRestockDigest]);

  const nearReplacement = useMemo(
    () => (hydrated ? roomsWithNearReplacement(household) : new Set<string>()),
    [household, hydrated],
  );
  const ninety = useMemo(() => (hydrated ? next90DaysSpend(household) : 0), [household, hydrated]);
  const restockGroups = useMemo(
    () => (hydrated ? groupRestock(household.supplyAutomations, household) : null),
    [household, hydrated],
  );
  const summary = useMemo(() => (hydrated ? homeSummary(household) : null), [household, hydrated]);

  if (!hydrated) {
    return <OpeningScreen />;
  }

  if (loadError) {
    return (
      <LoadFailed
        reason={loadError.reason}
        onRetry={() => void retryLoad()}
        onStartFresh={() => setConfirmErase(true)}
        onImport={importBackup}
        confirmErase={confirmErase}
        onConfirmEraseChange={setConfirmErase}
        onErase={() => void eraseEverything()}
      />
    );
  }

  if (!household.onboarded) {
    return <Onboarding onComplete={(input) => completeOnboarding(input)} />;
  }

  if (household.lockSettings.requireFaceId && canLock === null) {
    return <OpeningScreen />;
  }

  if (locked && household.lockSettings.requireFaceId && canLock) {
    return <FaceLock
      method={lockMethod ?? "none"}
      onUnlocked={() => setLocked(false)}
      showTip={!hasSeenTip(household, TIP_LOCK_REENGAGE)}
      onDismissTip={() => updateTree((current) => markTipSeen(current, TIP_LOCK_REENGAGE))}
    />;
  }

  if (household.mode === "cleaner") {
    return (
      <CleanerVisit
        household={forCleanerSession(household)}
        ownerCheck={canLock === true}
        lockMethod={lockMethod ?? "none"}
        onComplete={completeDuty}
        onUndo={undoCompletion}
        onEndVisit={async () => {
          if (canLock) {
            const ok = await verifyDeviceOwner("Hand the phone back");
            if (!ok) return false;
          }
          endCleanerVisit();
          return true;
        }}
      />
    );
  }

  const weather = weatherCaption(forecast, household.location);
  const restockHandlers = {
    onMarkOrdered: markSupplyOrdered,
    onMarkReceived: markSupplyReceived,
    onSaveLink: saveSupplyLink,
    onPreferRetailer: preferSupplyRetailer,
    onStillWaiting: stillWaitingSupply,
    onNeverCame: neverCameSupply,
    onChangeArrival: changeSupplyArrival,
    onApplyLeadTime: applySupplyLeadTime,
    onCheckin: checkinSupply,
    onMarkTip: (tip: string) => updateTree((current) => markTipSeen(current, tip)),
  };

  return (
    <div className="app-frame">
      <main className="app-shell-main min-w-0 flex-1 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {tab === "today" ? (
          <TodayView
            household={household}
            weatherLine={weather.text}
            needsZip={weather.needsZip}
            onSavePostalCode={savePostalCode}
            onComplete={completeDuty}
            onRecordCost={recordCompletionCost}
            onUndo={undoCompletion}
            onSaveDuty={saveDuty}
            onDeleteDuty={deleteDuty}
            onStartCleanerVisit={startCleanerVisit}
            onOpenHome={() => setTab("home")}
            onOpenSettings={() => setTab("settings")}
            showTeaching={teachingCardVisible(household)}
            onDismissTeaching={() =>
              updateTree((current) =>
                withTeaching(current, { checkedChore: true, openedRestock: true, setDigestOrZip: true }),
              )
            }
            onOpenDigest={() => setTab("settings")}
            {...restockHandlers}
            onOpenRestock={() => navigate({ tab: "restock" })}
            onNavigate={navigate}
            focus={tab === "today" ? nav : null}
            onFocusHandled={handleFocusHandled}
          />
        ) : null}
        {tab === "restock" ? (
          <RestockView
            household={household}
            onSaveDuty={saveDuty}
            onDeleteDuty={deleteDuty}
            {...restockHandlers}
            onWalkHouse={applyRestockWalk}
            focus={tab === "restock" ? nav : null}
            onFocusHandled={handleFocusHandled}
          />
        ) : null}
        {tab === "home" ? (
          <div className="flex flex-col gap-4 pb-8">
            <PageHeader
              title={household.householdName}
              subtitle={
                <div className="grid gap-1">
                  <button type="button" className="text-left text-[13px] font-medium text-primary" onClick={() => setTab("budget")}>
                    {ninety > 0
                      ? `Next 90 days: ~$${Math.round(ninety).toLocaleString()}`
                      : "Budget: add costs to see the next 90 days"}
                  </button>
                  <HomeStatusLine summary={summary} />
                </div>
              }
              action={
                <button
                  type="button"
                  aria-label="Settings"
                  onClick={() => setTab("settings")}
                  className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground"
                >
                  <Settings className="size-5" />
                </button>
              }
            />
            <HomeMapView
              household={household}
              now={new Date()}
              replacementRooms={nearReplacement}
              onSelectRoom={(roomId) => setRoomOpen(roomId)}
              onReorder={(floorId, ids) =>
                updateTree((current) => ({
                  ...current,
                  rooms: current.rooms.map((room) => {
                    if (room.floorId !== floorId && !(floorId === null && room.system)) return room;
                    const rank = ids.indexOf(room.id);
                    return rank >= 0 ? { ...room, sortOrder: rank } : room;
                  }),
                }))
              }
            />
            <HouseMapSheet
              open={Boolean(roomOpen)}
              initialSelected={roomOpen}
              household={household}
              now={new Date()}
              filter="all"
              onOpenChange={(open) => {
                if (!open) setRoomOpen(null);
              }}
              onToggle={(duty, completed) => (completed ? undoCompletion(duty.id) : completeDuty(duty.id))}
              onSaveDuty={saveDuty}
              onDeleteDuty={deleteDuty}
              onChangeTree={(next) => updateTree(() => next)}
              {...restockHandlers}
            />
          </div>
        ) : null}
        {tab === "budget" ? (
          <BudgetView
            household={household}
            onChange={(updater) => updateTree(updater)}
            onNavigate={navigate}
          />
        ) : null}
        {tab === "seasonal" ? (
          <SeasonalView
            household={household}
            forecast={forecast}
            weatherLine={weather.text}
            needsZip={weather.needsZip}
            weatherError={weatherError ?? household.weatherStatus.lastError}
            onSavePostalCode={savePostalCode}
            onAccept={acceptPlaybook}
            onDecline={declinePlaybook}
            onReconsider={reconsiderPlaybook}
            onToggleAttribute={(key) =>
              updateHome({ attributes: { ...household.attributes, [key]: !household.attributes[key] } })
            }
          />
        ) : null}
        {tab === "settings" ? (
          <HomeView
            household={household}
            onUpdate={updateHome}
            onSavePostalCode={savePostalCode}
            onStartCleanerVisit={startCleanerVisit}
            onChangeTree={(next) => updateTree(() => next)}
            onErase={eraseEverything}
            onExportBackup={exportBackup}
            onImportBackup={importBackup}
            canLock={canLock === true}
            lockMethod={lockMethod ?? "none"}
            restockDigest={household.restockDigest}
            onUpdateDigest={updateRestockDigest}
            focusAssetId={tab === "settings" ? nav?.assetId : undefined}
            onFocusHandled={handleFocusHandled}
          />
        ) : null}
      </main>

      <nav className="app-tab-bar pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="app-tab-inner pointer-events-auto mx-auto grid grid-cols-5 border-t border-black/6 bg-background/90 px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <NavButton label="Today" icon={<Sun className="size-5" />} active={tab === "today"} onClick={() => setTab("today")} />
          <NavButton label="Home" icon={<Home className="size-5" />} active={tab === "home"} onClick={() => setTab("home")} />
          <NavButton
            label="Restock"
            icon={<Package className="size-5" />}
            active={tab === "restock"}
            badge={restockGroups?.order_now.length ?? 0}
            onClick={() => setTab("restock")}
          />
          <NavButton label="Budget" icon={<Wallet className="size-5" />} active={tab === "budget"} onClick={() => setTab("budget")} />
          <NavButton label="Seasonal" icon={<Leaf className="size-5" />} active={tab === "seasonal"} onClick={() => setTab("seasonal")} />
        </div>
      </nav>
    </div>
  );
}

function OpeningScreen() {
  return (
    <div
      suppressHydrationWarning
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-8"
    >
      <div className="brand-enter">
        <BrandMark size="md" />
      </div>
    </div>
  );
}

function initialTab(): Tab {
  if (typeof window === "undefined") return "today";
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") === "restock" ? "restock" : "today";
}

function LoadFailed({
  reason,
  onRetry,
  onStartFresh,
  onImport,
  confirmErase,
  onConfirmEraseChange,
  onErase,
}: {
  reason: "corrupt" | "unavailable" | "key-mismatch";
  onRetry: () => void;
  onStartFresh: () => void;
  onImport: (raw: string, passphrase: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  confirmErase: boolean;
  onConfirmEraseChange: (open: boolean) => void;
  onErase: () => void;
}) {
  const keyMismatch = reason === "key-mismatch";
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <BrandMark size="sm" />
      <h1 className="ui-heading mt-5 text-[28px] font-semibold tracking-tight">
        {keyMismatch ? "This iPhone doesn’t have the key" : "Couldn’t load the house"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {keyMismatch
          ? "Cuidala can’t find the Keychain item that unlocks this home. Restore from a Cuidala backup file, or erase this copy and start over."
          : reason === "unavailable"
            ? "Saved household data couldn’t be read right now. Try again, or erase this device’s copy and start over."
            : "Saved household data on this device looks damaged. Nothing was overwritten. You can try again, restore a backup, or erase it and start over."}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button className="h-12" onClick={onRetry}>
          Try again
        </Button>
        <BackupPanel mode="import-only" onImport={onImport} replaceCounts={{ chores: 0, items: 0 }} />
        <Button variant="secondary" className="h-12 text-destructive" onClick={onStartFresh}>
          Erase and start over
        </Button>
      </div>
      <AlertDialog open={confirmErase} onOpenChange={onConfirmEraseChange}>
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
            <AlertDialogAction className="bg-destructive text-white" onClick={onErase}>
              Erase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NavButton({
  label,
  icon,
  active,
  badge,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {icon}
      {label}
      {badge ? (
        <span className="absolute top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function HomeStatusLine({ summary }: { summary: ReturnType<typeof homeSummary> | null }) {
  if (!summary || (summary.total === 0 && summary.reorderPending === 0)) {
    return <span>All caught up</span>;
  }
  const parts: Array<{ key: string; text: string; urgent?: boolean }> = [];
  if (summary.overdue) parts.push({ key: "overdue", text: `${summary.overdue} overdue`, urgent: true });
  if (summary.dueSoon) parts.push({ key: "soon", text: `${summary.dueSoon} due soon` });
  if (summary.reorderPending) parts.push({ key: "reorder", text: `${summary.reorderPending} to reorder` });
  return (
    <span>
      {parts.map((part, index) => (
        <span key={part.key}>
          {index > 0 ? " · " : null}
          <span className={part.urgent ? "text-destructive" : undefined}>{part.text}</span>
        </span>
      ))}
    </span>
  );
}
