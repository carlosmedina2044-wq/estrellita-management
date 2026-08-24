import playbookSeed from "@/lib/playbooks/playbooks.json";
import { deriveClimate } from "@/lib/climate";
import { EXTERIOR_ID, WHOLE_HOME_ID } from "@/lib/home-model";
import { normalizeAssetType } from "@/lib/asset-catalog";
import type {
  Duty,
  HomeAttributes,
  Household,
  NodeType,
  PlaybookSeason,
  RoomType,
  Tenure,
} from "@/lib/types";

export type PlaybookTaskDef = {
  title: string;
  description?: string;
  nodeType: "home" | "exterior" | "roomType" | "assetType";
  target?: string;
  estimatedMinutes?: number;
  estimatedCost?: number;
  isDiy?: boolean;
  consumables?: string[];
};

export type Playbook = {
  id: string;
  name: string;
  season: PlaybookSeason;
  climateZones: string[] | "all";
  tenure?: Tenure;
  requires?: Partial<HomeAttributes>;
  triggerMonth?: number;
  tasks: PlaybookTaskDef[];
};

export const PLAYBOOKS = playbookSeed as Playbook[];

export function taskKey(playbookId: string, title: string): string {
  return `${playbookId}:${title}`;
}

export function attributesMatch(requires: Partial<HomeAttributes> | undefined, attributes: HomeAttributes): boolean {
  if (!requires) return true;
  return (Object.entries(requires) as [keyof HomeAttributes, HomeAttributes[keyof HomeAttributes]][]).every(
    ([key, value]) => attributes[key] === value,
  );
}

export function playbookApplies(
  playbook: Playbook,
  household: Pick<Household, "location" | "attributes" | "tenure">,
): boolean {
  const zone = deriveClimate(household.location);
  const climateOk = playbook.climateZones === "all" || playbook.climateZones.includes(zone);
  const tenureOk = !playbook.tenure || playbook.tenure === household.tenure;
  return climateOk && attributesMatch(playbook.requires, household.attributes) && tenureOk;
}

export function matchingPlaybooks(
  household: Pick<Household, "location" | "attributes" | "playbookDecisions" | "tenure">,
  month = new Date().getMonth() + 1,
): Playbook[] {
  const year = new Date().getFullYear();
  return PLAYBOOKS.filter((playbook) => {
    if (!playbookApplies(playbook, household)) return false;
    if (playbook.triggerMonth && playbook.triggerMonth !== month && playbook.season !== "any") return false;
    const decision = household.playbookDecisions.find((item) => item.playbookId === playbook.id && item.year === year);
    if (decision?.disabled) return false;
    return true;
  });
}

export function resolvePlaybookTarget(
  household: Pick<Household, "rooms" | "assets">,
  task: PlaybookTaskDef,
): { nodeId: string; nodeType: NodeType; room: string } {
  if (task.nodeType === "home") {
    return { nodeId: WHOLE_HOME_ID, nodeType: "home", room: WHOLE_HOME_ID };
  }
  if (task.nodeType === "exterior") {
    return { nodeId: EXTERIOR_ID, nodeType: "room", room: EXTERIOR_ID };
  }
  if (task.nodeType === "roomType" && task.target) {
    const room = household.rooms.find((item) => item.type === (task.target as RoomType) && !item.system);
    if (room) return { nodeId: room.id, nodeType: "room", room: room.id };
    return { nodeId: WHOLE_HOME_ID, nodeType: "home", room: WHOLE_HOME_ID };
  }
  if (task.nodeType === "assetType" && task.target) {
    const type = normalizeAssetType(task.target);
    const asset = household.assets.find((item) => normalizeAssetType(item.type) === type);
    if (asset) return { nodeId: asset.id, nodeType: "asset", room: asset.roomId };
    if (type === "dryer" || type === "washer") {
      const laundry = household.rooms.find((room) => room.type === "laundry");
      if (laundry) return { nodeId: laundry.id, nodeType: "room", room: laundry.id };
    }
    return { nodeId: WHOLE_HOME_ID, nodeType: "home", room: WHOLE_HOME_ID };
  }
  return { nodeId: WHOLE_HOME_ID, nodeType: "home", room: WHOLE_HOME_ID };
}

export function dutyFromPlaybookTask(
  household: Pick<Household, "rooms" | "assets">,
  playbook: Playbook,
  task: PlaybookTaskDef,
  dueDate: string,
  origin: Duty["origin"] = "playbook",
): Omit<Duty, "id" | "createdAt"> {
  const target = resolvePlaybookTarget(household, task);
  return {
    title: task.title,
    notes: task.description ?? "",
    room: target.room,
    nodeId: target.nodeId,
    nodeType: target.nodeType,
    audience: "me",
    effort: (task.estimatedMinutes ?? 20) > 40 ? "large" : (task.estimatedMinutes ?? 20) > 15 ? "medium" : "small",
    frequency: "once",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate,
    priority: "medium",
    archived: false,
    estimatedCost: task.estimatedCost,
    isDiy: task.isDiy,
    estimatedMinutes: task.estimatedMinutes,
    origin,
    playbookId: playbook.id,
  };
}
