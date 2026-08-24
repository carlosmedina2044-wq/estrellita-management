import assert from "node:assert/strict";
import { test } from "node:test";
import { BACKUP_ITERATIONS, isBackupEnvelope, openBackup, sealBackup } from "@/lib/backup";
import { isLegacyPinEnvelope } from "@/lib/crypto";
import { parseStored } from "@/lib/storage";

test("backup round-trip restores the household JSON", async () => {
  const payload = JSON.stringify({ householdName: "Home", version: 7 });
  const file = await sealBackup(payload, "correct horse");
  const parsed: unknown = JSON.parse(file);
  assert.equal(isBackupEnvelope(parsed), true);
  assert.equal(isLegacyPinEnvelope(parsed), false);
  assert.equal((parsed as { iterations: number }).iterations, BACKUP_ITERATIONS);
  assert.equal(BACKUP_ITERATIONS, 600_000);
  assert.equal(await openBackup(file, "correct horse"), payload);
});

test("wrong passphrase cannot open a backup", async () => {
  const file = await sealBackup("secret household", "correct horse");
  await assert.rejects(() => openBackup(file, "wrong horse"), /Wrong passphrase/);
});

test("rejects a short passphrase", async () => {
  await assert.rejects(() => sealBackup("{}", "short"), /at least 8/);
  await assert.rejects(() => openBackup("{}", "short"), /at least 8/);
});

test("NFC-normalized passphrases round-trip across keyboard layouts", async () => {
  const payload = JSON.stringify({ householdName: "Home" });
  const composed = "caf\u00e9-home";
  const decomposed = "cafe\u0301-home";
  const file = await sealBackup(payload, composed);
  assert.equal(await openBackup(file, decomposed), payload);
});

test("opens a backup sealed at the previous 210k iteration count", async () => {
  const payload = JSON.stringify({ householdName: "Home", version: 7 });
  const file = await sealBackup(payload, "correct horse", 210_000);
  assert.equal(JSON.parse(file).iterations, 210_000);
  assert.equal(await openBackup(file, "correct horse"), payload);
});

test("restoring a v7 backup migrates to v8 with empty preferredRetailers", async () => {
  const payload = JSON.stringify({
    householdName: "Home",
    version: 7,
    onboarded: true,
    duties: [
      {
        id: "duty-0007",
        title: "Replace filter",
        room: "kitchen",
        kind: "replacement",
        createdAt: "2026-08-23T12:00:00.000Z",
      },
    ],
    supplyAutomations: [
      {
        id: "sup-00007",
        dutyId: "duty-0007",
        itemName: "Filter",
        leadTimeDays: 14,
        lastPaidPrice: 18.5,
      },
    ],
    completions: [
      {
        id: "cmp-00007",
        dutyId: "duty-0007",
        actor: "me",
        visitId: null,
        completedAt: "2026-08-20T12:00:00.000Z",
        actualCost: 18.5,
      },
    ],
  });
  const file = await sealBackup(payload, "correct horse");
  const opened = await openBackup(file, "correct horse");
  const household = parseStored(opened);
  assert.equal(household.version, 8);
  assert.deepEqual(household.preferredRetailers, []);
  assert.equal(household.supplyAutomations[0]?.preferredRetailer, undefined);
  assert.equal(household.supplyAutomations[0]?.orderedAt, undefined);
  assert.equal(household.supplyAutomations[0]?.orderedQty, undefined);
  assert.equal(household.supplyAutomations[0]?.observedLeadTimeDays, undefined);
  assert.equal(household.supplyAutomations[0]?.lastPaidPrice, 18.5);
  assert.equal(household.completions[0]?.actualCost, 18.5);
  assert.equal("arrivalNudgedOn" in (household.supplyAutomations[0] ?? {}), false);
});
