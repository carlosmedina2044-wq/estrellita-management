"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { tDutyTitle } from "@/i18n/content";
import { useLocale } from "@/i18n/locale-provider";
import { COMPLETE_HOLD_MS, prefersReducedMotion } from "@/lib/motion";
import { hapticComplete, hapticUndo } from "@/lib/native/haptics";
import type { OutstandingScope } from "@/lib/duties";
import type { Duty } from "@/lib/types";

export function useCompletionFlow(args: {
  open: Duty[];
  scope: OutstandingScope;
  viewingCalendar: boolean;
  momentumOn: boolean;
  onComplete: (id: string) => void;
  onUndo: (id: string) => void;
  onCommitted?: (duty: Duty, remaining: Duty[]) => void;
  /** The house's answer to this chore, shown under the toast. Returning null
   * falls back to the bare title. Supplied by the caller because the copy
   * needs `t`, which belongs to the view, not to this hook. */
  reactionFor?: (duty: Duty, remaining: number) => string | null;
}): {
  completingId: string | null;
  complete: (duty: Duty) => void;
  undo: (duty: Duty) => void;
} {
  const { t } = useLocale();
  const [completingId, setCompletingId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const completingRef = useRef<string | null>(null);
  const argsRef = useRef(args);
  useEffect(() => {
    argsRef.current = args;
  }, [args]);

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, []);

  function clearHold() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    completingRef.current = null;
    setCompletingId(null);
  }

  function complete(duty: Duty) {
    if (completingRef.current) return;
    completingRef.current = duty.id;
    setCompletingId(duty.id);
    void hapticComplete();
    // The house answers in the same beat as the haptic, rather than reading
    // the chore's own title back at the person who just tapped it.
    const remainingNow = argsRef.current.open.filter((item) => item.id !== duty.id).length;
    const reaction = argsRef.current.reactionFor?.(duty, remainingNow) ?? null;
    toast.success(reaction ?? tDutyTitle(duty.title), {
      description: reaction ? tDutyTitle(duty.title) : undefined,
      action: {
        label: t("today.undoToast"),
        onClick: () => undoDuringOrAfter(duty),
      },
    });
    const hold = prefersReducedMotion() ? 0 : COMPLETE_HOLD_MS;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      completingRef.current = null;
      setCompletingId(null);
      const current = argsRef.current;
      const remaining = current.open.filter((item) => item.id !== duty.id);
      current.onComplete(duty.id);
      current.onCommitted?.(duty, remaining);
    }, hold);
  }

  function undoDuringOrAfter(duty: Duty) {
    if (completingRef.current === duty.id) {
      clearHold();
      void hapticUndo();
      return;
    }
    argsRef.current.onUndo(duty.id);
    void hapticUndo();
    toast(t("today.undoToast"));
  }

  function undo(duty: Duty) {
    if (completingRef.current === duty.id) {
      clearHold();
      void hapticUndo();
      return;
    }
    argsRef.current.onUndo(duty.id);
    void hapticUndo();
    toast(t("today.undoToast"));
  }

  return { completingId, complete, undo };
}
