"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocale } from "@/i18n/locale-provider";
import { checkinOptions, type CheckinLevel } from "@/lib/restock";
import type { SupplyAutomation } from "@/lib/types";

export function SupplyCheckinSheet({
  item,
  onOpenChange,
  onCheckin,
}: {
  item: SupplyAutomation | null;
  onOpenChange: (open: boolean) => void;
  onCheckin?: (id: string, level: CheckinLevel) => void;
}) {
  const { t } = useLocale();
  return (
    <Sheet open={Boolean(item)} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle>{t("supply.howMuchLeft")}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-4">
          {checkinOptions().map((option) => (
            <Button
              key={option.level}
              type="button"
              variant="secondary"
              className="h-12 w-full"
              onClick={() => {
                if (item) onCheckin?.(item.id, option.level);
                onOpenChange(false);
                toast.success(t("supply.updated"));
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
