"use client";

import { motion, useReducedMotion } from "motion/react";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { careLevelIndex, type NextLookHint } from "@/lib/care-level";
import { nextLookLine } from "@/components/today/next-look";
import { DUR_NONE, DUR_SCREEN, EASE_OUT } from "@/lib/motion";
import { CARE_DECOR_AT } from "@/lib/scene/care-decor";
import { CARE_LEVELS, type CareLevelId } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * All five care levels at once, with the one still to come named by what it
 * puts on the house. The level was only ever a word: the ladder was invisible
 * until a rung landed, and nothing said a rung was worth climbing to.
 */
export function CareLadder({
  level,
  next,
  fraction,
  hint = null,
}: {
  level: CareLevelId;
  next: CareLevelId | null;
  fraction: number;
  /** Days still to go, when it can be worked out; replaces the generic line. */
  hint?: NextLookHint | null;
}) {
  const { t } = useLocale();
  // A width tween is not covered by `reducedMotion="user"`.
  const reduce = useReducedMotion();
  const reached = careLevelIndex(level);
  const decor = next ? CARE_DECOR_AT[next] : null;
  const hintLine = nextLookLine(hint, next, t);

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex items-stretch gap-1" aria-label={t("care.ladderAria")}>
        {CARE_LEVELS.map((step, index) => {
          const done = index <= reached;
          const isNext = index === reached + 1;
          return (
            <li key={step} className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="relative block h-1 overflow-hidden rounded-full bg-foreground/25">
                {done ? (
                  <span className="block h-full rounded-full bg-done" />
                ) : isNext ? (
                  <motion.span
                    className="block h-full rounded-full bg-done/60"
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${Math.round(fraction * 100)}%` }}
                    transition={reduce ? { duration: DUR_NONE } : { duration: DUR_SCREEN, ease: EASE_OUT }}
                  />
                ) : null}
              </span>
              {/* No tick alongside the name: five names share the screen width,
                  and the glyph cost enough of it to truncate "Settling in" on a
                  fresh home — the very level it was marking. The filled bar
                  above already says the rung is behind you. */}
              <span
                className={cn(
                  "truncate ui-caption leading-tight",
                  done ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {t(`care.level.${step}` as MessageKey)}
              </span>
            </li>
          );
        })}
      </ol>
      {next ? (
        <p className="ui-caption text-muted-foreground">
          {hintLine ? hintLine : decor
            ? t("care.nextAdds", {
                level: t(`care.level.${next}` as MessageKey),
                thing: t(`care.decor.${decor}` as MessageKey),
              })
            : t("care.nextLevel", { level: t(`care.level.${next}` as MessageKey) })}
        </p>
      ) : (
        <p className="ui-caption text-done">{t("care.topLevel")}</p>
      )}
    </div>
  );
}
