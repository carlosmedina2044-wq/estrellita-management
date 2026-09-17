import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, toISODate } from "@/lib/dates";
import { houseLine, houseLineCandidates, houseLineId } from "@/lib/house-line";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import type { Completion, Duty, Household } from "@/lib/types";
import type { WeatherForecast } from "@/lib/weather/provider";

function duty(partial: Partial<Duty> & Pick<Duty, "id" | "title">): Duty {
  return {
    notes: "",
    room: "exterior",
    nodeId: "exterior",
    nodeType: "room",
    audience: "me",
    effort: "medium",
    frequency: "yearly",
    kind: "chore",
    weekday: 0,
    monthDay: 1,
    dueDate: null,
    priority: "medium",
    createdAt: "2025-01-01T00:00:00.000Z",
    archived: false,
    estimatedMinutes: 60,
    ...partial,
  };
}

function done(dutyId: string, at: Date): Completion {
  return { id: `c-${dutyId}-${at.toISOString()}`, dutyId, actor: "me", visitId: null, completedAt: at.toISOString() };
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
    homeType: "house",
    location: {},
    floors: [],
    rooms: [],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...partial,
  });
}

function forecast(now: Date, days: Array<Partial<WeatherForecast["days"][number]>>): WeatherForecast {
  return {
    fetchedAt: now.toISOString(),
    days: days.map((day, index) => ({
      date: toISODate(addDays(now, index)),
      tempMinF: 55,
      tempMaxF: 75,
      windMph: 5,
      precipIn: 0,
      ...day,
    })),
  };
}

const NOW = new Date(2026, 8, 17, 10, 0, 0);

test("a freeze in the next three days speaks first, and mentions hoses only for a home with a yard", () => {
  const cold = forecast(NOW, [{}, { tempMinF: 28 }]);
  const yard = home({ attributes: { ...home().attributes, hasYard: true } });
  assert.equal(houseLineCandidates(yard, cold, NOW)[0].key, "houseLine.freezeHoses");
  const flat = home({ attributes: { ...home().attributes, hasYard: false } });
  assert.equal(houseLineCandidates(flat, cold, NOW)[0].key, "houseLine.freeze");
  // A freeze five days out is outside the lookahead.
  const far = forecast(NOW, [{}, {}, {}, {}, {}, { tempMinF: 28 }]);
  assert.notEqual(houseLineCandidates(yard, far, NOW)[0].source, "weather");
});

test("rain credits recently cleared gutters, otherwise nudges toward them", () => {
  const rainy = forecast(NOW, [{}, { precipIn: 0.8 }]);
  const gutters = duty({ id: "g", title: "Clean gutters before freeze" });
  const kept = home({
    attributes: { ...home().attributes, hasGutters: true },
    duties: [gutters],
    completions: [done("g", addDays(NOW, -40))],
  });
  const line = houseLineCandidates(kept, rainy, NOW)[0];
  assert.equal(line.key, "houseLine.rainGuttersKept");
  assert.ok(line.params?.month);
  const unkempt = home({ attributes: { ...home().attributes, hasGutters: true }, duties: [gutters] });
  assert.equal(houseLineCandidates(unkempt, rainy, NOW)[0].key, "houseLine.rainGutters");
  const noGutters = home({ attributes: { ...home().attributes, hasGutters: false } });
  assert.equal(houseLineCandidates(noGutters, rainy, NOW)[0].key, "houseLine.rain");
});

test("a seasonal window opening within two weeks is named, and the ideal month wins", () => {
  // 17 September: October windows open on the 1st, 14 days out.
  const line = houseLineCandidates(home(), null, NOW).find((item) => item.source === "season");
  assert.ok(line);
  assert.ok(["houseLine.windowOpens", "houseLine.windowIdeal"].includes(line!.key));
  // The universal September playbook is in its ideal month.
  assert.equal(line!.key, "houseLine.windowIdeal");
});

test("a completion from a year ago this week comes back as an anniversary", () => {
  const heater = duty({ id: "wh", title: "Flush the water heater" });
  const household = home({ duties: [heater], completions: [done("wh", addDays(NOW, -365))] });
  const line = houseLineCandidates(household, null, NOW).find((item) => item.source === "anniversary");
  assert.ok(line);
  assert.equal(line!.params?.title, "Flush the water heater");
});

test("the ledger speaks on the 1st and 15th only", () => {
  const wipe = duty({ id: "w", title: "Wipe", frequency: "daily", estimatedMinutes: 10 });
  const first = new Date(2026, 8, 1, 10);
  const household = home({ duties: [wipe], completions: [done("w", new Date(2026, 8, 1, 8))] });
  assert.ok(houseLineCandidates(household, null, first).some((item) => item.source === "ledger"));
  assert.ok(!houseLineCandidates(household, null, new Date(2026, 8, 3, 10)).some((item) => item.source === "ledger"));
});

test("the same source never speaks two days running when another can, and lines never repeat back to back", () => {
  const rainyWeek = forecast(NOW, Array.from({ length: 16 }, () => ({ precipIn: 0.9 })));
  const household = home({ attributes: { ...home().attributes, hasGutters: false } });
  let previous: ReturnType<typeof houseLine> | null = null;
  for (let offset = 0; offset < 14; offset += 1) {
    const day = addDays(NOW, offset);
    const line = houseLine(household, rainyWeek, day);
    if (previous) {
      assert.notEqual(houseLineId(line), houseLineId(previous), `day ${offset} repeated`);
      if (previous.source === "weather") assert.notEqual(line.source, "weather", `day ${offset} weather twice`);
    }
    previous = line;
  }
});

test("with nothing else to say the house still has a fact, and consecutive facts differ", () => {
  const bare = home();
  let previous: string | null = null;
  for (let offset = 0; offset < 8; offset += 1) {
    const line = houseLine(bare, null, addDays(new Date(2026, 0, 3), offset));
    assert.ok(["fact", "season"].includes(line.source));
    if (previous) assert.notEqual(houseLineId(line), previous);
    previous = houseLineId(line);
  }
});
