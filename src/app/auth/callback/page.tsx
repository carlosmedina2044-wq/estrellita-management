import { Suspense } from "react";
import { AuthCallbackClient } from "@/app/auth/callback/callback-client";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
          <h1 className="ui-heading text-[28px] font-semibold">Signing you in</h1>
        </div>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
