"use client";

import { useState } from "react";
import {
  RESTOCK_WALK_GROUPS,
  catalogItemForSupply,
  isCustomRestockPick,
  visibleWalkItems,
  type CustomRestockPick,
  type RestockPick,
  type RestockWalkContext,
  type RestockWalkGroup,
} from "@/lib/onboarding/restock-walk";
import { cn } from "@/lib/utils";

export function RestockWalkPicker({
  picks,
  onChange,
  context,
  trackedNames = [],
  sizeWarning = false,
  onSkipSizes,
  onAddCustom,
  onEditCustom,
}: {
  picks: RestockPick[];
  onChange: (picks: RestockPick[]) => void;
  context: RestockWalkContext;
  trackedNames?: string[];
  sizeWarning?: boolean;
  onSkipSizes?: () => void;
  onAddCustom?: (group: RestockWalkGroup) => void;
  onEditCustom?: (pick: CustomRestockPick) => void;
}) {
  const [typingId, setTypingId] = useState<string | null>(null);
  const visible = visibleWalkItems(context);
  const missing = sizeWarning
    ? picks.flatMap((pick) => {
        if (isCustomRestockPick(pick)) return [];
        const item = visible.find((entry) => entry.id === pick.id);
        if (!item?.variants?.length || pick.variant?.trim()) return [];
        return [item.itemName];
      })
    : [];

  function catalogPick(id: string) {
    const pick = picks.find((item) => item.id === id);
    if (!pick || isCustomRestockPick(pick)) return undefined;
    return pick;
  }

  function isTracked(itemName: string) {
    const needle = itemName.toLowerCase();
    return trackedNames.some((name) => catalogItemForSupply({ itemName: name })?.itemName.toLowerCase() === needle);
  }

  function toggle(id: string) {
    const current = picks.find((item) => item.id === id);
    if (current) {
      if (typingId === id) setTypingId(null);
      onChange(picks.filter((item) => item.id !== id));
      return;
    }
    onChange([...picks, { id }]);
  }

  function setVariant(id: string, variant: string) {
    const rest = picks.filter((item) => item.id !== id);
    onChange([...rest, { id, variant }]);
  }

  return (
    <div className="grid gap-5">
      {missing.length > 0 ? (
        <div className="rounded-2xl bg-secondary px-3 py-3">
          <p className="text-[15px] font-medium">Sizes to confirm: {missing.join(", ")}</p>
          {onSkipSizes ? (
            <button type="button" className="mt-2 text-[13px] font-medium text-brand" onClick={onSkipSizes}>
              Skip for now
            </button>
          ) : null}
        </div>
      ) : null}

      {RESTOCK_WALK_GROUPS.map((group) => {
        const items = visible.filter((item) => item.group === group.id);
        const custom = picks.filter(
          (pick): pick is CustomRestockPick => isCustomRestockPick(pick) && pick.custom.group === group.id,
        );
        if (items.length === 0 && custom.length === 0 && !onAddCustom && group.id !== "bath") return null;
        return (
          <section key={group.id}>
            <h2 className="mb-2 px-1 text-[13px] font-medium text-muted-foreground">{group.label}</h2>
            <div className="grid gap-2">
              {items.map((item) => {
                const pick = catalogPick(item.id);
                const tracked = isTracked(item.itemName);
                const chipLabels = item.variants?.map((variant) => variant.label) ?? [];
                const typed = Boolean(pick?.variant && !chipLabels.includes(pick.variant));
                const typing = typingId === item.id || typed;
                return (
                  <div key={item.id} className="rounded-2xl bg-card px-3 py-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(pick) || tracked}
                        disabled={tracked}
                        onChange={() => toggle(item.id)}
                        className="mt-1 size-5 accent-primary disabled:opacity-60"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] font-medium">{item.itemName}</span>
                        <span className="mt-0.5 block text-[13px] text-muted-foreground">
                          {tracked ? "Tracking" : item.hint}
                        </span>
                      </span>
                    </label>
                    {pick && !tracked && item.variants ? (
                      <div className="mt-2 pl-8">
                        <div className="flex flex-wrap gap-1.5">
                          {item.variants.map((variant) => (
                            <button
                              key={variant.id}
                              type="button"
                              className={cn(
                                "h-8 rounded-full px-3 text-[13px] font-medium",
                                pick.variant === variant.label ? "bg-primary text-primary-foreground" : "bg-secondary",
                              )}
                              onClick={() => {
                                setTypingId(null);
                                setVariant(item.id, variant.label);
                              }}
                            >
                              {variant.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={cn(
                              "h-8 rounded-full px-3 text-[13px] font-medium",
                              typing ? "bg-primary text-primary-foreground" : "bg-secondary",
                            )}
                            onClick={() => {
                              setTypingId(item.id);
                              if (!typed) setVariant(item.id, "");
                            }}
                          >
                            Type it
                          </button>
                        </div>
                        {typing ? (
                          <input
                            value={typed ? pick.variant : ""}
                            onChange={(event) => setVariant(item.id, event.target.value)}
                            placeholder="20×20×1"
                            inputMode="text"
                            aria-label={`${item.itemName} size`}
                            className="mt-2 h-11 w-full rounded-xl bg-secondary px-3 text-[15px]"
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {custom.map((pick) => (
                <div key={pick.id} className="rounded-2xl bg-card px-3 py-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggle(pick.id)}
                      className="mt-1 size-5 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-medium">{pick.custom.itemName}</span>
                      {pick.custom.sku ? (
                        <span className="mt-0.5 block text-[13px] text-muted-foreground">{pick.custom.sku}</span>
                      ) : null}
                    </span>
                  </label>
                  {onEditCustom ? (
                    <button
                      type="button"
                      className="mt-2 pl-8 text-[13px] font-medium text-brand"
                      onClick={() => onEditCustom(pick)}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
              ))}
              {onAddCustom ? (
                <button
                  type="button"
                  className="rounded-2xl border border-dashed border-border px-3 py-3 text-left text-[15px] font-medium text-brand"
                  onClick={() => onAddCustom(group.id)}
                >
                  + Add something you buy for the {group.label.toLowerCase()}
                </button>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
