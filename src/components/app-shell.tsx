"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Home, Leaf, Package, Settings, Sun, Wallet } from "lucide-react";
import { BudgetView } from "@/components/budget-view";
import { CleanerVisit } from "@/components/cleaner-visit";
import { FaceLock } from "@/components/face-lock";
import { HomeMapView } from "@/components/home-map-view";
import { HomeView } from "@/components/home-view";
import { HouseMapSheet } from "@/components/house-map-sheet";
import { Onboarding } from "@/components/onboarding";
import { RestockView } from "@/components/restock-view";
import { SeasonalView } from "@/components/seasonal-view";
import { ShareLinkSheet } from "@/components/share-link-sheet";
import { TodayView } from "@/components/today-view";
import { Button } from "@/components/ui/button";
import { useHousehold } from "@/hooks/use-household";
import { digestPayload } from "@/lib/digest";
import { showLocalNotification } from "@/lib/notifications";
import { extractSharedUrl } from "@/lib/retailer";
import { groupRestock } from "@/lib/restock";
import { applyPostalCode, isValidUsZip, normalizeUsZip } from "@/lib/climate";
import { roomsWithNearReplacement } from "@/lib/forecast";
import { next90DaysSpend } from "@/lib/forecast";
import { readVaultSecret } from "@/lib/native/keychain";
import { evaluateTriggers, weatherCaption, type WeatherForecast } from "@/lib/weather/provider";
import { forCleanerSession } from "@/lib/storage";
import type { Tab } from "@/lib/types";
import { cn } from "@/lib/utils";

const LOCK_MS = { immediate: 0, "2min": 120_000, "15min": 900_000 } as const;

