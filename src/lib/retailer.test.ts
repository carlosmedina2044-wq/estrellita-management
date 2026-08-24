import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractSharedUrl,
  isKnownRetailerUrl,
  isProductPageUrl,
  MAX_SAVED_RETAILER_LINKS,
  normalizeSavedRetailerUrl,
  orderedRetailerChips,
  parseRetailerInput,
  rememberRetailerLink,
  RETAILER_CHIPS,
  retailerSearchUrl,
  resolveRetailerEntry,
  retailerUrlFor,
  savedRetailerLabel,
  searchQueryFor,
  searchUrlOnHost,
} from "@/lib/retailer";

test("accepts any retailer URL, including Walmart", () => {
  const parsed = parseRetailerInput("https://www.walmart.com/ip/filter");
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.match(parsed.url, /walmart\.com/);
});

test("ASIN becomes an Amazon product URL", () => {
  const parsed = parseRetailerInput("B0FILTER12");
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.url, "https://www.amazon.com/dp/B0FILTER12");
    assert.equal(parsed.productPage, true);
  }
});

test("search chips encode the item name", () => {
  assert.equal(
    retailerSearchUrl("amazon", "HVAC filter 16x25x1"),
    "https://www.amazon.com/s?k=HVAC%20filter%2016x25x1",
  );
  assert.match(retailerSearchUrl("home-depot", "caulk"), /homedepot\.com/);
  assert.match(retailerSearchUrl("target", "trash bags"), /target\.com/);
});

test("search URLs append sizeSpec and encode x and quotes", () => {
  assert.equal(
    retailerSearchUrl("amazon", "HVAC filter", "16x25x1"),
    "https://www.amazon.com/s?k=HVAC%20filter%2016x25x1",
  );
  const quoted = retailerSearchUrl("amazon", "shim", '1/4"');
  assert.equal(quoted, `https://www.amazon.com/s?k=${encodeURIComponent('shim 1/4"')}`);
  assert.match(quoted, /1%2F4%22/);
  assert.match(searchUrlOnHost("homedepot.com", "HVAC filter", "16x25x1"), /16x25x1/);
  assert.equal(
    searchUrlOnHost("ebay.com", "shim", '1/4"'),
    `https://ebay.com/sch/i.html?_nkw=${encodeURIComponent('shim 1/4"')}`,
  );
});

test("absent sizeSpec produces the same search URLs as name-only", () => {
  assert.equal(retailerSearchUrl("amazon", "HVAC filter"), retailerSearchUrl("amazon", "HVAC filter", undefined));
  assert.equal(retailerSearchUrl("amazon", "HVAC filter", ""), retailerSearchUrl("amazon", "HVAC filter"));
  assert.equal(
    retailerSearchUrl("walmart", "caulk"),
    "https://www.walmart.com/search?q=caulk",
  );
  assert.equal(searchUrlOnHost("target.com", "trash bags"), searchUrlOnHost("target.com", "trash bags", undefined));
});

test("resolveRetailerEntry searches a typed host and saves the store", () => {
  const ebay = resolveRetailerEntry("ebay.com", "HVAC filter");
  assert.equal(ebay.ok, true);
  if (ebay.ok) {
    assert.equal(ebay.saveUrl, "https://ebay.com");
    assert.match(ebay.openUrl, /ebay\.com\/sch\/i\.html\?_nkw=HVAC%20filter/);
  }
  const listing = resolveRetailerEntry("https://www.ebay.com/itm/123456", "HVAC filter");
  assert.equal(listing.ok, true);
  if (listing.ok) {
    assert.match(listing.saveUrl, /ebay\.com\/itm\/123456/);
    assert.equal(listing.openUrl, listing.saveUrl);
  }
  assert.equal(resolveRetailerEntry("", "filter").ok, false);
});

test("product page detection distinguishes search vs product", () => {
  assert.equal(isProductPageUrl("https://www.amazon.com/dp/B0FILTER12"), true);
  assert.equal(isProductPageUrl("https://www.amazon.com/s?k=filter"), false);
  assert.equal(isProductPageUrl("https://www.homedepot.com/p/123"), true);
});

test("retailerUrlFor returns the saved link or null", () => {
  assert.equal(retailerUrlFor({ retailerUrl: "https://www.target.com/p/filter" }), "https://www.target.com/p/filter");
  assert.equal(retailerUrlFor({ retailerUrl: "" }), null);
  assert.equal(retailerUrlFor({ retailerUrl: "javascript:alert(1)" }), null);
});

test("extractSharedUrl finds a URL in share text", () => {
  assert.equal(
    extractSharedUrl({ text: "Check this https://www.chewy.com/dp/abc123 extra" }),
    "https://www.chewy.com/dp/abc123",
  );
});

