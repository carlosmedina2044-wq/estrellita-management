"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { dayOutcome } from "@/lib/momentum";
import { Dialog } from "@capacitor/dialog";
import { Home, Package, Sun } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { HomeScene } from "@/components/home-scene";
import { BackTitleContext } from "@/components/page-header";
import { BackupPanel } from "@/components/backup-panel";
import { BudgetView } from "@/components/budget-view";
import { CleanerVisit } from "@/components/cleaner-visit";
import { FaceLock } from "@/components/face-lock";
import { HomeMapView } from "@/components/home-map-view";
import { HomeView } from "@/components/home-view";
import { HouseMapSheet } from "@/components/house-map-sheet";
import { preloadSparkleBurst } from "@/components/illustrated-moment";
import { Onboarding } from "@/components/onboarding";
import { RestockView } from "@/components/restock-view";
import { SeasonalView } from "@/components/seasonal-view";
import { TodayView } from "@/components/today-view";
import { YearView } from "@/components/year-view";
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
import type { MessageKey } from "@/i18n";
import { toISODate } from "@/lib/dates";
import { useCareRise } from "@/hooks/use-care-rise";
import { useHouseAnswer } from "@/hooks/use-house-answer";
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
import { isCuidalaTodayUrl } from "@/lib/widget-url";
import { hideLaunchSplash } from "@/lib/native/splash";
import { motion } from "motion/react";
import { DUR_SCREEN, EASE_OUT, prefersReducedMotion, scrollBehavior } from "@/lib/motion";
import { useFirstReveal } from "@/hooks/use-session-arrival";
import { fetchForecastFor } from "@/lib/weather/client";
import { fetchWeatherAttribution, type WeatherAttribution } from "@/lib/native/weatherkit";
import { evaluateTriggers, weatherCaption, type WeatherForecast } from "@/lib/weather/provider";
import { forCleanerSession, PERSIST_FAILED_EVENT, resyncNotifications } from "@/lib/storage";
import { hasSeenTip, markTipSeen, teachingCardVisible, TIP_LOCK_KEEP_PRIVATE, TIP_LOCK_REENGAGE, withTeaching } from "@/lib/teaching";
import { lockMethodLabel } from "@/lib/native/lock-labels";
import { isRootTab, type AppNavigateTarget, type RootTab } from "@/lib/types";
import { hapticPress, hapticTab } from "@/lib/native/haptics";
import { hasCheckedInToday, recordCheckIn } from "@/lib/check-ins";
import { eveningNudgeSettings } from "@/lib/evening-nudge";
import { EMPTY_HOUSEHOLD } from "@/lib/storage";
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
    addAnotherSize,
    addHaul,
    removeHaul,
    saveSupplyLink,
    preferSupplyRetailer,
    stillWaitingSupply,
    neverCameSupply,
    changeSupplyArrival,
    applySupplyLeadTime,
    updateRestockDigest,
    updateMorningBrief,
    updateEveningNudge,
    updateMomentum,
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
  const [roomOpen, setRoomOpen] = useState<string | null>(null);
  // Window taps on Today open the room sheet via the Home tab. Remember to
  // put the user back on Today when that sheet closes, instead of leaving
  // them on Home.
  const [roomReturnTab, setRoomReturnTab] = useState<RootTab | null>(null);
  const top = stack[stack.length - 1] ?? null;
  const backLabel = rootTab === "today" ? t("tabs.today") : rootTab === "restock" ? t("tabs.restock") : t("tabs.home");
  const reduceMotion = prefersReducedMotion();
  // The first time a tab is opened in a launch its sections compose themselves
  // instead of being stamped down all at once. Never on later switches: iOS
  // tab bars change instantly, and a repeated entrance is the fastest way to
  // make an app feel slow. Today has its own arrival and the year draws its
  // own grid, so only these two need it.
  //
  // Declared here, above the shell's early returns for the opening screen and
  // the lock, because hooks cannot be called conditionally — hence recomputing
  // the two "is this tab showing" conditions rather than reusing the ones
  // further down.
  const homeFirstReveal = useFirstReveal("home", stack.length === 0 && rootTab === "home");
  const homeShowing = stack.length === 0 && rootTab === "home";
  // The rooms list arrives row by row once per visit to the tab, not once per
  // launch: remounting it when the tab comes back is what replays the entrance.
  const [homeVisit, setHomeVisit] = useState(0);
  const [wasHomeActive, setWasHomeActive] = useState(homeShowing);
  if (homeShowing !== wasHomeActive) {
    setWasHomeActive(homeShowing);
    if (homeShowing) setHomeVisit((count) => count + 1);
  }
  const restockFirstReveal = useFirstReveal("restock", stack.length === 0 && rootTab === "restock");
  const [leavingPush, setLeavingPush] = useState<AppNavigateTarget | null>(null);
  const leaveTimerRef = useRef<number | null>(null);

  const beginPushExit = useCallback((screen: AppNavigateTarget) => {
    if (leaveTimerRef.current != null) window.clearTimeout(leaveTimerRef.current);
    setLeavingPush(screen);
    leaveTimerRef.current = window.setTimeout(() => {
      setLeavingPush(null);
      leaveTimerRef.current = null;
      // Must stay in step with `.app-shell-push`'s own animation length in
      // globals.css (`--dur-base` / `--dur-reduced`), or the leaving screen
      // either unmounts mid-flight or lingers as a dead layer afterwards.
    }, prefersReducedMotion() ? 150 : 320);
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
      // A window tap on Today lands on Home with that room's sheet open.
      if (target.tab === "home" && target.roomId) {
        setRoomOpen(target.roomId);
        setRoomReturnTab(rootTab === "today" ? "today" : null);
      } else {
        setRoomReturnTab(null);
      }
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
  }, [beginPushExit, cancelPushExit, rootTab]);

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
  const EDGE_SPRING =
    "transform var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out)";

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
      void hapticPress();
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
    setRoomReturnTab(null);
    clearPushStack();
  }, [clearPushStack, top, leavingPush]);

  const closeRoomSheet = useCallback(() => {
    setRoomOpen(null);
    if (roomReturnTab) {
      setRootTab(roomReturnTab);
      setRoomReturnTab(null);
    }
  }, [roomReturnTab]);
  const handleFocusHandled = useCallback(() => {
    setNav((current) =>
      current
        ? { tab: current.tab, section: current.section, itemId: current.itemId, playbookId: current.playbookId }
        : null,
    );
  }, []);
  // Start locked; unlock only after ACL Keychain get succeeds (or no vault / web).
  const [locked, setLocked] = useState(true);
  // Hydration reaching plaintext means this session is already authenticated:
  // the ACL Keychain get happened, or there was nothing to unlock. `locked`
  // used to stay true for the whole session on a Face ID device with the
  // setting off, so switching the lock on in Settings swapped the main tree
  // for FaceLock mid-interaction and remounted every keep-alive pane on the
  // way back. Cleared once, at that boundary — a later re-lock still sets
  // `locked` (and `pendingUnlock`) and is not undone here.
  const [unlockedThisSession, setUnlockedThisSession] = useState(false);
  const [lockMethod, setLockMethod] = useState<LockMethod | null>(null);
  const canLock = lockMethod === null ? null : lockMethod !== "none";
  const requireFaceId = sessionMeta?.requireFaceId ?? household.lockSettings?.requireFaceId ?? false;
  const lockAfter = sessionMeta?.lockAfter ?? household.lockSettings?.lockAfter ?? "2min";
  const cleanerVisitActive = sessionMeta?.cleanerVisitActive ?? household.mode === "cleaner";
  const onboarded = sessionMeta?.onboarded ?? household.onboarded;
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  /** Inputs of the last weather fetch this session, so a coords write-back
   * triggered by that same fetch does not fetch again. */
  const weatherRunRef = useRef<{ lat?: number | null; lng?: number | null; zip?: string | null } | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherAttribution, setWeatherAttribution] = useState<WeatherAttribution | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  if (!unlockedThisSession && hydrated && !pendingUnlock) {
    setUnlockedThisSession(true);
    setLocked(false);
  }
  const now = useNow();
  const nowMs = now.getTime();
  // The house answers a finished chore and a new care level once, from here,
  // whichever screen caused it; Today and Home each draw the result.
  const houseAnswer = useHouseAnswer(household, household.momentum.enabled, now);
  const careRise = useCareRise(household.momentum.care, toISODate(now));
  // Today says it with its care card; Home has no card, so one calm line.
  const riseToasted = useRef(0);
  useEffect(() => {
    if (careRise.key === 0 || careRise.key === riseToasted.current) return;
    if (rootTab !== "home" || stack.length > 0) return;
    riseToasted.current = careRise.key;
    toast(t(`care.rise.${careRise.level}` as MessageKey));
  }, [careRise.key, careRise.level, rootTab, stack.length, t]);
  // Once a day, note that the house was opened. On device only; it is the
  // owner's own "days you opened the house" number on the year view.
  useEffect(() => {
    if (!hydrated || !sessionUnlocked || pendingUnlock || !onboarded) return;
    if (household === EMPTY_HOUSEHOLD) return; // never write the pre-hydrate placeholder
    if (hasCheckedInToday(household, now)) return;
    updateTree((current) => recordCheckIn(current, now));
  }, [hydrated, sessionUnlocked, pendingUnlock, onboarded, household, now, updateTree]);
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!hydrated) return;
    void hideLaunchSplash();
  }, [hydrated]);

  useEffect(() => {
    // Idle, not immediate: this competes with first paint for the main
    // thread, and the sparkle it warms up is not needed until the user
    // completes their first chore.
    if (!hydrated) return;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (win.requestIdleCallback) {
      const handle = win.requestIdleCallback(() => preloadSparkleBurst());
      return () => win.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => preloadSparkleBurst(), 1);
    return () => window.clearTimeout(timer);
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
    });
    return () => {
      cancelled = true;
    };
  }, []);


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
    const resync = () => {
      void resyncNotifications();
    };
    const onVisible = () => {
      if (!document.hidden) resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    let cancelled = false;
    let removeNative: (() => void) | undefined;
    if (isNative()) {
      void import("@capacitor/app").then(async ({ App }) => {
        const resume = await App.addListener("resume", resync);
        if (cancelled) {
          void resume.remove();
          return;
        }
        removeNative = () => {
          void resume.remove();
        };
      });
    }
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      removeNative?.();
    };
  }, []);

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
    // A ZIP-only save writes the payload's coords back into `location`, which
    // changes this effect's own deps and ran it a second time — two WeatherKit
    // round-trips for one save. If the last run already answered for this ZIP
    // and it was the one that supplied the coords, there is nothing new to ask.
    const lastRun = weatherRunRef.current;
    if (lastRun && lastRun.zip === zip && lastRun.lat == null && lastRun.lng == null) {
      weatherRunRef.current = { lat, lng, zip };
      return;
    }
    weatherRunRef.current = { lat, lng, zip };
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
    let cancelled = false;
    let remove: (() => void) | undefined;
    void import("@capacitor/app").then(async ({ App }) => {
      const openToday = (url: string) => {
        if (isCuidalaTodayUrl(url)) navigate({ tab: "today" });
      };
      const launch = await App.getLaunchUrl();
      if (cancelled) return;
      if (launch?.url) openToday(launch.url);
      const handle = await App.addListener("appUrlOpen", (event) => {
        openToday(event.url);
      });
      if (cancelled) {
        void handle.remove();
        return;
      }
      remove = () => void handle.remove();
    });
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [navigate]);

  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    let remove: (() => void) | undefined;
    void import("@capacitor/local-notifications").then(async ({ LocalNotifications }) => {
      const handle = await LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
        const extra = event.notification.extra as { tab?: string; itemId?: string; action?: string } | undefined;
        if (extra?.tab === "today") navigate({ tab: "today" });
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
      if (cancelled) {
        void handle.remove();
        return;
      }
      remove = () => void handle.remove();
    });
    return () => {
      cancelled = true;
      remove?.();
    };
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
    // Not before there is anything worth protecting: ask once the person has
    // finished a whole day, when there is a streak to keep, not in the middle
    // of the first chore and not on a first look at a sample home.
    if (dayOutcome(household, new Date(nowMs)) !== "closed") return false;
    const start = household.teaching?.startedAt;
    if (!start) return false;
    const startMs = Date.parse(`${start}T00:00:00`);
    if (!Number.isFinite(startMs)) return false;
    return (nowMs - startMs) / 86_400_000 < 7;
  }, [canLock, requireFaceId, household, nowMs]);
  // On the phone this is the system's own alert, not a lookalike: same
  // buttons, same haptics, same Dark Mode and Dynamic Type as every other
  // iPhone alert. The web dialog below remains the fallback for a browser.
  const nativeLockPrompted = useRef(false);
  const useNativeLockPrompt = Capacitor.isNativePlatform();
  useEffect(() => {
    if (!showLockKeepPrivate || !useNativeLockPrompt || nativeLockPrompted.current) return;
    // Let the day's celebration finish before anything stands over it.
    const timer = window.setTimeout(() => {
    nativeLockPrompted.current = true;
    void Dialog.confirm({
      title: t("lock.keepPrivateTitle", { method: lockMethodLabel(lockMethod ?? "passcode", t).noun }),
      message: t("lock.keepPrivateBody"),
      okButtonTitle: t("lock.enable"),
      cancelButtonTitle: t("lock.skipForNow"),
    }).then(({ value }) => {
      updateTree((current) => ({
        ...markTipSeen(current, TIP_LOCK_KEEP_PRIVATE),
        ...(value ? { lockSettings: { ...current.lockSettings, requireFaceId: true } } : {}),
      }));
    });
    }, 4500);
    return () => window.clearTimeout(timer);
    // The prompt is asked once; later renders must not re-open it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLockKeepPrivate, useNativeLockPrompt]);

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
          void (async () => {
            // Same bar as Settings: this screen is reachable on a transient
            // `unavailable` read where the vault is still intact, so a confirm
            // dialog alone is not enough to wipe it.
            if (canLock) {
              const verified = await verifyDeviceOwner(t("settings.eraseEverything"));
              if (!verified) {
                toast.error(t("settings.verifyFailed"));
                return;
              }
            }
            const result = await eraseEverything();
            if (!result.ok) toast.error(t("shell.eraseFailed"));
          })();
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
        household={household}
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
        now={now}
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

  // The box on the porch is the way into "it came": the one item opens its
  // arrived flow, several open the on-the-way list.
  const openDelivery = (itemId: string | null) =>
    navigate(
      itemId
        ? { tab: "restock", itemId, action: "receive", section: "ordered" }
        : { tab: "restock", section: "ordered" },
    );
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
    onAddAnotherSize: addAnotherSize,
    onAddHaulItem: addHaul,
    onRemoveHaulItem: removeHaul,
    onMarkTip: (tip: string) => updateTree((current) => markTipSeen(current, tip)),
  };

  const lockMethodNoun = lockMethodLabel(lockMethod ?? "passcode", t).noun;

  const todayActive = top === null && rootTab === "today";
  const homeActive = top === null && rootTab === "home";
  const restockActive = top === null && rootTab === "restock";
  const pushBackLabel = t("shell.backTo", { label: backLabel });

  return (
    <div className="app-frame">
      <AlertDialog
        open={showLockKeepPrivate && !useNativeLockPrompt}
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
          className="app-keep-alive app-pane-bleed"
          ref={(node) => {
            tabPaneRefs.current.today = node;
          }}
        >
          <TodayView
            household={household}
            weatherAttribution={weatherAttribution}
            forecast={forecast}
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
            onChangeTree={(next) => updateTree(() => next)}
            onUpdateTree={updateTree}
            houseAnswer={houseAnswer}
            levelUp={careRise.key}
            active={todayActive}
          />
        </div>
        <div
          hidden={!homeActive}
          inert={!homeActive}
          className="app-keep-alive app-pane-bleed"
          data-entering={homeFirstReveal ? "true" : undefined}
          ref={(node) => {
            tabPaneRefs.current.home = node;
          }}
        >
          <HomeScene
            household={household}
            forecast={forecast}
            now={now}
            summary={summary}
            active={homeActive}
            paused={roomOpen !== null}
            answer={houseAnswer}
            levelUp={careRise.key}
            onOpenDelivery={openDelivery}
            onOpenSettings={() => navigate({ tab: "settings" })}
            onOpenRoom={(roomId) => {
              setRoomReturnTab(null);
              setRoomOpen(roomId);
            }}
          >
            <ForecastCard
              household={household}
              onNavigate={navigate}
              onAddInstallDate={() => {
                const first = household.assets[0];
                setRoomReturnTab(null);
                setRoomOpen(first?.roomId ?? "whole-home");
              }}
            />
            <HomeMapView
              key={homeVisit}
              household={household}
              now={now}
              replacementRooms={nearReplacement}
              onApply={(build) => updateTree(build)}
              onSelectRoom={(roomId) => {
                setRoomReturnTab(null);
                setRoomOpen(roomId);
              }}
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
              now={now}
              filter="all"
              onOpenChange={(open) => {
                if (!open) closeRoomSheet();
              }}
              onToggle={(duty, completed) => (completed ? undoCompletion(duty.id) : completeDuty(duty.id))}
              onSaveDuty={saveDuty}
              onDeleteDuty={deleteDuty}
              onChangeTree={(next) => updateTree(() => next)}
              {...restockHandlers}
            />
          </HomeScene>
        </div>
        <div
          hidden={!restockActive}
          inert={!restockActive}
          className="app-keep-alive app-keep-alive-inset"
          data-entering={restockFirstReveal ? "true" : undefined}
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
            <div className="app-shell-push-body">
              <BackTitleContext.Provider value={backLabel}>
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
                  now={now}
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
                  morningBrief={household.morningBrief}
                  onUpdateMorningBrief={updateMorningBrief}
                  eveningNudge={eveningNudgeSettings(household)}
                  onUpdateEveningNudge={updateEveningNudge}
                  onUpdateMomentum={updateMomentum}
                  focusAssetId={nav?.assetId}
                  onFocusHandled={handleFocusHandled}
                  onOpenYear={() => navigate({ tab: "year" })}
                  onBack={popStack}
                  backLabel={pushBackLabel}
                />
              ) : null}
              {pushScreen.tab === "year" ? (
                <YearView household={household} now={now} onBack={popStack} backLabel={pushBackLabel} />
              ) : null}
              </BackTitleContext.Provider>
            </div>
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
            icon={<Sun className={cn("size-6", rootTab === "today" && "[stroke-width:2.25]")} />}
            active={rootTab === "today"}
            onClick={() => selectRootTab("today")}
          />
          <NavButton
            label={t("tabs.home")}
            icon={<Home className={cn("size-6", rootTab === "home" && "[stroke-width:2.25]")} />}
            active={rootTab === "home"}
            onClick={() => selectRootTab("home")}
          />
          <NavButton
            label={t("tabs.restock")}
            icon={<Package className={cn("size-6", rootTab === "restock" && "[stroke-width:2.25]")} />}
            active={rootTab === "restock"}
            badge={restockGroups?.order_now.length ?? 0}
            onClick={() => selectRootTab("restock")}
          />
        </div>
      </nav>
    </div>
  );
}

