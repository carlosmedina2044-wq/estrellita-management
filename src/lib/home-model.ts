import { HOUSE_ROOMS, HOUSE_STARTERS } from "@/lib/house";
import { catalogLabel, CANONICAL_ASSET_TYPES } from "@/lib/asset-catalog";
import type {
  AssetType,
  HomeAsset,
  HomeFloor,
  HomeRoom,
  Household,
  NodeType,
  RoomType,
  SystemRoomKind,
} from "@/lib/types";

export const ROOM_TYPES: { id: RoomType; label: string; common?: boolean }[] = [
  { id: "kitchen", label: "Kitchen", common: true },
  { id: "living", label: "Living", common: true },
  { id: "dining", label: "Dining", common: true },
  { id: "primary_bedroom", label: "Primary bedroom", common: true },
  { id: "bedroom", label: "Bedroom", common: true },
  { id: "bathroom", label: "Bathroom", common: true },
  { id: "office", label: "Office" },
  { id: "laundry", label: "Laundry", common: true },
  { id: "garage", label: "Garage" },
  { id: "hallway", label: "Hallway / entry", common: true },
  { id: "closet", label: "Closet" },
  { id: "basement", label: "Basement" },
  { id: "attic", label: "Attic" },
  { id: "patio", label: "Patio / balcony" },
  { id: "other", label: "Other" },
];

export const WHOLE_HOME_ID = "whole-home";
export const EXTERIOR_ID = "exterior";

export const ASSET_TYPES: { id: AssetType; label: string }[] = CANONICAL_ASSET_TYPES.map((id) => ({
  id,
  label: catalogLabel(id),
}));

const EXTERIOR_LEGACY = new Set(["patio", "lawn", "pool", "ramada", "shed"]);

const ROOM_TYPE_BY_LEGACY: Record<string, RoomType> = {
  entry: "hallway",
  "family-room": "living",
  "dining-room": "dining",
  kitchen: "kitchen",
  nook: "other",
  "living-room": "living",
  "guest-room": "bedroom",
  "downstairs-bath": "bathroom",
  laundry: "laundry",
  garage: "garage",
  patio: "other",
  "main-bedroom": "primary_bedroom",
  "main-bath": "bathroom",
  "carlos-office": "office",
  "adriana-office": "bedroom",
  "elliotts-room": "bedroom",
  "upstairs-bath": "bathroom",
  "upstairs-hall": "hallway",
  lawn: "other",
  pool: "other",
  ramada: "other",
  shed: "other",
};

export function roomTypeLabel(type: RoomType): string {
  return ROOM_TYPES.find((item) => item.id === type)?.label ?? type;
}

export function isRoomType(value: string): value is RoomType {
  return ROOM_TYPES.some((item) => item.id === value);
}

export function asRoomType(value: string): RoomType {
  return isRoomType(value) ? value : "other";
}

export function systemRooms(names?: { wholeHome?: string; exterior?: string }): HomeRoom[] {
  return [
    {
      id: WHOLE_HOME_ID,
      floorId: null,
      name: names?.wholeHome ?? "Whole Home",
      type: "other",
      sortOrder: 0,
      system: "whole-home",
    },
    {
      id: EXTERIOR_ID,
      floorId: null,
      name: names?.exterior ?? "Exterior",
      type: "patio",
      sortOrder: 1,
      system: "exterior",
    },
  ];
}

export function emptyHomeTree(homeName = "Home"): Pick<Household, "homeId" | "floors" | "rooms" | "assets"> {
  return {
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: systemRooms(),
    assets: [],
  };
}

export function appraisalHomeTree(): Pick<Household, "homeId" | "floors" | "rooms" | "assets"> {
  const floors: HomeFloor[] = [
    { id: "downstairs", name: "Downstairs", sortOrder: 0 },
    { id: "upstairs", name: "Upstairs", sortOrder: 1 },
    { id: "outside", name: "Yard", sortOrder: 2 },
  ];
  const rooms: HomeRoom[] = [
    ...systemRooms(),
    ...HOUSE_ROOMS.map((room, index) => ({
      id: room.id,
      floorId: room.floor,
      name: room.label,
      type: ROOM_TYPE_BY_LEGACY[room.id] ?? "other",
      sortOrder: index + 2,
    })),
  ];
  return { homeId: "home", floors, rooms, assets: [] };
}

