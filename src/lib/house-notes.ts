import type { MessageKey } from "@/i18n";
import { roomName } from "@/lib/home-model";
import { sanitizeText } from "@/lib/sanitize";
import { HOUSE_NOTE_LIMITS } from "@/lib/storage/migrate";
import type { HouseNote, HouseNoteKind, Household } from "@/lib/types";

/*
 * House notes: the facts you hunt for in a hurry (which breaker is the kitchen,
 * where the water shuts off, the paint colour). Pure functions only. Nothing here
 * logs, and nothing leaves the device unless the person taps "House handbook".
 */

export const HOUSE_NOTE_KINDS: readonly HouseNoteKind[] = ["breaker", "shutoff", "paint", "other"];
export const MAX_HOUSE_NOTES = 200;

export type HouseNoteDraft = {
  id?: string;
  roomId?: string;
  title: string;
  body: string;
  kind: HouseNoteKind;
};

export function houseNotes(household: Pick<Household, "houseNotes">): HouseNote[] {
  return household.houseNotes ?? [];
}

/** Adds a note, or replaces the one with the same id. An empty note changes nothing. */
export function saveHouseNote(household: Household, draft: HouseNoteDraft, now = new Date()): Household {
  const title = sanitizeText(draft.title, HOUSE_NOTE_LIMITS.title);
  const body = sanitizeText(draft.body, HOUSE_NOTE_LIMITS.body);
  if (!title && !body) return household;
  const kind: HouseNoteKind = HOUSE_NOTE_KINDS.includes(draft.kind) ? draft.kind : "other";
  const roomId =
    draft.roomId && household.rooms.some((room) => room.id === draft.roomId) ? draft.roomId : undefined;
  const existing = houseNotes(household);
  const current = draft.id ? existing.find((note) => note.id === draft.id) : undefined;
  const note: HouseNote = {
    id: current?.id ?? draft.id ?? crypto.randomUUID(),
    ...(roomId ? { roomId } : {}),
    title,
    body,
    kind,
    createdAt: current?.createdAt ?? now.toISOString(),
  };
  const next = current
    ? existing.map((item) => (item.id === note.id ? note : item))
    : [...existing, note].slice(-MAX_HOUSE_NOTES);
  return { ...household, houseNotes: next };
}

export function deleteHouseNote(household: Household, id: string): Household {
  const existing = houseNotes(household);
  if (!existing.some((note) => note.id === id)) return household;
  const next = existing.filter((note) => note.id !== id);
  const { houseNotes: _drop, ...rest } = household;
  void _drop;
  return next.length > 0 ? { ...rest, houseNotes: next } : (rest as Household);
}

/** A note belongs to a room only while that room still exists. */
export function noteRoomId(household: Pick<Household, "rooms">, note: HouseNote): string | undefined {
  return note.roomId && household.rooms.some((room) => room.id === note.roomId) ? note.roomId : undefined;
}

