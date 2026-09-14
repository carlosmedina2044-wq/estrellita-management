"use client";

import { motion } from "motion/react";
import { IllustratedMoment } from "@/components/illustrated-moment";
import { CountUp } from "@/components/today/count-up";
import { useLocale } from "@/i18n/locale-provider";
import { EASE_OUT } from "@/lib/motion";

export function ClosingStats({
  stats,
  instant,
}: {
  stats: { done: number; minutes: number; rooms: number };
  instant: boolean;
}) {
  const { t } = useLocale();
  const duration = instant ? 0 : 0.5;
  const delay = instant ? 0 : 0.3;

  return (
    <div className="flex items-start gap-3">
      <div>
        <CountUp to={stats.done} duration={duration} delay={delay} className="ui-title font-semibold" />
        <p className="ui-caption text-muted-foreground">{t("today.ceremonyThings")}</p>
      </div>
      <div>
        <CountUp to={stats.minutes} duration={duration} delay={delay} className="ui-title font-semibold" />
        <p className="ui-caption text-muted-foreground">{t("today.ceremonyMinutes")}</p>
      </div>
      <div>
        <CountUp to={stats.rooms} duration={duration} delay={delay} className="ui-title font-semibold" />
        <p className="ui-caption text-muted-foreground">{t("today.ceremonyRooms")}</p>
      </div>
    </div>
  );
}

export function ClosingReward({
  onShare,
  instant,
}: {
  onShare?: () => void;
  instant: boolean;
}) {
  const { t } = useLocale();

  return (
    <motion.div
      className="flex items-center gap-[12px] rounded-2xl bg-secondary/60 px-[12px] py-[8px]"
      initial={instant ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: instant ? 0 : 0.7, ease: EASE_OUT }}
    >
      <div
        className="flex size-[120px] shrink-0 items-center justify-center"
        style={{
          background:
            "radial-gradient(closest-side, var(--brand-cream), color-mix(in oklab, var(--brand-cream) 20%, transparent))",
        }}
      >
        <IllustratedMoment kind="shelf-scene" size={120} loop autoplay />
      </div>
      {onShare ? (
        <button
          type="button"
          onClick={onShare}
          className="h-[40px] shrink-0 rounded-full bg-card px-[16px] ui-caption font-medium ring-1 ring-border"
        >
          {t("today.ceremonyShare")}
        </button>
      ) : null}
    </motion.div>
  );
}
