import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, startOfWeek, toISODate } from "@/lib/dates";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { isQuestDone, markQuestDone, QUEST_IDS, weeklyQuest } from "@/lib/quest";
import type { Completion, Duty, Household } from "@/lib/types";

function duty(partial: Partial<Duty> & Pick<Duty, "title">): Duty {
  return {
    id: "d1",
    notes: "",
    room: "kitchen",
    nodeId: "kitchen",
    nodeType: "room",
    audience: "me",
    effort: "small",
    frequency: "daily",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2026-01-05T00:00:00.000Z",
    archived: false,
    ...partial,
  };
}

function completion(partial: Partial<Completion> & Pick<Completion, "dutyId" | "completedAt">): Completion {
  return { id: partial.id ?? `c-${partial.dutyId}-${partial.completedAt}`, actor: "me", visitId: null, ...partial };
}

function household(overrides: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 9,
    householdName: "Casa",
    ownerName: "Me",
    cleanerName: "Ana",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: [
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 0 },
      { id: "bath", floorId: "main", name: "Bath", type: "bathroom", sortOrder: 1 },
    ],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

const thursday = new Date(2026, 8, 17, 12, 0, 0);
const atNoon = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0).toISOString();

test("a home with history gets one named goal for the week", () => {
  const home = household({ duties: [duty({ id: "wipe", title: "Wipe" })] });
  const quest = weeklyQuest(home, thursday);
  assert.ok(quest);
  assert.ok((QUEST_IDS as readonly string[]).includes(quest.id));
  assert.ok(quest.target > 0);
});

test("the same home gets the same quest all week, and a different one next week", () => {
  const home = household({ duties: [duty({ id: "wipe", title: "Wipe" })] });
  const week = startOfWeek(thursday);
  const ids = new Set(
    [0, 1, 2, 3, 4, 5, 6].map((offset) => weeklyQuest(home, addDays(week, offset))?.id),
  );
  assert.equal(ids.size, 1, "the week's quest changed mid-week");

  // Over a run of weeks the pool must actually rotate.
  const across = new Set(
    Array.from({ length: 12 }, (_, index) => weeklyQuest(home, addDays(week, index * 7))?.id),
  );
  assert.ok(across.size > 1, "the same quest every week is wallpaper");
});

test("a home set up midweek is never asked to close five days it was not around for", () => {
  const week = startOfWeek(thursday);
  const fresh = household({
    duties: [duty({ id: "wipe", title: "Wipe", createdAt: atNoon(addDays(week, 2)) })],
  });
  for (let offset = 2; offset < 7; offset += 1) {
    assert.notEqual(weeklyQuest(fresh, addDays(week, offset))?.id, "close-five");
  }
});

test("a seasonal quest is only asked of a home that keeps seasonal work", () => {
  const plain = household({ duties: [duty({ id: "wipe", title: "Wipe" })] });
  for (let index = 0; index < 20; index += 1) {
    assert.notEqual(weeklyQuest(plain, addDays(thursday, index * 7))?.id, "one-seasonal");
  }
});

test("progress is measured against real work and caps at the target", () => {
  const week = startOfWeek(thursday);
  const wipe = duty({ id: "wipe", title: "Wipe" });
  const home = household({
    duties: [wipe],
    completions: Array.from({ length: 30 }, (_, index) =>
      completion({ dutyId: "wipe", id: `c${index}`, completedAt: atNoon(addDays(week, index % 4)) }),
    ),
  });
  const quest = weeklyQuest(home, thursday);
  assert.ok(quest);
  assert.ok(quest.current <= quest.target);
  assert.ok(quest.fraction >= 0 && quest.fraction <= 1);
});

test("a won week stays won even after the count would no longer reach it", () => {
  const home = household({ duties: [duty({ id: "wipe", title: "Wipe" })] });
  const quest = weeklyQuest(home, thursday);
  assert.ok(quest);
  const filed = markQuestDone(home, quest.week);
  assert.equal(isQuestDone(filed, thursday), true);
  // Filing twice does not grow the tip list, and the old week is pruned.
  const again = markQuestDone(filed, quest.week);
  assert.equal(again.seenTips.length, filed.seenTips.length);
  const nextWeek = markQuestDone(filed, "2026-W40");
  assert.equal(nextWeek.seenTips.filter((tip) => tip.startsWith("quest-done-")).length, 1);
});

test("a home with no rooms and no history still gets something to aim at", () => {
  const bare = household({ rooms: [], duties: [duty({ id: "wipe", title: "Wipe" })] });
  const quest = weeklyQuest(bare, thursday);
  assert.ok(quest, "nothing to aim at");
  assert.equal(quest.id === "every-room", false);
});

test("the week key follows the app's Sunday-to-Saturday week, not the ISO one", () => {
  // `isoWeekKey` runs Monday to Sunday, so keying the quest on it rolled the
  // week over every Sunday — mid-week by the reckoning the rest of the app uses.
  const home = household({ duties: [duty({ id: "wipe", title: "Wipe" })] });
  const sunday = startOfWeek(thursday);
  const saturday = addDays(sunday, 6);
  assert.equal(weeklyQuest(home, sunday)?.week, toISODate(sunday));
  assert.equal(weeklyQuest(home, saturday)?.week, toISODate(sunday));
  assert.notEqual(weeklyQuest(home, addDays(sunday, 7))?.week, toISODate(sunday));
});
