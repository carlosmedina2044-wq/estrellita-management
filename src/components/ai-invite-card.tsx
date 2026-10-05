"use client";

import { useState } from "react";
import { Lock, MessageSquareText, ScanText, Sparkles } from "lucide-react";
import { useAiAvailability } from "@/hooks/use-ai-availability";
import { useLocale } from "@/i18n/locale-provider";
import { hapticPress } from "@/lib/native/haptics";
import { openAppSettings } from "@/lib/native/open-url";
import { cn } from "@/lib/utils";

/**
 * The invitation to turn on Apple Intelligence. It shows nothing unless the phone
 * could use it and has it switched off, because an app cannot turn it on and must
 * not nag people whose phones cannot. Whether to show it again after a dismissal
 * is the caller's call (`shouldShowAiInvite`); the Settings row always shows it.
 */
export function AiInviteCard({
  context,
  onDismiss,
  className,
}: {
  context: "scan" | "settings" | "tell";
  /** Called after "Not now". Persist it with `recordAiInviteDismissal`. */
  onDismiss?: () => void;
  className?: string;
}) {
  const { t } = useLocale();
  const { state } = useAiAvailability();
  const [hidden, setHidden] = useState(false);

  if (state === "modelNotReady") {
    return (
      <p className={cn("rounded-[var(--r-container)] bg-secondary px-4 py-3 ui-body text-muted-foreground", className)}>
        {t("ai.gettingReady")}
      </p>
    );
  }
  if (state !== "notEnabled" || hidden) return null;

  const sayIt = { icon: MessageSquareText, key: "ai.inviteBenefitSay" as const };
  const benefits = [
    { icon: ScanText, key: "ai.inviteBenefitName" as const },
    sayIt,
    { icon: Sparkles, key: "ai.inviteBenefitRead" as const },
  ];
  const ordered = context === "tell" ? [sayIt, ...benefits.filter((item) => item !== sayIt)] : benefits;

  return (
    <section
      className={cn("rounded-[var(--r-container)] bg-secondary px-4 py-4", className)}
      aria-label={t("ai.inviteTitle")}
    >
      <h3 className="ui-heading ui-card font-semibold">{t("ai.inviteTitle")}</h3>
      <ul className="mt-3 flex flex-col gap-2.5">
        {ordered.map(({ icon: Icon, key }) => (
          <li key={key} className="flex items-start gap-3 ui-body">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">{t(key)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-start gap-3 ui-caption text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0">{t("ai.invitePrivacy")}</span>
      </p>
      <p className="mt-3 ui-body">{t("ai.inviteSteps")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 ui-body font-semibold text-primary-foreground"
          onClick={() => {
            void hapticPress();
            openAppSettings();
          }}
        >
          {t("ai.inviteOpen")}
        </button>
        {context !== "settings" ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center px-1 ui-body text-muted-foreground"
            onClick={() => {
              setHidden(true);
              onDismiss?.();
            }}
          >
            {t("ai.inviteLater")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
