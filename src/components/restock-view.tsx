"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Package } from "lucide-react";
import { ItemName } from "@/components/item-name";
import { ConsumableForm } from "@/components/consumable-form";
import { RestockWalkPicker } from "@/components/restock-walk-picker";
import { OrderByLine, RestockOrderButton, restockButtonProps } from "@/components/restock-order-flow";
import { Button } from "@/components/ui/button";
import { roomName } from "@/lib/home-model";
import { SAMPLE_RESTOCK_PICKS, defaultWalkPicks, type RestockPick } from "@/lib/onboarding/restock-walk";
import { groupRestock, restockPlacement, usedWhere, type RestockFlowHandlers } from "@/lib/restock";
import { useSheetOpenGuard } from "@/lib/sheet-guard";
import type { AppNavigateTarget, Duty, DutyDraft, Household, SupplyAutomation } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RestockView({
  household,
  onSaveDuty,
  onDeleteDuty,
  onWalkHouse,
  focus,
  onFocusHandled,
  ...restock
}: {
  household: Household;
  onSaveDuty: (duty: DutyDraft) => void;
  onDeleteDuty: (id: string) => void;
  onWalkHouse?: (picks: RestockPick[]) => void;
  focus?: AppNavigateTarget | null;
  onFocusHandled?: () => void;
} & RestockFlowHandlers) {
  const [creating, setCreating] = useState(false);
  const [editingDuty, setEditingDuty] = useState<Duty | null>(null);
  const [stockedOpen, setStockedOpen] = useState(false);
  const [walking, setWalking] = useState(false);
  const [walkPicks, setWalkPicks] = useState<RestockPick[]>(SAMPLE_RESTOCK_PICKS);
  const createGuard = useSheetOpenGuard();
  const groups = useMemo(
    () => groupRestock(household.supplyAutomations, household),
    [household],
  );
  const editingAutomation = editingDuty
    ? household.supplyAutomations.find((item) => item.dutyId === editingDuty.id || item.linkedDutyIds.includes(editingDuty.id)) ?? null
    : null;

  function openItem(item: SupplyAutomation) {
    const duty = household.duties.find((entry) => item.dutyId === entry.id || item.linkedDutyIds.includes(entry.id));
    if (duty) setEditingDuty(duty);
    else setCreating(true);
  }

  useEffect(() => {
    if (!focus?.itemId && !focus?.section) return;
    const itemEl = focus.itemId ? document.getElementById(`restock-item-${focus.itemId}`) : null;
    const sectionEl = focus.section ? document.getElementById(`restock-${focus.section}`) : null;
    (itemEl ?? sectionEl)?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (focus.action === "receive") onFocusHandled?.();
  }, [focus, onFocusHandled]);

  return (
    <div className="flex flex-col gap-5">
      <header className="pt-1">
        <p className="text-sm text-muted-foreground">{household.householdName}</p>
        <h1 className="ui-heading text-[34px] font-semibold tracking-tight">Restock</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Knows what is running out and when to order it. One tap to any retailer — you check out there.
        </p>
      </header>

      {household.supplyAutomations.length === 0 ? (
        <div className="rounded-2xl bg-card px-4 py-5">
          {walking ? (
            <>
              <p className="text-[17px] font-medium">Walk your house</p>
              <p className="mt-1 text-sm text-muted-foreground">Pick the filters and batteries you actually buy.</p>
              <div className="mt-3">
                <RestockWalkPicker picks={walkPicks} onChange={setWalkPicks} context={household} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" className="h-11 flex-1" onClick={() => setWalking(false)}>
                  Cancel
                </Button>
                <Button
                  className="h-11 flex-1"
                  onClick={() => {
                    onWalkHouse?.(walkPicks);
                    setWalking(false);
                  }}
                >
                  Add to Restock
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[17px] font-medium">Restock is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Walk the house once — HVAC filter, water filter, smoke-detector batteries — and this tab stays useful.
              </p>
              {onWalkHouse ? (
                <Button
                  className="mt-3 h-11 w-full"
                  onClick={() => {
                    setWalkPicks(defaultWalkPicks(household));
                    setWalking(true);
                  }}
                >
                  Walk your house
                </Button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {groups.ordered.length > 0 ? (
        <Section id="restock-ordered" title="On the way" count={groups.ordered.length}>
          {groups.ordered.map((item) => (
            <RestockRow
              key={item.id}
              household={household}
              item={item}
              onOpen={() => openItem(item)}
              autoReceive={focus?.action === "receive" && focus.itemId === item.id}
              {...restock}
            />
          ))}
        </Section>
      ) : null}

      <Section id="restock-order_now" title="Order now" count={groups.order_now.length}>
        {groups.order_now.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing to order right now.</p>
        ) : (
          groups.order_now.map((item) => (
            <RestockRow
              key={item.id}
              household={household}
              item={item}
              onOpen={() => openItem(item)}
              autoReceive={focus?.action === "receive" && focus.itemId === item.id}
              {...restock}
            />
          ))
        )}
      </Section>

      <Section id="restock-coming_up" title="Coming up" count={groups.coming_up.length}>
        {groups.coming_up.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing in the next three weeks.</p>
        ) : (
          groups.coming_up.map((item) => (
            <RestockRow
              key={item.id}
              household={household}
              item={item}
              onOpen={() => openItem(item)}
              {...restock}
            />
          ))
        )}
      </Section>

      <section id="restock-stocked">
        <button
          type="button"
          className="mb-2 flex w-full items-baseline justify-between gap-3 px-1"
          onClick={() => setStockedOpen((current) => !current)}
          aria-expanded={stockedOpen}
        >
          <h2 className="ui-heading text-[22px] font-semibold">Stocked</h2>
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground">
            {groups.stocked.length}
            <ChevronDown className={cn("size-4 transition-transform", stockedOpen && "rotate-180")} />
          </span>
        </button>
        {stockedOpen ? (
          <div className="ui-group">
            {groups.stocked.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No stocked items yet.</p>
            ) : (
              groups.stocked.map((item) => (
                <RestockRow
                  key={item.id}
                  household={household}
                  item={item}
                  onOpen={() => openItem(item)}
                  {...restock}
                />
              ))
            )}
          </div>
        ) : null}
      </section>

      <Button className="h-12 rounded-full" onClick={() => createGuard.tryOpen(() => setCreating(true))}>
        Add item
      </Button>

      <ConsumableForm
        open={creating || Boolean(editingDuty)}
        duty={editingDuty}
        household={household}
        defaultRoom={household.rooms.find((room) => !room.system)?.id ?? "kitchen"}
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
        {...restock}
      />
    </div>
  );
}

function Section({
  id,
  title,
  count,
  children,
}: {
  id?: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section id={id}>
      <header className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h2 className="ui-heading text-[22px] font-semibold">{title}</h2>
        <span className="text-[13px] font-medium text-muted-foreground">{count}</span>
      </header>
      <div className="ui-group">{children}</div>
    </section>
  );
}

function RestockRow({
  household,
  item,
  onOpen,
  autoReceive,
  ...restock
}: {
  household: Household;
  item: SupplyAutomation;
  onOpen: () => void;
  autoReceive?: boolean;
} & RestockFlowHandlers) {
  const where = usedWhere(item, household) || roomName(household, item.room);
  const placement = restockPlacement(item, household);
  return (
    <div id={`restock-item-${item.id}`} className="ui-group-row w-full px-4 py-3">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <span className="flex items-start gap-3">
          <Package
            className={`mt-0.5 size-4 shrink-0 ${placement.bucket === "order_now" ? "text-primary" : "text-muted-foreground"}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-medium leading-snug">
              <ItemName name={item.itemName} sizeSpec={item.sizeSpec} />
            </span>
            <span className="mt-0.5 block text-[13px] text-muted-foreground">
              {where ? `${where} · ` : ""}
              <OrderByLine item={item} household={household} />
            </span>
          </span>
        </span>
      </button>
      <div className="mt-2 pl-7">
        <RestockOrderButton
          item={item}
          household={household}
          onAddSize={onOpen}
          autoReceive={autoReceive}
          {...restockButtonProps(item, restock)}
        />
      </div>
    </div>
  );
}
