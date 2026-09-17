"use client";

import { motion } from "motion/react";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { toISODate } from "@/lib/dates";
import { DUR_BASE, EASE_OUT } from "@/lib/motion";
import type { CareState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CareTitle({
  careState,
  now,
  className,
}: {
  careState?: CareState;
  now: Date;
  className?: string;
}) {
  const { t } = useLocale();
  const level = careState?.level ?? "settling-in";
  const label = t(`care.level.${level}` as MessageKey);
  const today = toISODate(now);
  const rising = careState?.since === today && careState.direction === "up";

  return (
    <motion.p
      className={cn("relative inline-block ui-caption text-primary", className)}
      aria-label={t("care.titleAria", { level: label })}
      initial={rising ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: DUR_BASE, ease: EASE_OUT }}
    >
      {label}
      {rising ? (
        <motion.span
          aria-hidden
          className="absolute bottom-0 left-0 h-px w-full origin-left bg-[var(--brand-cream)]"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: DUR_BASE, ease: EASE_OUT }}
        />
      ) : null}
    </motion.p>
  );
}
