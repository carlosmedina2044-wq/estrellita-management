"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ItemName } from "@/components/item-name";
import type { Household } from "@/lib/types";

export function ShareLinkSheet({
  open,
  url,
  household,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  url: string | null;
  household: Household;
  onOpenChange: (open: boolean) => void;
  onPick: (consumableId?: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="pb-2">
          <SheetTitle>Save this product</SheetTitle>
        </SheetHeader>
        <div className="grid gap-2 px-4 pb-4">
          <p className="text-sm text-muted-foreground break-all">{url}</p>
          {household.supplyAutomations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No consumables yet. Save as a new item.</p>
          ) : (
            household.supplyAutomations.map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-2xl bg-white px-4 py-3 text-left"
                onClick={() => onPick(item.id)}
              >
                <span className="block font-medium">
                  <ItemName name={item.itemName} sizeSpec={item.sizeSpec} />
                </span>
                <span className="text-[13px] text-muted-foreground">On hand {item.onHand}</span>
              </button>
            ))
          )}
        </div>
        <SheetFooter>
          <Button className="h-12" onClick={() => onPick()}>
            New consumable
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
