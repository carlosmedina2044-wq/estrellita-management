import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const file = path.join(process.cwd(), "public/.well-known/apple-app-site-association");
  const body = await readFile(file, "utf8");
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
