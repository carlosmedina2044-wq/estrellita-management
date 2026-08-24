import assert from "node:assert/strict";
import { test } from "node:test";
import { generateRawKey, importRawKey, VAULT_STORAGE_KEY } from "@/lib/crypto";
import {
  flushHousehold,
  getHousehold,
  hydrateHousehold,
  installVaultIOForTests,
  resetVaultForTests,
  updateHousehold,
} from "@/lib/storage/vault";

test("hydrate retries a failed persist instead of dropping in-memory household", async () => {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  const store = new Map<string, string>();
  let failSet = false;
  installVaultIOForTests({
    loadOrCreateDeviceKey: async () => key,
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      if (failSet) throw new Error("disk full");
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });

  const first = await hydrateHousehold();
  assert.equal(first.ok, true);
  updateHousehold((current) => ({ ...current, householdName: "Kept", onboarded: true }));
  await flushHousehold();
  assert.ok(store.has(VAULT_STORAGE_KEY));

  failSet = true;
  updateHousehold((current) => ({ ...current, householdName: "Unsaved" }));
  await flushHousehold();
  assert.equal(getHousehold().householdName, "Unsaved");

  failSet = false;
  const retried = await hydrateHousehold();
  assert.equal(retried.ok, true);
  assert.equal(getHousehold().householdName, "Unsaved");
  await flushHousehold();
  assert.ok(store.has(VAULT_STORAGE_KEY));
  resetVaultForTests();
});
