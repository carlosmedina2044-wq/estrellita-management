"use client";

import { useState } from "react";
import { ChevronRight, Plus, ScanText, Search } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SelectRow, SettingsGroup } from "@/components/settings-rows";
import { useLocale } from "@/i18n/locale-provider";
import { roomName, systemRoomList, userRooms } from "@/lib/home-model";
import {
  bodyFromScan,
  deleteHouseNote,
  guessKind,
  HOUSE_NOTE_KINDS,
  houseNoteKindLabel,
  noteRoomId,
  notesInRoom,
  saveHouseNote,
  searchHouseNotes,
  houseNotes,
} from "@/lib/house-notes";
import { hapticPress, hapticSuccess } from "@/lib/native/haptics";
import { readPhoto, scanAny } from "@/lib/native/scan";
import { shareText } from "@/lib/native/share";
import { buildHouseHandbook } from "@/lib/house-notes";
import type { HouseNote, HouseNoteKind, Household } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = { id?: string; roomId: string; title: string; body: string; kind: HouseNoteKind };
const NO_ROOM = "none";

/** The "House handbook" action, shared by the notes sheet and Settings. */
export function useHandbookShare(household: Household) {
  const { t, dateLocale } = useLocale();
  return async () => {
    const text = buildHouseHandbook(household, {
      t,
      formatDate: (iso) =>
        new Intl.DateTimeFormat(dateLocale, { month: "short", day: "numeric", year: "numeric" }).format(
          new Date(`${iso}T00:00:00`),
        ),
      frequencyLabel: (frequency) => t(`freq.${frequency === "once" ? "oneTime" : frequency}` as "freq.weekly"),
    });
    const title = t("handbook.shareTitle", { name: household.householdName.trim() || t("handbook.homeFallback") });
    const result = await shareText(title, text);
    if (result === "copied") toast(t("handbook.copied"));
    else if (result === "failed") toast.error(t("handbook.failed"));
  };
}

/**
 * Every house note in one sheet: search, add, edit, delete, share the handbook.
 * With `roomId` it shows only that room's notes and starts new ones in that room.
 */