export function AppShell() {
  const {
    household,
    hydrated,
    completeOnboarding,
    saveDuty,
    markSupplyOrdered,
    markSupplyReceived,
    saveSupplyLink,
    attachSharedLink,
    updateRestockDigest,
    deleteDuty,
    completeDuty,
    undoCompletion,
    updateHome,
    savePostalCode,
    updateTree,
    startCleanerVisit,
    endCleanerVisit,
    loadError,
    retryLoad,
    startFresh,
    gate,
    unlock,
    markAssetReplaced,
    acceptPlaybook,
    declinePlaybook,
  } = useHousehold();
  const [tab, setTab] = useState<Tab>("today");
  const [locked, setLocked] = useState(false);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [roomOpen, setRoomOpen] = useState<string | null>(null);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (!household.onboarded || !household.lockSettings?.requireFaceId) return;
    const ms = LOCK_MS[household.lockSettings.lockAfter];
    let timer: number | undefined;
    const arm = () => {
      if (timer) window.clearTimeout(timer);
      if (household.lockSettings.lockAfter === "immediate") {
        const onHide = () => {
          if (document.hidden) setLocked(true);
        };
        document.addEventListener("visibilitychange", onHide);
        return () => document.removeEventListener("visibilitychange", onHide);
      }
      const onHide = () => {
        if (document.hidden) {
          timer = window.setTimeout(() => setLocked(true), ms);
        } else if (timer) {
          window.clearTimeout(timer);
        }
      };
      document.addEventListener("visibilitychange", onHide);
      return () => {
        document.removeEventListener("visibilitychange", onHide);
        if (timer) window.clearTimeout(timer);
      };
    };
    return arm();
  }, [household.onboarded, household.lockSettings]);

  useEffect(() => {
    if (!household.onboarded) return;
    const lat = household.location?.lat;
    const lng = household.location?.lng;
    const zip = household.location?.postalCode;
    const query =
      lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
        ? `lat=${lat}&lng=${lng}`
        : zip && isValidUsZip(zip)
          ? `zip=${encodeURIComponent(normalizeUsZip(zip))}`
          : null;
    if (!query) return;
    void (async () => {
      try {
        const response = await fetch(`/api/weather?${query}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Weather unavailable");
        const payload = (await response.json()) as WeatherForecast & { lat?: number; lng?: number };
        setForecast(payload);
        setWeatherError(null);
        const { duties, fires } = evaluateTriggers(household, payload);
        const needsCoords =
          (lat == null || lng == null) &&
          typeof payload.lat === "number" &&
          typeof payload.lng === "number" &&
          zip;
        updateTree((current) => ({
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
            ? applyPostalCode(current.location, zip, { lat: payload.lat!, lng: payload.lng! })
            : current.location,
        }));
      } catch {
        setWeatherError("Could not refresh weather");
        updateTree((current) => ({
          ...current,
          weatherStatus: { ...current.weatherStatus, lastError: "Weather provider failed" },
        }));
      }
    })();
    // Fetch once per location, not on every household mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household.location?.lat, household.location?.lng, household.location?.postalCode, household.onboarded]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "restock") setTab("restock");
    const url = extractSharedUrl({
      url: params.get("restockUrl") || params.get("url"),
      text: params.get("text"),
      title: params.get("title"),
    });
    if (url) {
      setSharedUrl(url);
      setTab("restock");
    }
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "open-restock") setTab("restock");
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const onOpen = () => setTab("restock");
    window.addEventListener("estrellita-open-restock", onOpen);
    return () => window.removeEventListener("estrellita-open-restock", onOpen);
  }, []);

  useEffect(() => {
    if (!household.onboarded) return;
    const payload = digestPayload(household);
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

  if (!hydrated) {
    return (
      <div
        suppressHydrationWarning
        className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5"
      >
        <p className="text-sm font-medium text-primary">Estrellita</p>
        <h1 className="ui-heading mt-2 text-[28px] font-semibold tracking-tight">Opening…</h1>
        <p className="mt-2 text-sm text-muted-foreground">Loading this household on the device.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <LoadFailed
        reason={loadError.reason}
        onRetry={() => void retryLoad()}
        onStartFresh={startFresh}
      />
    );
  }

  // Temporary: skip locked / needs-wrap PIN gates so first paint is Today or onboarding.
  if (!household.onboarded || gate === "empty" || gate === "locked" || gate === "needs-wrap") {
    return (
      <Onboarding
        onComplete={(input) =>
          completeOnboarding({
            answers: input.answers,
            account: input.account,
            vaultSecret: input.vaultSecret,
            ownerName: input.ownerName,
            householdName: input.answers.nickname,
          })
        }
      />
    );
  }

  if (locked && household.lockSettings.requireFaceId && household.ownerPin.trim().length > 0) {
    return (
      <FaceLock
        onUnlock={async (secret) => {
          if (secret) {
            const ok = await unlock(secret);
            if (ok) setLocked(false);
            return ok;
          }
          const stored = await readVaultSecret();
          if (stored) {
            const ok = await unlock(stored);
            if (ok) setLocked(false);
            return ok;
          }
          setLocked(false);
          return true;
        }}
      />
    );
  }

  if (household.mode === "cleaner") {
    return (
      <CleanerVisit
        household={forCleanerSession(household)}
        pinRequired={false}
        onComplete={completeDuty}
        onUndo={undoCompletion}
        onEndVisit={endCleanerVisit}
      />
    );
  }

  const weather = weatherCaption(forecast, household.location);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col overflow-x-hidden bg-background">
      <main className="app-shell-main min-w-0 flex-1 px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {tab === "today" ? (
          <TodayView
            household={household}
            weatherLine={weather.text}
            needsZip={weather.needsZip}
            onSavePostalCode={savePostalCode}
            onComplete={completeDuty}
            onUndo={undoCompletion}
            onSaveDuty={saveDuty}
            onDeleteDuty={deleteDuty}
            onStartCleanerVisit={startCleanerVisit}
            onOpenSettings={() => setTab("settings")}
            onOpenHome={() => setTab("home")}
            onMarkOrdered={markSupplyOrdered}
            onMarkReceived={markSupplyReceived}
            onSaveLink={saveSupplyLink}
            onOpenRestock={() => setTab("restock")}
          />
        ) : null}
        {tab === "restock" ? (
          <RestockView
            household={household}
            onSaveDuty={saveDuty}
            onDeleteDuty={deleteDuty}
            onMarkOrdered={markSupplyOrdered}
            onMarkReceived={markSupplyReceived}
            onSaveLink={saveSupplyLink}
          />
        ) : null}
        {tab === "home" ? (
          <div className="flex flex-col gap-4 pb-8">
            <header>
              <h1 className="ui-heading text-[34px] font-semibold tracking-tight">{household.householdName}</h1>
              <button type="button" className="mt-2 text-sm font-medium text-primary" onClick={() => setTab("budget")}>
                Next 90 days: ~${Math.round(ninety).toLocaleString()}
              </button>
            </header>
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
              onMarkOrdered={markSupplyOrdered}
              onMarkReceived={markSupplyReceived}
              onSaveLink={saveSupplyLink}
            />
          </div>
        ) : null}
        {tab === "budget" ? (
          <BudgetView
            household={household}
            onReplace={markAssetReplaced}
            onUpdateAsset={(assetId, patch) =>
              updateTree((current) => ({
                ...current,
                assets: current.assets.map((asset) => (asset.id === assetId ? { ...asset, ...patch } : asset)),
              }))
            }
          />
        ) : null}
        {tab === "seasonal" ? (
          <SeasonalView
            household={household}
            weatherLine={weather.text}
            needsZip={weather.needsZip}
            weatherError={weatherError ?? household.weatherStatus.lastError}
            onSavePostalCode={savePostalCode}
            onAccept={acceptPlaybook}
            onDecline={declinePlaybook}
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
            onDeleted={startFresh}
            restockDigest={household.restockDigest}
            onUpdateDigest={updateRestockDigest}
          />
        ) : null}
      </main>

      <ShareLinkSheet
        open={Boolean(sharedUrl) && household.onboarded}
        url={sharedUrl}
        household={household}
        onOpenChange={(open) => {
          if (!open) setSharedUrl(null);
        }}
        onPick={(id) => {
          if (sharedUrl) attachSharedLink(sharedUrl, id);
          setSharedUrl(null);
        }}
      />

      <nav className="app-tab-bar pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div className="pointer-events-auto mx-auto grid max-w-lg grid-cols-6 border-t border-black/6 bg-[#f5f5f7]/95 px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <NavButton label="Today" icon={<Sun className="size-5" />} active={tab === "today"} onClick={() => setTab("today")} />
          <NavButton label="Home" icon={<Home className="size-5" />} active={tab === "home"} onClick={() => setTab("home")} />
          <NavButton
            label="Restock"
            icon={<Package className="size-5" />}
            active={tab === "restock"}
            badge={groupRestock(household.supplyAutomations, household).order_now.length}
            onClick={() => setTab("restock")}
          />
          <NavButton label="Budget" icon={<Wallet className="size-5" />} active={tab === "budget"} onClick={() => setTab("budget")} />
          <NavButton label="Seasonal" icon={<Leaf className="size-5" />} active={tab === "seasonal"} onClick={() => setTab("seasonal")} />
          <NavButton label="Settings" icon={<Settings className="size-5" />} active={tab === "settings"} onClick={() => setTab("settings")} />
        </div>
      </nav>
    </div>
  );
}

function LoadFailed({
  reason,
  onRetry,
  onStartFresh,
}: {
  reason: "corrupt" | "unavailable";
  onRetry: () => void;
  onStartFresh: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <h1 className="ui-heading text-[28px] font-semibold tracking-tight">Couldn’t load the house</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {reason === "unavailable"
          ? "This browser blocked saved household data. Try again, or start fresh on this device."
          : "Saved household data on this device looks damaged. Nothing was overwritten."}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button className="h-12" onClick={onRetry}>
          Try again
        </Button>
        <Button variant="secondary" className="h-12" onClick={onStartFresh}>
          Start fresh
        </Button>
      </div>
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
        "relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {icon}
      {label}
      {badge ? (
        <span className="absolute top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
