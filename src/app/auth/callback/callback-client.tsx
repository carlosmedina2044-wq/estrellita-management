"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { persistRefreshToken, persistVaultSecret } from "@/lib/native/keychain";

export function AuthCallbackClient() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("This sign-in link is missing its token.");
      return;
    }
    void (async () => {
      const response = await fetch("/api/auth/magic-link/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        setError("This link expired or was already used. Request a new one.");
        return;
      }
      const payload = (await response.json()) as { refreshToken?: string; user?: { id: string } };
      if (payload.refreshToken) await persistRefreshToken(payload.refreshToken);
      const secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      await persistVaultSecret(secret);
      window.sessionStorage.setItem("estrellita-auth-user", JSON.stringify(payload.user ?? {}));
      router.replace("/");
    })();
  }, [params, router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="ui-heading text-[28px] font-semibold">Signing you in</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error || "One moment — opening your home."}</p>
    </div>
  );
}