export function HouseNotesSheet({
  open,
  onOpenChange,
  household,
  onApply,
  roomId,
  startAdding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  household: Household;
  onApply: (build: (current: Household) => Household) => void;
  roomId?: string;
  startAdding?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" size="form" className="gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        {open ? (
          <NotesBody
            household={household}
            onApply={onApply}
            roomId={roomId}
            startAdding={startAdding}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function NotesBody({
  household,
  onApply,
  roomId,
  startAdding,
  onClose,
}: {
  household: Household;
  onApply: (build: (current: Household) => Household) => void;
  roomId?: string;
  startAdding?: boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const blank: Draft = { roomId: roomId ?? NO_ROOM, title: "", body: "", kind: "other" };
  const [draft, setDraft] = useState<Draft | null>(startAdding ? blank : null);
  const share = useHandbookShare(household);

  const kindLabel = (kind: HouseNoteKind) => houseNoteKindLabel(kind, t);
  const found = searchHouseNotes(household, query, kindLabel).filter(
    (note) => !roomId || noteRoomId(household, note) === roomId,
  );
  const total = roomId ? notesInRoom(household, roomId).length : houseNotes(household).length;

  if (draft) {
    return (
      <NoteEditor
        household={household}
        draft={draft}
        setDraft={setDraft}
        onCancel={() => setDraft(null)}
        onSave={() => {
          onApply((current) =>
            saveHouseNote(current, {
              id: draft.id,
              roomId: draft.roomId === NO_ROOM ? undefined : draft.roomId,
              title: draft.title,
              body: draft.body,
              kind: draft.kind,
            }),
          );
          void hapticSuccess();
          setDraft(null);
        }}
        onDelete={
          draft.id
            ? () => {
                const id = draft.id as string;
                onApply((current) => deleteHouseNote(current, id));
                setDraft(null);
              }
            : undefined
        }
      />
    );
  }

  return (
    <>
      <SheetHeader className="shrink-0 pb-2">
        <SheetTitle className="ui-page-title text-[1.75rem] font-semibold leading-tight">
          {roomId ? t("notes.titleRoom", { room: roomName(household, roomId) }) : t("notes.title")}
        </SheetTitle>
      </SheetHeader>
      <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3">
        {total > 3 ? (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("notes.search")}
              aria-label={t("notes.search")}
              className="pl-9"
            />
          </div>
        ) : null}
        {total === 0 ? (
          <p className="rounded-[var(--r-container)] bg-secondary px-4 py-4 ui-body text-muted-foreground">
            {t("notes.empty")}
          </p>
        ) : found.length === 0 ? (
          <p className="px-1 py-2 ui-body text-muted-foreground">{t("notes.noMatch")}</p>
        ) : (
          <ul className="ui-group">
            {found.map((note) => (
              <li key={note.id} className="ui-group-row">
                <button
                  type="button"
                  className="flex min-h-14 w-full flex-col items-start gap-0.5 px-4 py-3 text-left active:bg-foreground/6"
                  onClick={() => {
                    void hapticPress();
                    setDraft({
                      id: note.id,
                      roomId: noteRoomId(household, note) ?? NO_ROOM,
                      title: note.title,
                      body: note.body,
                      kind: note.kind,
                    });
                  }}
                >
                  <span className="ui-body font-medium">{note.title || kindLabel(note.kind)}</span>
                  <span className="ui-caption text-muted-foreground">{noteWhere(household, note, kindLabel, t("notes.wholeHome"))}</span>
                  {note.body ? (
                    <span className="mt-0.5 line-clamp-2 whitespace-pre-line ui-caption text-muted-foreground">{note.body}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 px-4 pt-2">
        <Button
          type="button"
          className="h-12 rounded-full ui-body font-semibold"
          onClick={() => {
            void hapticPress();
            setDraft(blank);
          }}
        >
          <Plus className="size-4" aria-hidden />
          {t("notes.add")}
        </Button>
        {!roomId ? (
          <Button type="button" variant="ghost" className="h-11" onClick={() => void share()}>
            {t("notes.handbook")}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" className="h-11 text-muted-foreground" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
    </>
  );
}

function noteWhere(household: Household, note: HouseNote, kindLabel: (kind: HouseNoteKind) => string, whole: string) {
  const id = noteRoomId(household, note);
  return `${id ? roomName(household, id) : whole} · ${kindLabel(note.kind)}`;
}

function NoteEditor({
  household,
  draft,
  setDraft,
  onCancel,
  onSave,
  onDelete,
}: {
  household: Household;
  draft: Draft;
  setDraft: (next: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const { t } = useLocale();
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rooms = [...systemRoomList(household), ...userRooms(household)];
  const canSave = draft.title.trim() !== "" || draft.body.trim() !== "";

  async function scanIt() {
    setScanning(true);
    setScanNote(null);
    // Live camera first; if this iPhone cannot, a photo from the library. Either way
    // only the words come back, never the picture.
    let result = await scanAny();
    if (!result.ok && (result.reason === "unsupported" || result.reason === "unavailable")) {
      result = await readPhoto();
    }
    setScanning(false);
    if (!result.ok) {
      if (result.reason !== "cancelled") {
        setScanNote(result.reason === "denied" ? t("notes.scanDenied") : t("notes.scanUnavailable"));
      }
      return;
    }
    const text = bodyFromScan(result.lines);
    if (!text) {
      setScanNote(t("notes.scanNothing"));
      return;
    }
    const body = [draft.body.trim(), text].filter(Boolean).join("\n");
    setDraft({ ...draft, body, kind: draft.kind === "other" ? guessKind(result.lines) : draft.kind });
    void hapticSuccess();
  }

  return (
    <>
      <SheetHeader className="shrink-0 pb-2">
        <SheetTitle className="ui-page-title text-[1.75rem] font-semibold leading-tight">{draft.id ? t("notes.edit") : t("notes.new")}</SheetTitle>
      </SheetHeader>
      <div data-keyboard-scroll className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("notes.kind")}>
          {HOUSE_NOTE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={draft.kind === kind}
              className={cn(
                "h-11 rounded-full px-3.5 ui-caption font-medium",
                draft.kind === kind ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
              )}
              onClick={() => setDraft({ ...draft, kind })}
            >
              {houseNoteKindLabel(kind, t)}
            </button>
          ))}
        </div>
        <SettingsGroup>
          <SelectRow
            label={t("notes.room")}
            value={draft.roomId}
            display={draft.roomId === NO_ROOM ? t("notes.wholeHome") : roomName(household, draft.roomId)}
            onValueChange={(value) => setDraft({ ...draft, roomId: value })}
          >
            <SelectContent>
              <SelectItem value={NO_ROOM}>{t("notes.wholeHome")}</SelectItem>
              {rooms
                .filter((room) => !room.system)
                .map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {roomName(household, room.id)}
                  </SelectItem>
                ))}
            </SelectContent>
          </SelectRow>
        </SettingsGroup>
        <Input
          value={draft.title}
          maxLength={80}
          placeholder={t("notes.titlePlaceholder")}
          aria-label={t("notes.titleLabel")}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <Textarea
          value={draft.body}
          maxLength={2000}
          rows={6}
          placeholder={t("notes.bodyPlaceholder")}
          aria-label={t("notes.bodyLabel")}
          className="min-h-32 rounded-2xl px-4 py-3 ui-body"
          onChange={(event) => setDraft({ ...draft, body: event.target.value })}
        />
        <Button type="button" variant="ghost" className="h-11 w-fit px-0 text-primary" disabled={scanning} onClick={() => void scanIt()}>
          <ScanText className="size-4" aria-hidden />
          {scanning ? t("notes.scanning") : t("notes.scanIt")}
        </Button>
        {scanNote ? (
          <p role="status" className="ui-caption text-muted-foreground">
            {scanNote}
          </p>
        ) : null}
        {onDelete ? (
          <Button type="button" variant="ghost" className="h-11 w-fit px-0 text-destructive" onClick={() => setConfirmDelete(true)}>
            {t("notes.delete")}
          </Button>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-2 px-4 pt-2">
        <Button type="button" className="h-12 rounded-full ui-body font-semibold" disabled={!canSave} onClick={onSave}>
          {t("notes.save")}
        </Button>
        <Button type="button" variant="ghost" className="h-11 text-muted-foreground" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("notes.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("notes.deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-primary-foreground" onClick={onDelete}>
              {t("notes.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** A quiet row on Home that opens every house note, with a search field. */
export function HouseNotesEntry({
  household,
  onApply,
}: {
  household: Household;
  onApply: (build: (current: Household) => Household) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const count = houseNotes(household).length;
  return (
    <>
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--r-container)] bg-secondary px-4 ui-body font-medium"
        onClick={() => {
          void hapticPress();
          setOpen(true);
        }}
      >
        <span>{t("notes.homeEntry")}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {count > 0 ? <span className="num">{count}</span> : null}
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </button>
      <HouseNotesSheet open={open} onOpenChange={setOpen} household={household} onApply={onApply} />
    </>
  );
}
