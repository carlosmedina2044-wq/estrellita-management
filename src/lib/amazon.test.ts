import assert from "node:assert/strict";
import { test } from "node:test";
import { amazonOrderHref, amazonProductHref, amazonSearchUrl, parseAmazonProduct } from "@/lib/amazon";

test("accepts a 10-character ASIN", () => {
  const parsed = parseAmazonProduct("B0EXAMPLE1");
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.kind, "asin");
  assert.equal(parsed.asin, "B0EXAMPLE1");
  assert.equal(parsed.url, "https://www.amazon.com/dp/B0EXAMPLE1");
});

test("accepts amazon.com dp and gp/product links", () => {
  const dp = parseAmazonProduct("https://www.amazon.com/dp/B0FILTER12");
  assert.equal(dp.ok, true);
  if (dp.ok) assert.equal(dp.asin, "B0FILTER12");

  const gp = parseAmazonProduct("https://www.amazon.com/gp/product/B0FILTER12?th=1");
  assert.equal(gp.ok, true);
  if (gp.ok) assert.equal(gp.asin, "B0FILTER12");
});

test("rejects non-Amazon links", () => {
  const parsed = parseAmazonProduct("https://www.walmart.com/ip/filter");
  assert.equal(parsed.ok, false);
});

test("product href prefers a saved URL, then ASIN", () => {
  assert.equal(
    amazonProductHref({ amazonProductUrl: "https://www.amazon.com/dp/B0FILTER12", asin: "" }),
    "https://www.amazon.com/dp/B0FILTER12",
  );
  assert.equal(amazonProductHref({ asin: "B0FILTER12" }), "https://www.amazon.com/dp/B0FILTER12");
  assert.equal(amazonProductHref({ itemName: "Filter" } as { asin?: string }), null);
});

test("search URL is used when no product is linked", () => {
  const order = amazonOrderHref({ itemName: "HVAC filter 16x25x1", asin: "" });
  assert.equal(order.search, true);
  assert.equal(order.href, amazonSearchUrl("HVAC filter 16x25x1"));
});
