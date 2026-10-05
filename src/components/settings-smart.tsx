"use client";

import { useState } from "react";
import { AiInviteCard } from "@/components/ai-invite-card";
import { HouseNotesSheet, useHandbookShare } from "@/components/house-notes-sheet";
import { NavRow, RowText, SettingsGroup, SettingsRow, SettingsSection } from "@/components/settings-rows";
import { useAiAvailability } from "@/hooks/use-ai-availability";
import { useLocale } from "@/i18n/locale-provider";
import { houseNoteKindLabel, houseNotes, noteRoomId } from "@/lib/house-notes";
import { roomName } from "@/lib/home-model";
import type { Household } from "@/lib/types";

/** The live state of Smart reading, in words. Gone entirely on phones that cannot do it. */
export function SmartReadingSection() {
  const { t } = useLocale();
  const { state } = useAiAvailability();
  if (state === "unknown" || state === "unavailable") return null;
  const value =
    state === "available" ? t("ai.stateOn") : state === "modelNotReady" ? t("ai.stateReady") : t("ai.stateOff");
  return (
    <SettingsSection>
      <SettingsGroup>
        <SettingsRow className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <RowText
            title={t("ai.settingsTitle")}
            help={state === "available" ? t("ai.settingsOnHelp") : undefined}
          />
          <span className="ml-auto ui-body text-muted-foreground">{value}</span>
        </SettingsRow>
      </SettingsGroup>
      {state !== "available" ? <AiInviteCard context="settings" /> : null}
    </SettingsSection>
  );
}

const SHOWN = 4;

/** Every house note: the first few here, all of them (with search) in the sheet. */
export function HouseNotesSection({
  household,
  onChange,
}: {
  household: Household;
  onChange: (next: Household) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const share = useHandbookShare(household);
  const notes = houseNotes(household);
  return (
    <SettingsSection title={t("notes.title")}>
      <SettingsGroup>
        {notes.slice(0, SHOWN).map((note) => {
          const id = noteRoomId(household, note);
          return (
            <NavRow
              key={note.id}
              title={note.title || houseNoteKindLabel(note.kind, t)}
              help={`${id ? roomName(household, id) : t("notes.wholeHome")} · ${houseNoteKindLabel(note.kind, t)}`}
              onClick={() => {
                setAdding(false);
                setOpen(true);
              }}
            />
          );
        })}
        {notes.length > SHOWN ? (
          <NavRow
            title={t("notes.seeAll", { count: notes.length })}
            onClick={() => {
              setAdding(false);
              setOpen(true);
            }}
          />
        ) : null}
        <NavRow
          title={t("notes.add")}
          onClick={() => {
            setAdding(true);
            setOpen(true);
          }}
        />
        <NavRow title={t("notes.handbook")} onClick={() => void share()} />
      </SettingsGroup>
      <HouseNotesSheet
        key={adding ? "add" : "list"}
        open={open}
        onOpenChange={setOpen}
        household={household}
        startAdding={adding}
        onApply={(build) => onChange(build(household))}
      />
    </SettingsSection>
  );
}
