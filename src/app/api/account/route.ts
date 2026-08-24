import { deleteUser, findUserById } from "@/lib/auth/store";
import { json, readJsonLimited } from "@/lib/http";
import { logEvent } from "@/lib/logger";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await readJsonLimited(request);
  } catch {
    return json({ error: "Payload too large" }, 413);
  }
  const userId =
    body && typeof body === "object" && "userId" in body && typeof body.userId === "string" ? body.userId : "";
  if (!userId) return json({ error: "userId required" }, 400);
  const user = await findUserById(userId);
  if (!user) return json({ ok: true });
  await deleteUser(userId);
  logEvent("account.deleted", { userId });
  return json({ ok: true });
}
