import { sha256Hex } from "@/lib/crypto";

export type AuditEvent =
  | "login"
  | "passkey_add"
  | "passkey_remove"
  | "address_change"
  | "payment_change"
  | "order_placed"
  | "order_cancelled"
  | "consent_given"
  | "account_deleted"
  | "admin_action"
  | "onboarding_complete";

export type AuditEntry = {
  id: string;
  at: string;
  event: AuditEvent;
  prevHash: string;
  hash: string;
};

const KEY = "estrellita-audit-v1";

export async function appendAudit(event: AuditEvent): Promise<void> {
  if (typeof window === "undefined") return;
  const existing = readAudit();
  const prevHash = existing[existing.length - 1]?.hash ?? "genesis";
  const id = crypto.randomUUID();
  const at = new Date().toISOString();
  const hash = await sha256Hex(`${prevHash}:${id}:${at}:${event}`);
  const next = [...existing, { id, at, event, prevHash, hash }].slice(-400);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function readAudit(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as AuditEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
