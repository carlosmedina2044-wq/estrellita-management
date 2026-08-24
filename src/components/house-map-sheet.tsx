"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { DutyForm } from "@/components/duty-form";
import { DutyRow } from "@/components/duty-row";
import { HomeMapView } from "@/components/home-map-view";
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
import { ASSET_TYPES, reorderRooms, roomById } from "@/lib/home-model";
import { useSheetOpenGuard } from "@/lib/sheet-guard";
import { AmazonOrderButton } from "@/components/amazon-order-button";
import { lifespanLabel } from "@/lib/supply";
import type { AssetType, Audience, Duty, DutyDraft, Household } from "@/lib/types";

export function HouseMapSheet({
  open,
  household,
  now,
  filter,
  onOpenChange,
  onToggle,
  onSaveDuty,
  onDeleteDuty,
  onReorderRooms,
  onChangeTree,
  initialSelected,
  onMarkOrdered,
}: {
  open: boolean;
  household: Household;
  now: Date;
  filter: Audience | "all";
  onOpenChange: (open: boolean) => void;
  onToggle: (duty: Duty, completed: boolean) => void;
  onSaveDuty: (duty: DutyDraft) => void;
  onDeleteDuty: (id: string) => void;
  onReorderRooms?: (rooms: Household["rooms"]) => void;
  onChangeTree?: (next: Household) => void;
  initialSelected?: string | null;
  onMarkOrdered?: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(initialSelected ?? null);
  const [editing, setEditing] = useState<Duty | null>(null);
  const [creating, setCreating] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("other");
  const createGuard = useSheetOpenGuard();

  useEffect(() => {
    if (open) setSelected(initialSelected ?? null);
  }, [open, initialSelected]);

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
    const name = assetName.trim() || ASSET_TYPES.find((item) => item.id === type)?.label || "Asset";
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
      toast.message(`Suggestion: ${suggestion.itemName}`, { description: suggestion.hint });
    } else {
      toast.success("Asset added");
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
            <SheetTitle>House</SheetTitle>
          </SheetHeader>
          <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-5 px-4 pb-4">
            {selectedRoom ? (
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  className="self-start text-[15px] font-medium text-primary"
                  onClick={() => setSelected(null)}
                >
                  Map
                </button>
                <div>
                  <h2 className="ui-heading text-[28px] font-semibold">{selectedRoom.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {roomOpen.length === 0 ? "All clear" : `${roomOpen.length} open`}
                  </p>
                </div>
                {roomOpen.length === 0 && roomDone.length === 0 && roomUpcoming.length === 0 ? (
                  <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                    No jobs in this room yet.
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
                    <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">Consumables</h3>
                    <ul className="grid gap-2">
                      {roomConsumables.map((item) => (
                        <li key={item.id} className="rounded-2xl bg-white px-4 py-3 text-sm">
                          <p className="font-medium">{item.itemName}</p>
                          <p className="mt-0.5 text-[13px] text-muted-foreground">
                            {item.orderInFlight && item.expectedArrivalDate
                              ? `Ordered · arriving ${item.expectedArrivalDate}`
                              : `Need by ${item.orderByDate} · lasts ${lifespanLabel(item.lifespanValue, item.lifespanUnit)}`}
                          </p>
                          {onMarkOrdered ? (
                            <div className="mt-2">
                              <AmazonOrderButton item={item} onOrdered={() => onMarkOrdered(item.id)} />
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                <section>
                  <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">Assets</h3>
                  {roomAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No appliances or units tagged yet.</p>
                  ) : (
                    <ul className="mb-3 grid gap-2">
                      {roomAssets.map((asset) => (
                        <li key={asset.id} className="rounded-2xl bg-white px-4 py-3 text-sm">
                          <p className="font-medium">{asset.name}</p>
                          <p className="mt-0.5 text-[13px] text-muted-foreground">
                            {ASSET_TYPES.find((item) => item.id === asset.type)?.label ?? asset.type}
                          </p>
                        </li>
                      ))}
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
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Input
                          value={assetName}
                          onChange={(event) => setAssetName(event.target.value)}
                          placeholder="Optional name"
                          className="h-11"
                        />
                        <Button type="button" variant="secondary" className="h-11 shrink-0" onClick={addAsset}>
                          Add
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </section>
                {hints.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Suggested reorder: {hints.map((item) => item.itemName).join(", ")}
                  </p>
                ) : null}
                <Button
                  variant="secondary"
                  className="h-11 w-full"
                  onClick={() => createGuard.tryOpen(() => setCreating(true))}
                >
                  <Plus className="size-4" />
                  Add a duty in {selectedRoom.name}
                </Button>
              </div>
            ) : (
              <HomeMapView
                household={household}
                now={now}
                selectedId={selected}
                onSelectRoom={setSelected}
                onReorder={
                  onReorderRooms
                    ? (floorId, ids) => onReorderRooms(reorderRooms(household.rooms, floorId, ids))
                    : undefined
                }
              />
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
          editing ? household.supplyAutomations.find((item) => item.dutyId === editing.id) : null
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
        onMarkOrdered={onMarkOrdered}
      />
    </>
  );
}
