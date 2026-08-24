import type { Audience, Duty, Floor, Room } from "@/lib/types";

export type RoomDef = {
  id: Room;
  label: string;
  short: string;
  floor: Floor;
  alsoOn?: Floor[];
};

export const FLOORS: { id: Floor; label: string }[] = [
  { id: "downstairs", label: "Downstairs" },
  { id: "upstairs", label: "Upstairs" },
  { id: "outside", label: "Yard" },
];

export const HOUSE_ROOMS: RoomDef[] = [
  { id: "entry", label: "Entry", short: "Entry", floor: "downstairs" },
  { id: "family-room", label: "Family room", short: "Family", floor: "downstairs" },
  { id: "dining-room", label: "Dining room", short: "Dining", floor: "downstairs" },
  { id: "kitchen", label: "Kitchen", short: "Kitchen", floor: "downstairs" },
  { id: "nook", label: "Nook", short: "Nook", floor: "downstairs" },
  { id: "living-room", label: "Living room", short: "Living", floor: "downstairs" },
  { id: "guest-room", label: "Guest room", short: "Guest", floor: "downstairs" },
  { id: "downstairs-bath", label: "Downstairs bathroom", short: "Bath", floor: "downstairs" },
  { id: "laundry", label: "Laundry", short: "Laundry", floor: "downstairs" },
  { id: "garage", label: "Garage", short: "Garage", floor: "downstairs" },
  { id: "patio", label: "Covered patio", short: "Patio", floor: "downstairs", alsoOn: ["outside"] },
  { id: "main-bedroom", label: "Main bedroom", short: "Main bed", floor: "upstairs" },
  { id: "main-bath", label: "Main bathroom", short: "Bath", floor: "upstairs" },
  { id: "carlos-office", label: "Carlos’ office", short: "Carlos", floor: "upstairs" },
  { id: "adriana-office", label: "Adriana’s bedroom", short: "Adriana", floor: "upstairs" },
  { id: "elliotts-room", label: "Elliott’s room", short: "Elliott", floor: "upstairs" },
  { id: "upstairs-bath", label: "Upstairs bathroom", short: "Bath", floor: "upstairs" },
  { id: "upstairs-hall", label: "Upstairs hall", short: "Hall", floor: "upstairs" },
  { id: "lawn", label: "Lawn", short: "Grass", floor: "outside" },
  { id: "pool", label: "Pool", short: "Pool", floor: "outside" },
  { id: "ramada", label: "Ramada", short: "Ramada", floor: "outside" },
  { id: "shed", label: "Shed", short: "Shed", floor: "outside" },
];

const ROOM_INDEX = Object.fromEntries(HOUSE_ROOMS.map((room) => [room.id, room])) as Record<
  Room,
  RoomDef
>;

export function roomDef(id: Room): RoomDef {
  return ROOM_INDEX[id];
}

export function roomLabel(id: Room): string {
  return ROOM_INDEX[id]?.label ?? id;
}

export function roomsOnFloor(floor: Floor): RoomDef[] {
  return HOUSE_ROOMS.filter((room) => room.floor === floor || room.alsoOn?.includes(floor));
}

export const ROOMS = HOUSE_ROOMS.map((room) => ({
  id: room.id,
  label: room.label,
  floor: room.floor,
}));

export function inferAudience(title: string, room: Room): Audience {
  const text = title.toLowerCase();
  if (
    text.includes("bathroom") ||
    text.includes("vacuum") ||
    text.includes("sheet") ||
    text.includes("mop") ||
    text.includes("dust")
  ) {
    return "cleaner";
  }
  if (room === "main-bath" || room === "upstairs-bath" || room === "downstairs-bath") {
    return "cleaner";
  }
  return "me";
}

export type HouseStarter = Pick<
  Duty,
  "title" | "room" | "frequency" | "weekday" | "monthDay" | "priority" | "effort" | "audience"
> & { notes?: string };

