import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type AuthMethod = "apple" | "passkey" | "magic-link";

export type AuthUser = {
  id: string;
  appleUserId?: string;
  email?: string;
  emailHidden?: boolean;
  methods: AuthMethod[];
  vaultId?: string;
  createdAt: string;
};

export type RefreshRecord = {
  userId: string;
  tokenHash: string;
  createdAt: string;
  reused?: boolean;
};

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokensMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export function minSupportedAppVersion(): string {
  return process.env.MIN_SUPPORTED_APP_VERSION || "1.0.0";
}

export function clientNeedsUpgrade(version: string | null): boolean {
  if (!version) return false;
  return compareSemver(version, minSupportedAppVersion()) < 0;
}

function compareSemver(a: string, b: string): number {
  const left = a.split(".").map((part) => Number(part) || 0);
  const right = b.split(".").map((part) => Number(part) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((left[i] ?? 0) !== (right[i] ?? 0)) return (left[i] ?? 0) - (right[i] ?? 0);
  }
  return 0;
}
