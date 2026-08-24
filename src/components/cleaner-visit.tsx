"use client";

import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { DutyRow } from "@/components/duty-row";
import { HomeMapView } from "@/components/home-map-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isOverdueFor, todaysOpenDuties } from "@/lib/duties";
import { roomById } from "@/lib/home-model";
import type { Duty, Household } from "@/lib/types";
import { toast } from "sonner";

export function CleanerVisit({
  household,
  pinRequired,
  onComplete,
  onUndo,
  onEndVisit,
}: {
  household: Household;
  pinRequired: boolean;
  onComplete: (dutyId: string) => void;
  onUndo: (dutyId: string) => void;
  onEndVisit: (pin: string) => boolean | Promise<boolean>;
}) {
  const now = useMemo(() => new Date(), [household.completions, household.duties]);
  const [pin, setPin] = useState("");
  const [askingPin, setAskingPin] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const open = todaysOpenDuties(household, now, "cleaner");
  const next = open[0];
  const selectedRoom = selected ? roomById(household, selected) : null;
  const roomOpen = open.filter((duty) => duty.room === selected);

  function finish() {
    if (pinRequired) {
      setAskingPin(true);
      return;
    }
    void onEndVisit("");
  }

  async function confirmPin() {
    if (!(await onEndVisit(pin))) {
      toast.error("Wrong PIN");
      return;
    }
    setPin("");
    setAskingPin(false);
  }

  function toggle(duty: Duty, completed: boolean) {
    if (completed) onUndo(duty.id);
    else onComplete(duty.id);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-background px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="pt-1">
        <p className="text-sm text-muted-foreground">Cleaner visit</p>
        <h1 className="ui-heading text-[34px] font-semibold tracking-tight">
          {open.length === 0 ? "All caught up" : `${open.length} left`}
        </h1>
      </header>

      {next ? (
        <div className="mt-4 rounded-2xl bg-white p-4">
          <p className="text-[13px] font-medium text-muted-foreground">Next up</p>
          <p className="ui-heading mt-1 text-[22px] font-semibold">{next.title}</p>
          <Button className="mt-3 h-11 w-full" onClick={() => onComplete(next.id)}>
            Done — next
          </Button>
        </div>
      ) : null}

      <div className="mt-5">
        {selectedRoom ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="self-start text-[15px] font-medium text-primary"
              onClick={() => setSelected(null)}
            >
              Map
            </button>
            <h2 className="ui-heading text-[22px] font-semibold">{selectedRoom.name}</h2>
            <div className="ui-group">
              {roomOpen.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing left here.</p>
              ) : (
                roomOpen.map((duty) => (
                  <div key={duty.id} className="ui-group-row">
                    <DutyRow
                      duty={duty}
                      household={household}
                      now={now}
                      overdue={isOverdueFor(duty, household, now)}
                      onToggle={() => toggle(duty, false)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <HomeMapView household={household} now={now} onSelectRoom={setSelected} />
        )}
      </div>

      <Button variant="secondary" className="mt-auto h-12" onClick={finish}>
        <Lock className="size-4" />
        Hand phone back
      </Button>

      {askingPin ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 p-4">
          <div className="w-full rounded-3xl bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="font-medium">Owner PIN to hand the phone back</p>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="PIN"
              className="mt-3 h-12"
            />
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="h-12 flex-1" onClick={() => setAskingPin(false)}>
                Cancel
              </Button>
              <Button className="h-12 flex-1" onClick={() => void confirmPin()}>
                Unlock
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
