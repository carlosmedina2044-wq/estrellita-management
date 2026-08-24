import { consumeMagicLink, findUserByEmail, saveRefresh, upsertUser } from "@/lib/auth/store";
import { hashToken, newOpaqueToken } from "@/lib/auth/session";
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
  if (!body || typeof body !== "object" || !("token" in body) || typeof body.token !== "string") {
    return json({ error: "token required" }, 400);
  }
  const email = await consumeMagicLink(hashToken(body.token));
  if (!email) return json({ error: "Link expired or already used" }, 401);
  const existing = await findUserByEmail(email);
  const user = await upsertUser({
    id: existing?.id ?? crypto.randomUUID(),
    email,
    methods: Array.from(new Set([...(existing?.methods ?? []), "magic-link" as const])),
    vaultId: existing?.vaultId,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });
  const refreshToken = newOpaqueToken();
  await saveRefresh({ userId: user.id, tokenHash: hashToken(refreshToken), createdAt: new Date().toISOString() });
  logEvent("auth.magic_link", { userId: user.id });
  return json({
    user: { id: user.id, email: user.email, methods: user.methods },
    refreshToken,
  });
}
