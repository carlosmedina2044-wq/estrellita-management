import { addDays, startOfDay } from "@/lib/dates";
import { isDueToday, isOverdue, nextDueDate } from "@/lib/duties";
import { restockPlacement } from "@/lib/restock";
import type { Household, NodeType } from "@/lib/types";

export type NodeStatus = {
  overdue: number;
  dueSoon: number;
  total: number;
  reorderPending: number;
};

const EMPTY: NodeStatus = { overdue: 0, dueSoon: 0, total: 0, reorderPending: 0 };

function addStatus(a: NodeStatus, b: NodeStatus): NodeStatus {
  return {
    overdue: a.overdue + b.overdue,
    dueSoon: a.dueSoon + b.dueSoon,
    total: a.total + b.total,
    reorderPending: a.reorderPending + b.reorderPending,
  };
}

export function statusTone(status: NodeStatus): "green" | "amber" | "red" {
  if (status.overdue > 0) return "red";
  if (status.dueSoon > 0 || status.reorderPending > 0) return "amber";
  return "green";
}

function attachedTo(
  household: Household,
  nodeId: string,
  nodeType: NodeType,
  item: { nodeId: string; nodeType: NodeType; room: string },
): boolean {
  if (item.nodeId === nodeId && item.nodeType === nodeType) return true;
  if (nodeType === "room") {
    if (item.room === nodeId) return true;
    if (item.nodeType === "asset") {
      return household.assets.some((asset) => asset.id === item.nodeId && asset.roomId === nodeId);
    }
  }
  return false;
}

function ownStatus(household: Household, nodeId: string, nodeType: NodeType, now: Date): NodeStatus {
  const soonEnd = addDays(now, 7);
  const status = { ...EMPTY };

  for (const duty of household.duties) {
    if (duty.archived) continue;
    if (!attachedTo(household, nodeId, nodeType, duty)) continue;
    const installedAt = household.supplyAutomations.find((item) => item.dutyId === duty.id)?.installedAt ?? null;
    const overdue = isOverdue(duty, household.completions, now, installedAt);
    const dueToday = isDueToday(duty, household.completions, now, installedAt);
    const next = nextDueDate(duty, household.completions, now, installedAt);
    const dueSoon =
      !overdue &&
      !dueToday &&
      Boolean(next) &&
      startOfDay(next!) <= startOfDay(soonEnd) &&
      startOfDay(next!) >= startOfDay(now);
    if (overdue || dueToday || dueSoon) {
      status.total += 1;
      if (overdue) status.overdue += 1;
      else status.dueSoon += 1;
    }
  }

  for (const item of household.supplyAutomations) {
    if (!attachedTo(household, nodeId, nodeType, item)) continue;
    const bucket = restockPlacement(item, household, now).bucket;
    if (bucket === "order_now" || bucket === "coming_up") {
      status.reorderPending += 1;
    }
  }

  return status;
}

export function nodeStatus(
  household: Household,
  nodeId: string,
  nodeType: NodeType,
  now = new Date(),
): NodeStatus {
  if (nodeType === "room" || nodeType === "asset") {
    return ownStatus(household, nodeId, nodeType, now);
  }
  if (nodeType === "floor") {
    let status = ownStatus(household, nodeId, "floor", now);
    for (const room of household.rooms.filter((room) => room.floorId === nodeId && !room.system)) {
      status = addStatus(status, ownStatus(household, room.id, "room", now));
    }
    return status;
  }
  let status = ownStatus(household, nodeId, "home", now);
  for (const floor of household.floors) {
    status = addStatus(status, ownStatus(household, floor.id, "floor", now));
  }
  for (const room of household.rooms) {
    status = addStatus(status, ownStatus(household, room.id, "room", now));
  }
  return status;
}

export function homeSummary(household: Household, now = new Date()): NodeStatus {
  return nodeStatus(household, household.homeId || "home", "home", now);
}
