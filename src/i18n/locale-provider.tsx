"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  detectDeviceLocale,
  isAppLocale,
  localeDateTag,
  LOCALE_PREF_KEY,
  setActiveAppLocale,
  translate,
  type AppLocale,
  type MessageKey,
} from "@/i18n";
import { setActiveDateLocale } from "@/lib/dates";
import { kvGet, kvSet } from "@/lib/native/kv";

type LocaleContextValue = {
  locale: AppLocale;
  /** system = follow device languages */
  preference: AppLocale | "system";
  setPreference: (next: AppLocale | "system") => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  dateLocale: string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function htmlLang(locale: AppLocale): string {
  return locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es-MX" : "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<AppLocale | "system">("system");
  const [deviceLocale, setDeviceLocale] = useState<AppLocale>("en");

  const refreshDeviceLocale = useCallback(() => {
    setDeviceLocale(detectDeviceLocale());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      refreshDeviceLocale();
      try {
        const stored = await kvGet(LOCALE_PREF_KEY);
        if (!cancelled && isAppLocale(stored)) setPreferenceState(stored);
      } catch {
        // keep system
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshDeviceLocale]);

  // When iPhone language changes while the app is backgrounded, System mode picks it up.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshDeviceLocale();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("languagechange", refreshDeviceLocale);

    let removeResume: (() => void) | undefined;
    void import("@capacitor/app")
      .then(async ({ App }) => {
        const handle = await App.addListener("resume", refreshDeviceLocale);
        removeResume = () => {
          void handle.remove();
        };
      })
      .catch(() => {});

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("languagechange", refreshDeviceLocale);
      removeResume?.();
    };
  }, [refreshDeviceLocale]);

  const setPreference = useCallback((next: AppLocale | "system") => {
    setPreferenceState(next);
    void (async () => {
      if (next === "system") {
        await kvSet(LOCALE_PREF_KEY, "");
      } else {
        await kvSet(LOCALE_PREF_KEY, next);
      }
    })();
  }, []);

  const locale = preference === "system" ? deviceLocale : preference;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = htmlLang(locale);
    setActiveDateLocale(localeDateTag(locale));
    setActiveAppLocale(locale);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      preference,
      setPreference,
      t: (key, params) => translate(locale, key, params),
      dateLocale: localeDateTag(locale),
    }),
    [locale, preference, setPreference],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale requires LocaleProvider");
  return ctx;
}