/**
 * The half-second between the splash and the first real screen. It was a bare
 * mark on cream, which is honest but reads as a stall; the mark now breathes
 * up to full so the wait looks like the app arriving rather than nothing
 * happening. Nothing here waits on data — it is a local-first app and there is
 * no spinner to justify.
 */
function OpeningScreen() {
  return (
    <div
      suppressHydrationWarning
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: DUR_SCREEN, ease: EASE_OUT }}
      >
        <BrandMark size="md" />
      </motion.div>
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

  // `Browser.open` only handles http/https on iOS, so it rejected this URL and
  // the button did nothing on the one screen where it is the way out. A
  // top-level navigation is the path a custom scheme needs: Capacitor's
  // WebViewDelegationHandler cancels any top-level navigation away from the
  // app URL and hands it to `UIApplication.open`. Fire-and-forget, and
  // meaningless in the web shell, where the scheme resolves to nothing.
  function openIosSettings() {
    if (!isNative()) return;
    window.location.href = "app-settings:";
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
          <Button className="h-12" onClick={() => openIosSettings()}>
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
            <AlertDialogAction className="bg-destructive text-primary-foreground" onClick={onErase}>
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
      onClick={() => {
        if (!active) void hapticTab();
        onClick();
      }}
      className={cn(
        "mx-0.5 flex min-h-12 flex-col items-center justify-center gap-0.5 ui-caption font-medium transition-colors ui-press",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span className="relative">
        {icon}
        {badge ? (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 ui-caption font-semibold num text-primary-foreground">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
    </button>
  );
}
