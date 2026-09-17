import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays } from "@/lib/dates";
import { eveningNudgeNotifications, NUDGE_ID_BASE } from "@/lib/evening-nudge";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import { plannedNotifications } from "@/lib/notifications";
import type { Completion, Duty, Household } from "@/lib/types";

const NOW = new Date(2026, 8, 17, 12, 0, 0);

function duty(partial: Partial<Duty> & Pick<Duty, "id" | "title">): Duty {
  return {
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
    createdAt: addDays(NOW, -20).toISOString(),
    archived: false,
    estimatedMinutes: 10,
    ...partial,
  };
}

function done(dutyId: string, daysAgo: number): Completion {
  const at = addDays(NOW, -daysAgo);
  at.setHours(9, 0, 0, 0);
  return { id: `c-${dutyId}-${daysAgo}`, dutyId, actor: "me", visitId: null, completedAt: at.toISOString() };
}

function home(partial: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 8,
    householdName: "Casa",
    ownerName: "",
    cleanerName: "",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [],
    rooms: [],
    assets: [],
    duties: [duty({ id: "wipe", title: "Wipe counters" })],
    completions: [1, 2, 3, 4, 5].map((daysAgo) => done("wipe", daysAgo)),
    visits: [],
    supplyAutomations: [],
    ...partial,
  });
}

test("plans one evening note per day for a week when a run is at stake and little is left", () => {
  const notices = eveningNudgeNotifications(home({ eveningNudge: { enabled: true, hour: 19 } }), NOW);
  assert.equal(notices.length, 7);
  assert.deepEqual(notices.map((n) => n.id), [0, 1, 2, 3, 4, 5, 6].map((i) => NUDGE_ID_BASE + i));
  for (const notice of notices) {
    assert.equal(notice.schedule.at.getHours(), 19);
    assert.equal(notice.extra.tab, "today");
    assert.match(notice.body, /1 left/);
  }
  assert.match(notices[0].body, /5-day run/);
});

test("stays silent when off, when the run is short, when the hour has passed, and when too much is left", () => {
  assert.deepEqual(eveningNudgeNotifications(home(), NOW), []);
  const shortRun = home({ eveningNudge: { enabled: true, hour: 19 }, completions: [done("wipe", 1)] });
  assert.deepEqual(eveningNudgeNotifications(shortRun, NOW), []);
  const late = eveningNudgeNotifications(home({ eveningNudge: { enabled: true, hour: 9 } }), NOW);
  assert.equal(late.length, 6, "today's 9am has passed");
  const busy = home({
    eveningNudge: { enabled: true, hour: 19 },
    duties: [
      duty({ id: "wipe", title: "Wipe counters" }),
      duty({ id: "b", title: "B" }),
      duty({ id: "c", title: "C" }),
    ],
  });
  assert.deepEqual(eveningNudgeNotifications(busy, NOW), []);
});

test("private mode carries no counts or titles, and the planner keeps nudges inside the pending cap", () => {
  const household = home({
    eveningNudge: { enabled: true, hour: 19 },
    restockDigest: { enabled: false, weekday: 0, hour: 9, lastSentOn: null, permissionAsked: true, privateNotifications: true },
  });
  const notices = eveningNudgeNotifications(household, NOW);
  assert.ok(notices.length > 0);
  for (const notice of notices) {
    assert.equal(notice.body, "A little left today.");
    assert.doesNotMatch(notice.body, /Wipe|\d/);
  }
  const planned = plannedNotifications(household, NOW);
  const ids = planned.map((n) => n.id);
  assert.ok(ids.includes(NUDGE_ID_BASE));
  assert.ok(planned.length <= 64);
});
