"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { DUR_SCREEN, EASE_OUT } from "@/lib/motion";
import type { MilestoneProgress } from "@/lib/momentum";
import { cn } from "@/lib/utils";

function ProgressTrack({ fraction, className }: { fraction: number; className?: string }) {
  return (
    <span className={cn("block h-1 overflow-hidden rounded-full bg-foreground/12", className)}>
      <motion.span
        className="block h-full rounded-full bg-done"
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(fraction * 100)}%` }}
        transition={{ duration: DUR_SCREEN, ease: EASE_OUT }}
      />
    </span>
  );
}

function MilestoneGlyph({ item }: { item: MilestoneProgress }) {
  if (item.earned) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-done-soft text-done">
        <Check className="size-4" aria-hidden />
      </span>
    );
  }
  const size = 28;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="size-7 shrink-0 -rotate-90"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={stroke}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--done)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - item.fraction) }}
        transition={{ duration: DUR_SCREEN, ease: EASE_OUT }}
      />
    </svg>
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
      </span>
      <span className="shrink-0 ui-caption num text-muted-foreground">
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
      <div className="rounded-2xl bg-done-soft px-4 py-3">
        <p className="ui-body font-medium text-done">{t("milestone.allEarned")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card px-4 py-3 ring-1 ring-border">
      <div className="flex items-baseline justify-between gap-3">
        <p className="ui-caption text-muted-foreground">{t("milestone.nextTitle")}</p>
        <p className="shrink-0 ui-caption num text-muted-foreground">
          {t("seasonal.doneOf", { done: item.current, total: item.target })}
        </p>
      </div>
      <p className="mt-0.5 ui-card font-semibold text-foreground">
        {t(`milestone.${item.id}.title` as MessageKey)}
      </p>
      <ProgressTrack fraction={item.fraction} className="mt-2" />
      <p className="mt-2 ui-caption text-muted-foreground">
        {t(`milestone.${item.id}.body` as MessageKey)}
      </p>
    </div>
  );
}

export { ProgressTrack };
