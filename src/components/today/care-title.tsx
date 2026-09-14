"use client";

import { motion } from "motion/react";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { toISODate } from "@/lib/dates";
import { EASE_OUT } from "@/lib/motion";
import type { CareState } from "@/lib/types";

export function CareTitle({ careState, now }: { careState?: CareState; now: Date }) {
  const { t } = useLocale();
  const level = careState?.level ?? "settling-in";
  const label = t(`care.level.${level}` as MessageKey);
  const today = toISODate(now);
  const rising = careState?.since === today && careState.direction === "up";

  return (
    <motion.p
      className="relative mt-1 inline-block ui-caption text-primary"
      aria-label={t("care.titleAria", { level: label })}
      initial={rising ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
    >
      {label}
      {rising ? (
        <motion.span
          aria-hidden
          className="absolute bottom-0 left-0 h-px w-full origin-left bg-[var(--brand-cream)]"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.32, ease: EASE_OUT }}
        />
      ) : null}
    </motion.p>
  );
}
