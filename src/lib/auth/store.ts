import { get, put } from "@vercel/blob";
import type { AuthUser, RefreshRecord } from "@/lib/auth/session";

type AuthStore = {
  users: AuthUser[];
  refresh: RefreshRecord[];
  magicLinks: { email: string; tokenHash: string; expiresAt: string; used?: boolean }[];
  passkeys: { userId: string; credentialId: string; publicKey: string; counter: number }[];
};

const PATH = "auth/store-v1.json";

function token() {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

export function authStoreConfigured() {
  return Boolean(token());
}

const memory: AuthStore = { users: [], refresh: [], magicLinks: [], passkeys: [] };

async function readStore(): Promise<AuthStore> {
  const storeToken = token();
  if (!storeToken) return memory;
  try {
    const result = await get(PATH, { access: "private", useCache: false, token: storeToken });
    if (!result?.stream) return { users: [], refresh: [], magicLinks: [], passkeys: [] };
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as AuthStore;
    return {
      users: parsed.users ?? [],
      refresh: parsed.refresh ?? [],
      magicLinks: parsed.magicLinks ?? [],
      passkeys: parsed.passkeys ?? [],
    };
  } catch {
    return { users: [], refresh: [], magicLinks: [], passkeys: [] };
  }
}

async function writeStore(store: AuthStore) {
  const storeToken = token();
  if (!storeToken) {
    memory.users = store.users;
    memory.refresh = store.refresh;
    memory.magicLinks = store.magicLinks;
    memory.passkeys = store.passkeys;
    return;
  }
  await put(PATH, JSON.stringify(store), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: storeToken,
  });
}

export async function upsertUser(user: AuthUser): Promise<AuthUser> {
  const store = await readStore();
  const index = store.users.findIndex((item) => item.id === user.id || (user.appleUserId && item.appleUserId === user.appleUserId) || (user.email && item.email === user.email));
  if (index >= 0) {
    store.users[index] = { ...store.users[index], ...user, id: store.users[index].id };
    await writeStore(store);
    return store.users[index];
  }
  store.users.push(user);
  await writeStore(store);
  return user;
}

export async function findUserByApple(appleUserId: string): Promise<AuthUser | null> {
  const store = await readStore();
  return store.users.find((user) => user.appleUserId === appleUserId) ?? null;
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const store = await readStore();
  return store.users.find((user) => user.email === email) ?? null;
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  const store = await readStore();
  return store.users.find((user) => user.id === id) ?? null;
}

export async function deleteUser(id: string): Promise<void> {
  const store = await readStore();
  store.users = store.users.filter((user) => user.id !== id);
  store.refresh = store.refresh.filter((item) => item.userId !== id);
  store.passkeys = store.passkeys.filter((item) => item.userId !== id);
  await writeStore(store);
}

export async function saveRefresh(record: RefreshRecord) {
  const store = await readStore();
  store.refresh.push(record);
  await writeStore(store);
}

export async function consumeRefresh(tokenHash: string): Promise<RefreshRecord | null> {
  const store = await readStore();
  const record = store.refresh.find((item) => item.tokenHash === tokenHash);
  if (!record) return null;
  if (record.reused) return record;
  record.reused = true;
  await writeStore(store);
  return { ...record, reused: false };
}

export async function saveMagicLink(email: string, tokenHash: string, expiresAt: string) {
  const store = await readStore();
  store.magicLinks = store.magicLinks.filter((item) => item.email !== email);
  store.magicLinks.push({ email, tokenHash, expiresAt });
  await writeStore(store);
}

export async function consumeMagicLink(tokenHash: string): Promise<string | null> {
  const store = await readStore();
  const record = store.magicLinks.find((item) => item.tokenHash === tokenHash && !item.used);
  if (!record) return null;
  if (Date.parse(record.expiresAt) < Date.now()) return null;
  record.used = true;
  await writeStore(store);
  return record.email;
}

export async function savePasskey(record: AuthStore["passkeys"][number]) {
  const store = await readStore();
  store.passkeys = store.passkeys.filter((item) => item.credentialId !== record.credentialId);
  store.passkeys.push(record);
  await writeStore(store);
}

export async function findPasskey(credentialId: string) {
  const store = await readStore();
  return store.passkeys.find((item) => item.credentialId === credentialId) ?? null;
}
