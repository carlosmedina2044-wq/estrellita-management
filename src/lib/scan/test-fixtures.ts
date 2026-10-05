import { withHouseholdDefaults } from "@/lib/household-defaults";
import { defaultConsumableFields } from "@/lib/restock";
import type { Consumable, Duty, Household, SupplyAutomation } from "@/lib/types";

export const NOW = new Date(2026, 9, 4);

export function automation(partial: Partial<SupplyAutomation> & { id: string; itemName: string }): SupplyAutomation {
  return {
    ...defaultConsumableFields(NOW),
    dutyId: `duty-${partial.id}`,
    linkedDutyIds: [`duty-${partial.id}`],
    room: "kitchen" as SupplyAutomation["room"],
    nodeId: "kitchen",
    nodeType: "room",
    leadTimeDays: 5,
    createdAt: NOW.toISOString(),
    ...partial,
  } as SupplyAutomation;
}

export function consumable(partial: Partial<Consumable> & { id: string; name: string }): Consumable {
  return { nodeId: "kitchen", nodeType: "room", intervalDays: 90, ...partial };
}

export function household(overrides: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 9,
    householdName: "Test",
    ownerName: "Me",
    cleanerName: "",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: [
      { id: "whole-home", floorId: null, name: "Whole Home", type: "other", sortOrder: 0, system: "whole-home" },
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 1 },
      { id: "basement", floorId: "main", name: "Basement", type: "basement", sortOrder: 2 },
    ],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  }) as Household;
}

/** A replacement chore for an automation made by automation(); storage drops automations with no chore. */
export function dutyFor(id: string): Duty {
  return {
    id: `duty-${id}`,
    title: "Replace it",
    notes: "",
    room: "kitchen",
    nodeId: "kitchen",
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "quarterly",
    kind: "replacement",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-08-01T00:00:00.000Z",
    archived: false,
  };
}
