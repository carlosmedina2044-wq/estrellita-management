import assert from "node:assert/strict";
import { test } from "node:test";
import { warrantyBadgeLabel, warrantyNotificationsFor } from "@/lib/warranty";

const today = new Date(2026, 7, 24, 10, 0, 0, 0);

test("warrantyNotificationsFor uses a 30-day window, skips past dates, and keeps stable ids", () => {
  const assets = [
    { id: "asset-ok1", name: "Fridge", warrantyUntil: "2026-10-23" },
    { id: "asset-soon", name: "Washer", warrantyUntil: "2026-09-10" },
    { id: "asset-past", name: "Dryer", warrantyUntil: "2026-07-01" },
    { id: "asset-none", name: "Range" },
  ];
  const notices = warrantyNotificationsFor(assets, today);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]?.id, "warranty-asset-ok1");
  assert.equal(notices[0]?.title, "Warranty ending soon");
  assert.match(notices[0]?.body ?? "", /Fridge warranty ends/);
  assert.equal(notices[0]?.extra.tab, "home");
  assert.equal(notices[0]?.at.getHours(), 9);
  assert.equal(warrantyNotificationsFor([], today).length, 0);
});

test("warranty badge is quiet within 60 days and silent when expired", () => {
  assert.equal(
    warrantyBadgeLabel({ warrantyUntil: "2026-09-12" }, today),
    "Warranty ends Sep 12",
  );
  assert.equal(warrantyBadgeLabel({ warrantyUntil: "2026-07-01" }, today), null);
  assert.equal(warrantyBadgeLabel({ warrantyUntil: "2027-08-24" }, today), null);
  assert.equal(warrantyBadgeLabel({}, today), null);
});
