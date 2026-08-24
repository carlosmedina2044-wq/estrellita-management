import { TEXT_LIMITS } from "@/lib/sanitize";
import type { SavedRetailerLink } from "@/lib/types";

export type { RetailerId } from "@/lib/types";

const ASIN = /^[A-Z0-9]{10}$/i;
const AMAZON_HOST = /(^|\.)amazon\.(com|ca|com\.mx|co\.uk|de|fr|es|it|nl|se|pl|com\.au|co\.jp|in|sg|ae|sa|com\.br)$/i;
const SHORT_HOST = /^(amzn\.to|a\.co)$/i;

/** Hosts a link may come from without the user pasting it themselves. */
const KNOWN_RETAILER_HOSTS = [
  AMAZON_HOST,
  SHORT_HOST,
  /(^|\.)homedepot\.com$/i,
  /(^|\.)lowes\.com$/i,
  /(^|\.)walmart\.com$/i,
  /(^|\.)target\.com$/i,
  /(^|\.)chewy\.com$/i,
  /(^|\.)costco\.com$/i,
  /(^|\.)acehardware\.com$/i,
  /(^|\.)ebay\.(com|ca|co\.uk|com\.au|de|fr|it|es)$/i,
];

const TRACKING_PARAM = /^(utm_|fbclid|gclid|mc_|ref_|tag$|camp$|_encoding$)/i;
export const MAX_SAVED_RETAILER_LINKS = 12;

export function isKnownRetailerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.replace(/^www\./i, "");
    return KNOWN_RETAILER_HOSTS.some((pattern) => pattern.test(host));
  } catch {
    return false;
  }
}

export type RetailerChip = {
  id: "amazon" | "home-depot" | "walmart" | "chewy" | "target";
  label: string;
  searchUrl: (query: string) => string;
};

export const RETAILER_CHIPS: RetailerChip[] = [
  {
    id: "amazon",
    label: "Amazon",
    searchUrl: (query) => `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
  },
  {
    id: "home-depot",
    label: "Home Depot",
    searchUrl: (query) => `https://www.homedepot.com/s/${encodeURIComponent(query)}`,
  },
  {
    id: "walmart",
    label: "Walmart",
    searchUrl: (query) => `https://www.walmart.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "chewy",
    label: "Chewy",
    searchUrl: (query) => `https://www.chewy.com/s?query=${encodeURIComponent(query)}`,
  },
  {
    id: "target",
    label: "Target",
    searchUrl: (query) => `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`,
  },
];

export type RetailerRef =
  | { ok: true; url: string; asin?: string; productPage: boolean }
  | { ok: false; error: string };

function searchQuery(name: string, sizeSpec?: string): string {
  return `${name.trim()} ${sizeSpec?.trim() ?? ""}`.trim() || "home supply";
}

export function retailerSearchUrl(chipId: RetailerChip["id"], name: string, sizeSpec?: string): string {
  const chip = RETAILER_CHIPS.find((item) => item.id === chipId);
  return (chip ?? RETAILER_CHIPS[0]).searchUrl(searchQuery(name, sizeSpec));
}

/** Search the item on an arbitrary store host the user typed (ebay.com, etc.). */
export function searchUrlOnHost(host: string, name: string, sizeSpec?: string): string {
  const h = host.replace(/^www\./i, "").toLowerCase();
  const q = encodeURIComponent(searchQuery(name, sizeSpec));
  if (AMAZON_HOST.test(h) || SHORT_HOST.test(h)) return `https://www.amazon.com/s?k=${q}`;
  if (/(^|\.)homedepot\.com$/i.test(h)) return `https://www.homedepot.com/s/${q}`;
  if (/(^|\.)walmart\.com$/i.test(h)) return `https://www.walmart.com/search?q=${q}`;
  if (/(^|\.)target\.com$/i.test(h)) return `https://www.target.com/s?searchTerm=${q}`;
  if (/(^|\.)chewy\.com$/i.test(h)) return `https://www.chewy.com/s?query=${q}`;
  if (/(^|\.)ebay\.(com|ca|co\.uk|com\.au|de|fr|it|es)$/i.test(h)) {
    return `https://${h}/sch/i.html?_nkw=${q}`;
  }
  return `https://${h}/search?q=${q}`;
}

function isBareStoreUrl(value: string): boolean {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.pathname === "/" || url.pathname === "";
  } catch {
    return false;
  }
}

/**
 * User-typed store or listing. Bare hosts (ebay.com) are remembered as the store
 * and opened as a search for the item name. Full listing URLs are saved and opened as-is.
 */
export function resolveRetailerEntry(
  input: string,
  itemName = "",
  sizeSpec?: string,
): { ok: true; saveUrl: string; openUrl: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Type a store like ebay.com, or paste a link." };
  const parsed = parseRetailerInput(trimmed);
  if (!parsed.ok) return parsed;
  const saveUrl = normalizeSavedRetailerUrl(parsed.url) ?? parsed.url;
  if (isBareStoreUrl(parsed.url) && itemName.trim()) {
    try {
      const host = new URL(parsed.url.includes("://") ? parsed.url : `https://${parsed.url}`).hostname;
      return { ok: true, saveUrl, openUrl: searchUrlOnHost(host, itemName, sizeSpec) };
    } catch {
      return { ok: true, saveUrl, openUrl: saveUrl };
    }
  }
  return { ok: true, saveUrl, openUrl: saveUrl };
}

