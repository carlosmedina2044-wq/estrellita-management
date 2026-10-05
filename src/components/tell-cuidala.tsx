"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAiAvailability } from "@/hooks/use-ai-availability";
import { useLocale } from "@/i18n/locale-provider";
import { formatMoney } from "@/lib/forecast";
import { aiTellCuidala, type AiAction } from "@/lib/native/intelligence";
import { hapticPress, hapticSuccess } from "@/lib/native/haptics";
import { applyTellActions, completionTargets, describeAction, isUsable, tellContext } from "@/lib/tell-cuidala";
import type { Household } from "@/lib/types";

type Phase = "ask" | "thinking" | "review" | "nothing" | "failed";

/**
 * "Tell Cuidala": say a chore, a purchase or a finished job in your own words and
 * confirm what it understood. Only on phones where Apple Intelligence is on, so it
 * renders nothing anywhere else. Nothing is saved until "Add" is tapped.
 */
export function TellCuidala({
  household,
  onApply,
  onComplete,
}: {
  household: Household;
  /** Saves by building the next household from the latest one. */
  onApply: (build: (current: Household) => Household) => void;
  /** The app's normal "mark done", so the house answers. */
  onComplete: (dutyId: string) => void;
}) {
  const { t } = useLocale();
  const { state } = useAiAvailability();
  const [open, setOpen] = useState(false);
  if (state !== "available") return null;
  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-11 w-full items-center gap-2.5 rounded-[var(--r-container)] bg-secondary px-4 ui-body font-medium text-primary"
        onClick={() => {
          void hapticPress();
          setOpen(true);
        }}
      >
        <MessageSquareText className="size-5 shrink-0" aria-hidden />
        {t("tell.entry")}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" size="form" className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          {open ? (
            <TellBody household={household} onApply={onApply} onComplete={onComplete} onClose={() => setOpen(false)} />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function TellBody({
  household,
  onApply,
  onComplete,
  onClose,
}: {
  household: Household;
  onApply: (build: (current: Household) => Household) => void;
  onComplete: (dutyId: string) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("ask");
  const [actions, setActions] = useState<AiAction[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);

  async function submit() {
    if (!text.trim() || phase === "thinking") return;
    setPhase("thinking");
    const result = await aiTellCuidala(text, tellContext(household));
    if (!result.ok) {
      setPhase("failed");
      return;
    }
    const usable = result.actions.filter((action) => isUsable(household, action));
    if (usable.length === 0) {
      setPhase("nothing");
      return;
    }
    setActions(usable);
    // One thing to confirm is ticked for you; several are left for you to pick.
    setChecked(usable.map(() => usable.length === 1));
    setPhase("review");
  }

  function add() {
    const picked = actions.filter((_, index) => checked[index]);
    if (picked.length === 0) return;
    const now = new Date();
    const toComplete = completionTargets(household, picked);
    onApply((current) => applyTellActions(current, picked, now));
    toComplete.forEach((id) => onComplete(id));
    void hapticSuccess();
    toast(t("tell.added", { count: picked.length }));
    onClose();
  }

  const count = checked.filter(Boolean).length;
  const message =
    phase === "nothing" ? t("tell.nothing") : phase === "failed" ? t("tell.failed") : null;

  return (
    <>
      <SheetHeader className="shrink-0 pb-2">
        <SheetTitle className="ui-page-title text-[1.75rem] font-semibold leading-tight">{t("tell.title")}</SheetTitle>
      </SheetHeader>
      <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3">
        {phase === "review" ? (
          <>
            <p className="ui-body text-muted-foreground">{t("tell.reviewIntro")}</p>
            <ul className="ui-group">
              {actions.map((action, index) => (
                <li key={`${action.kind}-${index}`} className="ui-group-row">
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
                    <Checkbox
                      checked={checked[index] === true}
                      onCheckedChange={(next) =>
                        setChecked((current) => current.map((value, i) => (i === index ? next === true : value)))
                      }
                      aria-label={describeAction(household, action, t, formatMoney)}
                    />
                    <span className="min-w-0 ui-body">{describeAction(household, action, t, formatMoney)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <label htmlFor="tell-text" className="ui-body text-muted-foreground">
              {t("tell.prompt")}
            </label>
            <Textarea
              id="tell-text"
              value={text}
              maxLength={400}
              rows={3}
              disabled={phase === "thinking"}
              placeholder={t("tell.placeholder")}
              className="min-h-24 rounded-2xl px-4 py-3 ui-body"
              onChange={(event) => {
                setText(event.target.value);
                if (phase === "nothing" || phase === "failed") setPhase("ask");
              }}
            />
            {message ? (
              <p role="status" className="ui-body text-muted-foreground">
                {message}
              </p>
            ) : null}
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 px-4 pt-2">
        {phase === "review" ? (
          <>
            <Button type="button" className="h-12 rounded-full ui-body font-semibold" disabled={count === 0} onClick={add}>
              {count > 0 ? t("tell.addCount", { count }) : t("tell.add")}
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setPhase("ask")}>
              {t("tell.change")}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            className="h-12 rounded-full ui-body font-semibold"
            disabled={!text.trim() || phase === "thinking"}
            onClick={() => void submit()}
          >
            {phase === "thinking" ? t("tell.thinking") : t("tell.go")}
          </Button>
        )}
      </div>
    </>
  );
}
