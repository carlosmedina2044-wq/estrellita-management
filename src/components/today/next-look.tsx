"use client";

import { motion, useReducedMotion } from "motion/react";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { type NextLookHint } from "@/lib/care-level";
import { DUR_NONE, DUR_SCREEN, EASE_OUT } from "@/lib/motion";
import { CARE_DECOR_AT } from "@/lib/scene/care-decor";
import type { CareLevelId } from "@/lib/types";

type Translate = ReturnType<typeof useLocale>["t"];

/**
 * How far the house is from getting something new, in the words a person
 * would say: the days left come first, then what shows up. Null when there is
 * nothing to say (the top level, or a next level that adds nothing).
 */
export function nextLookLine(hint: NextLookHint | null, next: CareLevelId | null, t: Translate): string | null {
  const decor = next ? CARE_DECOR_AT[next] : null;
  if (!hint || !decor) return null;
  const thing = t(`care.hint.${decor}` as MessageKey);
  if (hint.kind === "seasonal") return t("care.hintSeasonal", { thing });
  if (hint.days <= 0) return t("care.hintTomorrow", { thing });
  if (hint.days === 1) return t("care.hintDay", { thing });
  return t("care.hintDays", { count: String(hint.days), thing });
}

/**
 * The quiet line on Home under the picture: what is left before the house
 * gets its next touch. No card, no border; the bar is the same slender one the
 * care ladder uses.
 */
export function NextLookNote({
  hint,
  next,
  fraction,
}: {
  hint: NextLookHint | null;
  next: CareLevelId | null;
  fraction: number;
}) {
  const { t } = useLocale();
  const reduce = useReducedMotion();
  const line = nextLookLine(hint, next, t);
  if (!line) return null;
  return (
    <div className="flex flex-col gap-2 px-1">
      <p className="text-pretty ui-caption text-muted-foreground">{line}</p>
      <span aria-hidden className="block h-1 overflow-hidden rounded-full bg-foreground/15">
        <motion.span
          className="block h-full rounded-full bg-done/70"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${Math.round(fraction * 100)}%` }}
          transition={reduce ? { duration: DUR_NONE } : { duration: DUR_SCREEN, ease: EASE_OUT }}
        />
      </span>
    </div>
  );
}
