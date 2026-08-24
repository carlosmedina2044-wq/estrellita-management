import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractSharedUrl,
  isKnownRetailerUrl,
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
});

test("isKnownRetailerUrl matches subdomains but not lookalikes", () => {
  assert.equal(isKnownRetailerUrl("https://smile.amazon.com/dp/B0FILTER12"), true);
  assert.equal(isKnownRetailerUrl("https://amazon.com.evil.example/dp/x"), false);
  assert.equal(isKnownRetailerUrl("https://notwalmart.com/ip/x"), false);
});
