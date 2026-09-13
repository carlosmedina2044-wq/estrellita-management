"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type DutyMenuAction = "complete" | "snooze" | "edit" | "delete";

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

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current?.contains(event.target as Node)) return;
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const items: { id: DutyMenuAction; label: string; danger?: boolean }[] = [
    { id: "complete", label: t("chore.complete") },
    { id: "snooze", label: t("chore.snoozeWeek") },
    { id: "edit", label: t("common.edit") },
    { id: "delete", label: t("common.delete"), danger: true },
  ];

  const maxX = typeof window !== "undefined" ? window.innerWidth - 12 : x;
  const maxY = typeof window !== "undefined" ? window.innerHeight - 12 : y;
  const left = Math.min(Math.max(12, x), maxX - 180);
  const top = Math.min(Math.max(12, y), maxY - 200);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={t("chore.menuAria", { title })}
      className="fixed z-[60] min-w-44 overflow-hidden rounded-xl bg-popover py-1 shadow-lg ring-1 ring-foreground/10"
      style={{ left, top }}
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
    </div>
  );
}
