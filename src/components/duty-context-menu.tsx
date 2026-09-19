"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { useLocale } from "@/i18n/locale-provider";
import { SPRING_SETTLE } from "@/lib/motion";
import { hapticPress } from "@/lib/native/haptics";
import { cn } from "@/lib/utils";

export type DutyMenuAction = "complete" | "snooze" | "edit" | "delete";

/** Four 44px rows plus the 4px of vertical padding. */
const MENU_HEIGHT_PX = 184;
/** `4.5rem` — the tab bar's own height, before its safe-area padding. */
const TAB_BAR_FALLBACK_PX = 72;

export function DutyContextMenu({
  open,
  x,
  y,
  title,
  onAction,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  title: string;
  onAction: (action: DutyMenuAction) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Focus moved in here on open and was never handed back, leaving a
    // keyboard or VoiceOver user at the top of the document after a dismiss.
    const opener = document.activeElement;
    returnFocusRef.current = opener instanceof HTMLElement ? opener : null;
    const menuItems = () =>
      Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    menuItems()[0]?.focus();
    // The long press already buzzed on the way in; this is the menu itself
    // arriving, which had been silent and instant.
    void hapticPress();
    function onPointerDown(event: PointerEvent) {
      if (ref.current?.contains(event.target as Node)) return;
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const items = menuItems();
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = current < 0 ? 0 : (current + delta + items.length) % items.length;
      items[next]?.focus();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      const back = returnFocusRef.current;
      returnFocusRef.current = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  const items: { id: DutyMenuAction; label: string; danger?: boolean }[] = [
    { id: "complete", label: t("chore.complete") },
    { id: "snooze", label: t("chore.snoozeWeek") },
    { id: "edit", label: t("common.edit") },
    { id: "delete", label: t("common.delete"), danger: true },
  ];

  if (typeof document === "undefined") return null;

  const maxX = window.innerWidth - 12;
  // The clamp used to run to the bottom of the window, which put "Edit" and
  // "Delete" under the tab bar for any row near the end of the Today list.
  const tabBar = document.querySelector(".app-tab-bar");
  const tabBarHeight = tabBar ? tabBar.getBoundingClientRect().height : TAB_BAR_FALLBACK_PX;
  const maxY = window.innerHeight - tabBarHeight - 12;
  const left = Math.min(Math.max(12, x), maxX - 180);
  const top = Math.max(12, Math.min(y, maxY - MENU_HEIGHT_PX));

  // `.app-shell-roots` carries `will-change: transform`, which makes it both
  // the containing block and a stacking context with `z-index: auto` — so a
  // `fixed z-[60]` menu rendered inside it still painted *under* the later
  // sibling tab bar. Portalled to the body, as the Radix sheets are.
  return createPortal(
    <motion.div
      ref={ref}
      role="menu"
      aria-label={t("chore.menuAria", { title })}
      className="fixed z-[60] min-w-44 overflow-hidden rounded-xl bg-popover py-1 shadow-lg ring-1 ring-foreground/10"
      // Grows out of the row it was pressed on rather than appearing. The
      // origin is the corner nearest the finger, so the menu looks like it
      // came from the press rather than from the middle of the screen.
      style={{ left, top, originX: x > left + 90 ? 1 : 0, originY: y > top + 100 ? 1 : 0 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_SETTLE}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={cn(
            "flex min-h-11 w-full items-center px-4 text-left ui-body active:bg-foreground/6",
            item.danger ? "text-destructive" : "text-foreground",
          )}
          onClick={() => {
            onAction(item.id);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </motion.div>,
    document.body,
  );
}
