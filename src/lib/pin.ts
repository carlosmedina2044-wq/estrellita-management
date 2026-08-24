import { sanitizePinInput } from "@/lib/sanitize";

const PIN_PREFIX = "sha256:";
const PIN_SALT = "estrellita-pin-v1";

export function isPinHash(value: string): boolean {
  return value.startsWith(PIN_PREFIX) && /^[a-f0-9]{64}$/.test(value.slice(PIN_PREFIX.length));
}

/** Truncated leftover from slicing a hash with the PIN input limiter. */
export function isBrokenPinHash(value: string): boolean {
  return value.startsWith(PIN_PREFIX) && !isPinHash(value);
}

export function pinIsSet(stored: string): boolean {
  return stored.trim().length > 0;
}

/** Persist/load hashes intact — `sanitizePinInput` caps at 32 chars and would break them. */
export function sanitizeStoredPin(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (isPinHash(trimmed) || trimmed.startsWith(PIN_PREFIX)) return trimmed;
  return sanitizePinInput(value);
}

export async function hashPin(pin: string): Promise<string> {
  const trimmed = pin.trim();
  if (!trimmed) return "";
  if (isPinHash(trimmed)) return trimmed;
  if (!globalThis.crypto?.subtle) return trimmed;
  const data = new TextEncoder().encode(`${PIN_SALT}:${trimmed}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${PIN_PREFIX}${hex}`;
}

export async function pinsMatch(entered: string, stored: string): Promise<boolean> {
  const expected = stored.trim();
  if (!expected) return true;
  const input = entered.trim();
  if (isPinHash(expected)) {
    if (!globalThis.crypto?.subtle) return false;
    return (await hashPin(input)) === expected;
  }
  return input === expected;
}

export async function ensureHashedPin(stored: string): Promise<string> {
  const trimmed = stored.trim();
  if (!trimmed || isPinHash(trimmed)) return trimmed;
  return hashPin(trimmed);
}
