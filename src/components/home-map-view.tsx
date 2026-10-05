"use client";

import { ChevronRight, Package } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { RollingNumber } from "@/components/today/rolling-number";
import { DUR_QUICK, EASE_OUT, STAGGER_CHILD } from "@/lib/motion";
import type { MessageKey } from "@/i18n";
import { tActive } from "@/i18n";
import { useLocale } from "@/i18n/locale-provider";
import { RoomTypeIcon } from "@/components/room-type-icon";
import { ScanLabelSheet } from "@/components/scan-label-sheet";
import { shouldOfferScan } from "@/lib/scan/add-from-label";
import { markTipSeen, TIP_SCAN_PROMPT } from "@/lib/teaching";
import { useState } from "react";
import { floorsInOrder, roomsOnFloor, systemRoomList } from "@/lib/home-model";
import { nodeStatus, type NodeStatus } from "@/lib/node-status";
import type { Completion, HomeRoom, Household } from "@/lib/types";
import { relativeDayLabel } from "@/lib/duties";
import { cn } from "@/lib/utils";

type RoomEntry = { room: HomeRoom; status: NodeStatus; nearReplacement: boolean; left: number };

/** Chores left in a room (see roomLeftDuties). Reorders and replacements are
 * noted under the name but never added to this count. */
function leftIn(status: NodeStatus): number {
  return status.total;
}

function roomHasExtras(entry: RoomEntry): boolean {
  return entry.status.reorderPending > 0 || entry.nearReplacement;
}

/** The sentence for `key`, with its one changing number set to roll. Under
 * Reduce Motion the number component is a plain figure, so nothing else
 * needs to know. */
function SentenceWithNumber({
  id,
  name,
  value,
  params,
}: {
  id: MessageKey;
  name: string;
  value: number;
  params?: Record<string, string | number>;
}) {
  const { t } = useLocale();
  const marker = "\u0001";
  const [before = "", after = ""] = t(id, { ...params, [name]: marker }).split(marker);
  return (
    <>
      {before}
      <RollingNumber value={value} />
      {after}
    </>
  );
}

/** Rows past this many arrive with the rest: a long stagger is a delay. */
const STAGGER_ROWS = 8;

/**
 * Every room in one group, ordered by what is left: overdue first, then the
 * rooms with the most waiting, finished rooms last. Within a tie the home's own
 * order (whole home, then floor by floor) is kept.
 */
export function HomeMapView({
  household,
  now,
  selectedId,
  replacementRooms,
  onSelectRoom,
  onApply,
  openScan,
}: {
  household: Household;
  now: Date;
  selectedId?: string | null;
  replacementRooms?: Set<string>;
  onSelectRoom: (roomId: string) => void;
  /** Present on the real Home: lets the one-time "scan a label" card save. */
  onApply?: (build: (current: Household) => Household) => void;
  /** A new object each time the `cuidala://scan` link asks for the scan sheet. */
  openScan?: object | null;
  /** Kept so callers need not change; the list is ordered by need, not by hand. */
  onReorder?: (floorId: string | null, orderedIds: string[]) => void;
}) {
  const { t } = useLocale();
  const [scanOpen, setScanOpen] = useState(false);
  // Open once per request from the `cuidala://scan` link (adjusting state while rendering, not in an effect).
  const [handledScan, setHandledScan] = useState<object | null>(null);
  if (openScan && openScan !== handledScan) {
    setHandledScan(openScan);
    if (onApply) setScanOpen(true);
  }
  const offerScan = Boolean(onApply) && shouldOfferScan(household);
  const seen = new Set<string>();
  const ordered: HomeRoom[] = [];
  const push = (room: HomeRoom) => {
    if (seen.has(room.id)) return;
    seen.add(room.id);
    ordered.push(room);
  };
  systemRoomList(household).forEach(push);
  floorsInOrder(household).forEach((floor) => roomsOnFloor(household, floor.id).forEach(push));
  household.rooms.filter((room) => !room.system).forEach(push);

  const entries: RoomEntry[] = ordered
    .map((room) => {
      const status = nodeStatus(household, room.id, "room", now);
      const nearReplacement = Boolean(replacementRooms?.has(room.id));
      return { room, status, nearReplacement, left: leftIn(status) };
    })
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const overdue = (b.entry.status.overdue > 0 ? 1 : 0) - (a.entry.status.overdue > 0 ? 1 : 0);
      if (overdue !== 0) return overdue;
      const left = b.entry.left + (roomHasExtras(b.entry) ? 0.5 : 0) - (a.entry.left + (roomHasExtras(a.entry) ? 0.5 : 0));
      return left !== 0 ? left : a.index - b.index;
    })
    .map(({ entry }) => entry);

  const done = entries.filter((entry) => entry.left === 0 && !roomHasExtras(entry)).length;

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
        <h2 className="ui-heading ui-card font-semibold">{t("map.rooms")}</h2>
        {entries.length > 0 ? (
          <p className="ui-caption num text-muted-foreground">
            {done === entries.length ? (
              t("map.roomsEvery")
            ) : (
              <SentenceWithNumber id="map.roomsAllDone" name="done" value={done} params={{ total: entries.length }} />
            )}
          </p>
        ) : null}
      </div>
      {offerScan && onApply ? (
        <div className="mb-3 rounded-[var(--r-container)] bg-secondary px-4 py-3">
          <p className="ui-body text-foreground">{t("scan.cardBody")}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-4">
            <button
              type="button"
              className="inline-flex min-h-11 items-center ui-body font-semibold text-primary"
              onClick={() => setScanOpen(true)}
            >
              {t("scan.cardScan")}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center ui-body text-muted-foreground"
              onClick={() => onApply((current) => markTipSeen(current, TIP_SCAN_PROMPT))}
            >
              {t("scan.cardDismiss")}
            </button>
          </div>
        </div>
      ) : null}
      {entries.length === 0 ? (
        <p className="rounded-[var(--r-container)] bg-card px-4 py-6 text-center ui-body text-muted-foreground">
          {t("map.noRoomsOnFloor")}
        </p>
      ) : (
        <div className="ui-group">
          {entries.map((entry, index) => (
            <RoomRow
              key={entry.room.id}
              entry={entry}
              index={index}
              selected={selectedId === entry.room.id}
              onSelect={() => onSelectRoom(entry.room.id)}
            />
          ))}
        </div>
      )}
      {onApply ? <ScanLabelSheet open={scanOpen} onOpenChange={setScanOpen} household={household} onApply={onApply} /> : null}
    </section>
  );
}