export function ensureHomeTree<T extends Pick<Household, "floors" | "rooms" | "assets" | "homeId" | "householdName" | "duties" | "supplyAutomations">>(
  household: T,
): T {
  const hasTree = household.floors.length > 0 && household.rooms.some((room) => room.system);
  if (hasTree) {
    return ensureSystemRooms(household);
  }
  const seeded = household.duties.length > 0 || household.rooms.length === 0 ? appraisalHomeTree() : emptyHomeTree(household.householdName);
  const rooms = seeded.rooms;
  const duties = household.duties.map((duty) => {
    const nodeId = duty.nodeId || duty.room;
    const nodeType: NodeType = duty.nodeType || "room";
    return { ...duty, nodeId, nodeType, room: resolveRoomId(rooms, household.assets, nodeId, nodeType, duty.room) };
  });
  const supplyAutomations = household.supplyAutomations.map((item) => {
    const nodeId = item.nodeId || item.room;
    const nodeType: NodeType = item.nodeType || "room";
    return { ...item, nodeId, nodeType, room: resolveRoomId(rooms, household.assets, nodeId, nodeType, item.room) };
  });
  return {
    ...household,
    homeId: household.homeId || seeded.homeId,
    floors: seeded.floors,
    rooms,
    assets: household.assets.length ? household.assets : seeded.assets,
    duties,
    supplyAutomations,
  };
}

function ensureSystemRooms<T extends Pick<Household, "rooms">>(household: T): T {
  const missing = systemRooms().filter((room) => !household.rooms.some((item) => item.system === room.system));
  if (missing.length === 0) return household;
  return { ...household, rooms: [...missing, ...household.rooms] };
}

export function resolveRoomId(
  rooms: HomeRoom[],
  assets: HomeAsset[],
  nodeId: string,
  nodeType: NodeType,
  fallback: string,
): string {
  if (nodeType === "room" && rooms.some((room) => room.id === nodeId)) return nodeId;
  if (nodeType === "asset") {
    const asset = assets.find((item) => item.id === nodeId);
    if (asset) return asset.roomId;
  }
  if (nodeType === "home") return WHOLE_HOME_ID;
  if (nodeType === "floor") {
    const first = rooms.find((room) => room.floorId === nodeId);
    return first?.id ?? WHOLE_HOME_ID;
  }
  if (rooms.some((room) => room.id === fallback)) return fallback;
  return rooms[0]?.id ?? WHOLE_HOME_ID;
}

export function roomById(household: Pick<Household, "rooms">, roomId: string): HomeRoom | undefined {
  return household.rooms.find((room) => room.id === roomId);
}

export function roomName(household: Pick<Household, "rooms" | "floors" | "assets">, roomId: string): string {
  return roomById(household, roomId)?.name ?? roomId;
}

