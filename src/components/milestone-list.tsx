"use client";

import { CalendarCheck, Check, Flame, Heart, ListChecks, Sprout } from "lucide-react";
import { motion } from "motion/react";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { DUR_SCREEN, EASE_OUT } from "@/lib/motion";
import { MILESTONE_FAMILY, type MilestoneFamily, type MilestoneProgress } from "@/lib/momentum";
import { cn } from "@/lib/utils";

/**
 * A progress track. `segments` splits it into one pill per unit, which is what
 * a countable goal deserves: "2 of 5 rooms" as two filled pills out of five is
 * read at a glance, where the same thing as 40% of a continuous bar has to be
 * measured against the label. Above `MAX_SEGMENTS` the pills get too thin to
 * tell apart and it falls back to the continuous bar.
 */
const MAX_SEGMENTS = 8;

function ProgressTrack({
  fraction,
  segments,
  className,
  muted,
}: {
  fraction: number;
  segments?: number;
  className?: string;
  muted?: boolean;
}) {
  const fill = muted ? "bg-done/55" : "bg-done";
  if (segments != null && segments >= 2 && segments <= MAX_SEGMENTS) {
    const filled = Math.round(fraction * segments);
    return (
      <span className={cn("flex gap-1", className)}>
        {Array.from({ length: segments }, (_, index) => (
          <motion.span
            key={index}
            className={cn(
              "block h-1 min-w-0 flex-1 rounded-full",
              index < filled ? fill : "bg-foreground/12",
            )}
            // Each pill lands after the one before it, so finishing a room
            // reads as the row advancing rather than the whole bar redrawing.
            initial={{ opacity: index < filled ? 0.2 : 1 }}
            animate={{ opacity: 1 }}
            transition={{ duration: DUR_SCREEN, ease: EASE_OUT, delay: index * 0.05 }}
          />
        ))}
      </span>
    );
  }
  return (
    <span className={cn("block h-1 overflow-hidden rounded-full bg-foreground/12", className)}>
      <motion.span
        className={cn("block h-full rounded-full", fill)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(fraction * 100)}%` }}
        transition={{ duration: DUR_SCREEN, ease: EASE_OUT }}
      />
    </span>
  );
}

const FAMILY_ICON: Record<MilestoneFamily, typeof Flame> = {
  first: CalendarCheck,
  run: Flame,
  done: ListChecks,
  seasonal: Sprout,
  care: Heart,
};

/**
 * The badge on a milestone row. Earned ones wear their family mark in the done
 * colour; open ones wear the same mark, quietly. It used to be an empty ring
 * with the fraction drawn around it, which at three chores out of two hundred
 * was a bare circle — fourteen identical bare circles, telling you nothing
 * about what any of them were. The progress now lives in the row's own track,
 * where a sliver is still legible, and the badge says what kind of work this is.
 */
function MilestoneGlyph({ item }: { item: MilestoneProgress }) {
  const Icon = item.earned ? Check : FAMILY_ICON[MILESTONE_FAMILY[item.id]];
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        item.earned ? "bg-done-soft text-done" : "bg-foreground/8 text-muted-foreground/80",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}

export function MilestoneRow({
  item,
  earnedLabel,
}: {
  item: MilestoneProgress;
  earnedLabel?: string;
}) {
  const { t } = useLocale();
  const title = t(`milestone.${item.id}.title` as MessageKey);

  return (
    <div className="ui-group-row flex items-center gap-3 px-4 py-3">
      <MilestoneGlyph item={item} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block ui-body font-medium",
            item.earned ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {title}
        </span>
        {/* Open milestones carry their own track: the fraction is the point of
            the row, and a number on its own says nothing about how close it is. */}
        {item.earned ? null : (
          <ProgressTrack fraction={item.fraction} segments={item.target} muted className="mt-1.5" />
        )}
      </span>
      <span
        className={cn(
          "shrink-0 ui-caption num",
          item.earned ? "text-done" : "text-muted-foreground",
        )}
      >
        {item.earned
          ? earnedLabel
          : t("seasonal.doneOf", { done: item.current, total: item.target })}
      </span>
    </div>
  );
}

/** One goal, named and measured — the house sheet and the year view both open
 * on this rather than on a list of things already won. */
export function NextMilestone({ item }: { item: MilestoneProgress | null }) {
  const { t } = useLocale();

  if (!item) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-done-soft px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-done/15 text-done">
          <Check className="size-4" aria-hidden />
        </span>
        <p className="ui-body font-medium text-done">{t("milestone.allEarned")}</p>
      </div>
    );
  }

  const Icon = FAMILY_ICON[MILESTONE_FAMILY[item.id]];
  return (
    <div className="rounded-2xl bg-card px-4 py-3 ring-1 ring-border">
      <div className="flex items-baseline justify-between gap-3">
        <p className="ui-caption text-muted-foreground">{t("milestone.nextTitle")}</p>
        <p className="shrink-0 ui-caption num text-muted-foreground">
          {t("seasonal.doneOf", { done: item.current, total: item.target })}
        </p>
      </div>
      <div className="mt-1 flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-done-soft text-done">
          <Icon className="size-4" aria-hidden />
        </span>
        <p className="min-w-0 ui-card font-semibold text-foreground">
          {t(`milestone.${item.id}.title` as MessageKey)}
        </p>
      </div>
      <ProgressTrack fraction={item.fraction} segments={item.target} className="mt-2.5" />
      <p className="mt-2 ui-caption text-muted-foreground">
        {t(`milestone.${item.id}.body` as MessageKey)}
      </p>
    </div>
  );
}

export { ProgressTrack };