/** One line under a room's name, used by the room sheet's heading. */
export function roomCaption(
  status: NodeStatus,
  nearReplacement: boolean,
  left: number,
  lastDone: Completion | null,
  now: Date,
) {
  if (status.overdue > 0) {
    return { text: tActive("map.overdueCount", { count: status.overdue }), className: "text-overdue" };
  }
  if (left > 0) {
    return { text: tActive("map.leftCount", { count: left }), className: "text-muted-foreground" };
  }
  if (status.reorderPending > 0) {
    return { text: tActive("map.reorderCount", { count: status.reorderPending }), className: "text-muted-foreground" };
  }
  if (nearReplacement) {
    return { text: tActive("home.replacementSoon"), className: "text-muted-foreground" };
  }
  if (lastDone) {
    return {
      text: `${tActive("map.roomAllDone")} · ${tActive("map.lastDone", {
        when: relativeDayLabel(new Date(lastDone.completedAt), now),
      })}`,
      className: "text-done",
    };
  }
  return { text: tActive("map.roomAllDone"), className: "text-done" };
}

function RoomRow({
  entry,
  index,
  selected,
  onSelect,
}: {
  entry: RoomEntry;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useLocale();
  const { room, status, nearReplacement, left } = entry;
  const finished = left === 0 && !roomHasExtras(entry);
  const late = status.overdue > 0;
  // Once per visit (the shell remounts the list when the tab is opened): a
  // short rise, in order, then still. Skipped entirely under Reduce Motion.
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR_QUICK, ease: EASE_OUT, delay: Math.min(index, STAGGER_ROWS) * STAGGER_CHILD * 0.6 }}
      className={cn(
        "ui-group-row flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-left transition-colors active:bg-foreground/6",
        selected && "bg-foreground/5",
      )}
    >
      <RoomTypeIcon
        room={room}
        className={cn("size-6 shrink-0", finished ? "text-muted-foreground/50" : "text-muted-foreground")}
      />
      <span className="min-w-[7rem] flex-1 break-words">
        <span className={cn("block ui-body font-medium", finished && "text-muted-foreground")}>{room.system === "whole-home" ? t("map.wholeHome") : room.system === "exterior" ? t("content.room.exterior") : room.name}</span>
        {late ? (
          <span className="block ui-caption font-medium text-overdue">
            {t("map.overdueCount", { count: status.overdue })}
          </span>
        ) : status.reorderPending > 0 ? (
          <span className="flex items-center gap-1 ui-caption text-muted-foreground">
            <Package className="size-3.5" aria-hidden />
            {t("home.toReorderCount", { count: status.reorderPending })}
          </span>
        ) : nearReplacement ? (
          <span className="block ui-caption text-muted-foreground">{t("home.replacementSoon")}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "ml-auto text-right ui-caption num",
          finished ? "text-muted-foreground/70" : "font-semibold",
          late ? "text-overdue" : !finished && "text-foreground",
        )}
      >
        {finished ? (
          t("map.roomAllDone")
        ) : left > 0 ? (
          <SentenceWithNumber id="map.leftCount" name="count" value={left} />
        ) : (
          ""
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
    </motion.button>
  );
}
