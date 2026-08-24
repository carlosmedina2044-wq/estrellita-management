import { hashToken, newOpaqueToken } from "@/lib/auth/session";
import { saveMagicLink } from "@/lib/auth/store";
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
  if (!body || typeof body !== "object" || !("email" in body) || typeof body.email !== "string") {
    return json({ error: "email required" }, 400);
  }
  const email = body.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid email" }, 400);
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await saveMagicLink(email, hashToken(token), expiresAt);
  const link = `${process.env.NEXT_PUBLIC_APP_ORIGIN || "https://estrellita-management.vercel.app"}/auth/callback?token=${token}`;
  if (process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.AUTH_FROM_EMAIL || "Estrellita <noreply@estrellita.app>",
        to: email,
        subject: "Your Estrellita sign-in link",
        text: `Open this link in the Estrellita app within 15 minutes:\n${link}`,
      }),
    });
  } else {
    logEvent("auth.magic_link.dev", { email, link });
  }
  return json({ ok: true });
}
