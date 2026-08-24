import { createHash, timingSafeEqual } from "node:crypto";
import { json, readJsonLimited } from "@/lib/http";
import { parseClientEnvelope, isValidVaultParam, type VaultRecord } from "@/lib/vault-record";
import { readVaultRecord, vaultStoreConfigured, writeVaultRecord } from "@/lib/vault-store";

export const runtime = "nodejs";

function authHashFromHeader(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token.length > 200) return null;
  return createHash("sha256").update(token).digest("hex");
}

function hashesMatch(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  if (a.length !== 32 || b.length !== 32) return false;
  return timingSafeEqual(a, b);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ vaultId: string }> },
) {
  const { vaultId } = await context.params;
  if (!isValidVaultParam(vaultId)) return json({ error: "Not found" }, 404);
  if (!vaultStoreConfigured()) return json({ error: "Vault store unavailable" }, 503);
  try {
    const record = await readVaultRecord(vaultId);
    if (!record) return json({ error: "Not found" }, 404);
    return json({ envelope: record.envelope });
  } catch (error) {
    console.error("vault GET failed", vaultId);
    console.error(error);
    return json({ error: "Vault read failed" }, 500);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ vaultId: string }> },
) {
  const { vaultId } = await context.params;
  if (!isValidVaultParam(vaultId)) return json({ error: "Not found" }, 404);
  if (!vaultStoreConfigured()) return json({ error: "Vault store unavailable" }, 503);

  const hash = authHashFromHeader(request);
  if (!hash) return json({ error: "Unauthorized" }, 401);

  let body: unknown;
  try {
    body = await readJsonLimited(request);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const envelope = parseClientEnvelope(body);
  if (!envelope || envelope.vaultId !== vaultId) {
    return json({ error: "Invalid envelope" }, 400);
  }

  try {
    const existing = await readVaultRecord(vaultId);
    if (existing && !hashesMatch(existing.authHash, hash)) {
      return json({ error: "Unauthorized" }, 401);
    }
    const record: VaultRecord = { envelope, authHash: existing?.authHash ?? hash };
    await writeVaultRecord(vaultId, record);
    return json({ ok: true, updatedAt: envelope.updatedAt });
  } catch (error) {
    console.error("vault PUT failed", vaultId);
    console.error(error);
    return json({ error: "Vault write failed" }, 500);
  }
}
