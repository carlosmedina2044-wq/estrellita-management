import assert from "node:assert/strict";
import { test } from "node:test";
import { translate } from "@/i18n";
import { withHouseholdDefaults } from "@/lib/household-defaults";
import {
  bodyFromScan,
  buildHouseHandbook,
  deleteHouseNote,
  guessKind,
  notesInRoom,
  saveHouseNote,
  searchHouseNotes,
} from "@/lib/house-notes";
import { parseStored } from "@/lib/storage";
import type { Household } from "@/lib/types";

function home(overrides: Partial<Household> = {}): Household {
  return withHouseholdDefaults({
    version: 9,
    householdName: "Casa Luz",
    ownerName: "Ana",
    cleanerName: "Rosa",
    onboarded: true,
    mode: "owner",
    activeVisitId: null,
    homeId: "home",
    floors: [{ id: "main", name: "Main", sortOrder: 0 }],
    rooms: [
      { id: "whole-home", floorId: null, name: "Whole Home", type: "other", sortOrder: 0, system: "whole-home" },
      { id: "kitchen", floorId: "main", name: "Kitchen", type: "kitchen", sortOrder: 1 },
      { id: "garage", floorId: "main", name: "Garage", type: "garage", sortOrder: 2 },
    ],
    assets: [],
    duties: [],
    completions: [],
    visits: [],
    supplyAutomations: [],
    ...overrides,
  });
}

const NOW = new Date(2026, 9, 4, 12);

test("saving adds a note, editing keeps its id and date, empty notes change nothing", () => {
  const added = saveHouseNote(home(), { roomId: "garage", title: "Breaker panel", body: "1 Kitchen\n2 Hall", kind: "breaker" }, NOW);
  assert.equal(added.houseNotes?.length, 1);
  const note = added.houseNotes![0]!;
  assert.equal(note.roomId, "garage");
  const edited = saveHouseNote(added, { id: note.id, roomId: "kitchen", title: "Panel", body: "x", kind: "breaker" }, new Date(2027, 0, 1));
  assert.equal(edited.houseNotes?.length, 1);
  assert.equal(edited.houseNotes![0]!.createdAt, note.createdAt);
  assert.equal(edited.houseNotes![0]!.roomId, "kitchen");
  const same = home();
  assert.equal(saveHouseNote(same, { title: "  ", body: "", kind: "other" }), same);
});

test("a room that does not exist is not stored, and a deleted room frees its notes", () => {
  const h = saveHouseNote(home(), { roomId: "nowhere", title: "Water", body: "", kind: "shutoff" }, NOW);
  assert.equal(h.houseNotes![0]!.roomId, undefined);
  const inGarage = saveHouseNote(home(), { roomId: "garage", title: "Water", body: "", kind: "shutoff" }, NOW);
  assert.equal(notesInRoom(inGarage, "garage").length, 1);
  const gone = { ...inGarage, rooms: inGarage.rooms.filter((room) => room.id !== "garage") };
  assert.equal(notesInRoom(gone, "garage").length, 0);
});

test("deleting the last note removes the field", () => {
  const h = saveHouseNote(home(), { title: "Water", body: "", kind: "shutoff" }, NOW);
  const none = deleteHouseNote(h, h.houseNotes![0]!.id);
  assert.equal("houseNotes" in none, false);
});

test("search matches every word across title, body, room and kind, ignoring accents and case", () => {
  let h = saveHouseNote(home(), { roomId: "kitchen", title: "Pintura", body: "Sherwin Williams Agreeable Gray, satin", kind: "paint" }, NOW);
  h = saveHouseNote(h, { roomId: "garage", title: "Main shutoff", body: "Behind the water heater", kind: "shutoff" }, NOW);
  assert.equal(searchHouseNotes(h, "").length, 2);
  assert.deepEqual(searchHouseNotes(h, "KITCHEN gray").map((n) => n.title), ["Pintura"]);
  assert.deepEqual(searchHouseNotes(h, "garage water").map((n) => n.title), ["Main shutoff"]);
  assert.deepEqual(searchHouseNotes(h, "pintúra").map((n) => n.title), ["Pintura"]);
  assert.equal(searchHouseNotes(h, "kitchen water").length, 0);
  assert.deepEqual(searchHouseNotes(h, "breaker", (kind) => (kind === "paint" ? "Breaker-ish" : kind)).map((n) => n.title), ["Pintura"]);
});