export function floorsInOrder(household: Pick<Household, "floors">): HomeFloor[] {
  return [...household.floors].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function roomsOnFloor(household: Pick<Household, "rooms">, floorId: string): HomeRoom[] {
  return household.rooms
    .filter((room) => room.floorId === floorId && !room.system)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function systemRoomList(household: Pick<Household, "rooms">): HomeRoom[] {
  return household.rooms
    .filter((room) => room.system)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function userRooms(household: Pick<Household, "rooms">): HomeRoom[] {
  return household.rooms
    .filter((room) => !room.system)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function isSystemRoom(room: HomeRoom): room is HomeRoom & { system: SystemRoomKind } {
  return Boolean(room.system);
}

export function defaultRoomName(type: RoomType, existing: HomeRoom[]): string {
  const base = roomTypeLabel(type);
  const count = existing.filter((room) => room.type === type && !room.system).length;
  return count === 0 ? base : `${base} ${count + 1}`;
}

export function nextSortOrder(items: { sortOrder: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
}

export function reorderRooms(rooms: HomeRoom[], floorId: string | null, orderedIds: string[]): HomeRoom[] {
  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  return rooms.map((room) =>
    room.floorId === floorId && rank.has(room.id) ? { ...room, sortOrder: rank.get(room.id)! } : room,
  );
}

export function deleteRoomFromHousehold(
  household: Household,
  roomId: string,
  mode: { action: "delete" } | { action: "reassign"; toRoomId: string },
): Household {
  const room = roomById(household, roomId);
  if (!room || room.system) return household;
  const duties =
    mode.action === "delete"
      ? household.duties.filter((duty) => duty.room !== roomId && duty.nodeId !== roomId)
      : household.duties.map((duty) =>
          duty.room === roomId || (duty.nodeType === "room" && duty.nodeId === roomId)
            ? { ...duty, room: mode.toRoomId, nodeId: mode.toRoomId, nodeType: "room" as const }
            : duty,
        );
  const supplyAutomations =
    mode.action === "delete"
      ? household.supplyAutomations.filter((item) => item.room !== roomId && item.nodeId !== roomId)
      : household.supplyAutomations.map((item) =>
          item.room === roomId || (item.nodeType === "room" && item.nodeId === roomId)
            ? { ...item, room: mode.toRoomId, nodeId: mode.toRoomId, nodeType: "room" as const }
            : item,
        );
  return {
    ...household,
    rooms: household.rooms.filter((item) => item.id !== roomId),
    assets: household.assets.filter((item) => item.roomId !== roomId),
    duties,
    supplyAutomations,
    completions:
      mode.action === "delete"
        ? household.completions.filter((item) => duties.some((duty) => duty.id === item.dutyId))
        : household.completions,
  };
}

export type HomeTreeDraft = {
  homeName: string;
  floors: HomeFloor[];
  rooms: HomeRoom[];
};

export function mapStarterRoom(rooms: HomeRoom[], legacyRoom: string): string {
  if (EXTERIOR_LEGACY.has(legacyRoom)) {
    return rooms.find((room) => room.system === "exterior")?.id ?? EXTERIOR_ID;
  }
  const exact = rooms.find((room) => room.id === legacyRoom);
  if (exact) return exact.id;
  if (legacyRoom === "nook") {
    return (
      rooms.find((room) => room.type === "dining" && !room.system)?.id ??
      rooms.find((room) => room.type === "kitchen" && !room.system)?.id ??
      rooms.find((room) => !room.system)?.id ??
      WHOLE_HOME_ID
    );
  }
  const type = ROOM_TYPE_BY_LEGACY[legacyRoom];
  const byType = type ? rooms.find((room) => room.type === type && !room.system) : undefined;
  if (byType) return byType.id;
  if (type === "office") {
    return rooms.find((room) => room.system === "whole-home")?.id ?? WHOLE_HOME_ID;
  }
  return rooms.find((room) => !room.system)?.id ?? WHOLE_HOME_ID;
}

export function startersForTree(rooms: HomeRoom[]) {
  return HOUSE_STARTERS.map((starter) => ({
    ...starter,
    room: mapStarterRoom(rooms, starter.room),
  })).filter((starter, index, all) => all.findIndex((item) => item.title === starter.title && item.room === starter.room) === index);
}

export function treeFromDraft(draft: HomeTreeDraft): Pick<Household, "homeId" | "floors" | "rooms" | "assets"> {
  const rooms = [...systemRooms(), ...draft.rooms.filter((room) => !room.system)];
  return {
    homeId: "home",
    floors: draft.floors.map((floor, index) => ({ ...floor, sortOrder: index })),
    rooms: rooms.map((room, index) => ({ ...room, sortOrder: index })),
    assets: [],
  };
}
