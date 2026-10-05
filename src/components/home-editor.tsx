"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  INLINE_INPUT,
  SelectRow,
  SettingsGroup,
  SettingsRow,
  SettingsSection,
  TextRow,
} from "@/components/settings-rows";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { suggestionsForAsset, suggestionsForRoom } from "@/lib/catalog";
import { scrollBehavior } from "@/lib/motion";
import { warrantyBadgeLabel, warrantyFromInstall } from "@/lib/warranty";
import {
  ASSET_TYPES,
  defaultRoomName,
  deleteRoomFromHousehold,
  floorsInOrder,
  nextSortOrder,
  ROOM_TYPES,
  roomHasAssignedWork,
  roomsOnFloor,
  userRooms,
} from "@/lib/home-model";
import { assetLabel, catalogLabel } from "@/lib/asset-catalog";
import type { AssetType, HomeFloor, Household, RoomType } from "@/lib/types";

/** A date sits in its own tonal field so an empty one is still a visible, tappable target. */
const DATE_FIELD = "h-11 rounded-lg bg-secondary px-3 text-left ui-body dark:bg-secondary";

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
  const { t } = useLocale();
  const [floorName, setFloorName] = useState("");
  const [roomType, setRoomType] = useState<RoomType>("bedroom");
  const [roomFloor, setRoomFloor] = useState(household.floors[0]?.id ?? "");
  const [roomName, setRoomName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [editingRooms, setEditingRooms] = useState(false);
  const [assetRoom, setAssetRoom] = useState(household.rooms[0]?.id ?? "");
  const [assetType, setAssetType] = useState<AssetType>("other");
  const [assetName, setAssetName] = useState("");
  const [assetInstall, setAssetInstall] = useState("");
  const [assetWarranty, setAssetWarranty] = useState("");
  const roomHints = suggestionsForRoom(roomType);
  const assetHints = suggestionsForAsset(assetType);
  const changeTimer = useRef<number | null>(null);
  const pendingHousehold = useRef<Household | null>(null);

  // A restore (or an undo of one) swaps the whole tree under this screen, and
  // these two ids were seeded once at mount. Left alone, "Add room" could
  // attach a room to a floor id that no longer exists. Re-point them at the
  // current tree during render whenever the id they hold has gone.
  if (!household.floors.some((floor) => floor.id === roomFloor)) {
    const nextFloor = household.floors[0]?.id ?? "";
    if (nextFloor !== roomFloor) setRoomFloor(nextFloor);
  }
  if (!household.rooms.some((room) => room.id === assetRoom)) {
    const nextRoom = household.rooms[0]?.id ?? "";
    if (nextRoom !== assetRoom) setAssetRoom(nextRoom);
  }

  useEffect(() => {
    if (!focusAssetId) return;
    document.getElementById(`home-asset-${focusAssetId}`)?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
    onFocusHandled?.();
  }, [focusAssetId, onFocusHandled]);

  useEffect(() => {
    return () => {
      if (changeTimer.current != null) window.clearTimeout(changeTimer.current);
      const pending = pendingHousehold.current;
      pendingHousehold.current = null;
      if (pending) onChange(pending);
    };
    // Flush only on unmount; onChange identity is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional unmount flush
  }, []);

  function takePending(): Household {
    if (changeTimer.current != null) {
      window.clearTimeout(changeTimer.current);
      changeTimer.current = null;
    }
    const pending = pendingHousehold.current;
    pendingHousehold.current = null;
    return pending ?? household;
  }

  function scheduleChange(build: (current: Household) => Household) {
    const next = build(pendingHousehold.current ?? household);
    pendingHousehold.current = next;
    if (changeTimer.current != null) window.clearTimeout(changeTimer.current);
    changeTimer.current = window.setTimeout(() => {
      const pending = pendingHousehold.current;
      pendingHousehold.current = null;
      changeTimer.current = null;
      if (pending) onChange(pending);
    }, 300);
  }

  function flushChange(build?: (current: Household) => Household) {
    const current = takePending();
    onChange(build ? build(current) : current);
  }

  const floors = floorsInOrder(household);

  function addFloor() {
    const current = takePending();
    const name = floorName.trim() || t("home.floorN", { n: current.floors.length + 1 });
    const floor: HomeFloor = {
      id: crypto.randomUUID(),
      name,
      sortOrder: nextSortOrder(current.floors),
    };
    onChange({ ...current, floors: [...current.floors, floor] });
    setFloorName("");
    setRoomFloor(floor.id);
    toast.success(t("home.floorAdded"));
  }

  function addRoom() {
    if (!roomFloor) {
      toast.error(t("home.addFloorFirst"));
      return;
    }
    const current = takePending();
    const name = roomName.trim() || defaultRoomName(roomType, current.rooms);
    onChange({
      ...current,
      rooms: [
        ...current.rooms,
        {
          id: crypto.randomUUID(),
          floorId: roomFloor,
          name,
          type: roomType,
          sortOrder: nextSortOrder(current.rooms),
        },
      ],
    });
    setRoomName("");
    const hints = suggestionsForRoom(roomType);
    if (hints[0]) toast.message(t("home.suggestion", { name: hints[0].itemName }), { description: hints[0].hint });
  }

  function confirmDelete() {
    if (!deleteId) return;
    const current = takePending();
    const room = current.rooms.find((item) => item.id === deleteId);
    if (!room) return;
    const hasWork = roomHasAssignedWork(current, deleteId);
    if (hasWork && !reassignTo) {
      toast.error(t("home.reassignJobs"));
      return;
    }
    onChange(
      deleteRoomFromHousehold(
        current,
        deleteId,
        hasWork && reassignTo ? { action: "reassign", toRoomId: reassignTo } : { action: "delete" },
      ),
    );
    setDeleteId(null);
    setReassignTo("");
  }

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection
        title={
          <span className="flex items-center justify-between gap-3">
            <span>{t("home.floorsAndRooms")}</span>
            <button
              type="button"
              className="-my-3 inline-flex h-11 shrink-0 items-center px-1 ui-caption font-semibold text-primary"
              onClick={() => {
                setEditingRooms((current) => !current);
                setDeleteId(null);
              }}
            >
              {editingRooms ? t("common.done") : t("common.edit")}
            </button>
          </span>
        }
        footer={t("home.floorsAndRoomsBody")}
      >
        {floors.map((floor) => (
          <SettingsGroup key={floor.id}>
            <div className="ui-group-row flex items-center px-4 py-1">
              <DebouncedTextInput
                value={floor.name}
                onSchedule={(value) =>
                  scheduleChange((current) => ({
                    ...current,
                    floors: current.floors.map((item) =>
                      item.id === floor.id ? { ...item, name: value } : item,
                    ),
                  }))
                }
                onFlush={() => flushChange()}
                className={`${ROW_INPUT} font-semibold`}
              />
            </div>
            {roomsOnFloor(household, floor.id).map((room) => (
              <div key={room.id} className="ui-group-row">
                <div className="flex items-center gap-2 px-4 py-1">
                  <DebouncedTextInput
                    value={room.name}
                    onSchedule={(value) =>
                      scheduleChange((current) => ({
                        ...current,
                        rooms: current.rooms.map((item) =>
                          item.id === room.id ? { ...item, name: value } : item,
                        ),
                      }))
                    }
                    onFlush={() => flushChange()}
                    className={ROW_INPUT}
                  />
                  {editingRooms ? (
                    <button
                      type="button"
                      className="inline-flex h-11 shrink-0 items-center px-1 ui-body font-medium text-destructive"
                      onClick={() => {
                        setDeleteId(room.id);
                        setReassignTo(userRooms(household).find((item) => item.id !== room.id)?.id ?? "");
                      }}
                    >
                      {t("home.delete")}
                    </button>
                  ) : null}
                </div>
                {deleteId === room.id ? (
                  <div className="px-4 pb-3">
                    <p className="ui-body font-medium">{t("home.deleteRoomTitle")}</p>
                    <p className="mt-0.5 ui-caption text-muted-foreground">{t("home.deleteRoomBody")}</p>
                    <Select value={reassignTo} onValueChange={setReassignTo}>
                      <SelectTrigger className="mt-2 h-11 w-full">
                        <SelectValue placeholder={t("home.moveJobsTo")} />
                      </SelectTrigger>
                      <SelectContent>
                        {userRooms(household)
                          .filter((item) => item.id !== deleteId)
                          .map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="secondary" className="h-11 flex-1" onClick={() => setDeleteId(null)}>
                        {t("common.cancel")}
                      </Button>
                      <Button type="button" variant="destructive" className="h-11 flex-1" onClick={confirmDelete}>
                        {t("home.confirm")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </SettingsGroup>
        ))}

        <SettingsGroup>
          <label className="ui-group-row flex items-center gap-3 px-4 py-1">
            <span className="max-w-[40%] shrink-0 ui-body font-medium">{t("home.addFloor")}</span>
            <Input
              value={floorName}
              onChange={(event) => setFloorName(event.target.value)}
              placeholder={t("home.basementPlaceholder")}
              className={`${INLINE_INPUT} min-w-0 flex-1`}
            />
            <button
              type="button"
              className="inline-flex h-11 shrink-0 items-center px-1 ui-body font-semibold text-primary"
              onClick={addFloor}
            >
              {t("home.add")}
            </button>
          </label>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        title={t("home.addARoom")}
        footer={
          roomHints.length > 0
            ? t("home.suggestedItems", { list: roomHints.map((item) => item.itemName).join(", ") })
            : null
        }
      >
        <SettingsGroup>
          <SelectRow
            label={t("home.floorPlaceholder")}
            value={roomFloor}
            display={floors.find((floor) => floor.id === roomFloor)?.name ?? t("home.floorPlaceholder")}
            onValueChange={setRoomFloor}
          >
            <SelectContent>
              {floors.map((floor) => (
                <SelectItem key={floor.id} value={floor.id}>
                  {floor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRow>
          <SelectRow
            label={t("home.roomType")}
            value={roomType}
            display={ROOM_TYPES.find((item) => item.id === roomType)?.label ?? ""}
            onValueChange={(value) => setRoomType(value as RoomType)}
          >
            <SelectContent>
              {ROOM_TYPES.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRow>
          <TextRow label={t("home.optionalName")}>
            <Input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              className={INLINE_INPUT}
            />
          </TextRow>
          <SettingsRow>
            <Button type="button" className="h-11 w-full" onClick={addRoom}>
              {t("home.addRoomCta")}
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        title={t("home.addAnAsset")}
        footer={
          assetHints.length > 0
            ? t("home.suggestedItems", { list: assetHints.map((item) => item.itemName).join(", ") })
            : null
        }
      >
        <SettingsGroup>
          <SelectRow
            label={t("home.roomPlaceholder")}
            value={assetRoom}
            display={household.rooms.find((room) => room.id === assetRoom)?.name ?? t("home.roomPlaceholder")}
            onValueChange={setAssetRoom}
          >
            <SelectContent>
              {household.rooms.map((room) => (
                <SelectItem key={room.id} value={room.id}>
                  {room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRow>
          <SelectRow
            label={t("home.applianceType")}
            value={assetType}
            display={assetLabel(assetType)}
            onValueChange={(value) => setAssetType(value as AssetType)}
          >
            <SelectContent>
              {ASSET_TYPES.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {assetLabel(item.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRow>
          <TextRow label={t("home.optionalName")}>
            <Input
              value={assetName}
              onChange={(event) => setAssetName(event.target.value)}
              className={INLINE_INPUT}
            />
          </TextRow>
          <TextRow label={t("home.installDate")}>
            <Input
              type="date"
              value={assetInstall}
              onChange={(event) => setAssetInstall(event.target.value)}
              className={DATE_FIELD}
            />
          </TextRow>
          <TextRow label={t("home.warrantyUntil")}>
            <Input
              type="date"
              value={assetWarranty}
              onChange={(event) => setAssetWarranty(event.target.value)}
              className={DATE_FIELD}
            />
          </TextRow>
          {assetInstall ? (
            <SettingsRow>
              <WarrantyChips onPick={(years) => setAssetWarranty(warrantyFromInstall(assetInstall, years))} />
            </SettingsRow>
          ) : null}
          <SettingsRow>
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-full"
              onClick={() => {
                if (!assetRoom) {
                  toast.error(t("home.pickRoomFirst"));
                  return;
                }
                const current = takePending();
                const name =
                  assetName.trim() || catalogLabel(assetType) || t("home.assetFallback");
                onChange({
                  ...current,
                  assets: [
                    ...current.assets,
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
                  toast.message(t("home.suggestion", { name: assetHints[0].itemName }), { description: assetHints[0].hint });
                } else {
                  toast.success(t("home.assetAdded"));
                }
              }}
            >
              {t("home.addAssetCta")}
            </Button>
          </SettingsRow>
        </SettingsGroup>
      </SettingsSection>

      {household.assets.length > 0 ? (
        <SettingsSection title={t("home.assets")}>
          {household.assets.map((asset) => {
            const badge = warrantyBadgeLabel(asset);
            const room = household.rooms.find((item) => item.id === asset.roomId);
            return (
              <SettingsGroup key={asset.id} className="scroll-mt-24">
                <div id={`home-asset-${asset.id}`} className="ui-group-row px-4 py-3">
                  <p className="ui-body font-medium">{asset.name}</p>
                  <p className="mt-0.5 ui-caption text-muted-foreground">
                    {room?.name ?? t("home.homeFallback")}
                    {badge ? ` · ${badge}` : ""}
                  </p>
                </div>
                <TextRow label={t("home.installDate")}>
                  <Input
                    type="date"
                    value={asset.installDate ?? ""}
                    onChange={(event) => {
                      const value = event.target.value || undefined;
                      scheduleChange((current) => ({
                        ...current,
                        assets: current.assets.map((item) =>
                          item.id === asset.id ? { ...item, installDate: value } : item,
                        ),
                      }));
                    }}
                    onBlur={() => flushChange()}
                    className={DATE_FIELD}
                  />
                </TextRow>
                <TextRow label={t("home.warrantyUntil")}>
                  <Input
                    type="date"
                    value={asset.warrantyUntil ?? ""}
                    onChange={(event) => {
                      const value = event.target.value || undefined;
                      scheduleChange((current) => ({
                        ...current,
                        assets: current.assets.map((item) =>
                          item.id === asset.id ? { ...item, warrantyUntil: value } : item,
                        ),
                      }));
                    }}
                    onBlur={() => flushChange()}
                    className={DATE_FIELD}
                  />
                </TextRow>
                {asset.installDate ? (
                  <SettingsRow>
                    <WarrantyChips
                      onPick={(years) =>
                        flushChange((current) => ({
                          ...current,
                          assets: current.assets.map((item) =>
                            item.id === asset.id
                              ? { ...item, warrantyUntil: warrantyFromInstall(asset.installDate!, years) }
                              : item,
                          ),
                        }))
                      }
                    />
                  </SettingsRow>
                ) : null}
              </SettingsGroup>
            );
          })}
        </SettingsSection>
      ) : null}
    </div>
  );
}

const ROW_INPUT = "h-11 min-w-0 flex-1 bg-transparent px-0 ui-body dark:bg-transparent";

function WarrantyChips({ onPick }: { onPick: (years: 1 | 2 | 5 | 10) => void }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap gap-1.5">
      {([1, 2, 5, 10] as const).map((years) => (
        <button
          key={years}
          type="button"
          className="h-11 rounded-full bg-secondary px-3 ui-caption font-medium"
          onClick={() => onPick(years)}
        >
          {t("home.yearsShort", { n: years })}
        </button>
      ))}
    </div>
  );
}

/** Local draft so typing stays responsive while parent persist is debounced. */
function DebouncedTextInput({
  value,
  onSchedule,
  onFlush,
  className,
}: {
  value: string;
  onSchedule: (value: string) => void;
  onFlush: () => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  return (
    <Input
      value={draft}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        onSchedule(next);
      }}
      onBlur={onFlush}
      className={className}
    />
  );
}
