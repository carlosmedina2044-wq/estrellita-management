"use client";

import { RESTOCK_WALK_CATALOG, type RestockPick } from "@/lib/onboarding/restock-walk";
import { cn } from "@/lib/utils";

export function RestockWalkPicker({
  picks,
  onChange,
}: {
  picks: RestockPick[];
  onChange: (picks: RestockPick[]) => void;
}) {
  function selected(id: string) {
    return picks.find((item) => item.id === id);
  }

  function toggle(id: string) {
    const current = selected(id);
    if (current) onChange(picks.filter((item) => item.id !== id));
    else onChange([...picks, { id }]);
  }

  function setVariant(id: string, variant: string) {
    const rest = picks.filter((item) => item.id !== id);
    onChange([...rest, { id, variant }]);
  }

  return (
    <div className="grid gap-2">
      {RESTOCK_WALK_CATALOG.map((item) => {
        const pick = selected(item.id);
        return (
          <div key={item.id} className="rounded-2xl bg-card px-3 py-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={Boolean(pick)}
                onChange={() => toggle(item.id)}
                className="mt-1 size-5 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-medium">{item.itemName}</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">{item.hint}</span>
              </span>
            </label>
            {pick && item.variants ? (
              <div className="mt-2 flex flex-wrap gap-1.5 pl-8">
                {item.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className={cn(
                      "h-8 rounded-full px-3 text-[13px] font-medium",
                      pick.variant === variant.label ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                    onClick={() => setVariant(item.id, variant.label)}
                  >
                    {variant.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
