"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { DutyForm } from "@/components/duty-form";
import { DutyRow } from "@/components/duty-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { suggestionsForAsset, suggestionsForRoom } from "@/lib/catalog";
import {
  isOverdueFor,
  matchesAudience,
  sortDuties,
  todaysOpenDuties,
  wasCompletedToday,
} from "@/lib/duties";
import { ASSET_TYPES, roomById } from "@/lib/home-model";
import { assetLabel, catalogLabel } from "@/lib/asset-catalog";
import { warrantyBadgeLabel } from "@/lib/warranty";
import { useSheetOpenGuard } from "@/lib/sheet-guard";
import { ItemName } from "@/components/item-name";
import { RestockOrderButton, restockButtonProps } from "@/components/restock-order-flow";
import { restockPlacement, type RestockFlowHandlers } from "@/lib/restock";
import type { AssetType, Audience, Duty, DutyDraft, Household } from "@/lib/types";

export function HouseMapSheet({
  open,
  roomId,
  household,
  now,
  filter,
  onOpenChange,
  onToggle,
  onSaveDuty,
  onDeleteDuty,
  onChangeTree,
  ...restock
}: {
  open: boolean;
  roomId: string;
  household: Household;
  now: Date;
  filter: Audience | "all";
  onOpenChange: (open: boolean) => void;
  onToggle: (duty: Duty, completed: boolean) => void;
  onSaveDuty: (duty: DutyDraft) => void;
  onDeleteDuty: (id: string) => void;
  onReorderRooms?: (rooms: Household["rooms"]) => void;
  onChangeTree?: (next: Household) => void;
} & RestockFlowHandlers) {
  const { t } = useLocale();
  const selected = roomId;
  const [editing, setEditing] = useState<Duty | null>(null);
  const [creating, setCreating] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("other");
  const createGuard = useSheetOpenGuard();

  const openDuties = todaysOpenDuties(household, now, filter);
  const done = household.duties.filter((duty) =>
    wasCompletedToday(duty, household.completions, now),
  );
  const selectedRoom = selected ? roomById(household, selected) : null;
  const roomAll = sortDuties(
    household.duties.filter((duty) => duty.room === selected && !duty.archived),
    household,
  );
  const roomOpen = openDuties.filter((duty) => duty.room === selected);
  const roomDone = done.filter(
    (duty) => duty.room === selected && matchesAudience(duty, filter === "all" ? "all" : filter),
  );
  const roomUpcoming = roomAll.filter(
    (duty) =>
      !roomOpen.some((item) => item.id === duty.id) && !roomDone.some((item) => item.id === duty.id),
  );
  const hints = selectedRoom ? suggestionsForRoom(selectedRoom.type) : [];
  const roomAssets = selected
    ? household.assets.filter((asset) => asset.roomId === selected)
    : [];
  const roomConsumables = selected
    ? household.supplyAutomations.filter(
        (item) => item.room === selected || item.nodeId === selected,
      )
    : [];

  function addAsset() {
    if (!selected || !onChangeTree) return;
    const type = assetType;
    const name = assetName.trim() || catalogLabel(type) || t("home.assetFallback");
    onChangeTree({
      ...household,
      assets: [
        ...household.assets,
        { id: crypto.randomUUID(), roomId: selected, name, type },
      ],
    });
    setAssetName("");
    const suggestion = suggestionsForAsset(type)[0];
    if (suggestion) {
      toast.message(t("home.suggestion", { name: suggestion.itemName }), { description: suggestion.hint });
    } else {
      toast.success(t("home.assetAdded"));
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          size="form"
          className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="shrink-0 pb-2">
            <SheetTitle>{selectedRoom?.name ?? t("map.roomFallback")}</SheetTitle>
          </SheetHeader>
          <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-5 px-4 pb-4">
            {selectedRoom ? (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="ui-heading ui-display font-semibold">{selectedRoom.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {roomOpen.length === 0 ? t("home.allClear") : t("common.openCount", { count: roomOpen.length })}
                  </p>
                </div>
                {roomOpen.length === 0 && roomDone.length === 0 && roomUpcoming.length === 0 ? (
                  <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                    {t("map.noJobsInRoom")}
                  </p>
                ) : (
                  <div className="ui-group">
                    {roomOpen.map((duty) => (
                      <div key={duty.id} className="ui-group-row">
                        <DutyRow
                          duty={duty}
                          household={household}
                          now={now}
                          overdue={isOverdueFor(duty, household, now)}
                          onToggle={() => onToggle(duty, false)}
                          onOpen={() => setEditing(duty)}
                        />
                      </div>
                    ))}
                    {roomUpcoming.map((duty) => (
                      <div key={duty.id} className="ui-group-row">
                        <DutyRow
                          duty={duty}
                          household={household}
                          now={now}
                          upcoming
                          onToggle={() => onToggle(duty, false)}
                          onOpen={() => setEditing(duty)}
                        />
                      </div>
                    ))}
                    {roomDone.map((duty) => (
                      <div key={duty.id} className="ui-group-row">
                        <DutyRow
                          duty={duty}
                          household={household}
                          now={now}
                          done
                          onToggle={() => onToggle(duty, true)}
                          onOpen={() => setEditing(duty)}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {roomConsumables.length > 0 ? (
                  <section>
                    <h3 className="mb-2 ui-caption font-medium text-muted-foreground">{t("map.items")}</h3>
                    <ul className="grid gap-2">
                      {roomConsumables.map((item) => {
                        const placement = restockPlacement(item, household, now);
                        return (
                        <li key={item.id} className="rounded-2xl bg-card px-4 py-3 text-sm">
                          <p className="font-medium">
                            <ItemName name={item.itemName} sizeSpec={item.sizeSpec} />
                          </p>
                          <p className="mt-0.5 ui-caption text-muted-foreground">
                            {placement.bucket === "ordered" && item.expectedArrivalDate
                              ? t("home.arrivingApprox", { date: item.expectedArrivalDate })
                              : t("home.onHandLead", { onHand: item.onHand, lead: item.leadTimeDays })}
                          </p>
                          {placement.bucket === "order_now" ? (
                            <div className="mt-2">
                              <RestockOrderButton
                                item={item}
                                household={household}
                                {...restockButtonProps(item, restock)}
                              />
                            </div>
                          ) : null}
                        </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}
                <section>
                  <h3 className="mb-2 ui-caption font-medium text-muted-foreground">{t("map.assets")}</h3>
                  {roomAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("map.noAssets")}</p>
                  ) : (
                    <ul className="mb-3 grid gap-2">
                      {roomAssets.map((asset) => {
                        const badge = warrantyBadgeLabel(asset, now);
                        return (
                        <li key={asset.id} className="rounded-2xl bg-card px-4 py-3 text-sm">
                          <p className="font-medium">{asset.name}</p>
                          <p className="mt-0.5 ui-caption text-muted-foreground">
                            {assetLabel(asset.type)}
                            {badge ? ` · ${badge}` : ""}
                          </p>
                        </li>
                        );
                      })}
                    </ul>
                  )}
                  {onChangeTree ? (
                    <div className="mt-2 grid gap-2">
                      <Select value={assetType} onValueChange={(value) => setAssetType(value as AssetType)}>
                        <SelectTrigger className="h-11 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSET_TYPES.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {assetLabel(item.id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Input
                          value={assetName}
                          onChange={(event) => setAssetName(event.target.value)}
                          placeholder={t("home.optionalName")}
                          className="h-11"
                        />
                        <Button type="button" variant="secondary" className="h-11 shrink-0" onClick={addAsset}>
                          {t("common.add")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </section>
                {hints.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("map.suggestedReorder", {
                      names: hints.map((item) => item.itemName).join(", "),
                    })}
                  </p>
                ) : null}
                <Button
                  variant="secondary"
                  className="h-11 w-full"
                  onClick={() => createGuard.tryOpen(() => setCreating(true))}
                >
                  <Plus className="size-4" />
                  {t("map.addChoreIn", { room: selectedRoom.name })}
                </Button>
              </div>
            ) : (
              <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                {t("map.roomGone")}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DutyForm
        open={creating || Boolean(editing)}
        duty={editing}
        household={household}
        defaultRoom={selected ?? household.rooms.find((room) => !room.system)?.id ?? "kitchen"}
        supplyAutomation={
          editing
            ? household.supplyAutomations.find(
                (item) => item.dutyId === editing.id || item.linkedDutyIds.includes(editing.id),
              )
            : null
        }
        onOpenChange={(openSheet) => {
          if (!openSheet) {
            createGuard.markClosed();
            setCreating(false);
            setEditing(null);
          }
        }}
        onSave={onSaveDuty}
        onDelete={onDeleteDuty}
        {...restock}
      />
    </>
  );
}
