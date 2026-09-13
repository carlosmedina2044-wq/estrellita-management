import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import ptBR from "@/i18n/messages/pt-BR.json";

export const LOCALES = ["en", "es", "pt-BR"] as const;
export type AppLocale = (typeof LOCALES)[number];
export type MessageKey = keyof typeof en;

const catalogs: Record<AppLocale, Record<string, string>> = {
  en,
  es,
  "pt-BR": ptBR,
};

export const LOCALE_PREF_KEY = "cuidala-locale";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "en" || value === "es" || value === "pt-BR";
}

/** Resolve BCP-47 tags like es-MX / pt-BR / en-US into an AppLocale. */
export function resolveLocaleTag(tag: string | null | undefined): AppLocale | null {
  if (!tag) return null;
  const normalized = tag.trim().replace("_", "-");
  if (isAppLocale(normalized)) return normalized;
  const lower = normalized.toLowerCase();
  if (lower === "pt-br" || lower.startsWith("pt-br") || lower === "pt") return "pt-BR";
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("pt")) return "pt-BR";
  return null;
}

export function detectDeviceLocale(): AppLocale {
  if (typeof navigator === "undefined") return "en";
  const candidates = [...(navigator.languages ?? []), navigator.language];
  for (const tag of candidates) {
    const resolved = resolveLocaleTag(tag);
    if (resolved) return resolved;
  }
  return "en";
}

export function translate(
  locale: AppLocale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const table = catalogs[locale] ?? catalogs.en;
  let value = table[key] ?? catalogs.en[key] ?? key;
  if (params) {
    for (const [name, raw] of Object.entries(params)) {
      value = value.replaceAll(`{${name}}`, String(raw));
    }
  }
  return value;
}

export function localeDateTag(locale: AppLocale): string {
  return locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es-419" : "en-US";
}
