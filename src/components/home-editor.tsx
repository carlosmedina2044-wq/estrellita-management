"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { suggestionsForAsset, suggestionsForRoom } from "@/lib/catalog";
import { warrantyBadgeLabel, warrantyFromInstall } from "@/lib/warranty";
import {
  ASSET_TYPES,
  defaultRoomName,
  deleteRoomFromHousehold,
  floorsInOrder,
  nextSortOrder,
  ROOM_TYPES,
  roomsOnFloor,
  userRooms,
} from "@/lib/home-model";
import type { AssetType, HomeFloor, Household, RoomType } from "@/lib/types";

export function HomeEditor({
  household,
  onChange,
  focusAssetId,
  onFocusHandled,
}: {
  household: Household;
  onChange: (next: Household) => void;
  focusAssetId?: string;
  onFocusHandled?: () => void;
}) {
  const [floorName, setFloorName] = useState("");
  const [roomType, setRoomType] = useState<RoomType>("bedroom");
  const [roomFloor, setRoomFloor] = useState(household.floors[0]?.id ?? "");
  const [roomName, setRoomName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [assetRoom, setAssetRoom] = useState(household.rooms[0]?.id ?? "");
  const [assetType, setAssetType] = useState<AssetType>("other");
  const [assetName, setAssetName] = useState("");
  const [assetInstall, setAssetInstall] = useState("");
  const [assetWarranty, setAssetWarranty] = useState("");
  const roomHints = suggestionsForRoom(roomType);
  const assetHints = suggestionsForAsset(assetType);

  useEffect(() => {
    if (!focusAssetId) return;
    document.getElementById(`home-asset-${focusAssetId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    onFocusHandled?.();
  }, [focusAssetId, onFocusHandled]);

  const floors = floorsInOrder(household);

  function addFloor() {
    const name = floorName.trim() || `Floor ${household.floors.length + 1}`;
    const floor: HomeFloor = {
      id: crypto.randomUUID(),
      name,
      sortOrder: nextSortOrder(household.floors),
    };
    onChange({ ...household, floors: [...household.floors, floor] });
    setFloorName("");
    setRoomFloor(floor.id);
    toast.success("Floor added");
  }

  function addRoom() {
    if (!roomFloor) {
      toast.error("Add a floor first");
      return;
    }
    const name = roomName.trim() || defaultRoomName(roomType, household.rooms);
    onChange({
      ...household,
      rooms: [
        ...household.rooms,
        {
          id: crypto.randomUUID(),
          floorId: roomFloor,
          name,
          type: roomType,
          sortOrder: nextSortOrder(household.rooms),
        },
      ],
    });
    setRoomName("");
    const hints = suggestionsForRoom(roomType);
    if (hints[0]) toast.message(`Suggestion: ${hints[0].itemName}`, { description: hints[0].hint });
  }

  function confirmDelete() {
    if (!deleteId) return;
    const room = household.rooms.find((item) => item.id === deleteId);
    if (!room) return;
    const hasWork =
      household.duties.some((duty) => duty.room === deleteId) ||
      household.supplyAutomations.some((item) => item.room === deleteId);
    if (hasWork && !reassignTo) {
      toast.error("Reassign this room’s jobs, or they will be deleted.");
    }
    onChange(
      deleteRoomFromHousehold(
        household,
        deleteId,
        hasWork && reassignTo ? { action: "reassign", toRoomId: reassignTo } : { action: "delete" },
      ),
    );
    setDeleteId(null);
    setReassignTo("");
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="font-medium">Floors and rooms</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Whole Home and Exterior stay on the map. Delete a room only after you reassign or drop its
          jobs.
        </p>
      </div>

      {floors.map((floor) => (
        <section key={floor.id} className="rounded-2xl bg-white p-4">
          <Input
            value={floor.name}
            onChange={(event) =>
              onChange({
                ...household,
                floors: household.floors.map((item) =>
                  item.id === floor.id ? { ...item, name: event.target.value } : item,
                ),
              })
            }
            className="h-11 font-medium"
          />
          <div className="mt-3 grid gap-2">
            {roomsOnFloor(household, floor.id).map((room) => (
              <div key={room.id} className="flex items-center gap-2">
                <Input
                  value={room.name}
                  onChange={(event) =>
                    onChange({
                      ...household,
                      rooms: household.rooms.map((item) =>
                        item.id === room.id ? { ...item, name: event.target.value } : item,
                      ),
                    })
                  }
                  className="h-11"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 shrink-0"
                  onClick={() => {
                    setDeleteId(room.id);
                    setReassignTo(userRooms(household).find((item) => item.id !== room.id)?.id ?? "");
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="grid gap-2">
        <Label className="text-xs font-medium text-muted-foreground">Add a floor</Label>
        <div className="flex gap-2">
          <Input
            value={floorName}
            onChange={(event) => setFloorName(event.target.value)}
            placeholder="Basement"
            className="h-11"
          />
          <Button type="button" variant="secondary" className="h-11" onClick={addFloor}>
            Add
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label className="text-xs font-medium text-muted-foreground">Add a room</Label>
        <Select value={roomFloor} onValueChange={setRoomFloor}>
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Floor" />
          </SelectTrigger>
          <SelectContent>
            {floors.map((floor) => (
              <SelectItem key={floor.id} value={floor.id}>
                {floor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roomType} onValueChange={(value) => setRoomType(value as RoomType)}>
          <SelectTrigger className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROOM_TYPES.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={roomName}
          onChange={(event) => setRoomName(event.target.value)}
          placeholder="Optional name"
          className="h-11"
        />
        {roomHints.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Suggested items: {roomHints.map((item) => item.itemName).join(", ")}
          </p>
        ) : null}
        <Button type="button" className="h-11" onClick={addRoom}>
          Add room
        </Button>
      </div>

      <div className="grid gap-2">
        <Label className="text-xs font-medium text-muted-foreground">Add an asset</Label>
        <Select value={assetRoom} onValueChange={setAssetRoom}>
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Room" />
          </SelectTrigger>
          <SelectContent>
            {household.rooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                {room.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Input
          value={assetName}
          onChange={(event) => setAssetName(event.target.value)}
          placeholder="Optional name"
          className="h-11"
        />
        <div className="grid gap-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Install date</Label>
          <Input
            type="date"
            value={assetInstall}
            onChange={(event) => setAssetInstall(event.target.value)}
            className="h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Warranty until</Label>
          <Input
            type="date"
            value={assetWarranty}
            onChange={(event) => setAssetWarranty(event.target.value)}
            className="h-11"
          />
          {assetInstall ? (
            <div className="flex flex-wrap gap-1.5">
              {([1, 2, 5, 10] as const).map((years) => (
                <button
                  key={years}
                  type="button"
                  className="h-8 rounded-full bg-secondary px-3 text-[13px] font-medium"
                  onClick={() => setAssetWarranty(warrantyFromInstall(assetInstall, years))}
                >
                  +{years} yr
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {assetHints.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Suggested items: {assetHints.map((item) => item.itemName).join(", ")}
          </p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="h-11"
          onClick={() => {
            if (!assetRoom) {
              toast.error("Pick a room first");
              return;
            }
            const name =
              assetName.trim() || ASSET_TYPES.find((item) => item.id === assetType)?.label || "Asset";
            onChange({
              ...household,
              assets: [
                ...household.assets,
                {
                  id: crypto.randomUUID(),
                  roomId: assetRoom,
                  name,
                  type: assetType,
                  installDate: assetInstall || undefined,
                  warrantyUntil: assetWarranty || undefined,
                },
              ],
            });
            setAssetName("");
            setAssetInstall("");
            setAssetWarranty("");
            if (assetHints[0]) {
              toast.message(`Suggestion: ${assetHints[0].itemName}`, { description: assetHints[0].hint });
            } else {
              toast.success("Asset added");
            }
          }}
        >
          Add asset
        </Button>
      </div>

      {household.assets.length > 0 ? (
        <div className="grid gap-3">
          <p className="font-medium">Assets</p>
          {household.assets.map((asset) => {
            const badge = warrantyBadgeLabel(asset);
            const room = household.rooms.find((item) => item.id === asset.roomId);
            return (
              <section key={asset.id} id={`home-asset-${asset.id}`} className="rounded-2xl bg-white p-4">
                <p className="font-medium">{asset.name}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {room?.name ?? "Home"}
                  {badge ? ` · ${badge}` : ""}
                </p>
                <div className="mt-3 grid gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">Install date</Label>
                  <Input
                    type="date"
                    value={asset.installDate ?? ""}
                    onChange={(event) =>
                      onChange({
                        ...household,
                        assets: household.assets.map((item) =>
                          item.id === asset.id ? { ...item, installDate: event.target.value || undefined } : item,
                        ),
                      })
                    }
                    className="h-11"
                  />
                  <Label className="text-xs font-medium text-muted-foreground">Warranty until</Label>
                  <Input
                    type="date"
                    value={asset.warrantyUntil ?? ""}
                    onChange={(event) =>
                      onChange({
                        ...household,
                        assets: household.assets.map((item) =>
                          item.id === asset.id ? { ...item, warrantyUntil: event.target.value || undefined } : item,
                        ),
                      })
                    }
                    className="h-11"
                  />
                  {asset.installDate ? (
                    <div className="flex flex-wrap gap-1.5">
                      {([1, 2, 5, 10] as const).map((years) => (
                        <button
                          key={years}
                          type="button"
                          className="h-8 rounded-full bg-secondary px-3 text-[13px] font-medium"
                          onClick={() =>
                            onChange({
                              ...household,
                              assets: household.assets.map((item) =>
                                item.id === asset.id
                                  ? { ...item, warrantyUntil: warrantyFromInstall(asset.installDate!, years) }
                                  : item,
                              ),
                            })
                          }
                        >
                          +{years} yr
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {deleteId ? (
        <div className="rounded-2xl bg-accent p-4">
          <p className="font-medium">Delete this room?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reassign its duties and reorders, or delete them with the room.
          </p>
          <Select value={reassignTo} onValueChange={setReassignTo}>
            <SelectTrigger className="mt-3 h-11 w-full">
              <SelectValue placeholder="Move jobs to…" />
            </SelectTrigger>
            <SelectContent>
              {userRooms(household)
                .filter((room) => room.id !== deleteId)
                .map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="secondary" className="h-11 flex-1" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" className="h-11 flex-1" onClick={confirmDelete}>
              Confirm
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
