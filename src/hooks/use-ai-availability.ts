"use client";

import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { tActive } from "@/i18n";
import type { AiState } from "@/lib/ai-invite";
import { aiAvailable } from "@/lib/native/intelligence";
import { isNative } from "@/lib/native/platform";

export type { AiState };

/*
 * One shared answer to "can this iPhone read with Apple Intelligence right now?".
 * Every screen that asks shares one cached check, re-run whenever the app comes
 * back to the foreground (the person may have just switched it on in Settings).
 * When that re-check finds it newly on, a quiet "Smart reading is on" appears once.
 */

const CACHE_MS = 5_000;

let state: AiState = "unknown";
let checkedAt = 0;
let inflight: Promise<void> | null = null;
let announced = false;
let started = false;
const listeners = new Set<() => void>();

function setState(next: AiState) {
  if (next === state) return;
  const before = state;
  state = next;
  if (next === "available" && (before === "notEnabled" || before === "modelNotReady") && !announced) {
    announced = true;
    toast(tActive("ai.nowOn"));
  }
  listeners.forEach((listener) => listener());
}

function stateFrom(result: Awaited<ReturnType<typeof aiAvailable>>): AiState {
  if (result.available) return "available";
  if (result.reason === "notEnabled") return "notEnabled";
  if (result.reason === "modelNotReady") return "modelNotReady";
  return "unavailable";
}

function check(force: boolean): Promise<void> {
  if (inflight) return inflight;
  if (!force && state !== "unknown" && Date.now() - checkedAt < CACHE_MS) return Promise.resolve();
  inflight = aiAvailable()
    .then((result) => {
      checkedAt = Date.now();
      setState(stateFrom(result));
    })
    .catch(() => {
      checkedAt = Date.now();
      setState("unavailable");
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function start() {
  if (started || typeof document === "undefined") return;
  started = true;
  const onVisible = () => {
    if (!document.hidden) void check(true);
  };
  document.addEventListener("visibilitychange", onVisible);
  if (isNative()) {
    void import("@capacitor/app").then(async ({ App }) => {
      await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void check(true);
      });
      await App.addListener("resume", () => void check(true));
    });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  void check(false);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = (): AiState => "unknown";

export function useAiAvailability(): { state: AiState; refresh: () => void } {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const refresh = useCallback(() => {
    void check(true);
  }, []);
  return { state: current, refresh };
}
