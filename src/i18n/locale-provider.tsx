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
  translate,
  type AppLocale,
  type MessageKey,
} from "@/i18n";
import { setActiveDateLocale } from "@/lib/dates";
import { kvGet, kvSet } from "@/lib/native/kv";

type LocaleContextValue = {
  locale: AppLocale;
  /** null = follow device languages */
  preference: AppLocale | "system";
  setPreference: (next: AppLocale | "system") => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  dateLocale: string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<AppLocale | "system">("system");
  const [deviceLocale, setDeviceLocale] = useState<AppLocale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setDeviceLocale(detectDeviceLocale());
      try {
        const stored = await kvGet(LOCALE_PREF_KEY);
        if (!cancelled && isAppLocale(stored)) setPreferenceState(stored);
      } catch {
        // keep system
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    document.documentElement.lang = locale === "pt-BR" ? "pt-BR" : locale;
    setActiveDateLocale(localeDateTag(locale));
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

  // Avoid flashing wrong language before preference loads.
  if (!ready) {
    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale requires LocaleProvider");
  return ctx;
}
