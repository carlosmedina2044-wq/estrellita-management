import assert from "node:assert/strict";
import { test } from "node:test";
import { BACKUP_ITERATIONS, isBackupEnvelope, openBackup, sealBackup } from "@/lib/backup";
import { isLegacyPinEnvelope } from "@/lib/crypto";

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
