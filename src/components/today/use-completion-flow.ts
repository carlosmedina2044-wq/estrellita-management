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
    toast.success(tDutyTitle(duty.title), {
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
