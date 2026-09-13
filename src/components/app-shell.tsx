"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Home, Package, Settings, Sun } from "lucide-react";
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
import { useNow } from "@/hooks/use-now";
import { useLocale } from "@/i18n/locale-provider";
import { digestPayload } from "@/lib/digest";
import { OPEN_RESTOCK_EVENT, overdueChoreCount, showLocalNotification } from "@/lib/notifications";
import { groupRestock } from "@/lib/restock";
import { applyPostalCode } from "@/lib/climate";
import { roomsWithNearReplacement } from "@/lib/forecast";
import { ForecastCard } from "@/components/forecast-card";
import { homeSummary } from "@/lib/node-status";
import { detectLockMethod, isOwnerPromptInFlight, verifyDeviceOwner, type LockMethod } from "@/lib/native/biometrics";
import { isNative } from "@/lib/native/platform";
import { hideLaunchSplash } from "@/lib/native/splash";
import { prefersReducedMotion, scrollBehavior } from "@/lib/motion";
import { fetchForecastFor } from "@/lib/weather/client";
import { fetchWeatherAttribution, type WeatherAttribution } from "@/lib/native/weatherkit";
import { evaluateTriggers, weatherCaption, type WeatherForecast } from "@/lib/weather/provider";
import { forCleanerSession, PERSIST_FAILED_EVENT } from "@/lib/storage";
import { hasSeenTip, markTipSeen, teachingCardVisible, TIP_LOCK_KEEP_PRIVATE, TIP_LOCK_REENGAGE, withTeaching } from "@/lib/teaching";
import { lockMethodLabel } from "@/lib/native/lock-labels";
import { isRootTab, type AppNavigateTarget, type RootTab } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const IMMEDIATE_GRACE_MS = 750;
const LOCK_MS = { immediate: IMMEDIATE_GRACE_MS, "2min": 120_000, "15min": 900_000 } as const;

