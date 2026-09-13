"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { HomeMapView } from "@/components/home-map-view";
import { Button } from "@/components/ui/button";
import { todaysOpenDuties } from "@/lib/duties";
import { roomById } from "@/lib/home-model";
import { lockMethodLabel, type LockMethod } from "@/lib/native/lock-labels";
import type { Household } from "@/lib/types";
import { toast } from "sonner";

export function CleanerVisit({
  household,
  ownerCheck,
  lockMethod,
  onComplete,
  onEndVisit,
}: {
  household: Household;
  /** True when the device can confirm the owner before exiting. */
  ownerCheck: boolean;
  lockMethod: LockMethod;
  onComplete: (dutyId: string) => void;
  onUndo: (dutyId: string) => void;
  onEndVisit: () => boolean | Promise<boolean>;
}) {
  const now = new Date();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const open = todaysOpenDuties(household, now, "cleaner");
  const next = open[0];
  const selectedRoom = selected ? roomById(household, selected) : null;
  const roomOpen = open.filter((duty) => duty.room === selected);

  async function finish() {
    setBusy(true);
    const ok = await onEndVisit();
    setBusy(false);
    if (!ok) toast.error(ownerCheck ? "Couldn’t confirm the owner. Try again." : "Couldn’t end the visit.");
  }

  return (
    <div className="app-frame px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="pt-1">
        <p className="text-sm text-muted-foreground">Cleaner visit</p>
        <h1 className="ui-heading ui-display font-semibold tracking-tight">
          {open.length === 0 ? "All caught up" : `${open.length} left`}
        </h1>
      </header>

      {next ? (
        <div className="mt-4 rounded-2xl bg-card p-4">
          <p className="ui-caption font-medium text-muted-foreground">Next up</p>
          <p className="ui-heading mt-1 ui-title font-semibold">{next.title}</p>
          <Button className="mt-3 h-11 w-full" onClick={() => onComplete(next.id)}>
            Done. Next
          </Button>
        </div>
      ) : null}

      <div className="mt-5">
        {selectedRoom ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="self-start ui-body font-medium text-primary"
              onClick={() => setSelected(null)}
            >
              Map
            </button>
            <h2 className="ui-heading ui-title font-semibold">{selectedRoom.name}</h2>
            <p className="text-sm text-muted-foreground">
              {roomOpen.length === 0 ? "Nothing left here." : `${roomOpen.length} left here. Use Done. Next above.`}
            </p>
          </div>
        ) : (
          <HomeMapView household={household} now={now} onSelectRoom={setSelected} />
        )}
      </div>

      <Button variant="secondary" className="mt-auto h-12" disabled={busy} onClick={() => void finish()}>
        <Lock className="size-4" />
        {ownerCheck
          ? `Hand phone back (${lockMethod === "passcode" ? "passcode" : lockMethodLabel(lockMethod).noun})`
          : "Hand phone back"}
      </Button>

    </div>
  );
}
