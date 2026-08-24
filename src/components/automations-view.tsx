"use client";

import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { AmazonOrderButton } from "@/components/amazon-order-button";
import { AutomationForm } from "@/components/automation-form";
import { Button } from "@/components/ui/button";
import { formatDueDate } from "@/lib/dates";
import { roomName } from "@/lib/home-model";
import { useSheetOpenGuard } from "@/lib/sheet-guard";
import { isDueToOrderSoon, lifespanLabel, reminderDateFor, sortAutomations } from "@/lib/supply";
import type { Duty, DutyDraft, Household, SupplyAutomation } from "@/lib/types";

export function AutomationsView({
  household,
  onSaveDuty,
  onDeleteDuty,
  onMarkOrdered,
}: {
  household: Household;
  onSaveDuty: (duty: DutyDraft) => void;
  onDeleteDuty: (id: string) => void;
  onMarkOrdered?: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editingDuty, setEditingDuty] = useState<Duty | null>(null);
  const createGuard = useSheetOpenGuard();

  const rules = useMemo(() => sortAutomations(household.supplyAutomations), [household.supplyAutomations]);
  const due = useMemo(() => rules.filter((item) => isDueToOrderSoon(item)), [rules]);
  const upcoming = useMemo(() => rules.filter((item) => !isDueToOrderSoon(item)), [rules]);
  const editingAutomation = editingDuty
    ? household.supplyAutomations.find((item) => item.dutyId === editingDuty.id) ?? null
    : null;

  function openRule(item: SupplyAutomation) {
    const duty = household.duties.find((entry) => entry.id === item.dutyId);
    if (duty) setEditingDuty(duty);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="pt-1">
        <p className="text-sm text-muted-foreground">{household.householdName}</p>
        <h1 className="ui-heading text-[34px] font-semibold tracking-tight">Automations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reminds you to reorder before you run out. One tap opens Amazon.
        </p>
      </header>

      {due.length > 0 ? (
        <section>
          <header className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h2 className="ui-heading text-[22px] font-semibold">Review</h2>
            <span className="text-[13px] font-medium text-muted-foreground">
              {due.length === 1 ? "1 due" : `${due.length} due`}
            </span>
          </header>
          <div className="ui-group">
            {due.map((item) => (
              <AutomationRow
                key={item.id}
                household={household}
                item={item}
                due
                onOpen={() => openRule(item)}
                onMarkOrdered={onMarkOrdered}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <header className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <h2 className="ui-heading text-[22px] font-semibold">
            {due.length > 0 ? "Coming up" : "Rules"}
          </h2>
          <span className="text-[13px] font-medium text-muted-foreground">
            {due.length > 0 ? upcoming.length : rules.length}
          </span>
        </header>
        <div className="ui-group">
          {(due.length > 0 ? upcoming : rules).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {due.length > 0
                ? "Nothing else queued."
                : "Nothing yet."}
            </p>
          ) : (
            (due.length > 0 ? upcoming : rules).map((item) => (
              <AutomationRow
                key={item.id}
                household={household}
                item={item}
                onOpen={() => openRule(item)}
                onMarkOrdered={onMarkOrdered}
              />
            ))
          )}
        </div>
      </section>

      <Button className="h-12 rounded-full" onClick={() => createGuard.tryOpen(() => setCreating(true))}>
        Add item
      </Button>

      <AutomationForm
        open={creating || Boolean(editingDuty)}
        duty={editingDuty}
        household={household}
        automation={editingAutomation}
        onOpenChange={(open) => {
          if (!open) {
            createGuard.markClosed();
            setCreating(false);
            setEditingDuty(null);
          }
        }}
        onSave={onSaveDuty}
        onDelete={onDeleteDuty}
        onMarkOrdered={onMarkOrdered}
      />
    </div>
  );
}

function AutomationRow({
  household,
  item,
  due,
  onOpen,
  onMarkOrdered,
}: {
  household: Household;
  item: SupplyAutomation;
  due?: boolean;
  onOpen: () => void;
  onMarkOrdered?: (id: string) => void;
}) {
  return (
    <div className="ui-group-row w-full px-4 py-3">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <span className="flex items-start gap-3">
          <Package className={`mt-0.5 size-4 shrink-0 ${due ? "text-primary" : "text-muted-foreground"}`} />
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-medium leading-snug">{item.itemName}</span>
            <span className="mt-0.5 block text-[13px] text-muted-foreground">
              {roomName(household, item.room)} · lasts {lifespanLabel(item.lifespanValue, item.lifespanUnit)} ·
              remind {formatDueDate(reminderDateFor(item))}
            </span>
          </span>
        </span>
      </button>
      {due && onMarkOrdered ? (
        <div className="mt-2 pl-7">
          <AmazonOrderButton item={item} onOrdered={() => onMarkOrdered(item.id)} />
        </div>
      ) : null}
    </div>
  );
}
