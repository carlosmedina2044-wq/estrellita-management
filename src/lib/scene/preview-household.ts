import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { Completion, Duty, HomeRoom, Household, KitType, PaletteId } from "@/lib/types";

function previewDuty(partial: Partial<Duty> & Pick<Duty, "id" | "title" | "room">): Duty {
  return {
    notes: "",
    nodeId: partial.room,
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "daily",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-01-01T00:00:00.000Z",
    archived: false,
    estimatedMinutes: 8,
    ...partial,
  };
}

function previewCompletion(dutyId: string, at: Date): Completion {
  return { id: `preview-${dutyId}`, dutyId, actor: "me", visitId: null, completedAt: at.toISOString() };
}

function previewRooms(): HomeRoom[] {
  const types: HomeRoom["type"][] = ["kitchen", "living", "bathroom", "primary_bedroom", "laundry"];
  return types.map((type, index) => ({ id: type, floorId: "main", name: type, type, sortOrder: index }));
}

/**
 * A believable, self-contained household for rendering PortraitScene before
 * a real one exists — onboarding's welcome screen and the house-look picker.
 * Deliberately not derived from the answers flowing through onboarding: it
 * only needs to be plausible enough for `dayArc`, not accurate to the home
 * the person is about to build.
 */
export function previewHousehold(
  name: string,
  look?: { kitType: KitType; palette: PaletteId },
  now: Date = new Date(),
): Household {
  const allRooms = previewRooms();
  const openDuties = ["wipe", "bath", "beds"].map((id, index) =>
    previewDuty({ id, title: id, room: allRooms[index]?.id ?? "kitchen" }),
  );
  const noon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);

  return withHouseholdDefaults({
    version: 8,
    householdName: name,
    ownerName: "",
    cleanerName: "",
    onboarded: false,
    mode: "owner",
    activeVisitId: null,
    homeId: "preview",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: allRooms,
    assets: [],
    duties: openDuties,
    completions: [previewCompletion("wipe", noon)],
    visits: [],
    supplyAutomations: [],
    homeSpec: look
      ? { version: 2, kitType: look.kitType as KitType, palette: look.palette as PaletteId, windows: [], seed: 1 }
      : undefined,
    momentum: { enabled: true, bestRun: 0, nightFollowsSky: true },
  });
}
