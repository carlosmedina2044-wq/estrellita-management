import { verifyAppleIdentityToken } from "@/lib/auth/apple";
import { hashToken, newOpaqueToken } from "@/lib/auth/session";
import { findUserByApple, saveRefresh, upsertUser } from "@/lib/auth/store";
import { json, readJsonLimited } from "@/lib/http";
import { logEvent } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readJsonLimited(request);
  } catch {
    return json({ error: "Payload too large" }, 413);
  }
  if (!body || typeof body !== "object" || !("identityToken" in body) || typeof body.identityToken !== "string") {
    return json({ error: "identityToken required" }, 400);
  }
  try {
    const identity = await verifyAppleIdentityToken(body.identityToken);
    const existing = await findUserByApple(identity.appleUserId);
    const user = await upsertUser({
      id: existing?.id ?? crypto.randomUUID(),
      appleUserId: identity.appleUserId,
      email: identity.email ?? existing?.email,
      emailHidden: identity.emailHidden,
      methods: Array.from(new Set([...(existing?.methods ?? []), "apple" as const])),
      vaultId: existing?.vaultId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    const refreshToken = newOpaqueToken();
    await saveRefresh({ userId: user.id, tokenHash: hashToken(refreshToken), createdAt: new Date().toISOString() });
    logEvent("auth.apple", { userId: user.id });
    return json({
      user: {
        id: user.id,
        appleUserId: user.appleUserId,
        email: user.email,
        emailHidden: user.emailHidden,
        methods: user.methods,
      },
      refreshToken,
    });
  } catch (error) {
    logEvent("auth.apple.fail", { message: error instanceof Error ? error.message : "verify-failed" });
    return json({ error: "Apple token could not be verified" }, 401);
  }
}
