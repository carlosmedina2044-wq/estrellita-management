import {
  decryptJson,
  encryptJson,
  isLegacyPinEnvelope,
  LEGACY_PLAINTEXT_KEY,
  LEGACY_VAULT_KEY,
  parseEnvelopeJson,
  PREVIOUS_VAULT_KEY,
  VAULT_STORAGE_KEY,
} from "@/lib/crypto";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { emptyHomeTree } from "@/lib/home-model";
import {
  createDeviceKey,
  deleteDeviceKey,
  DeviceKeyError,
  loadDeviceKey,
  loadOrCreateDeviceKey,
} from "@/lib/native/device-key";
import { kvGet, kvRemove, kvSet } from "@/lib/native/kv";
import { syncScheduledNotifications } from "@/lib/notifications";
import { isPlainObject } from "@/lib/sanitize";
import { EMPTY_HOUSEHOLD, migrateHousehold, parseStored } from "@/lib/storage/migrate";
import type { Household } from "@/lib/types";

export type HouseholdLoad =
  | { ok: true; legacyLockedVault: boolean }
  | { ok: false; reason: "corrupt" | "unavailable" | "key-mismatch" };

export const PERSIST_FAILED_EVENT = "cuidala-persist-failed";

type VaultIO = {
  kvGet: typeof kvGet;
  kvSet: typeof kvSet;
  kvRemove: typeof kvRemove;
  loadDeviceKey: typeof loadDeviceKey;
  createDeviceKey: typeof createDeviceKey;
  loadOrCreateDeviceKey: typeof loadOrCreateDeviceKey;
  deleteDeviceKey: typeof deleteDeviceKey;
};

const defaultIO = (): VaultIO => ({
  kvGet,
  kvSet,
  kvRemove,
  loadDeviceKey,
  createDeviceKey,
  loadOrCreateDeviceKey,
  deleteDeviceKey,
});

let io: VaultIO = defaultIO();

/** Test-only: swap persistence adapters. Pass null to restore production IO. */
export function installVaultIOForTests(next: Partial<VaultIO> | null) {
  io = next ? { ...defaultIO(), ...next } : defaultIO();
}

/** Test-only: reset module-level vault state. */
export function resetVaultForTests() {
  memory = null;
  didHydrate = false;
  lastLoad = null;
  key = null;
  persistChain = Promise.resolve();
  persistOk = true;
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = null;
  io = defaultIO();
}

let memory: Household | null = null;
let didHydrate = false;
let lastLoad: HouseholdLoad | null = null;
let key: CryptoKey | null = null;
let persistChain: Promise<void> = Promise.resolve();
let persistOk = true;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

function cloneEmpty(): Household {
  return withHouseholdDefaults({
    ...EMPTY_HOUSEHOLD,
    ...emptyHomeTree(),
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    assets: [],
    consumables: [],
    playbookDecisions: [],
    weatherFires: [],
  });
}

const CHANGE_EVENT = "cuidala-change";

function notifyChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

async function persist(next: Household) {
  if (!key) {
    const existingVault = (await io.kvGet(VAULT_STORAGE_KEY)) ?? (await io.kvGet(PREVIOUS_VAULT_KEY));
    if (existingVault) {
      throw new DeviceKeyError("Refusing to mint a new key while a vault exists");
    }
    key = await io.createDeviceKey();
  }
  const envelope = await encryptJson(key, JSON.stringify(next));
  await io.kvSet(VAULT_STORAGE_KEY, JSON.stringify(envelope));
  scheduleNotificationSync(next);
}

function scheduleNotificationSync(next: Household) {
  if (notifyTimer) clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    void syncScheduledNotifications(next).catch(() => {});
  }, 1500);
}

function write(next: Household) {
  memory = next;
  notifyChange();
  persistChain = persistChain
    .then(() => persist(next))
    .then(() => {
      persistOk = true;
    })
    .catch(() => {
      const firstFailure = persistOk;
      persistOk = false;
      if (firstFailure && typeof window !== "undefined") {
        window.dispatchEvent(new Event(PERSIST_FAILED_EVENT));
      }
    });
}

export function getHousehold(): Household {
  if (!didHydrate) return EMPTY_HOUSEHOLD;
  return memory ?? EMPTY_HOUSEHOLD;
}

export function getHouseholdLoad(): HouseholdLoad | null {
  return lastLoad;
}

/** Resolves once every queued write has reached storage. */
export function flushHousehold(): Promise<void> {
  return persistChain;
}

async function readLegacyPlaintext(): Promise<Household | null> {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LEGACY_PLAINTEXT_KEY);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!isPlainObject(parsed) || isLegacyPinEnvelope(parsed)) return null;
  return migrateHousehold(parsed);
}