test("scanned text becomes a tidy body", () => {
  assert.equal(bodyFromScan(["  1  KITCHEN ", "", "1  kitchen", "2 HALL\u0007"]), "1 KITCHEN\n2 HALL");
  assert.equal(bodyFromScan([]), "");
  assert.ok(bodyFromScan(Array.from({ length: 500 }, (_, i) => `Line number ${i}`)).length <= 2000);
  assert.equal(guessKind(["20A", "Main breaker"]), "breaker");
  assert.equal(guessKind(["Behr Ultra", "Satin enamel", "1 gallon"]), "paint");
  assert.equal(guessKind(["hello"]), "other");
});

test("the handbook lists notes, appliances, supplies and chores in plain words", () => {
  let h = home({
    assets: [
      {
        id: "a1abcdef",
        roomId: "kitchen",
        name: "Dishwasher",
        type: "dishwasher",
        installDate: "2020-03-01",
        warrantyUntil: "2027-03-01",
        notes: "Model: DW100\nSerial: SN42",
      },
    ],
    supplyAutomations: [
      { itemName: "Furnace filter", sizeSpec: "16x25x1", onHand: 2 } as Household["supplyAutomations"][number],
    ],
    duties: [
      { id: "d1", title: "Wipe counters", notes: "", room: "kitchen", nodeId: "kitchen", nodeType: "room", frequency: "daily", kind: "chore", archived: false } as Household["duties"][number],
      { id: "d2", title: "Old", notes: "", room: "kitchen", nodeId: "kitchen", nodeType: "room", frequency: "daily", kind: "chore", archived: true } as Household["duties"][number],
    ],
  });
  h = saveHouseNote(h, { roomId: "garage", title: "Breaker panel", body: "1 Kitchen", kind: "breaker" }, NOW);
  const text = buildHouseHandbook(h, {
    t: (key, params) => translate("en", key, params),
    formatDate: (iso) => iso,
    frequencyLabel: (f) => f,
    now: NOW,
  });
  assert.match(text, /^Casa Luz: house handbook/);
  assert.match(text, /Owner: Ana/);
  assert.match(text, /Breaker panel \(Garage\)\n {2}1 Kitchen/);
  assert.match(text, /- Dishwasher \(Kitchen\) · 6 years old · Model: DW100, Serial: SN42 · warranty until 2027-03-01/);
  assert.match(text, /- Furnace filter · 16x25x1 · 2 on hand/);
  assert.match(text, /- Wipe counters \(Kitchen\) · daily/);
  assert.doesNotMatch(text, /Old/);
});

test("house notes survive a save and load, and junk is dropped", () => {
  const h = saveHouseNote(home(), { roomId: "garage", title: "Breaker panel", body: "1 Kitchen", kind: "breaker" }, NOW);
  const loaded = parseStored(JSON.stringify(h));
  assert.equal(loaded.houseNotes?.length, 1);
  assert.equal(loaded.houseNotes![0]!.kind, "breaker");
  assert.equal(loaded.houseNotes![0]!.roomId, "garage");
  const messy = parseStored(
    JSON.stringify({
      ...h,
      houseNotes: [
        ...h.houseNotes!,
        { id: "badbadbad", title: "", body: "", kind: "breaker" },
        { id: "okokokok1", title: "X", body: "Y\u0007", kind: "nonsense", createdAt: "not a date" },
        "junk",
        null,
      ],
    }),
  );
  assert.equal(messy.houseNotes?.length, 2);
  assert.equal(messy.houseNotes![1]!.kind, "other");
  assert.equal(messy.houseNotes![1]!.body, "Y");
  assert.equal("houseNotes" in parseStored(JSON.stringify({ ...h, houseNotes: "nope" })), false);
  assert.equal("houseNotes" in parseStored(JSON.stringify(home())), false);
});
