const ASIN = /^[A-Z0-9]{10}$/i;
const AMAZON_HOST = /(^|\.)amazon\.[a-z.]+$/i;
const SHORT_HOST = /^(amzn\.to|a\.co)$/i;

export type AmazonProductRef =
  | { ok: true; kind: "url"; url: string; asin?: string }
  | { ok: true; kind: "asin"; asin: string; url: string }
  | { ok: false; error: string };

export function parseAmazonProduct(input: string): AmazonProductRef {
  const value = input.trim();
  if (!value) return { ok: false, error: "Paste an Amazon product link or ASIN." };
  if (ASIN.test(value)) {
    const asin = value.toUpperCase();
    return { ok: true, kind: "asin", asin, url: `https://www.amazon.com/dp/${asin}` };
  }

  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    return { ok: false, error: "That doesn’t look like an Amazon link." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "That doesn’t look like an Amazon link." };
  }

  const host = url.hostname.replace(/^www\./i, "");
  if (!AMAZON_HOST.test(host) && !SHORT_HOST.test(host)) {
    return { ok: false, error: "Use an Amazon product link." };
  }

  const asinMatch = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
  return {
    ok: true,
    kind: "url",
    url: url.toString(),
    asin: asinMatch?.[1]?.toUpperCase(),
  };
}

export function amazonProductHref(item: { amazonProductUrl?: string; asin?: string }): string | null {
  const pasted = item.amazonProductUrl?.trim();
  if (pasted) {
    const parsed = parseAmazonProduct(pasted);
    if (parsed.ok) return parsed.url;
  }
  const asin = item.asin?.trim();
  if (asin && ASIN.test(asin)) return `https://www.amazon.com/dp/${asin.toUpperCase()}`;
  return null;
}

export function amazonSearchUrl(itemName: string): string {
  const query = itemName.trim() || "home supply";
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
}

export function amazonOrderHref(item: { amazonProductUrl?: string; asin?: string; itemName: string }): {
  href: string;
  search: boolean;
} {
  const href = amazonProductHref(item);
  if (href) return { href, search: false };
  return { href: amazonSearchUrl(item.itemName), search: true };
}