export function AppShell() {
  const { t } = useLocale();
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
    canUndoRestore,
    undoRestore,
    applyRestockWalk,
    acceptPlaybook,
    declinePlaybook,
    reconsiderPlaybook,
    pendingUnlock,
    sessionMeta,
    sessionUnlocked,
    lockSession,
    unlockSession,
  } = useHousehold();
  const [rootTab, setRootTab] = useState<RootTab>(() => initialTab());
  const [stack, setStack] = useState<AppNavigateTarget[]>([]);
  const [nav, setNav] = useState<AppNavigateTarget | null>(null);
  const top = stack[stack.length - 1] ?? null;
  const backLabel = rootTab === "today" ? t("tabs.today") : rootTab === "restock" ? t("tabs.restock") : t("tabs.home");
  const reduceMotion = prefersReducedMotion();
  const [leavingPush, setLeavingPush] = useState<AppNavigateTarget | null>(null);
  const leaveTimerRef = useRef<number | null>(null);

  const beginPushExit = useCallback((screen: AppNavigateTarget) => {
    if (leaveTimerRef.current != null) window.clearTimeout(leaveTimerRef.current);
    setLeavingPush(screen);
    leaveTimerRef.current = window.setTimeout(() => {
      setLeavingPush(null);
      leaveTimerRef.current = null;
    }, prefersReducedMotion() ? 150 : 350);
  }, []);

  const cancelPushExit = useCallback(() => {
    if (leaveTimerRef.current != null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setLeavingPush(null);
  }, []);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current != null) window.clearTimeout(leaveTimerRef.current);
    };
  }, []);

  const navigate = useCallback((target: AppNavigateTarget) => {
    setNav(target);
    if (isRootTab(target.tab)) {
      setRootTab(target.tab);
      setStack((current) => {
        const leaving = current[current.length - 1];
        if (leaving) window.setTimeout(() => beginPushExit(leaving), 0);
        return [];
      });
      return;
    }
    cancelPushExit();
    setStack((current) => {
      const last = current[current.length - 1];
      if (last?.tab === target.tab) return [...current.slice(0, -1), target];
      return [...current, target];
    });
  }, [beginPushExit, cancelPushExit]);

  const clearPushStack = useCallback(() => {
    setStack((current) => {
      const leaving = current[current.length - 1];
      if (leaving) window.setTimeout(() => beginPushExit(leaving), 0);
      return [];
    });
  }, [beginPushExit]);

  const popStack = useCallback(() => {
    setStack((current) => {
      if (current.length === 0) return current;
      if (current.length === 1) {
        const leaving = current[0]!;
        window.setTimeout(() => beginPushExit(leaving), 0);
      }
      return current.slice(0, -1);
    });
  }, [beginPushExit]);

  const pushScreen = top ?? leavingPush;
  const pushLeaving = Boolean(leavingPush) && !top;
  const pushLayerRef = useRef<HTMLDivElement | null>(null);
  const rootsLayerRef = useRef<HTMLDivElement | null>(null);
  const edgeDrag = useRef<{
    startX: number;
    lastX: number;
    lastTs: number;
    velocity: number;
    width: number;
    active: boolean;
  } | null>(null);
  const EDGE_ZONE = 24;
  const EDGE_DISMISS = 0.35;
  const EDGE_VELOCITY = 0.6;
  const EDGE_SPRING = "transform 320ms cubic-bezier(0.32,0.72,0,1), opacity 320ms cubic-bezier(0.32,0.72,0,1)";

  function applyEdgeProgress(progress: number, withTransition: boolean) {
    const push = pushLayerRef.current;
    const roots = rootsLayerRef.current;
    if (!push || !roots) return;
    const width = edgeDrag.current?.width ?? push.offsetWidth;
    const x = Math.max(0, progress) * width;
    push.style.transition = withTransition ? EDGE_SPRING : "none";
    roots.style.transition = withTransition ? EDGE_SPRING : "none";
    push.style.transform = x === 0 ? "" : `translateX(${x}px)`;
    const rootShift = -30 * (1 - Math.min(1, Math.max(0, progress)));
    const rootOpacity = 0.9 + 0.1 * Math.min(1, Math.max(0, progress));
    roots.style.transform = rootShift === 0 ? "" : `translateX(${rootShift}%)`;
    roots.style.opacity = String(rootOpacity);
  }

  function clearEdgeStyles() {
    const push = pushLayerRef.current;
    const roots = rootsLayerRef.current;
    if (push) {
      push.style.transition = "";
      push.style.transform = "";
    }
    if (roots) {
      roots.style.transition = "";
      roots.style.transform = "";
      roots.style.opacity = "";
    }
  }

  function onEdgePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (reduceMotion || pushLeaving || !top) return;
    if (event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX - bounds.left > EDGE_ZONE) return;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("input, textarea, select, [contenteditable='true'], button, a")) return;
    edgeDrag.current = {
      startX: event.clientX,
      lastX: event.clientX,
      lastTs: event.timeStamp,
      velocity: 0,
      width: bounds.width,
      active: true,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    applyEdgeProgress(0, false);
  }

  function onEdgePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = edgeDrag.current;
    if (!drag?.active) return;
    const dt = event.timeStamp - drag.lastTs;
    if (dt > 0) drag.velocity = (event.clientX - drag.lastX) / dt;
    drag.lastX = event.clientX;
    drag.lastTs = event.timeStamp;
    const progress = Math.max(0, event.clientX - drag.startX) / drag.width;
    applyEdgeProgress(progress, false);
  }

  function onEdgePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = edgeDrag.current;
    if (!drag?.active) return;
    drag.active = false;
    const progress = Math.max(0, event.clientX - drag.startX) / drag.width;
    const shouldPop = progress > EDGE_DISMISS || drag.velocity > EDGE_VELOCITY;
    if (shouldPop) {
      applyEdgeProgress(1, true);
      window.setTimeout(() => {
        clearEdgeStyles();
        setStack([]);
        cancelPushExit();
      }, 320);
      edgeDrag.current = null;
      return;
    }
    applyEdgeProgress(0, true);
    window.setTimeout(() => clearEdgeStyles(), 320);
    edgeDrag.current = null;
  }

  const tabPaneRefs = useRef<Partial<Record<RootTab, HTMLDivElement | null>>>({});
  const selectRootTab = useCallback((next: RootTab) => {
    setRootTab((current) => {
      if (current === next && top === null && !leavingPush) {
        const pane = tabPaneRefs.current[next];
        pane?.scrollTo({ top: 0, behavior: scrollBehavior() });
      }
      return next;
    });
    clearPushStack();
  }, [clearPushStack, top, leavingPush]);
  const handleFocusHandled = useCallback(() => {
    setNav((current) =>
      current
        ? { tab: current.tab, section: current.section, itemId: current.itemId, playbookId: current.playbookId }
        : null,
    );
  }, []);
  // Start locked; unlock only after ACL Keychain get succeeds (or no vault / web).
  const [locked, setLocked] = useState(true);
  const [lockMethod, setLockMethod] = useState<LockMethod | null>(null);
  const canLock = lockMethod === null ? null : lockMethod !== "none";
  const requireFaceId = sessionMeta?.requireFaceId ?? household.lockSettings?.requireFaceId ?? false;
  const lockAfter = sessionMeta?.lockAfter ?? household.lockSettings?.lockAfter ?? "2min";
  const cleanerVisitActive = sessionMeta?.cleanerVisitActive ?? household.mode === "cleaner";
  const onboarded = sessionMeta?.onboarded ?? household.onboarded;
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherAttribution, setWeatherAttribution] = useState<WeatherAttribution | null>(null);
  const [roomOpen, setRoomOpen] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const now = useNow();
  const nowMs = now.getTime();
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!hydrated) return;
    void hideLaunchSplash();
  }, [hydrated]);

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
      if (method === "none" && !pendingUnlock) setLocked(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pendingUnlock]);

  useEffect(() => {
    if (!onboarded || !requireFaceId || !canLock) return;
    if (cleanerVisitActive) return;
    const ms = LOCK_MS[lockAfter];
    let backgroundedAt: number | null = null;

    const onBackground = () => {
      if (isOwnerPromptInFlight()) return;
      backgroundedAt = Date.now();
      if (lockAfter === "immediate") {
        lockSession();
        setLocked(true);
      }
    };
    const onForeground = () => {
      if (isOwnerPromptInFlight()) return;
      if (backgroundedAt == null) return;
      if (Date.now() - backgroundedAt >= ms) {
        lockSession();
        setLocked(true);
      }
      backgroundedAt = null;
    };

    const onVis = () => {
      if (document.hidden) onBackground();
      else onForeground();
    };

    let cancelled = false;
    let removeNative: (() => void) | undefined;
    if (isNative()) {
      void import("@capacitor/app").then(async ({ App }) => {
        const pause = await App.addListener("pause", onBackground);
        const resume = await App.addListener("resume", onForeground);
        if (cancelled) {
          void pause.remove();
          void resume.remove();
          return;
        }
        removeNative = () => {
          void pause.remove();
          void resume.remove();
        };
      });
    } else {
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      removeNative?.();
    };
  }, [onboarded, requireFaceId, lockAfter, cleanerVisitActive, canLock, lockSession]);

  useEffect(() => {
    const onFail = () => toast.error(tRef.current("shell.saveFailed"));
    window.addEventListener(PERSIST_FAILED_EVENT, onFail);
    return () => window.removeEventListener(PERSIST_FAILED_EVENT, onFail);
  }, []);

  useEffect(() => {
    if (rootTab !== "restock" || household.teaching.openedRestock) return;
    updateTree((current) => withTeaching(current, { openedRestock: true }));
  }, [rootTab, household.teaching.openedRestock, updateTree]);

  useEffect(() => {
    if (!household.onboarded) return;
    const lat = household.location?.lat;
    const lng = household.location?.lng;
    const zip = household.location?.postalCode;
    if (lat == null && lng == null && !zip) return;
    let cancelled = false;
    void (async () => {
      try {
        const payload = await fetchForecastFor({ lat, lng, postalCode: zip });
        if (cancelled) return;
        if (!payload) throw new Error(tRef.current("shell.weatherUnavailable"));
        setForecast(payload);
        setWeatherError(null);
        const attribution = await fetchWeatherAttribution();
        if (cancelled) return;
        if (attribution) setWeatherAttribution(attribution);
        const needsCoords = (lat == null || lng == null) && zip;
        let addedDuties = 0;
        updateTree((current) => {
          const { duties, fires } = evaluateTriggers(current, payload);
          addedDuties = duties.length;
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
            weatherStatus: {
              lastSuccessAt: payload.fetchedAt,
              lastError: null,
            },
            location: needsCoords
              ? applyPostalCode(current.location, zip, {
                  lat: payload.lat,
                  lng: payload.lng,
                  placeName: payload.placeName,
                })
              : current.location,
          };
        });
        if (addedDuties > 0) {
          toast.message(
            addedDuties === 1
              ? tRef.current("shell.weatherChoreAdded")
              : tRef.current("shell.weatherChoresAdded", { count: addedDuties }),
          );
        }
      } catch {
        if (cancelled) return;
        setWeatherError(tRef.current("shell.weatherRefreshFailed"));
        updateTree((current) => ({
          ...current,
          weatherStatus: { ...current.weatherStatus, lastError: tRef.current("shell.weatherProviderFailed") },
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    household.location?.lat,
    household.location?.lng,
    household.location?.postalCode,
    household.onboarded,
    updateTree,
  ]);

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
  const restockGroups = useMemo(
    () => (hydrated ? groupRestock(household.supplyAutomations, household) : null),
    [household, hydrated],
  );
  const summary = useMemo(() => (hydrated ? homeSummary(household) : null), [household, hydrated]);
  const showLockKeepPrivate = useMemo(() => {
    if (canLock !== true || requireFaceId || hasSeenTip(household, TIP_LOCK_KEEP_PRIVATE)) return false;
    const start = household.teaching?.startedAt;
    if (!start) return false;
    const startMs = Date.parse(`${start}T00:00:00`);
    if (!Number.isFinite(startMs)) return false;
    return (nowMs - startMs) / 86_400_000 < 1;
  }, [canLock, requireFaceId, household, nowMs]);

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
        onErase={() => {
          void eraseEverything().then((result) => {
            if (!result.ok) toast.error(t("shell.eraseFailed"));
          });
        }}
      />
    );
  }

  // Ciphertext detected (or re-locked): ACL get → decrypt before any household UI.
  if (pendingUnlock || (locked && requireFaceId && canLock)) {
    if (canLock === null && !pendingUnlock) {
      return <OpeningScreen />;
    }
    return (
      <FaceLock
        method={lockMethod ?? "passcode"}
        performUnlock={() => unlockSession(t("biometrics.unlockCuidala"))}
        onUnlocked={() => {
          setLocked(false);
        }}
        onUnlockFailed={(result) => {
          if (result.reason === "key-mismatch" || result.reason === "corrupt" || result.reason === "unavailable") {
            void retryLoad();
          }
        }}
        showTip={sessionUnlocked ? !hasSeenTip(household, TIP_LOCK_REENGAGE) : false}
        onDismissTip={() => updateTree((current) => markTipSeen(current, TIP_LOCK_REENGAGE))}
        cleanerVisitActive={cleanerVisitActive}
      />
    );
  }

  if (!onboarded) {
    return <Onboarding onComplete={(input) => completeOnboarding(input)} />;
  }

  if (requireFaceId && canLock === null) {
    return <OpeningScreen />;
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
            const ok = await verifyDeviceOwner(t("biometrics.handPhoneBack"));
            if (!ok) return false;
          }
          endCleanerVisit();
          return true;
        }}
      />
    );
  }

  const weather = weatherCaption(forecast, household.location);
  const weatherLoading = Boolean(
    household.onboarded &&
      (household.location?.lat != null ||
        household.location?.lng != null ||
        household.location?.postalCode) &&
      !forecast &&
      !weatherError,
  );
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

  const lockMethodNoun = lockMethodLabel(lockMethod ?? "passcode").noun;

  const todayActive = top === null && rootTab === "today";
  const homeActive = top === null && rootTab === "home";
  const restockActive = top === null && rootTab === "restock";
  const pushBackLabel = t("shell.backTo", { label: backLabel });

  return (
    <div className="app-frame">
      <AlertDialog
        open={showLockKeepPrivate}
        onOpenChange={(open) => {
          if (!open) {
            updateTree((current) => markTipSeen(current, TIP_LOCK_KEEP_PRIVATE));
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <BrandMark size="sm" className="mx-auto mb-2" />
            <AlertDialogTitle>{t("lock.keepPrivateTitle", { method: lockMethodNoun })}</AlertDialogTitle>
            <AlertDialogDescription>{t("lock.keepPrivateBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => updateTree((current) => markTipSeen(current, TIP_LOCK_KEEP_PRIVATE))}
            >
              {t("lock.skipForNow")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                updateTree((current) => ({
                  ...markTipSeen(current, TIP_LOCK_KEEP_PRIVATE),
                  lockSettings: { ...current.lockSettings, requireFaceId: true },
                }));
              }}
            >
              {t("lock.enable")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <main className="app-shell-main relative min-w-0">
        <div
          ref={rootsLayerRef}
          className="app-shell-roots px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
          data-pushed={top ? "true" : "false"}
          data-reduce-motion={reduceMotion ? "true" : "false"}
          inert={Boolean(top)}
        >
        <div
          hidden={!todayActive}
          inert={!todayActive}
          className="app-keep-alive"
          ref={(node) => {
            tabPaneRefs.current.today = node;
          }}
        >
          <TodayView
            household={household}
            weatherAttribution={weatherAttribution}
            weatherLine={weather.text}
            needsZip={weather.needsZip}
            weatherLoading={weatherLoading}
            onSavePostalCode={savePostalCode}
            onComplete={completeDuty}
            onRecordCost={recordCompletionCost}
            onUndo={undoCompletion}
            onSaveDuty={saveDuty}
            onDeleteDuty={deleteDuty}
            onStartCleanerVisit={startCleanerVisit}
            onOpenHome={() => selectRootTab("home")}
            onOpenSettings={() => navigate({ tab: "settings" })}
            showTeaching={teachingCardVisible(household)}
            onOpenDigest={() => navigate({ tab: "settings" })}
            {...restockHandlers}
            onOpenRestock={() => navigate({ tab: "restock" })}
            onNavigate={navigate}
            focus={todayActive ? nav : null}
            onFocusHandled={handleFocusHandled}
          />
        </div>
        <div
          hidden={!homeActive}
          inert={!homeActive}
          className="app-keep-alive"
          ref={(node) => {
            tabPaneRefs.current.home = node;
          }}
        >
          <div className="flex flex-col gap-4 pb-8">
            <PageHeader
              title={household.householdName}
              subtitle={<HomeStatusLine summary={summary} />}
              action={
                <button
                  type="button"
                  aria-label={t("common.settings")}
                  onClick={() => navigate({ tab: "settings" })}
                  className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-transform duration-75 active:scale-[0.98]"
                >
                  <Settings className="size-5" />
                </button>
              }
            />
            <ForecastCard
              household={household}
              onNavigate={navigate}
              onAddInstallDate={() => {
                const first = household.assets[0];
                setRoomOpen(first?.roomId ?? "whole-home");
              }}
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
              roomId={roomOpen ?? ""}
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
        </div>
        <div
          hidden={!restockActive}
          inert={!restockActive}
          className="app-keep-alive"
          ref={(node) => {
            tabPaneRefs.current.restock = node;
          }}
        >
          <RestockView
            household={household}
            onSaveDuty={saveDuty}
            onDeleteDuty={deleteDuty}
            {...restockHandlers}
            onWalkHouse={applyRestockWalk}
            focus={restockActive ? nav : null}
            onFocusHandled={handleFocusHandled}
          />
        </div>
        </div>
        {pushScreen ? (
          <div
            ref={pushLayerRef}
            className="app-shell-push"
            data-leaving={pushLeaving ? "true" : "false"}
            data-reduce-motion={reduceMotion ? "true" : "false"}
            inert={pushLeaving}
            onPointerDown={onEdgePointerDown}
            onPointerMove={onEdgePointerMove}
            onPointerUp={onEdgePointerUp}
            onPointerCancel={() => {
              if (!edgeDrag.current?.active) return;
              edgeDrag.current = null;
              applyEdgeProgress(0, true);
              window.setTimeout(() => clearEdgeStyles(), 320);
            }}
          >
            {pushScreen.tab === "budget" ? (
              <BudgetView
                household={household}
                onChange={(updater) => updateTree(updater)}
                onNavigate={navigate}
                onBack={popStack}
                backLabel={pushBackLabel}
              />
            ) : null}
            {pushScreen.tab === "seasonal" ? (
              <SeasonalView
                household={household}
                weatherAttribution={weatherAttribution}
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
                onBack={popStack}
                backLabel={pushBackLabel}
                focusPlaybookId={pushScreen.playbookId}
              />
            ) : null}
            {pushScreen.tab === "settings" ? (
              <HomeView
                household={household}
                onUpdate={updateHome}
                onSavePostalCode={savePostalCode}
                onStartCleanerVisit={startCleanerVisit}
                onChangeTree={(next) => updateTree(() => next)}
                onErase={eraseEverything}
                onExportBackup={exportBackup}
                onImportBackup={importBackup}
                canUndoRestore={canUndoRestore}
                onUndoRestore={undoRestore}
                canLock={canLock === true}
                lockMethod={lockMethod ?? "none"}
                restockDigest={household.restockDigest}
                onUpdateDigest={updateRestockDigest}
                focusAssetId={nav?.assetId}
                onFocusHandled={handleFocusHandled}
                onBack={popStack}
                backLabel={pushBackLabel}
              />
            ) : null}
          </div>
        ) : null}
      </main>

      <nav className="app-tab-bar pointer-events-none fixed inset-x-0 bottom-0 z-40" aria-label={t("common.mainNav")}>
        <div
          role="tablist"
          aria-label={t("common.mainNav")}
          className="app-tab-inner pointer-events-auto mx-auto grid grid-cols-3 px-1 pt-1 pb-2"
        >
          <NavButton
            label={t("tabs.today")}
            icon={<Sun className={cn("size-5", rootTab === "today" && "fill-current")} />}
            active={rootTab === "today"}
            onClick={() => selectRootTab("today")}
          />
          <NavButton
            label={t("tabs.home")}
            icon={<Home className={cn("size-5", rootTab === "home" && "fill-current")} />}
            active={rootTab === "home"}
            onClick={() => selectRootTab("home")}
          />
          <NavButton
            label={t("tabs.restock")}
            icon={<Package className={cn("size-5", rootTab === "restock" && "fill-current")} />}
            active={rootTab === "restock"}
            badge={restockGroups?.order_now.length ?? 0}
            onClick={() => selectRootTab("restock")}
          />
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
      <BrandMark size="md" />
    </div>
  );
}

function initialTab(): RootTab {
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
  reason: "corrupt" | "unavailable" | "key-mismatch" | "passcode_required";
  onRetry: () => void;
  onStartFresh: () => void;
  onImport: (raw: string, passphrase: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  confirmErase: boolean;
  onConfirmEraseChange: (open: boolean) => void;
  onErase: () => void;
}) {
  const { t } = useLocale();
  const keyMismatch = reason === "key-mismatch";
  const passcodeRequired = reason === "passcode_required";

  async function openIosSettings() {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: "app-settings:" });
    } catch {
      // Web / missing plugin — ignore.
    }
  }

  if (passcodeRequired) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
        <BrandMark size="sm" />
        <h1 className="ui-heading mt-5 ui-display font-semibold tracking-tight">
          {t("recovery.passcodeTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("recovery.passcodeBody")}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button className="h-12" onClick={() => void openIosSettings()}>
            {t("recovery.openSettings")}
          </Button>
          <Button variant="secondary" className="h-12" onClick={onRetry}>
            {t("recovery.tryAgain")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <BrandMark size="sm" />
      <h1 className="ui-heading mt-5 ui-display font-semibold tracking-tight">
        {keyMismatch ? t("recovery.titleMismatch") : t("recovery.titleGeneric")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {keyMismatch
          ? t("recovery.bodyMismatch")
          : reason === "unavailable"
            ? t("recovery.bodyUnavailable")
            : t("recovery.bodyCorrupt")}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <BackupPanel mode="import-only" onImport={onImport} replaceCounts={{ chores: 0, items: 0 }} />
        <Button variant="secondary" className="h-12" onClick={onRetry}>
          {t("recovery.tryAgain")}
        </Button>
        <Button variant="secondary" className="h-12 text-destructive" onClick={onStartFresh}>
          {t("recovery.erase")}
        </Button>
      </div>
      <AlertDialog open={confirmErase} onOpenChange={onConfirmEraseChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <BrandMark size="sm" className="mx-auto mb-2" />
            <AlertDialogTitle>{t("settings.eraseTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.eraseBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white" onClick={onErase}>
              {t("settings.eraseConfirm")}
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
  const { t } = useLocale();
  const ariaLabel = badge ? t("tabs.toOrderBadge", { label, count: badge }) : label;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "relative mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 ui-caption font-medium transition-colors duration-75 active:scale-[0.98]",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {icon}
      {label}
      {badge ? (
        <span className="absolute top-0.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 ui-caption font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function HomeStatusLine({ summary }: { summary: ReturnType<typeof homeSummary> | null }) {
  const { t } = useLocale();
  if (!summary || (summary.total === 0 && summary.reorderPending === 0)) {
    return <span>{t("home.allCaughtUp")}</span>;
  }
  const parts: Array<{ key: string; text: string; urgent?: boolean }> = [];
  if (summary.overdue) {
    parts.push({ key: "overdue", text: t("home.overdueCount", { count: summary.overdue }), urgent: true });
  }
  if (summary.dueSoon) {
    parts.push({ key: "soon", text: t("home.dueSoonCount", { count: summary.dueSoon }) });
  }
  if (summary.reorderPending) {
    parts.push({ key: "reorder", text: t("home.toReorderCount", { count: summary.reorderPending }) });
  }
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