export function notesInRoom(household: Household, roomId: string): HouseNote[] {
  return houseNotes(household).filter((note) => noteRoomId(household, note) === roomId);
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Plain filter: every word typed must appear somewhere in the note's title, body,
 * room name or kind label. Accents and case are ignored. An empty search returns
 * everything, newest room first as stored.
 */
export function searchHouseNotes(
  household: Household,
  query: string,
  kindLabel: (kind: HouseNoteKind) => string = (kind) => kind,
): HouseNote[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const all = houseNotes(household);
  if (words.length === 0) return all;
  return all.filter((note) => {
    const roomId = noteRoomId(household, note);
    const haystack = fold(
      [note.title, note.body, roomId ? roomName(household, roomId) : "", kindLabel(note.kind)].join("\n"),
    );
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * Text read from a breaker panel or a paint can, tidied into a note body: one
 * line per entry, blanks and repeats dropped, kept to the saved length.
 */
export function bodyFromScan(lines: string[]): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of lines) {
    const line = sanitizeText(raw, 160).replace(/\s+/g, " ");
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(line);
  }
  return kept.join("\n").slice(0, HOUSE_NOTE_LIMITS.body).trim();
}

/** The kind a scan most likely is, so the form starts on the right choice. */
export function guessKind(lines: string[]): HouseNoteKind {
  const text = lines.join(" ").toLowerCase();
  if (/\b(breaker|panel|amp|circuit|main)\b/.test(text) || /\b\d{2}\s?a\b/.test(text)) return "breaker";
  if (/\b(paint|sheen|satin|matte|gloss|eggshell|semi-?gloss|primer|gallon)\b/.test(text)) return "paint";
  return "other";
}

// ---- the house handbook ----

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export type HandbookOptions = {
  t: Translate;
  /** Formats a YYYY-MM-DD day for reading. */
  formatDate: (iso: string) => string;
  /** Shown for a chore's frequency, e.g. "Weekly". */
  frequencyLabel: (frequency: string) => string;
  now?: Date;
};

const KIND_KEYS: Record<HouseNoteKind, MessageKey> = {
  breaker: "notes.kindBreaker",
  shutoff: "notes.kindShutoff",
  paint: "notes.kindPaint",
  other: "notes.kindOther",
};

export function houseNoteKindLabel(kind: HouseNoteKind, t: Translate): string {
  return t(KIND_KEYS[kind]);
}

function yearsOld(installDate: string | undefined, now: Date): number | null {
  if (!installDate) return null;
  const start = new Date(`${installDate}T00:00:00`);
  if (!Number.isFinite(start.getTime())) return null;
  const years = Math.floor((now.getTime() - start.getTime()) / (365.25 * 86_400_000));
  return years >= 0 ? years : null;
}

/**
 * Everything a house-sitter or cleaner would ask for, as plain text: house
 * notes, appliances, supplies kept on hand, and the regular chores. Built only
 * from what is already saved. No ids, no costs.
 */
export function buildHouseHandbook(household: Household, options: HandbookOptions): string {
  const { t, formatDate, frequencyLabel } = options;
  const now = options.now ?? new Date();
  const out: string[] = [];
  const name = household.householdName.trim() || t("handbook.homeFallback");
  out.push(t("handbook.title", { name }), "");

  const essentials: string[] = [];
  if (household.ownerName.trim()) essentials.push(t("handbook.owner", { name: household.ownerName.trim() }));
  if (household.cleanerName.trim()) essentials.push(t("handbook.cleaner", { name: household.cleanerName.trim() }));
  const place = [household.location.placeName, household.location.postalCode].filter(Boolean).join(" ");
  if (place) essentials.push(t("handbook.place", { place }));
  if (essentials.length > 0) out.push(t("handbook.essentials"), ...essentials, "");

  const notes = houseNotes(household);
  if (notes.length > 0) {
    out.push(t("handbook.notes"));
    for (const note of notes) {
      const roomId = noteRoomId(household, note);
      const where = roomId ? roomName(household, roomId) : t("notes.wholeHome");
      const heading = note.title || houseNoteKindLabel(note.kind, t);
      out.push(`${heading} (${where})`);
      if (note.body) out.push(...note.body.split("\n").map((line) => `  ${line}`));
    }
    out.push("");
  }

  const assets = household.assets;
  if (assets.length > 0) {
    out.push(t("handbook.appliances"));
    for (const asset of assets) {
      const parts = [`${asset.name} (${roomName(household, asset.roomId)})`];
      const years = yearsOld(asset.installDate, now);
      if (years !== null) {
        parts.push(
          years === 0 ? t("handbook.underYear") : years === 1 ? t("handbook.oneYear") : t("handbook.yearsOld", { count: years }),
        );
      }
      if (asset.notes?.trim()) parts.push(asset.notes.trim().replace(/\s*\n\s*/g, ", "));
      if (asset.warrantyUntil) parts.push(t("handbook.warranty", { date: formatDate(asset.warrantyUntil) }));
      out.push(`- ${parts.join(" · ")}`);
    }
    out.push("");
  }

  const supplies = household.supplyAutomations;
  if (supplies.length > 0) {
    out.push(t("handbook.supplies"));
    for (const item of supplies) {
      const parts = [item.itemName];
      if (item.sizeSpec) parts.push(item.sizeSpec);
      parts.push(t("handbook.onHand", { count: item.onHand }));
      out.push(`- ${parts.join(" · ")}`);
    }
    out.push("");
  }

  const chores = household.duties.filter((duty) => !duty.archived && duty.kind === "chore" && duty.frequency !== "once");
  if (chores.length > 0) {
    out.push(t("handbook.chores"));
    for (const duty of chores.slice(0, 40)) {
      out.push(`- ${duty.title} (${roomName(household, duty.nodeId || duty.room)}) · ${frequencyLabel(duty.frequency)}`);
    }
    out.push("");
  }

  if (out.length <= 2) out.push(t("handbook.empty"));
  return out.join("\n").trim();
}
