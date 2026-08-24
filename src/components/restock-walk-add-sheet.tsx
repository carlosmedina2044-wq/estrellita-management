"use client";

import { useState } from "react";
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
import { userRooms } from "@/lib/home-model";
import {
  defaultRoomForGroup,
  type CustomRestockItem,
  type RestockWalkGroup,
} from "@/lib/onboarding/restock-walk";
import { RETAILER_CHIPS } from "@/lib/retailer";
import type { Household, RetailerId } from "@/lib/types";
import { cn } from "@/lib/utils";

const INTERVALS: { months: CustomRestockItem["intervalMonths"]; label: string }[] = [
  { months: 1, label: "Monthly" },
  { months: 3, label: "Every 3 months" },
  { months: 6, label: "Every 6 months" },
  { months: 12, label: "Yearly" },
];

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
  household: Pick<Household, "rooms">;
  initial?: CustomRestockItem;
  onSave: (item: CustomRestockItem) => void;
  onMoreOptions?: () => void;
}) {
  const defaultRoom = defaultRoomForGroup(household, group);
  const resetKey = `${open}:${group}:${initial?.itemName ?? ""}:${initial?.roomId ?? ""}`;
  const [prevKey, setPrevKey] = useState(resetKey);
  const [itemName, setItemName] = useState(initial?.itemName ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [intervalMonths, setIntervalMonths] = useState<CustomRestockItem["intervalMonths"]>(
    initial?.intervalMonths ?? 1,
  );
  const [roomId, setRoomId] = useState(initial?.roomId || defaultRoom);
  const [retailer, setRetailer] = useState<RetailerId | undefined>(
    typeof initial?.retailer === "string" && RETAILER_CHIPS.some((chip) => chip.id === initial.retailer)
      ? (initial.retailer as RetailerId)
      : undefined,
  );

  if (open && prevKey !== resetKey) {
    setPrevKey(resetKey);
    setItemName(initial?.itemName ?? "");
    setSku(initial?.sku ?? "");
    setIntervalMonths(initial?.intervalMonths ?? 1);
    setRoomId(initial?.roomId || defaultRoom);
    setRetailer(
      typeof initial?.retailer === "string" && RETAILER_CHIPS.some((chip) => chip.id === initial.retailer)
        ? (initial.retailer as RetailerId)
        : undefined,
    );
  }

  const whole = household.rooms.find((room) => room.system === "whole-home");
  const rooms = [
    ...(whole ? [whole] : []),
    ...userRooms(household),
  ];

  function submit() {
    const name = itemName.trim();
    if (!name) return;
    onSave({
      itemName: name,
      sku: sku.trim() || undefined,
      roomId,
      intervalMonths,
      retailer,
      group,
    });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="shrink-0 pb-2">
          <SheetTitle>Add something you buy</SheetTitle>
        </SheetHeader>
        <div data-keyboard-scroll className="flex flex-col gap-3 px-4 pb-4">
          <div className="grid gap-1.5">
            <Label htmlFor="walk-add-name">What is it?</Label>
            <Input
              id="walk-add-name"
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              placeholder="Water softener salt"
              className="h-12"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="walk-add-size">Size or model</Label>
            <Input
              id="walk-add-size"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder="40 lb"
              className="h-12"
            />
          </div>
          <div className="grid gap-1.5">
            <p className="text-[13px] font-medium">How often?</p>
            <div className="flex flex-wrap gap-1.5">
              {INTERVALS.map((item) => (
                <button
                  key={item.months}
                  type="button"
                  className={cn(
                    "h-9 rounded-full px-3 text-[13px] font-medium",
                    intervalMonths === item.months ? "bg-primary text-primary-foreground" : "bg-secondary",
                  )}
                  onClick={() => setIntervalMonths(item.months)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Where it’s used</Label>
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
          <div className="grid gap-1.5">
            <p className="text-[13px] font-medium">Where you buy it</p>
            <div className="flex flex-wrap gap-1.5">
              {RETAILER_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={cn(
                    "h-9 rounded-full px-3 text-[13px] font-medium",
                    retailer === chip.id ? "bg-primary text-primary-foreground" : "bg-secondary",
                  )}
                  onClick={() => setRetailer((current) => (current === chip.id ? undefined : chip.id))}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          <Button className="h-12" disabled={!itemName.trim()} onClick={submit}>
            Add
          </Button>
          {onMoreOptions ? (
            <button type="button" className="text-center text-[13px] font-medium text-brand" onClick={onMoreOptions}>
              More options
            </button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
