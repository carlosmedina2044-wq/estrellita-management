import type { VaultEnvelope } from "@/lib/crypto";
import { isVaultEnvelope } from "@/lib/crypto";

export async function pullVaultEnvelope(vaultId: string): Promise<VaultEnvelope | null> {
  const response = await fetch(`/api/vault/${vaultId}`, { method: "GET", cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) return null;
  const body: unknown = await response.json();
  if (!isPlainEnvelopeBody(body)) return null;
  return body.envelope;
}

export async function pushVaultEnvelope(authToken: string, envelope: VaultEnvelope): Promise<boolean> {
  const response = await fetch(`/api/vault/${envelope.vaultId}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(envelope),
  });
  return response.ok;
}

function isPlainEnvelopeBody(value: unknown): value is { envelope: VaultEnvelope } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "envelope" in value &&
      isVaultEnvelope((value as { envelope: unknown }).envelope),
  );
}
