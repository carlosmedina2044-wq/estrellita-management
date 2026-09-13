import assert from "node:assert/strict";
import { test } from "node:test";
import { generateRawKey, importRawKey, PREVIOUS_VAULT_KEY, VAULT_STORAGE_KEY } from "@/lib/crypto";
import { sealBackup } from "@/lib/backup";
import {
  flushHousehold,
  getHousehold,
  getHouseholdLoad,
  hydrateHousehold,
  importHouseholdBackup,
  installVaultIOForTests,
  QUARANTINED_VAULT_KEY,
  resetVaultForTests,
  updateHousehold,
} from "@/lib/storage/vault";

test("hydrate retries a failed persist instead of dropping in-memory household", async () => {
  resetVaultForTests();
  const key = await importRawKey(generateRawKey());
  const store = new Map<string, string>();
  let failSet = false;
  installVaultIOForTests({
    loadDeviceKey: async () => key,
    createDeviceKey: async () => key,
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

test("S1: vault present and missing key reports key-mismatch without minting a key", async () => {
  resetVaultForTests();
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, JSON.stringify({
    v: 2,
    alg: "A256GCM",
    iv: "AAAAAAAAAAAA",
    ciphertext: "AQID",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })]]);
  let minted = 0;
  installVaultIOForTests({
    loadDeviceKey: async () => null,
    createDeviceKey: async () => {
      minted += 1;
      throw new Error("must not mint");
    },
    loadOrCreateDeviceKey: async () => {
      minted += 1;
      throw new Error("must not mint");
    },
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });
  const result = await hydrateHousehold();
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "key-mismatch");
  assert.equal(minted, 0);
  resetVaultForTests();
});

test("S1: vault present and Keychain throw reports unavailable without minting", async () => {
  resetVaultForTests();
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, JSON.stringify({
    v: 2,
    alg: "A256GCM",
    iv: "AAAAAAAAAAAA",
    ciphertext: "AQID",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })]]);
  let minted = 0;
  installVaultIOForTests({
    loadDeviceKey: async () => {
      throw new Error("User interaction is not allowed");
    },
    createDeviceKey: async () => {
      minted += 1;
      throw new Error("must not mint");
    },
    loadOrCreateDeviceKey: async () => {
      minted += 1;
      throw new Error("must not mint");
    },
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });
  const result = await hydrateHousehold();
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "unavailable");
  assert.equal(minted, 0);
  resetVaultForTests();
});

test("S1: empty first launch does not mint a key until the first write", async () => {
  resetVaultForTests();
  const store = new Map<string, string>();
  const key = await importRawKey(generateRawKey());
  let minted = 0;
  installVaultIOForTests({
    loadDeviceKey: async () => null,
    createDeviceKey: async () => {
      minted += 1;
      return key;
    },
    loadOrCreateDeviceKey: async () => {
      minted += 1;
      return key;
    },
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });
  const first = await hydrateHousehold();
  assert.equal(first.ok, true);
  assert.equal(minted, 0);
  updateHousehold((current) => ({ ...current, householdName: "New", onboarded: true }));
  await flushHousehold();
  assert.equal(minted, 1);
  assert.ok(store.has(VAULT_STORAGE_KEY));
  resetVaultForTests();
});

const UNREADABLE_VAULT = JSON.stringify({
  v: 2,
  alg: "A256GCM",
  iv: "AAAAAAAAAAAA",
  ciphertext: "AQID",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

test("S1b: import after key-mismatch quarantines the old vault, mints a key, and persists", async () => {
  resetVaultForTests();
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, UNREADABLE_VAULT]]);
  const key = await importRawKey(generateRawKey());
  let minted = 0;
  installVaultIOForTests({
    loadDeviceKey: async () => null,
    createDeviceKey: async () => {
      minted += 1;
      return key;
    },
    loadOrCreateDeviceKey: async () => {
      minted += 1;
      return key;
    },
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });
  const load = await hydrateHousehold();
  assert.equal(load.ok, false);
  if (!load.ok) assert.equal(load.reason, "key-mismatch");

  const file = await sealBackup(
    JSON.stringify({
      onboarded: true,
      householdName: "Restored Home",
      mode: "cleaner",
      activeVisitId: "visit-old",
    }),
    "correct horse",
  );
  const result = await importHouseholdBackup(file, "correct horse");
  assert.equal(result.ok, true);
  assert.equal(minted, 1);
  assert.equal(store.get(QUARANTINED_VAULT_KEY), UNREADABLE_VAULT);
  assert.notEqual(store.get(VAULT_STORAGE_KEY), UNREADABLE_VAULT);
  assert.ok(store.has(VAULT_STORAGE_KEY));
  assert.equal(store.has(PREVIOUS_VAULT_KEY), false);
  assert.equal(getHousehold().householdName, "Restored Home");
  assert.equal(getHousehold().mode, "owner");
  assert.equal(getHousehold().activeVisitId, null);
  const after = getHouseholdLoad();
  assert.ok(after?.ok);
  resetVaultForTests();
});

test("S1c: import when persist fails reports ok:false", async () => {
  resetVaultForTests();
  const store = new Map<string, string>([[VAULT_STORAGE_KEY, UNREADABLE_VAULT]]);
  const key = await importRawKey(generateRawKey());
  installVaultIOForTests({
    loadDeviceKey: async () => null,
    createDeviceKey: async () => key,
    loadOrCreateDeviceKey: async () => key,
    deleteDeviceKey: async () => {},
    kvGet: async (name) => store.get(name) ?? null,
    kvSet: async (name, value) => {
      if (name === VAULT_STORAGE_KEY && store.has(QUARANTINED_VAULT_KEY)) {
        throw new Error("disk full");
      }
      store.set(name, value);
    },
    kvRemove: async (name) => {
      store.delete(name);
    },
  });
  const load = await hydrateHousehold();
  assert.equal(load.ok, false);
  if (!load.ok) assert.equal(load.reason, "key-mismatch");

  const file = await sealBackup(JSON.stringify({ householdName: "Unsaved" }), "correct horse");
  const result = await importHouseholdBackup(file, "correct horse");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /couldn’t be saved to this iPhone/i);
  }
  const after = getHouseholdLoad();
  assert.equal(after?.ok, false);
  if (after && !after.ok) assert.equal(after.reason, "key-mismatch");
  resetVaultForTests();
});

test("import resets cleaner visit state", async () => {
  resetVaultForTests();
  const store = new Map<string, string>();
  const key = await importRawKey(generateRawKey());
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
  });
  const first = await hydrateHousehold();
  assert.equal(first.ok, true);
  updateHousehold((current) => ({ ...current, householdName: "Before", onboarded: true }));
  await flushHousehold();

  const file = await sealBackup(
    JSON.stringify({
      onboarded: false,
      householdName: "Cleaner phone",
      mode: "cleaner",
      activeVisitId: "visit-open",
    }),
    "correct horse",
  );
  const result = await importHouseholdBackup(file, "correct horse");
  assert.equal(result.ok, true);
  const household = getHousehold();
  assert.equal(household.mode, "owner");
  assert.equal(household.activeVisitId, null);
  assert.equal(household.onboarded, true);
  assert.equal(household.householdName, "Cleaner phone");
  resetVaultForTests();
});
