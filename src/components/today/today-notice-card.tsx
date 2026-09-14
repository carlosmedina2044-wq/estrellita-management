"use client";

import { AnimatePresence, motion } from "motion/react";
import { Illustration } from "@/components/illustration";
import { Button } from "@/components/ui/button";
import type { MessageKey } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { EASE_OUT } from "@/lib/motion";
import { payoffArtFor, payoffKeyFor } from "@/lib/payoff-lines";
import type { CareState, Duty, MilestoneId } from "@/lib/types";

export type TodayNotice =
  | { kind: "milestone"; id: MilestoneId }
  | { kind: "payoff"; duty: Duty }
  | { kind: "care"; state: CareState };

export function TodayNoticeCard({
  notice,
  onDismiss,
}: {
  notice: TodayNotice | null;
  onDismiss: () => void;
}) {
  const { t } = useLocale();

  let title = "";
  let body = "";
  let art: ReturnType<typeof payoffArtFor> | "house" | null = null;
  let key = "empty";

  if (notice?.kind === "milestone") {
    key = `milestone-${notice.id}`;
    title = t("milestone.cardTitle");
    body = t(`milestone.${notice.id}.body` as MessageKey);
  } else if (notice?.kind === "payoff") {
    key = `payoff-${notice.duty.id}`;
    title = t("payoff.title");
    const payoffKey = payoffKeyFor(notice.duty);
    body = payoffKey ? t(payoffKey) : "";
    art = payoffArtFor(notice.duty);
  } else if (notice?.kind === "care") {
    key = `care-${notice.state.level}-${notice.state.since}`;
    const level = t(`care.level.${notice.state.level}` as MessageKey);
    title = level;
    body =
      notice.state.direction === "down"
        ? t("care.dropped", { level })
        : t("care.rose", { level });
    art = "house";
  }

  return (
    <AnimatePresence mode="wait">
      {notice && body ? (
        <motion.div
          key={key}
          className="rounded-2xl bg-card px-4 py-3"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.16 } }}
          transition={{ duration: 0.24, ease: EASE_OUT }}
        >
          <div className="flex items-start gap-3">
            {art ? (
              <motion.div
                className="shrink-0"
                initial={{ scale: 0.96 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
              >
                <Illustration name={art} size={56} />
              </motion.div>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="ui-body font-medium">{title}</p>
              <p className="mt-0.5 ui-caption text-muted-foreground">{body}</p>
              <div className="mt-2">
                <Button variant="ghost" className="h-11 px-2" onClick={onDismiss}>
                  {t("common.gotIt")}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
