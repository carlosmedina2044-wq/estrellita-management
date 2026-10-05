import assert from "node:assert/strict";
import { test } from "node:test";
import { generateRawKey, importRawKey, VAULT_STORAGE_KEY } from "@/lib/crypto";
import { sealBackup } from "@/lib/backup";
import {
  flushHousehold,
  getHousehold,
  hydrateHousehold,
  importHouseholdBackup,
  installVaultIOForTests,
  resetVaultForTests,
  updateHousehold,
} from "@/lib/storage/vault";
import { makeDuty } from "@/lib/sync/test-helpers";

async function freshVault() {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  const store = new Map<string, string>();
  installVaultIOForTests({
    loadDeviceKey: async () => key,
    createDeviceKey: async () => key,
    loadOrCreateDeviceKey: async () => key,
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
    kvKeys: async () => [...store.keys()],
  });
  await hydrateHousehold();
  return store;
}

test("vault: with sync off (the default) an edit writes exactly what the updater returned", async () => {
  await freshVault();
  const duty = makeDuty("duty-0001");
  let produced: unknown;
  updateHousehold((current) => {
    const next = { ...current, onboarded: true, duties: [duty] };
    produced = next;
    return next;
  });
  await flushHousehold();
  assert.equal(getHousehold(), produced, "same object: nothing was stamped");
  assert.equal(getHousehold().duties[0]!.updatedAt, undefined);
  updateHousehold((current) => ({ ...current, duties: [] }));
  assert.equal(getHousehold().tombstones, undefined, "no deleted-id trail while sync is off");
  resetVaultForTests();
});

test("vault: with sync on, local edits are stamped and deletes leave tombstones", async () => {
  await freshVault();
  updateHousehold((current) => ({
    ...current,
    onboarded: true,
    sync: { enabled: true, deviceId: "device-aaaa" },
  }));
  updateHousehold((current) => ({ ...current, duties: [makeDuty("duty-0001")] }));
  const stamped = getHousehold().duties[0]!;
  assert.ok(stamped.updatedAt && Date.parse(stamped.updatedAt) > Date.now() - 60_000);
  updateHousehold((current) => ({ ...current, mode: "owner" }));
  assert.equal(getHousehold().duties[0], stamped, "an unrelated edit leaves it byte-identical");
  updateHousehold((current) => ({ ...current, duties: [] }));
  assert.equal(getHousehold().tombstones?.[0]?.id, "duty-0001");
  resetVaultForTests();
});

test("vault: a merged change applied with fromSync is not re-stamped", async () => {
  await freshVault();
  updateHousehold((current) => ({ ...current, onboarded: true, sync: { enabled: true, deviceId: "device-aaaa" } }));
  const remote = makeDuty("duty-remote1", { updatedAt: "2026-09-01T08:00:00.000Z" });
  updateHousehold((current) => ({ ...current, duties: [remote] }), { fromSync: true });
  assert.equal(getHousehold().duties[0]!.updatedAt, "2026-09-01T08:00:00.000Z");
  resetVaultForTests();
});

test("vault: a restored backup never carries sync state, tombstones or stamps survive", async () => {
  const store = await freshVault();
  void store;
  const backup = await sealBackup(
    JSON.stringify({
      version: 9,
      onboarded: true,
      householdName: "Backup",
      sync: { enabled: true, deviceId: "other-phone" },
      tombstones: [{ type: "duty", id: "duty-gone-1", deletedAt: "2026-09-01T00:00:00.000Z" }],
      duties: [{ id: "duty-0001", title: "Wipe", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-02T00:00:00.000Z" }],
    }),
    "correct horse battery",
  );
  const result = await importHouseholdBackup(backup, "correct horse battery");
  assert.equal(result.ok, true);
  assert.equal(getHousehold().sync, undefined);
  assert.equal(getHousehold().tombstones?.length, 1);
  assert.equal(getHousehold().duties[0]!.updatedAt, "2026-08-02T00:00:00.000Z");
  resetVaultForTests();
  void VAULT_STORAGE_KEY;
});

test("vault: cost of the sync-off check is a single property read", async () => {
  await freshVault();
  updateHousehold((current) => ({ ...current, onboarded: true }));
  const runs = 2000;
  const start = performance.now();
  for (let i = 0; i < runs; i += 1) updateHousehold((current) => ({ ...current, mode: i % 2 ? "owner" : "cleaner" }));
  const perCall = (performance.now() - start) / runs;
  console.log(`# updateHousehold (sync off, incl. in-memory write): ${(perCall * 1000).toFixed(1)} us per call`);
  await flushHousehold();
  resetVaultForTests();
});
