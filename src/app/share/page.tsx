"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { extractSharedUrl } from "@/lib/retailer";
import { Suspense } from "react";

function ShareRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const url = extractSharedUrl({
      url: params.get("url") ?? params.get("restockUrl"),
      text: params.get("text"),
      title: params.get("title"),
    });
    const next = url ? `/?restockUrl=${encodeURIComponent(url)}` : "/";
    router.replace(next);
  }, [params, router]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <p className="text-sm text-muted-foreground">Saving that product link…</p>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
          <p className="text-sm text-muted-foreground">Opening Restock…</p>
        </div>
      }
    >
      <ShareRedirect />
    </Suspense>
  );
}
