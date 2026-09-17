"use client";

import { HouseLookPicker } from "@/components/house-look-picker";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocale } from "@/i18n/locale-provider";
import { useClock } from "@/hooks/use-clock";
import type { KitType, PaletteId } from "@/lib/types";

export function HouseLookSheet({
  open,
  kitType,
  palette,
  order,
  lat,
  lng,
  onOpenChange,
  onChange,
}: {
  open: boolean;
  kitType: KitType;
  palette: PaletteId;
  order: KitType[];
  lat?: number;
  lng?: number;
  onOpenChange: (open: boolean) => void;
  onChange: (next: { kitType: KitType; palette: PaletteId }) => void;
}) {
  const { t } = useLocale();
  const now = useClock();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" size="form" className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle>{t("settings.houseLook")}</SheetTitle>
        </SheetHeader>
        <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-5 px-4 pb-4">
          <HouseLookPicker
            kitType={kitType}
            palette={palette}
            order={order}
            now={now}
            lat={lat}
            lng={lng}
            onChange={onChange}
          />
        </div>
        <SheetFooter className="pt-2">
          <Button className="h-12 w-full" onClick={() => onOpenChange(false)}>
            {t("common.done")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
