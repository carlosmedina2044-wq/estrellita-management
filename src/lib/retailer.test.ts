import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractSharedUrl,
  isProductPageUrl,
  parseRetailerInput,
  retailerSearchUrl,
  retailerUrlFor,
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

test("product page detection distinguishes search vs product", () => {
  assert.equal(isProductPageUrl("https://www.amazon.com/dp/B0FILTER12"), true);
  assert.equal(isProductPageUrl("https://www.amazon.com/s?k=filter"), false);
  assert.equal(isProductPageUrl("https://www.homedepot.com/p/123"), true);
});

test("retailerUrlFor prefers a saved retailer link", () => {
  assert.equal(
    retailerUrlFor({ retailerUrl: "https://www.target.com/p/filter", amazonProductUrl: "https://www.amazon.com/dp/B0FILTER12" }),
    "https://www.target.com/p/filter",
  );
  assert.equal(retailerUrlFor({ asin: "B0FILTER12" }), "https://www.amazon.com/dp/B0FILTER12");
});

test("extractSharedUrl finds a URL in share text", () => {
  assert.equal(
    extractSharedUrl({ text: "Check this https://www.chewy.com/dp/abc123 extra" }),
    "https://www.chewy.com/dp/abc123",
  );
});
