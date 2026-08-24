import assert from "node:assert/strict";
import { test } from "node:test";
import { isBackupEnvelope, openBackup, sealBackup } from "@/lib/backup";
import { isLegacyPinEnvelope } from "@/lib/crypto";

test("backup round-trip restores the household JSON", async () => {
  const payload = JSON.stringify({ householdName: "Home", version: 7 });
  const file = await sealBackup(payload, "correct horse");
  const parsed: unknown = JSON.parse(file);
  assert.equal(isBackupEnvelope(parsed), true);
  assert.equal(isLegacyPinEnvelope(parsed), false);
  assert.equal(await openBackup(file, "correct horse"), payload);
});

test("wrong passphrase cannot open a backup", async () => {
  const file = await sealBackup("secret household", "correct horse");
  await assert.rejects(() => openBackup(file, "wrong horse"), /Wrong passphrase/);
});

test("rejects a short passphrase", async () => {
  await assert.rejects(() => sealBackup("{}", "short"), /at least 8/);
});
