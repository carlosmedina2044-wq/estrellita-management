"use client";

import { useEffect } from "react";
import { BrandLockup } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5">
      <BrandLockup size="sm" />
      <h1 className="ui-heading mt-5 text-[28px] font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The screen failed to load. Your household list on this device was not changed.
      </p>
      <Button className="mt-6 h-12" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
