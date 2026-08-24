import { get, put } from "@vercel/blob";
import type { VaultRecord } from "@/lib/vault-record";
import { parseVaultRecord } from "@/lib/vault-record";

function pathnameFor(vaultId: string) {
  return `vaults/${vaultId}.json`;
}

function token() {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

export function vaultStoreConfigured() {
  return Boolean(token());
}

export async function readVaultRecord(vaultId: string): Promise<VaultRecord | null> {
  const storeToken = token();
  if (!storeToken) return null;
  const result = await get(pathnameFor(vaultId), {
    access: "private",
    useCache: false,
    token: storeToken,
  });
  if (!result?.stream) return null;
  const text = await new Response(result.stream).text();
  try {
    return parseVaultRecord(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export async function writeVaultRecord(vaultId: string, record: VaultRecord) {
  const storeToken = token();
  if (!storeToken) {
    throw new Error("Vault store is not configured");
  }
  await put(pathnameFor(vaultId), JSON.stringify(record), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: storeToken,
  });
}