export function amazonUrlFromAsin(asin: string): string {
  return `https://www.amazon.com/dp/${asin.toUpperCase()}`;
}

export function isProductPageUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return false;
  }
  const host = url.hostname.replace(/^www\./i, "");
  const path = url.pathname;
  if (path.includes("/s") && (url.searchParams.has("k") || url.searchParams.has("q") || url.searchParams.has("searchTerm") || url.searchParams.has("query"))) {
    return false;
  }
  if (AMAZON_HOST.test(host) || SHORT_HOST.test(host)) {
    return /\/(?:dp|gp\/product|gp\/aw\/d)\//i.test(path);
  }
  if (/(^|\.)homedepot\.com$/i.test(host)) return /\/p\//i.test(path);
  if (/(^|\.)walmart\.com$/i.test(host)) return /\/ip\//i.test(path);
  if (/(^|\.)target\.com$/i.test(host)) return /\/p\//i.test(path) || /\/-/i.test(path);
  if (/(^|\.)chewy\.com$/i.test(host)) return /\/dp\//i.test(path) || Boolean(path.split("/").filter(Boolean)[1]);
  const last = path.split("/").filter(Boolean).pop() ?? "";
  return last.length > 8 && !/^search|s|shop$/i.test(last);
}

export function parseRetailerInput(input: string): RetailerRef {
  const value = input.trim();
  if (!value) return { ok: false, error: "Paste a product link." };
  if (ASIN.test(value)) {
    const asin = value.toUpperCase();
    return { ok: true, url: amazonUrlFromAsin(asin), asin, productPage: true };
  }

  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return { ok: false, error: "That doesn’t look like a product link." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "That doesn’t look like a product link." };
  }

  const host = url.hostname.replace(/^www\./i, "");
  const asinMatch = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  const asin = AMAZON_HOST.test(host) || SHORT_HOST.test(host) ? asinMatch?.[1]?.toUpperCase() : undefined;
  return {
    ok: true,
    url: url.toString(),
    asin,
    productPage: isProductPageUrl(url.toString()),
  };
}

export function retailerUrlFor(item: { retailerUrl?: string }): string | null {
  const pasted = item.retailerUrl?.trim();
  if (!pasted) return null;
  const parsed = parseRetailerInput(pasted);
  return parsed.ok ? parsed.url : null;
}

/**
 * Pulls a product URL out of share-sheet input. Because this path is reached
 * from outside the app (share extension, deep link), only known retailer hosts
 * over HTTPS are accepted; anything else is dropped rather than surfaced as an
 * "Order" button.
 */
export function extractSharedUrl(input: { url?: string | null; text?: string | null; title?: string | null }): string | null {
  const candidates = [input.url, input.text, input.title];
  for (const value of candidates) {
    if (!value) continue;
    const match = value.match(/https?:\/\/[^\s]+/i);
    const candidate = match ? match[0] : value;
    const parsed = parseRetailerInput(candidate);
    if (parsed.ok && isKnownRetailerUrl(parsed.url)) return parsed.url;
  }
  return null;
}

/**
 * Canonical household-saved URL: https, no www, no hash, no tracking params.
 * Returns null for empty or unparseable input.
 */
export function normalizeSavedRetailerUrl(input: string): string | null {
  const parsed = parseRetailerInput(input);
  if (!parsed.ok) return null;
  try {
    const url = new URL(parsed.url);
    url.hash = "";
    url.username = "";
    url.password = "";
    url.protocol = "https:";
    url.hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
    }
    if (url.pathname === "/") url.pathname = "";
    const href = url.toString().replace(/\/$/, "");
    const cleaned = href.slice(0, TEXT_LIMITS.url);
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

export function savedRetailerLabel(url: string): string {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./i, "");
    const path = parsed.pathname.replace(/\/$/, "");
    if (!path) return host;
    if (path.length <= 22) return `${host}${path}`;
    return `${host}${path.slice(0, 19)}…`;
  } catch {
    return url;
  }
}

export function rememberRetailerLink(
  links: SavedRetailerLink[],
  rawUrl: string,
  now = new Date(),
): SavedRetailerLink[] {
  const url = normalizeSavedRetailerUrl(rawUrl);
  if (!url) return links;
  const existing = links.find((item) => item.url === url);
  const next: SavedRetailerLink = existing
    ? { url, lastUsedAt: now.toISOString(), useCount: existing.useCount + 1 }
    : { url, lastUsedAt: now.toISOString(), useCount: 1 };
  return [next, ...links.filter((item) => item.url !== url)].slice(0, MAX_SAVED_RETAILER_LINKS);
}

export function sortedSavedRetailerLinks(links: SavedRetailerLink[]): SavedRetailerLink[] {
  return [...links].sort((a, b) => {
    const byTime = b.lastUsedAt.localeCompare(a.lastUsedAt);
    if (byTime !== 0) return byTime;
    return b.useCount - a.useCount;
  });
}
