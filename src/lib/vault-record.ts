import { isVaultEnvelope, isVaultId, type VaultEnvelope } from "@/lib/crypto";
import { isPlainObject } from "@/lib/sanitize";

export type VaultRecord = {
  envelope: VaultEnvelope;
  authHash: string;
};

export function publicEnvelope(record: VaultRecord): VaultEnvelope {
  return record.envelope;
}

export function parseVaultRecord(value: unknown): VaultRecord | null {
  if (!isPlainObject(value)) return null;
  if (!isVaultEnvelope(value.envelope)) return null;
  if (typeof value.authHash !== "string" || !/^[a-f0-9]{64}$/.test(value.authHash)) return null;
  return { envelope: value.envelope, authHash: value.authHash };
}

export function parseClientEnvelope(value: unknown): VaultEnvelope | null {
  if (!isVaultEnvelope(value)) return null;
  return value;
}

export function isValidVaultParam(vaultId: string): boolean {
  return isVaultId(vaultId);
}