function legacyLockedVaultPresent(): boolean {
  if (typeof window === "undefined") return false;
  for (const storageKey of [LEGACY_VAULT_KEY, LEGACY_PLAINTEXT_KEY]) {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) continue;
    try {
      if (isLegacyPinEnvelope(JSON.parse(raw))) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Loads the household from encrypted storage. Never deletes anything it cannot
 * read: unreadable data is reported as `corrupt` and left in place.
 */
export async function hydrateHousehold(): Promise<HouseholdLoad> {
  didHydrate = true;
  await persistChain.catch(() => {});
  if (!persistOk && memory) {
    persistChain = persist(memory)
      .then(() => {
        persistOk = true;
      })
      .catch(() => {
        persistOk = false;
      });
    lastLoad = { ok: true, legacyLockedVault: false };
    return lastLoad;
  }
  try {
    let raw = await io.kvGet(VAULT_STORAGE_KEY);
    let fromPreviousKey = false;
    if (!raw) {
      raw = await io.kvGet(PREVIOUS_VAULT_KEY);
      fromPreviousKey = Boolean(raw);
    }
    if (raw) {
      // Vault exists: never mint a new key. Missing key → key-mismatch.
      // Unexpected Keychain errors fail closed as unavailable.
      try {
        key = await io.loadDeviceKey();
      } catch {
        lastLoad = { ok: false, reason: "unavailable" };
        return lastLoad;
      }
      if (!key) {
        lastLoad = { ok: false, reason: "key-mismatch" };
        return lastLoad;
      }
      const envelope = parseEnvelopeJson(raw);
      if (!envelope) {
        lastLoad = { ok: false, reason: "corrupt" };
        return lastLoad;
      }
      try {
        memory = parseStored(await decryptJson(key, envelope));
      } catch {
        lastLoad = { ok: false, reason: "key-mismatch" };
        return lastLoad;
      }
      if (fromPreviousKey) {
        await persist(memory);
        await io.kvRemove(PREVIOUS_VAULT_KEY);
      }
      if (typeof window !== "undefined") window.localStorage.removeItem("estrellita-audit-v1");
      lastLoad = { ok: true, legacyLockedVault: false };
      return lastLoad;
    }

    // First launch on this build: pick up a plaintext household from the
    // pre-release web build, encrypt it, and remove the plaintext copy.
    const legacy = await readLegacyPlaintext();
    if (legacy) {
      memory = legacy;
      await persist(legacy);
      window.localStorage.removeItem(LEGACY_PLAINTEXT_KEY);
      lastLoad = { ok: true, legacyLockedVault: false };
      return lastLoad;
    }

    memory = cloneEmpty();
    lastLoad = { ok: true, legacyLockedVault: legacyLockedVaultPresent() };
    return lastLoad;
  } catch (error) {
    lastLoad = { ok: false, reason: error instanceof DOMException || error instanceof DeviceKeyError ? "unavailable" : "corrupt" };
    return lastLoad;
  }
}

export function updateHousehold(updater: (current: Household) => Household) {
  didHydrate = true;
  write(updater(memory ?? cloneEmpty()));
}

/** Erases the household, its encryption key, and pending notifications on this device. */
export async function eraseHousehold(): Promise<void> {
  didHydrate = true;
  await persistChain.catch(() => {});
  try {
    await io.kvRemove(VAULT_STORAGE_KEY);
    await io.kvRemove(PREVIOUS_VAULT_KEY);
    await io.deleteDeviceKey();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LEGACY_PLAINTEXT_KEY);
      window.localStorage.removeItem(LEGACY_VAULT_KEY);
      window.localStorage.removeItem("estrellita-audit-v1");
    }
  } catch {
    // Storage may be unavailable; in-memory state still resets below.
  }
  key = null;
  memory = cloneEmpty();
  persistOk = true;
  lastLoad = { ok: true, legacyLockedVault: false };
  notifyChange();
  void syncScheduledNotifications(memory).catch(() => {});
}

export function forCleanerSession(household: Household): Household {
  return {
    ...household,
    supplyAutomations: [],
    duties: household.duties.filter((duty) => duty.audience === "cleaner" || duty.audience === "anyone"),
  };
}

export function subscribeHousehold(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(CHANGE_EVENT, onStoreChange);
}

export async function exportHouseholdBackup(passphrase: string): Promise<string> {
  const { sealBackup } = await import("@/lib/backup");
  return sealBackup(JSON.stringify(memory ?? cloneEmpty()), passphrase);
}

export async function importHouseholdBackup(
  raw: string,
  passphrase: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { openBackup } = await import("@/lib/backup");
    const plaintext = await openBackup(raw, passphrase);
    const household = parseStored(plaintext);
    write({ ...household, onboarded: true });
    lastLoad = { ok: true, legacyLockedVault: false };
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t open that backup.";
    return { ok: false, error: message };
  }
}
