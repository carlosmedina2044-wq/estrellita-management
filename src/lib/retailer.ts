const ASIN = /^[A-Z0-9]{10}$/i;
const AMAZON_HOST = /(^|\.)amazon\.[a-z.]+$/i;
const SHORT_HOST = /^(amzn\.to|a\.co)$/i;

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

function searchQuery(name: string): string {
  return name.trim() || "home supply";
}

export function retailerSearchUrl(chipId: RetailerChip["id"], name: string): string {
  const chip = RETAILER_CHIPS.find((item) => item.id === chipId);
  return (chip ?? RETAILER_CHIPS[0]).searchUrl(searchQuery(name));
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

export function retailerUrlFor(item: {
  retailerUrl?: string;
  amazonProductUrl?: string;
  asin?: string;
}): string | null {
  const pasted = item.retailerUrl?.trim() || item.amazonProductUrl?.trim();
  if (pasted) {
    const parsed = parseRetailerInput(pasted);
    if (parsed.ok) return parsed.url;
  }
  const asin = item.asin?.trim();
  if (asin && ASIN.test(asin)) return amazonUrlFromAsin(asin);
  return null;
}

export function extractSharedUrl(input: { url?: string | null; text?: string | null; title?: string | null }): string | null {
  const candidates = [input.url, input.text, input.title];
  for (const value of candidates) {
    if (!value) continue;
    const match = value.match(/https?:\/\/[^\s]+/i);
    if (match) {
      const parsed = parseRetailerInput(match[0]);
      if (parsed.ok) return parsed.url;
    }
    const parsed = parseRetailerInput(value);
    if (parsed.ok) return parsed.url;
  }
  return null;
}
