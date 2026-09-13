import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BACKUP_ITERATIONS,
  BACKUP_MAX_ITERATIONS,
  BACKUP_MIN_PASSPHRASE,
  BACKUP_OPEN_MIN_PASSPHRASE,
  isBackupEnvelope,
  openBackup,
  passphraseHint,
  sealBackup,
} from "@/lib/backup";
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
  await assert.rejects(() => sealBackup("{}", "short"), /at least 12/);
  await assert.rejects(() => openBackup("{}", "short"), /at least 8/);
});

test("8-char seal fails; 8-char open of a legacy envelope still passes", async () => {
  assert.equal(BACKUP_MIN_PASSPHRASE, 12);
  assert.equal(BACKUP_OPEN_MIN_PASSPHRASE, 8);
  await assert.rejects(() => sealBackup("{}", "12345678"), /at least 12/);
  const file = await sealBackup("legacy household", "12345678", BACKUP_ITERATIONS, BACKUP_OPEN_MIN_PASSPHRASE);
  assert.equal(await openBackup(file, "12345678"), "legacy household");
  assert.equal(passphraseHint("correcthorse"), "A few unrelated words are stronger than one word.");
  assert.equal(passphraseHint("correct horse"), null);
});

test("NFC-normalized passphrases round-trip across keyboard layouts", async () => {
  const payload = JSON.stringify({ householdName: "Home" });
  const composed = "caf\u00e9-home-key";
  const decomposed = "cafe\u0301-home-key";
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

test("iterations: 2_000_000_000 rejected as isn’t a Cuidala backup", async () => {
  const huge = {
    v: 1,
    kind: "cuidala-backup",
    alg: "A256GCM",
    kdf: "PBKDF2-SHA256",
    iterations: 2_000_000_000,
    salt: "AAAAAAAAAAAAAAAA",
    iv: "AAAAAAAAAAAAAAAA",
    ciphertext: "AQID",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  assert.equal(isBackupEnvelope(huge), false);
  assert.ok(2_000_000_000 > BACKUP_MAX_ITERATIONS);
  await assert.rejects(() => openBackup(JSON.stringify(huge), "correct horse"), /isn’t a Cuidala backup/);
});

test("13 MB spaces throw quickly before parse", async () => {
  const started = Date.now();
  await assert.rejects(() => openBackup(" ".repeat(13_000_000), "correct horse"), /too large to be a Cuidala backup/);
  assert.ok(Date.now() - started < 500);
});
