"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tinted circle-check used in walk / onboarding lists. */
export function CircleCheck({
  checked,
  disabled,
  className,
}: {
  checked: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-foreground/25 bg-transparent text-transparent",
        disabled && "opacity-60",
        className,
      )}
    >
      <Check className="size-3.5 stroke-[3]" />
    </span>
  );
}
