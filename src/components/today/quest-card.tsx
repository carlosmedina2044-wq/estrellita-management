"use client";

import { motion } from "motion/react";
import { RollingNumber } from "@/components/today/rolling-number";
import { Check } from "lucide-react";
import { ProgressTrack } from "@/components/milestone-list";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { startOfDay, weekRange } from "@/lib/dates";
import { DUR_QUICK, EASE_OUT } from "@/lib/motion";
import type { Quest } from "@/lib/quest";
import { cn } from "@/lib/utils";

/** Days left in the quest's week, today included — so the last day reads as
 * one, not none. `weekRange().end` is the start of the final day. */
function daysLeft(now: Date): number {
  const { end } = weekRange(now);
  const days = Math.round((startOfDay(end) - startOfDay(now)) / 86_400_000);
  return Math.max(1, days + 1);
}

/**
 * The week's one named goal. It sits between the day ring, which resolves in
 * hours, and the care level, which moves at most a rung a fortnight — the
 * middle distance where the habit is actually built and where the app
 * previously had nothing to show.
 *
 * Progress leads: the headline names the goal, the track moves when you act,
 * and the count is always attached to a label rather than standing on its own.
 * The week is the point, so the card says how much of it is left — a goal with
 * no deadline in sight is a list item.
 */
export function QuestCard({ quest, now = new Date() }: { quest: Quest; now?: Date }) {
  const { t } = useLocale();
  const title = t(`quest.${quest.id}.title` as MessageKey);
  const left = daysLeft(now);
  const remaining = Math.max(0, quest.target - quest.current);

  return (
    <motion.section
      aria-label={t("quest.title")}
      className={cn(
        "rounded-2xl px-4 py-3 ring-1",
        // A met quest is the one reward this card has to give, so it stops
        // looking like every other card on the screen until Sunday.
        quest.done ? "bg-done-soft ring-done/25" : "bg-card ring-border",
      )}
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: DUR_QUICK, ease: EASE_OUT }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={cn("ui-caption", quest.done ? "text-done" : "text-muted-foreground")}>
          {t("quest.title")}
          {/* The deadline belongs with the week, not under the body: a goal
              with no horizon in sight is just another list item, and hung on
              the right of a wrapping body line it read as a stray number. */}
          {quest.done ? null : (
            <span className="num text-muted-foreground/70">
              {" · "}
              {left === 1 ? t("quest.lastDay") : t("quest.daysLeft", { count: left })}
            </span>
          )}
        </p>
        <p
          // Inline flow, not flex: as flex items the split fragments lost
          // their edge whitespace and "4 of 5 rooms" rendered "4of5rooms".
          className={cn(
            "shrink-0 ui-caption num",
            quest.done ? "text-done" : "text-muted-foreground",
          )}
        >
          {/* The week's own number. It rolls for the same reason the day's
              does: finishing a room should move it, not replace it. */}
          {t(`quest.${quest.id}.count` as MessageKey, { done: "%%d", total: "%%t" })
            .split(/(%%d|%%t)/)
            .map((part, index) =>
              part === "%%d" ? (
                <RollingNumber key={index} value={quest.current} />
              ) : part === "%%t" ? (
                <span key={index}>{quest.target}</span>
              ) : (
                <span key={index}>{part}</span>
              ),
            )}
        </p>
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 ui-card font-semibold text-foreground">
        {quest.done ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-done text-background">
            <Check className="size-3.5" aria-hidden />
          </span>
        ) : null}
        <span className="min-w-0">{title}</span>
      </p>
      <ProgressTrack fraction={quest.fraction} segments={quest.target} className="mt-2" />
      <p className={cn("mt-2 ui-caption", quest.done ? "text-done" : "text-muted-foreground")}>
        {quest.done ? t("quest.doneBody") : t(`quest.${quest.id}.body` as MessageKey)}
      </p>
      <span className="sr-only">
        {quest.done ? "" : t("quest.remainingAria", { count: remaining })}
      </span>
    </motion.section>
  );
}
