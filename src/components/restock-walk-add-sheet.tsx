"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CONSUMABLE_CATALOG, type CatalogSuggestion } from "@/lib/catalog";
import { userRooms } from "@/lib/home-model";
import {
  defaultRoomForGroup,
  type CustomRestockItem,
  type RestockWalkGroup,
} from "@/lib/onboarding/restock-walk";
import type { Household } from "@/lib/types";
import { cn } from "@/lib/utils";

const INTERVAL_MONTHS: CustomRestockItem["intervalMonths"][] = [1, 3, 6, 12];

function catalogMonths(entry: CatalogSuggestion): CustomRestockItem["intervalMonths"] {
  let months = entry.lifespanValue;
  if (entry.lifespanUnit === "years") months = entry.lifespanValue * 12;
  if (entry.lifespanUnit === "days") months = entry.lifespanValue / 30;
  const options: CustomRestockItem["intervalMonths"][] = [1, 3, 6, 12];
  return options.reduce((best, n) => (Math.abs(n - months) < Math.abs(best - months) ? n : best));
}

export function RestockWalkAddSheet({
  open,
  onOpenChange,
  group,
  household,
  initial,
  onSave,
  onMoreOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: RestockWalkGroup;
  household: Pick<Household, "rooms"> & { supplyAutomations?: Household["supplyAutomations"] };
  initial?: CustomRestockItem;
  onSave: (item: CustomRestockItem) => void;
  onMoreOptions?: () => void;
}) {
  const { t } = useLocale();
  const defaultRoom = defaultRoomForGroup(household, group);
  const resetKey = `${open}:${group}:${initial?.itemName ?? ""}:${initial?.roomId ?? ""}`;
  const [prevKey, setPrevKey] = useState(resetKey);
  const [itemName, setItemName] = useState(initial?.itemName ?? "");
  const [intervalMonths, setIntervalMonths] = useState<CustomRestockItem["intervalMonths"]>(
    initial?.intervalMonths ?? 1,
  );
  const [roomId, setRoomId] = useState(initial?.roomId || defaultRoom);
  const [chipApplied, setChipApplied] = useState(false);

  if (open && prevKey !== resetKey) {
    setPrevKey(resetKey);
    setItemName(initial?.itemName ?? "");
    setIntervalMonths(initial?.intervalMonths ?? 1);
    setRoomId(initial?.roomId || defaultRoom);
    setChipApplied(false);
  }

  const whole = household.rooms.find((room) => room.system === "whole-home");
  const rooms = [...(whole ? [whole] : []), ...userRooms(household)];
  const tracked = (household.supplyAutomations ?? []).map((item) => item.itemName.toLowerCase());
  const query = itemName.trim().toLowerCase();
  const chips = CONSUMABLE_CATALOG.filter((entry) => {
    if (tracked.includes(entry.itemName.toLowerCase())) return false;
    if (query && !entry.itemName.toLowerCase().includes(query)) return false;
    return true;
  });
  const showChips = !chipApplied && chips.length > 0;
  const intervalLabel = (months: CustomRestockItem["intervalMonths"]) =>
    months === 1
      ? t("restock.interval.1m")
      : months === 3
        ? t("restock.interval.3m")
        : months === 6
          ? t("restock.interval.6m")
          : t("restock.interval.1y");

  function applyChip(entry: CatalogSuggestion) {
    setItemName(entry.itemName);
    setIntervalMonths(catalogMonths(entry));
    const match = household.rooms.find((room) => entry.roomTypes?.includes(room.type));
    setRoomId(match?.id || defaultRoom);
    setChipApplied(true);
  }

  function submit() {
    const name = itemName.trim();
    if (!name) return;
    onSave({
      itemName: name,
      sku: undefined,
      roomId,
      intervalMonths,
      retailer: undefined,
      group,
      checkin: initial?.checkin,
    });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[calc(100dvh-env(safe-area-inset-top,0px)-24px)] gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle>{initial ? t("restock.editCustomTitle") : t("restock.addSomethingBuy")}</SheetTitle>
        </SheetHeader>
        <div data-keyboard-scroll className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pb-4">
          <div className="grid gap-1.5">
            <Label htmlFor="walk-add-name">{t("restock.field.item")}</Label>
            <Input
              id="walk-add-name"
              value={itemName}
              onChange={(event) => {
                setItemName(event.target.value);
                setChipApplied(false);
              }}
              placeholder={t("restock.customPlaceholder")}
              className="h-12"
            />
          </div>
          {showChips ? (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="h-11 rounded-full bg-secondary px-3 ui-caption font-medium"
                  onClick={() => applyChip(entry)}
                >
                  {entry.itemName}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <p className="ui-caption font-medium">{t("restock.oneUsuallyLasts")}</p>
            <div className="flex flex-wrap gap-1.5">
              {INTERVAL_MONTHS.map((months) => (
                <button
                  key={months}
                  type="button"
                  className={cn(
                    "h-11 rounded-full px-3 ui-caption font-medium",
                    intervalMonths === months ? "bg-primary text-primary-foreground" : "bg-secondary",
                  )}
                  onClick={() => setIntervalMonths(months)}
                >
                  {intervalLabel(months)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>{t("restock.field.usedIn")}</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger className="h-12 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="h-12 disabled:bg-primary/35 disabled:text-primary-foreground/80 disabled:opacity-100"
            disabled={!itemName.trim()}
            onClick={submit}
          >
            {t("common.add")}
          </Button>
          {onMoreOptions ? (
            <button type="button" className="text-center ui-caption font-medium text-brand" onClick={onMoreOptions}>
              {t("chore.moreOptions")}
            </button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
