"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CheckinLevel } from "@/lib/restock";
import type { SupplyAutomation } from "@/lib/types";

const OPTIONS: { label: string; level: CheckinLevel }[] = [
  { label: "Plenty left", level: "plenty" },
  { label: "About half", level: "half" },
  { label: "Running low", level: "low" },
  { label: "Out", level: "out" },
];

export function SupplyCheckinSheet({
  item,
  onOpenChange,
  onCheckin,
}: {
  item: SupplyAutomation | null;
  onOpenChange: (open: boolean) => void;
  onCheckin?: (id: string, level: CheckinLevel) => void;
}) {
  return (
    <Sheet open={Boolean(item)} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle>How much is left?</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-4">
          {OPTIONS.map((option) => (
            <Button
              key={option.level}
              type="button"
              variant="secondary"
              className="h-12 w-full"
              onClick={() => {
                if (item) onCheckin?.(item.id, option.level);
                onOpenChange(false);
                toast.success("Got it. Updated.");
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
