"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { ProgressTrack } from "@/components/milestone-list";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { DUR_QUICK, EASE_OUT } from "@/lib/motion";
import type { Quest } from "@/lib/quest";

/**
 * The week's one named goal. It sits between the day ring, which resolves in
 * hours, and the care level, which moves at most a rung a fortnight — the
 * middle distance where the habit is actually built and where the app
 * previously had nothing to show.
 *
 * Progress leads: the headline names the goal, the bar moves when you act, and
 * the count is always attached to a label rather than standing on its own.
 */
export function QuestCard({ quest }: { quest: Quest }) {
  const { t } = useLocale();
  const title = t(`quest.${quest.id}.title` as MessageKey);

  return (
    <motion.section
      aria-label={t("quest.title")}
      className="rounded-2xl bg-card px-4 py-3 ring-1 ring-border"
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: DUR_QUICK, ease: EASE_OUT }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="ui-caption text-muted-foreground">{t("quest.title")}</p>
        <p className="shrink-0 ui-caption num text-muted-foreground">
          {t(`quest.${quest.id}.count` as MessageKey, {
            done: quest.current,
            total: quest.target,
          })}
        </p>
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 ui-card font-semibold text-foreground">
        {quest.done ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-done-soft text-done">
            <Check className="size-3.5" aria-hidden />
          </span>
        ) : null}
        <span className="min-w-0">{title}</span>
      </p>
      <ProgressTrack fraction={quest.fraction} className="mt-2" />
      <p className="mt-2 ui-caption text-muted-foreground">
        {quest.done ? t("quest.doneBody") : t(`quest.${quest.id}.body` as MessageKey)}
      </p>
    </motion.section>
  );
}