export const HOUSE_STARTERS: HouseStarter[] = [
  {
    title: "Wipe counters & sink",
    room: "kitchen",
    frequency: "daily",
    weekday: 0,
    monthDay: 1,
    priority: "high",
    effort: "small",
    audience: "me",
  },
  {
    title: "Dishes / dishwasher",
    room: "kitchen",
    frequency: "daily",
    weekday: 0,
    monthDay: 1,
    priority: "high",
    effort: "medium",
    audience: "me",
  },
  {
    title: "Wipe dining table",
    room: "dining-room",
    frequency: "daily",
    weekday: 0,
    monthDay: 1,
    priority: "low",
    effort: "small",
    audience: "me",
  },
  {
    title: "Wipe breakfast nook",
    room: "nook",
    frequency: "daily",
    weekday: 0,
    monthDay: 1,
    priority: "low",
    effort: "small",
    audience: "me",
  },
  {
    title: "Tidy family room",
    room: "family-room",
    frequency: "daily",
    weekday: 0,
    monthDay: 1,
    priority: "medium",
    effort: "small",
    audience: "me",
  },
  {
    title: "Vacuum family room",
    room: "family-room",
    frequency: "weekly",
    weekday: 6,
    monthDay: 1,
    priority: "medium",
    effort: "medium",
    audience: "cleaner",
  },
  {
    title: "Vacuum living room",
    room: "living-room",
    frequency: "weekly",
    weekday: 6,
    monthDay: 1,
    priority: "medium",
    effort: "medium",
    audience: "cleaner",
  },
  {
    title: "Clean downstairs bathroom",
    room: "downstairs-bath",
    frequency: "weekly",
    weekday: 6,
    monthDay: 1,
    priority: "high",
    effort: "large",
    audience: "cleaner",
  },
  {
    title: "Guest room surfaces",
    room: "guest-room",
    frequency: "weekly",
    weekday: 5,
    monthDay: 1,
    priority: "low",
    effort: "small",
    audience: "cleaner",
  },
  {
    title: "Laundry",
    room: "laundry",
    frequency: "weekly",
    weekday: 0,
    monthDay: 1,
    priority: "medium",
    effort: "large",
    audience: "me",
  },
  {
    title: "Sweep entry",
    room: "entry",
    frequency: "weekly",
    weekday: 5,
    monthDay: 1,
    priority: "low",
    effort: "small",
    audience: "me",
  },
  {
    title: "Sweep garage",
    room: "garage",
    frequency: "monthly",
    weekday: 0,
    monthDay: 1,
    priority: "low",
    effort: "medium",
    audience: "me",
  },
  {
    title: "Make main bed / change sheets",
    room: "main-bedroom",
    frequency: "monthly",
    weekday: 0,
    monthDay: 1,
    priority: "medium",
    effort: "large",
    audience: "cleaner",
  },
  {
    title: "Clean main bathroom",
    room: "main-bath",
    frequency: "weekly",
    weekday: 6,
    monthDay: 1,
    priority: "high",
    effort: "large",
    audience: "cleaner",
  },
  {
    title: "Clean upstairs bathroom",
    room: "upstairs-bath",
    frequency: "weekly",
    weekday: 6,
    monthDay: 1,
    priority: "high",
    effort: "large",
    audience: "cleaner",
  },
  {
    title: "Dust Carlos’ office",
    room: "carlos-office",
    frequency: "weekly",
    weekday: 3,
    monthDay: 1,
    priority: "low",
    effort: "small",
    audience: "me",
  },
  {
    title: "Dust Adriana’s office",
    room: "adriana-office",
    frequency: "weekly",
    weekday: 3,
    monthDay: 1,
    priority: "low",
    effort: "small",
    audience: "me",
  },
  {
    title: "Tidy Elliott’s room",
    room: "elliotts-room",
    frequency: "daily",
    weekday: 0,
    monthDay: 1,
    priority: "medium",
    effort: "small",
    audience: "me",
  },
  {
    title: "Vacuum Elliott’s room",
    room: "elliotts-room",
    frequency: "weekly",
    weekday: 6,
    monthDay: 1,
    priority: "medium",
    effort: "medium",
    audience: "cleaner",
  },
  {
    title: "Sweep covered patio",
    room: "patio",
    frequency: "weekly",
    weekday: 6,
    monthDay: 1,
    priority: "medium",
    effort: "medium",
    audience: "me",
  },
  {
    title: "Skim & check pool",
    room: "pool",
    frequency: "daily",
    weekday: 0,
    monthDay: 1,
    priority: "high",
    effort: "small",
    audience: "me",
  },
  {
    title: "Mow & edge the grass",
    room: "lawn",
    frequency: "weekly",
    weekday: 6,
    monthDay: 1,
    priority: "medium",
    effort: "large",
    audience: "me",
  },
  {
    title: "Sweep ramada",
    room: "ramada",
    frequency: "weekly",
    weekday: 6,
    monthDay: 1,
    priority: "low",
    effort: "small",
    audience: "me",
  },
  {
    title: "Tidy the shed",
    room: "shed",
    frequency: "monthly",
    weekday: 0,
    monthDay: 1,
    priority: "low",
    effort: "medium",
    audience: "me",
  },
  {
    title: "Replace air purifier filters",
    room: "living-room",
    frequency: "yearly",
    weekday: 0,
    monthDay: 1,
    priority: "medium",
    effort: "small",
    audience: "me",
  },
];

const LEGACY_ROOM: Record<string, Room> = {
  kitchen: "kitchen",
  bathroom: "downstairs-bath",
  living: "living-room",
  bedroom: "guest-room",
  laundry: "laundry",
  outdoor: "patio",
  pets: "patio",
  "whole-home": "entry",
};

export function migrateRoom(value: string): Room {
  if (value in ROOM_INDEX) return value as Room;
  if (LEGACY_ROOM[value]) return LEGACY_ROOM[value];
  if (/^[A-Za-z0-9_-]{2,64}$/.test(value)) return value;
  return "entry";
}