test("extractSharedUrl drops unknown hosts and non-HTTPS links", () => {
  assert.equal(extractSharedUrl({ url: "https://evil.example/login" }), null);
  assert.equal(extractSharedUrl({ url: "http://www.amazon.com/dp/B0FILTER12" }), null);
  assert.equal(extractSharedUrl({ text: "see https://www.homedepot.com/p/123" }), "https://www.homedepot.com/p/123");
  assert.match(extractSharedUrl({ url: "https://www.ebay.com/itm/123" }) ?? "", /ebay\.com/);
});

test("isKnownRetailerUrl matches subdomains but not lookalikes", () => {
  assert.equal(isKnownRetailerUrl("https://smile.amazon.com/dp/B0FILTER12"), true);
  assert.equal(isKnownRetailerUrl("https://amazon.com.evil.example/dp/x"), false);
  assert.equal(isKnownRetailerUrl("https://notwalmart.com/ip/x"), false);
  assert.equal(isKnownRetailerUrl("https://ebay.com/"), true);
  assert.equal(isKnownRetailerUrl("https://notebay.com/"), false);
});

test("normalizeSavedRetailerUrl strips www, tracking, and trailing slash", () => {
  assert.equal(normalizeSavedRetailerUrl("https://www.ebay.com/?utm_source=share"), "https://ebay.com");
  assert.equal(normalizeSavedRetailerUrl(""), null);
  assert.equal(normalizeSavedRetailerUrl("javascript:alert(1)"), null);
});

test("rememberRetailerLink upserts last-used first and caps the list", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");
  const later = new Date("2026-08-23T13:00:00.000Z");
  let links = rememberRetailerLink([], "https://www.ebay.com/itm/1", now);
  links = rememberRetailerLink(links, "https://www.walmart.com/ip/2", now);
  links = rememberRetailerLink(links, "https://ebay.com/itm/1", later);
  assert.equal(links[0]?.url, "https://ebay.com/itm/1");
  assert.equal(links[0]?.useCount, 2);
  assert.equal(links[1]?.url, "https://walmart.com/ip/2");
  assert.equal(savedRetailerLabel("https://ebay.com/itm/1"), "ebay.com/itm/1");
  let many = [] as ReturnType<typeof rememberRetailerLink>;
  for (let i = 0; i < MAX_SAVED_RETAILER_LINKS + 3; i += 1) {
    many = rememberRetailerLink(many, `https://ebay.com/itm/${i}`, now);
  }
  assert.equal(many.length, MAX_SAVED_RETAILER_LINKS);
});

test("default chips are Amazon, Walmart, Target, Home Depot, Lowe’s, Chewy", () => {
  assert.deepEqual(
    RETAILER_CHIPS.map((chip) => chip.id),
    ["amazon", "walmart", "target", "home-depot", "lowes", "chewy"],
  );
  assert.match(retailerSearchUrl("lowes", "caulk"), /lowes\.com\/search\?searchTerm=caulk/);
  assert.equal(isProductPageUrl("https://www.lowes.com/pd/filter/123"), true);
  assert.equal(isProductPageUrl("https://www.lowes.com/search?searchTerm=filter"), false);
  assert.match(searchUrlOnHost("lowes.com", "HVAC filter", "16x25x1"), /lowes\.com\/search\?searchTerm=/);
});

test("orderedRetailerChips puts last-used first and keeps Chewy opt-in", () => {
  const defaultOrder = orderedRetailerChips({ preferredRetailers: [] });
  assert.deepEqual(
    defaultOrder.map((chip) => chip.id),
    ["amazon", "walmart", "target", "home-depot", "lowes"],
  );
  assert.equal(defaultOrder.some((chip) => chip.id === "chewy"), false);

  const preferred = orderedRetailerChips({ preferredRetailers: ["walmart", "amazon", "chewy"] });
  assert.deepEqual(
    preferred.map((chip) => chip.id),
    ["walmart", "amazon", "chewy", "target", "home-depot", "lowes"],
  );

  const lastTime = orderedRetailerChips(
    { preferredRetailers: ["walmart", "amazon"] },
    { preferredRetailer: "target" },
  );
  assert.equal(lastTime[0]?.id, "target");
  assert.equal(lastTime[0]?.lastTime, true);
  assert.deepEqual(
    lastTime.map((chip) => chip.id),
    ["target", "walmart", "amazon", "home-depot", "lowes"],
  );

  const chewyItem = orderedRetailerChips({ preferredRetailers: [] }, { preferredRetailer: "chewy" });
  assert.equal(chewyItem[0]?.id, "chewy");
  assert.equal(chewyItem[0]?.lastTime, true);
});

test("searchQueryFor de-dupes size and turns × into x", () => {
  assert.equal(searchQueryFor({ itemName: "HVAC filter", sku: "16×25×1" }), "HVAC filter 16x25x1");
  assert.equal(searchQueryFor({ itemName: "HVAC filter (16×25×1)", sku: "16×25×1" }), "HVAC filter (16x25x1)");
  assert.equal(searchQueryFor({ itemName: "HVAC filter (16x25x1)", sku: "16x25x1" }), "HVAC filter (16x25x1)");
  assert.equal(searchQueryFor({ itemName: "Trash bags", sku: "" }), "Trash bags");
});
