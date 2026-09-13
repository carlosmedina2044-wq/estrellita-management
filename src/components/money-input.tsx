"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Decimal amount field with a leading `$` affordance. */
export function MoneyInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-base text-muted-foreground"
      >
        $
      </span>
      <Input inputMode="decimal" className={cn("pl-7", className)} {...props} />
    </div>
  );
}
